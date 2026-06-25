#!/usr/bin/env python3
"""
BStock Analytics - Motor de analisis
Solo usa lotes CERRADO con precio real de cierre.
"""
import sqlite3, json, os
from datetime import datetime
from config import DB_PATH

GRADOS_VALIDOS = {'A+(T)', 'AA+(T)', 'A(T)', 'B+(T)'}

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _enriquecer_capacidad(conn, rows):
    """Para lotes MIXTO reemplaza 'MIXTO:...' con '128GB(11) / 256GB(8)' desde lote_items."""
    ids = [r['listing_id'] for r in rows if r['listing_id']]
    if not ids:
        return [dict(r) for r in rows]
    ph = ','.join('?' * len(ids))
    items_map = {}
    for row in conn.execute(f"""
        SELECT listing_id, capacidad, SUM(cantidad) as cantidad
        FROM lote_items WHERE listing_id IN ({ph})
        GROUP BY listing_id, capacidad ORDER BY listing_id, cantidad DESC
    """, ids).fetchall():
        lid = row['listing_id']
        if lid not in items_map:
            items_map[lid] = []
        if row['capacidad'] and row['capacidad'] not in ('N/A', ''):
            items_map[lid].append(f"{row['capacidad']}({row['cantidad']})")
    result = []
    for r in rows:
        d = dict(r)
        lid = d.get('listing_id') or ''
        if (d.get('capacidad') or '').startswith('MIXTO') and lid in items_map and items_map[lid]:
            d['capacidad'] = ' / '.join(items_map[lid])
        result.append(d)
    return result


def ultima_subasta():
    """Resumen de la subasta mas reciente — solo lotes CERRADO."""
    with get_conn() as conn:
        ultima_fecha = conn.execute(
            "SELECT MAX(capturado_en) FROM subastas WHERE estado='CERRADO'"
        ).fetchone()[0]
        if not ultima_fecha:
            return {}

        fecha_sub = conn.execute(
            "SELECT MAX(fecha_subasta) FROM subastas WHERE estado='CERRADO'"
        ).fetchone()[0]

        stats = conn.execute("""
            SELECT COUNT(*) as total,
                   AVG(precio_unitario_promedio) as precio_prom,
                   MAX(precio_unitario_promedio) as precio_max,
                   MIN(precio_unitario_promedio) as precio_min,
                   SUM(precio_total) as valor_total,
                   SUM(cantidad_total) as unidades_total,
                   dia_semana, fecha_subasta
            FROM subastas
            WHERE fecha_subasta = ? AND estado = 'CERRADO'
        """, (fecha_sub,)).fetchone()

        # Cuantos lotes siguen ACTIVO en esa fecha (re-listados)
        abiertos = conn.execute(
            "SELECT COUNT(*) FROM subastas WHERE fecha_subasta >= ? AND estado='ACTIVO'",
            (fecha_sub,)
        ).fetchone()[0]

        # Top 10 mejores precios/u
        mejores = conn.execute("""
            SELECT listing_id, modelo, capacidad, grado, precio_unitario_promedio,
                   cantidad_total, numero_pujas
            FROM subastas
            WHERE fecha_subasta = ? AND estado='CERRADO' AND precio_unitario_promedio > 0
            ORDER BY precio_unitario_promedio ASC LIMIT 10
        """, (fecha_sub,)).fetchall()

        # Top 10 mas pujados
        mas_pujados = conn.execute("""
            SELECT listing_id, modelo, capacidad, grado, precio_unitario_promedio,
                   cantidad_total, numero_pujas
            FROM subastas
            WHERE fecha_subasta = ? AND estado='CERRADO' AND numero_pujas > 0
            ORDER BY numero_pujas DESC LIMIT 10
        """, (fecha_sub,)).fetchall()

        # Todos los lotes cerrados de la subasta para comparar vs historico
        todos_lotes = conn.execute("""
            SELECT listing_id, modelo, capacidad, grado, precio_unitario_promedio,
                   cantidad_total, numero_pujas
            FROM subastas
            WHERE fecha_subasta = ? AND estado='CERRADO' AND precio_unitario_promedio > 0
        """, (fecha_sub,)).fetchall()

        # Historico de precios (subastas anteriores, NO la fecha actual)
        hist_rows = conn.execute("""
            SELECT modelo, capacidad, grado,
                   AVG(precio_unitario_promedio) as hist_avg,
                   COUNT(*) as n
            FROM subastas
            WHERE estado='CERRADO' AND precio_unitario_promedio > 0
              AND fecha_subasta < ?
              AND capacidad NOT LIKE 'MIXTO%'
            GROUP BY modelo, capacidad, grado
            HAVING n >= 1
        """, (fecha_sub,)).fetchall()
        hist_map = {(r['modelo'], r['capacidad'], r['grado']): r['hist_avg'] for r in hist_rows}

        # Distribucion de precios por modelo (top 10 por valor total)
        por_modelo = conn.execute("""
            SELECT modelo, COUNT(*) as lotes,
                   AVG(precio_unitario_promedio) as precio_prom,
                   SUM(precio_total) as valor_total,
                   SUM(cantidad_total) as unidades
            FROM subastas
            WHERE fecha_subasta = ? AND estado='CERRADO'
            GROUP BY modelo ORDER BY valor_total DESC LIMIT 10
        """, (fecha_sub,)).fetchall()

        mejores_e = _enriquecer_capacidad(conn, mejores)
        pujados_e = _enriquecer_capacidad(conn, mas_pujados)

        # Lotes que subieron mas vs su promedio historico
        subieron = []
        for r in todos_lotes:
            key = (r['modelo'], r['capacidad'], r['grado'])
            hist_avg = hist_map.get(key)
            if not hist_avg:
                continue
            precio = r['precio_unitario_promedio']
            pct = (precio - hist_avg) / hist_avg * 100
            if pct >= 5:
                d = dict(r)
                d['hist_avg'] = round(hist_avg, 2)
                d['subio_pct'] = round(pct, 1)
                subieron.append(d)
        subieron.sort(key=lambda x: -x['subio_pct'])
        subieron_e     = _enriquecer_capacidad(conn, subieron[:10])
        subieron_todos = _enriquecer_capacidad(conn, subieron)

    return {
        'capturado_en':   ultima_fecha,
        'fecha_subasta':  fecha_sub,
        'dia_semana':     stats['dia_semana'],
        'total_cerrados': stats['total'] or 0,
        'abiertos':       abiertos or 0,
        'precio_prom':    round(stats['precio_prom'] or 0, 2),
        'precio_max':     round(stats['precio_max'] or 0, 2),
        'precio_min':     round(stats['precio_min'] or 0, 2),
        'valor_total':    round(stats['valor_total'] or 0, 2),
        'unidades_total': stats['unidades_total'] or 0,
        'mejores':        mejores_e,
        'mas_pujados':    pujados_e,
        'subieron_vs_hist': subieron_e,
        'subieron_todos':   subieron_todos,
        'por_modelo':     [dict(r) for r in por_modelo],
    }


def referencia_precios():
    """
    Tabla de referencia historica: modelo + capacidad + grado.
    Precio promedio, minimo, maximo y cantidad de subastas observadas.
    Solo lotes CERRADO.
    """
    with get_conn() as conn:
        # Lotes capacidad unica
        r1 = conn.execute("""
            SELECT modelo, capacidad, grado,
                   ROUND(AVG(precio_unitario_promedio), 2) as precio_prom,
                   ROUND(MIN(precio_unitario_promedio), 2) as precio_min,
                   ROUND(MAX(precio_unitario_promedio), 2) as precio_max,
                   COUNT(*) as num_subastas,
                   SUM(cantidad_total) as total_unidades,
                   ROUND(AVG(numero_pujas), 1) as pujas_prom,
                   MAX(fecha_subasta) as ultima_vez
            FROM subastas
            WHERE estado='CERRADO' AND precio_unitario_promedio > 0
              AND capacidad NOT LIKE 'MIXTO%' AND capacidad != 'N/A'
            GROUP BY modelo, capacidad, grado
        """).fetchall()

        # Lotes MIXTO desde lote_items
        r2 = conn.execute("""
            SELECT s.modelo, li.capacidad, s.grado,
                   ROUND(AVG(li.precio_unitario_estimado), 2) as precio_prom,
                   ROUND(MIN(li.precio_unitario_estimado), 2) as precio_min,
                   ROUND(MAX(li.precio_unitario_estimado), 2) as precio_max,
                   COUNT(DISTINCT s.listing_id) as num_subastas,
                   SUM(li.cantidad) as total_unidades,
                   ROUND(AVG(s.numero_pujas), 1) as pujas_prom,
                   MAX(s.fecha_subasta) as ultima_vez
            FROM subastas s
            JOIN lote_items li ON li.listing_id = s.listing_id
            WHERE s.estado='CERRADO' AND li.precio_unitario_estimado > 0
              AND s.capacidad LIKE 'MIXTO%'
              AND li.capacidad NOT IN ('N/A','') AND li.capacidad NOT LIKE 'MIXTO%'
            GROUP BY s.modelo, li.capacidad, s.grado
        """).fetchall()

        # N/A capacidad
        r3 = conn.execute("""
            SELECT modelo, 'N/A' as capacidad, grado,
                   ROUND(AVG(precio_unitario_promedio), 2) as precio_prom,
                   ROUND(MIN(precio_unitario_promedio), 2) as precio_min,
                   ROUND(MAX(precio_unitario_promedio), 2) as precio_max,
                   COUNT(*) as num_subastas,
                   SUM(cantidad_total) as total_unidades,
                   ROUND(AVG(numero_pujas), 1) as pujas_prom,
                   MAX(fecha_subasta) as ultima_vez
            FROM subastas
            WHERE estado='CERRADO' AND precio_unitario_promedio > 0
              AND capacidad = 'N/A'
            GROUP BY modelo, grado
        """).fetchall()

    seen = set()
    result = []
    for r in list(r1) + list(r2) + list(r3):
        key = (r['modelo'], r['capacidad'], r['grado'])
        if key not in seen:
            seen.add(key)
            result.append(dict(r))
    result.sort(key=lambda x: (x['modelo'], x['capacidad'], x['grado']))
    return result


def oportunidades():
    """
    Lotes que cerraron muy por debajo del promedio historico.
    Requiere al menos 2 subastas historicas para comparar.
    Solo CERRADO.
    """
    ref = referencia_precios()
    hist = {(r['modelo'], r['capacidad'], r['grado']): r for r in ref if r['num_subastas'] >= 2}

    with get_conn() as conn:
        # Ultima subasta cerrada
        fecha_sub = conn.execute(
            "SELECT MAX(fecha_subasta) FROM subastas WHERE estado='CERRADO'"
        ).fetchone()[0]
        if not fecha_sub:
            return []

        lotes = conn.execute("""
            SELECT listing_id, modelo, capacidad, grado,
                   precio_unitario_promedio, precio_total, cantidad_total,
                   numero_pujas, fecha_subasta, dia_semana
            FROM subastas
            WHERE fecha_subasta = ? AND estado='CERRADO' AND precio_unitario_promedio > 0
        """, (fecha_sub,)).fetchall()

    result = []
    for r in lotes:
        key = (r['modelo'], r['capacidad'], r['grado'])
        if key not in hist:
            continue
        h = hist[key]
        precio = r['precio_unitario_promedio']
        avg    = h['precio_prom']
        if not avg:
            continue
        diff_pct = (precio - avg) / avg * 100
        if diff_pct <= -10:
            result.append({
                'listing_id':    r['listing_id'],
                'modelo':        r['modelo'],
                'capacidad':     r['capacidad'],
                'grado':         r['grado'],
                'precio_u':      round(precio, 2),
                'hist_prom':     round(avg, 2),
                'hist_min':      round(h['precio_min'], 2),
                'descuento_pct': round(diff_pct, 1),
                'pujas':         r['numero_pujas'],
                'unidades':      r['cantidad_total'],
                'fecha':         r['fecha_subasta'],
                'dia':           r['dia_semana'],
            })
    result.sort(key=lambda x: x['descuento_pct'])
    return result


def tendencias_por_modelo():
    """Precio promedio/u por semana. Solo CERRADO."""
    with get_conn() as conn:
        rows_unicos = conn.execute("""
            SELECT s.modelo, s.capacidad, s.grado,
                   s.semana_iso, s.anio, s.dia_semana,
                   ROUND(AVG(s.precio_unitario_promedio), 2) as precio_prom,
                   ROUND(MIN(s.precio_unitario_promedio), 2) as precio_min,
                   ROUND(MAX(s.precio_unitario_promedio), 2) as precio_max,
                   SUM(s.cantidad_total) as total_unidades,
                   COUNT(*) as num_lotes,
                   ROUND(AVG(s.numero_pujas), 1) as pujas_prom
            FROM subastas s
            WHERE s.estado='CERRADO' AND s.precio_total > 0
              AND s.grado IN ('A+(T)','AA+(T)','A(T)','B+(T)','C+(T)','C(T)','B(T)')
              AND s.capacidad NOT LIKE 'MIXTO%' AND s.capacidad != 'N/A'
            GROUP BY s.modelo, s.capacidad, s.grado, s.semana_iso, s.anio, s.dia_semana
            ORDER BY s.modelo, s.capacidad, s.grado, s.anio DESC, s.semana_iso DESC
        """).fetchall()

        rows_mixto = conn.execute("""
            SELECT s.modelo, li.capacidad, s.grado,
                   s.semana_iso, s.anio, s.dia_semana,
                   ROUND(AVG(li.precio_unitario_estimado), 2) as precio_prom,
                   ROUND(MIN(li.precio_unitario_estimado), 2) as precio_min,
                   ROUND(MAX(li.precio_unitario_estimado), 2) as precio_max,
                   SUM(li.cantidad) as total_unidades,
                   COUNT(DISTINCT s.listing_id) as num_lotes,
                   ROUND(AVG(s.numero_pujas), 1) as pujas_prom
            FROM subastas s
            JOIN lote_items li ON li.listing_id = s.listing_id
            WHERE s.estado='CERRADO' AND s.precio_total > 0
              AND s.grado IN ('A+(T)','AA+(T)','A(T)','B+(T)','C+(T)','C(T)','B(T)')
              AND s.capacidad LIKE 'MIXTO%'
              AND li.capacidad NOT IN ('N/A','') AND li.capacidad NOT LIKE 'MIXTO%'
            GROUP BY s.modelo, li.capacidad, s.grado, s.semana_iso, s.anio, s.dia_semana
            ORDER BY s.modelo, li.capacidad, s.grado, s.anio DESC, s.semana_iso DESC
        """).fetchall()

        rows_na = conn.execute("""
            SELECT s.modelo, 'N/A' as capacidad, s.grado,
                   s.semana_iso, s.anio, s.dia_semana,
                   ROUND(AVG(s.precio_unitario_promedio), 2) as precio_prom,
                   ROUND(MIN(s.precio_unitario_promedio), 2) as precio_min,
                   ROUND(MAX(s.precio_unitario_promedio), 2) as precio_max,
                   SUM(s.cantidad_total) as total_unidades,
                   COUNT(*) as num_lotes,
                   ROUND(AVG(s.numero_pujas), 1) as pujas_prom
            FROM subastas s
            WHERE s.estado='CERRADO' AND s.precio_total > 0
              AND s.grado IN ('A+(T)','AA+(T)','A(T)','B+(T)','C+(T)','C(T)','B(T)')
              AND s.capacidad = 'N/A'
            GROUP BY s.modelo, s.grado, s.semana_iso, s.anio, s.dia_semana
            ORDER BY s.modelo, s.grado, s.anio DESC, s.semana_iso DESC
        """).fetchall()

    return [dict(r) for r in list(rows_unicos) + list(rows_mixto) + list(rows_na)]


def mis_pujas_perdidas():
    """
    Lee mis_pujas.json y cruza con la BD para agregar modelo/capacidad/grado.
    Retorna dict con listas perdidas/ganadas/activas enriquecidas.
    """
    if not os.path.exists('mis_pujas.json'):
        return {}
    with open('mis_pujas.json', encoding='utf-8') as f:
        data = json.load(f)

    # Cruzar con BD para obtener modelo, capacidad, grado, cantidad_total
    todas = data.get('todas', [])
    ids = [p['listing_id'] for p in todas if p.get('listing_id')]
    bd_map = {}
    if ids:
        with get_conn() as conn:
            ph = ','.join('?' * len(ids))
            rows = conn.execute(f"""
                SELECT listing_id, modelo, capacidad, grado, cantidad_total
                FROM subastas WHERE listing_id IN ({ph})
            """, ids).fetchall()
            for r in rows:
                bd_map[r['listing_id']] = dict(r)

    def enriquecer(lista):
        result = []
        for p in lista:
            lid = p.get('listing_id', '')
            bd = bd_map.get(lid, {})
            result.append({
                'listing_id':     lid,
                'titulo':         p.get('titulo', ''),
                'modelo':         bd.get('modelo', ''),
                'capacidad':      bd.get('capacidad', ''),
                'grado':          bd.get('grado', ''),
                'unidades':       bd.get('cantidad_total', 0),
                'mi_puja':        p.get('mi_puja', 0),
                'precio_ganador': p.get('precio_ganador', 0),
                'diferencia':     p.get('diferencia', 0),
                'status':         p.get('status', ''),
                'fecha_cierre':   p.get('fecha_cierre', ''),
                'hora_cierre':    p.get('hora_cierre', ''),
                'numero_pujas':   p.get('numero_pujas', 0),
            })
        return result

    return {
        'fecha_descarga': data.get('fecha_descarga', ''),
        'total':          data.get('total', 0),
        'status_count':   data.get('status_count', {}),
        'perdidas':       enriquecer(data.get('perdidas', [])),
        'ganadas':        enriquecer(data.get('ganadas', [])),
        'activas':        enriquecer(data.get('activas', [])),
    }


def resumen_general():
    with get_conn() as conn:
        r = conn.execute("""
            SELECT COUNT(DISTINCT listing_id) as total_lotes,
                   COUNT(DISTINCT modelo) as total_modelos,
                   SUM(cantidad_total) as total_unidades,
                   ROUND(AVG(precio_unitario_promedio), 2) as precio_prom_global,
                   MIN(fecha_subasta) as primera_captura,
                   MAX(fecha_subasta) as ultima_captura
            FROM subastas WHERE estado='CERRADO' AND precio_total > 0
        """).fetchone()
    return dict(r) if r else {}


def generar_reporte_json():
    reporte = {
        'generado_en':    datetime.now().isoformat(),
        'resumen':        resumen_general(),
        'ultima_subasta': ultima_subasta(),
        'referencia':     referencia_precios(),
        'oportunidades':  oportunidades(),
        'tendencias':     tendencias_por_modelo(),
        'mis_pujas':      mis_pujas_perdidas(),
    }
    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(reporte, f, indent=2, ensure_ascii=False, default=str)

    u = reporte['ultima_subasta']
    print(f"dashboard_data.json generado")
    print(f"  Ultima subasta : {u.get('fecha_subasta')} {u.get('dia_semana')} — {u.get('total_cerrados')} cerrados")
    print(f"  Referencia     : {len(reporte['referencia'])} SKUs (modelo+cap+grado)")
    print(f"  Oportunidades  : {len(reporte['oportunidades'])} lotes bajo promedio historico")
    print(f"  Tendencias     : {len(reporte['tendencias'])} puntos")
    print(f"  Mis pujas      : {len(reporte['mis_pujas'])} registros")
    return reporte


if __name__ == '__main__':
    generar_reporte_json()
