#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
"""
BStock Analytics — Pipeline automático
Uso:
  python pipeline.py inicio    # Mañana: descarga lotes + Excel + IDs
  python pipeline.py cierre    # Tarde:  captura precios + BD + analytics
  python pipeline.py estado    # Ver resumen de la subasta de hoy
"""
import sys
import sqlite3
import requests
import shutil
import os
import json
from datetime import date, datetime

# ─── COOKIE READER (igual que captura.py) ─────────────────────────────────────

def leer_cookies_firefox():
    profile_dir = os.path.expandvars(r'%APPDATA%\Mozilla\Firefox\Profiles')
    if not os.path.exists(profile_dir):
        print("❌ No se encontró directorio de perfiles de Firefox")
        return {}
    for p in os.listdir(profile_dir):
        cookies_path = os.path.join(profile_dir, p, 'cookies.sqlite')
        if not os.path.exists(cookies_path):
            continue
        tmp = cookies_path + '.tmp_bstock'
        try:
            shutil.copy2(cookies_path, tmp)
            conn = sqlite3.connect(tmp)
            cur = conn.cursor()
            cur.execute("SELECT name, value FROM moz_cookies WHERE host LIKE '%bstock%'")
            cookies = {name: value for name, value in cur.fetchall()}
            conn.close()
            os.remove(tmp)
            if 'bstock_access_token' in cookies:
                return cookies
        except Exception as e:
            if os.path.exists(tmp):
                os.remove(tmp)
    print("❌ No se encontraron cookies de bstock. ¿Estás logueado en Firefox?")
    return {}


def hacer_session(cookies):
    s = requests.Session()
    s.cookies.update(cookies)
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
    })
    return s


# ─── DETECTAR SUBASTA ACTIVA ──────────────────────────────────────────────────

STOREFRONT_ID = "67ec2a5fee190bcb0e7469af"

def hay_subasta_hoy(session, token):
    """Consulta la API y retorna el total de lotes activos hoy."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Origin": "https://bstock.com",
        "Referer": "https://bstock.com/",
    }
    payload = {
        "limit": 1, "offset": 0,
        "sortBy": "endTime", "sortOrder": "asc",
        "storeFrontId": [STOREFRONT_ID]
    }
    try:
        r = session.post(
            "https://search.bstock.com/v1/all-listings/listings",
            json=payload, headers=headers, timeout=20
        )
        r.raise_for_status()
        return r.json().get("total", 0)
    except Exception as e:
        print(f"❌ Error consultando API: {e}")
        return 0


def fetch_todos_los_listings(session, token):
    """Descarga todos los listings de la subasta actual."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Origin": "https://bstock.com",
        "Referer": "https://bstock.com/",
    }
    all_listings = []
    offset = 0
    while True:
        payload = {
            "limit": 200, "offset": offset,
            "sortBy": "endTime", "sortOrder": "asc",
            "storeFrontId": [STOREFRONT_ID]
        }
        r = session.post(
            "https://search.bstock.com/v1/all-listings/listings",
            json=payload, headers=headers, timeout=30
        )
        r.raise_for_status()
        data = r.json()
        listings = data.get("listings", [])
        total = data.get("total", 0)
        if not listings:
            break
        all_listings.extend(listings)
        print(f"  Descargados {len(all_listings)}/{total} lotes...")
        offset += len(listings)
        if offset >= total:
            break
    return all_listings


# ─── MIGRACIÓN BD (agrega columna estado si no existe) ───────────────────────

def migrar_bd(db_path):
    with sqlite3.connect(db_path) as conn:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(subastas)").fetchall()]
        if 'estado' not in cols:
            conn.execute("ALTER TABLE subastas ADD COLUMN estado TEXT DEFAULT 'ACTIVO'")
            conn.commit()
            print("✅ BD migrada: columna 'estado' agregada")


# ─── FASE INICIO ──────────────────────────────────────────────────────────────

def fase_inicio():
    print(f"\n{'='*60}")
    print(f"  PIPELINE INICIO — {date.today().strftime('%A %d/%m/%Y')}")
    print(f"{'='*60}\n")

    cookies = leer_cookies_firefox()
    if not cookies:
        sys.exit(1)
    token = cookies['bstock_access_token']
    session = hacer_session(cookies)

    # Verificar si hay subasta
    total = hay_subasta_hoy(session, token)
    if total == 0:
        print("ℹ️  No hay subasta activa hoy. El pipeline no hace nada.")
        return

    print(f"✅ Subasta detectada: {total} lotes\n")

    # Descargar todos los listings
    print("📥 Descargando listings...")
    listings = fetch_todos_los_listings(session, token)
    print(f"   Total: {len(listings)} lotes\n")

    # Guardar IDs
    today = date.today().strftime("%Y-%m-%d")
    ids_file = f"ids_{today}.txt"
    ids = [item.get("listingId") or item.get("id") for item in listings]
    ids = [i for i in ids if i]
    with open(ids_file, "w") as f:
        f.write("\n".join(ids))
    print(f"📋 IDs guardados: {ids_file} ({len(ids)} lotes)")

    # Generar Excel
    print("\n📊 Generando Excel...")
    from export_subasta_excel import build_excel
    excel_file = f"subasta_{today}.xlsx"
    build_excel(listings, excel_file)

    print(f"\n{'='*60}")
    print(f"  INICIO COMPLETADO")
    print(f"  IDs  : {ids_file}")
    print(f"  Excel: {excel_file}")
    print(f"  Ahora corré 'python pipeline.py cierre' al final de la tarde")
    print(f"{'='*60}\n")


# ─── FASE CIERRE ──────────────────────────────────────────────────────────────

def fase_cierre():
    print(f"\n{'='*60}")
    print(f"  PIPELINE CIERRE — {date.today().strftime('%A %d/%m/%Y')}")
    print(f"{'='*60}\n")

    from config import DB_PATH
    migrar_bd(DB_PATH)

    # Verificar que existe el archivo de IDs de hoy
    today = date.today().strftime("%Y-%m-%d")
    ids_file = f"ids_{today}.txt"
    if not os.path.exists(ids_file):
        candidatos = sorted(
            [f for f in os.listdir('.') if f.startswith('ids_') and f.endswith('.txt')],
            reverse=True
        )
        if candidatos:
            ids_file = candidatos[0]
            print(f"⚠️  No hay IDs de hoy, usando: {ids_file}")
        else:
            print("❌ No hay archivo de IDs. Ejecutá primero: python pipeline.py inicio")
            sys.exit(1)

    with open(ids_file) as f:
        listing_ids = [x.strip() for x in f if x.strip()]

    print(f"📋 {len(listing_ids)} lotes a capturar desde {ids_file}\n")

    # Capturar precios de cierre (el dia/fecha lo determina el endTime de cada lote)
    from captura import BStockCaptura
    captura = BStockCaptura()
    resultados = captura.capturar(listing_ids)

    # Actualizar estado por lote usando su propia fecha_subasta (del endTime)
    ids_capturados = {r['listing_id'] for r in resultados}
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        for r in resultados:
            estado = 'CERRADO' if r['precio_total'] > 0 else 'ACTIVO'
            cur.execute(
                "UPDATE subastas SET estado = ? WHERE listing_id = ? AND fecha_subasta = ?",
                (estado, r['listing_id'], r['fecha_subasta'])
            )
        # Marcar RETIRADO: solo lotes del archivo de IDs actual que no volvieron
        ids_archivo = set(listing_ids)
        ids_retirados = ids_archivo - ids_capturados
        for lid in ids_retirados:
            cur.execute(
                "UPDATE subastas SET estado = 'RETIRADO' WHERE listing_id = ? AND estado = 'ACTIVO'",
                (lid,)
            )
        retirados = len(ids_retirados)
        retirados = cur.rowcount
        conn.commit()

    if retirados > 0:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            filas = conn.execute(
                "SELECT listing_id, titulo, modelo FROM subastas WHERE estado = 'RETIRADO' AND fecha_subasta >= date('now','-7 days')"
            ).fetchall()
        print(f"\n{retirados} lote(s) RETIRADO(S):")
        for f in filas:
            print(f"   - {f['listing_id']} | {f['modelo']} | {f['titulo'][:50]}")

    # Actualizar Excel con precios de cierre
    print("\n📊 Actualizando Excel con precios de cierre...")
    cookies = leer_cookies_firefox()
    if cookies:
        token = cookies['bstock_access_token']
        session = hacer_session(cookies)
        try:
            listings = fetch_todos_los_listings(session, token)
            from export_subasta_excel import build_excel
            excel_file = f"subasta_{today}.xlsx"
            build_excel(listings, excel_file)
            print(f"   Excel actualizado: {excel_file}")
        except Exception as e:
            print(f"   ⚠️  No se pudo actualizar Excel: {e}")

    # Generar analítica
    print("\n📈 Generando analítica...")
    from analitica import generar_reporte_json
    reporte = generar_reporte_json()

    # Resumen final
    cerrados = sum(1 for r in resultados if r['precio_total'] > 0)
    abiertos = len(resultados) - cerrados
    alertas = reporte.get("alertas", [])
    buenos = [a for a in alertas if a["nivel"] == "BUEN_PRECIO"]
    altos = [a for a in alertas if a["nivel"] == "PRECIO_ALTO"]

    print(f"\n{'='*60}")
    print(f"  CIERRE COMPLETADO")
    print(f"  Capturados : {len(resultados)}/{len(listing_ids)}")
    print(f"  Cerrados   : {cerrados}  |  Abiertos: {abiertos}  |  Retirados: {retirados}")

    if buenos:
        print(f"\n  🟢 BUENOS PRECIOS ({len(buenos)}):")
        for a in buenos[:5]:
            print(f"     {a['modelo']}: ${a['ultimo_precio']:,.0f}/u "
                  f"(vs avg ${a['promedio_historico']:,.0f}, {a['cambio_pct']:+.1f}%)")
    if altos:
        print(f"\n  🔴 PRECIOS ALTOS ({len(altos)}):")
        for a in altos[:5]:
            print(f"     {a['modelo']}: ${a['ultimo_precio']:,.0f}/u "
                  f"(vs avg ${a['promedio_historico']:,.0f}, {a['cambio_pct']:+.1f}%)")

    print(f"\n  Abrí dashboard.html para ver el análisis completo")
    print(f"{'='*60}\n")


# ─── FASE ESTADO ──────────────────────────────────────────────────────────────

def fase_estado():
    from config import DB_PATH
    today = date.today().strftime("%Y-%m-%d")
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT estado, COUNT(*) as total FROM subastas WHERE fecha_subasta = ? GROUP BY estado",
            (today,)
        ).fetchall()

    if not rows:
        print(f"No hay datos para hoy ({today}). Ejecutá 'python pipeline.py inicio'")
        return

    print(f"\nEstado subasta {today}:")
    for r in rows:
        icono = {"ACTIVO": "🔵", "CERRADO": "🟢", "RETIRADO": "🔴"}.get(r["estado"], "⚪")
        print(f"  {icono} {r['estado']}: {r['total']} lotes")


# ─── FASE CAPTURAR (ids específicos + fecha override) ─────────────────────────

def fase_capturar(ids_file, fecha_override=None):
    """
    Captura precios de un archivo de IDs específico.
    Útil para capturar lotes de una fecha anterior que aún siguen cerrando.
    Uso: python pipeline.py capturar ids_2026-06-17.txt [2026-06-17]
    """
    from config import DB_PATH
    migrar_bd(DB_PATH)

    if not os.path.exists(ids_file):
        print(f"❌ No se encontró el archivo: {ids_file}")
        sys.exit(1)

    with open(ids_file) as f:
        listing_ids = [x.strip() for x in f if x.strip()]

    fecha = fecha_override or date.today().strftime("%Y-%m-%d")
    dia_num = datetime.strptime(fecha, "%Y-%m-%d").weekday()
    dias = {0:'LUNES',1:'MARTES',2:'MIERCOLES',3:'JUEVES',4:'VIERNES',5:'SABADO',6:'DOMINGO'}
    dia = dias[dia_num]

    print(f"\n{'='*60}")
    print(f"  CAPTURA: {ids_file}")
    print(f"  Fecha  : {fecha} ({dia})")
    print(f"  Lotes  : {len(listing_ids)}")
    print(f"{'='*60}\n")

    # El endTime de cada lote determina su fecha/dia de cierre automaticamente
    from captura import BStockCaptura
    captura = BStockCaptura()
    resultados = captura.capturar(listing_ids)

    # Actualizar estados
    ids_capturados = {r['listing_id'] for r in resultados}
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        for r in resultados:
            estado = 'CERRADO' if r['precio_total'] > 0 else 'ACTIVO'
            cur.execute(
                "UPDATE subastas SET estado = ? WHERE listing_id = ? AND fecha_subasta = ?",
                (estado, r['listing_id'], fecha)
            )
        conn.commit()

    cerrados = sum(1 for r in resultados if r['precio_total'] > 0)
    abiertos = len(resultados) - cerrados

    print(f"\n{'='*60}")
    print(f"  CAPTURA COMPLETADA")
    print(f"  Cerrados: {cerrados}  |  Abiertos aun: {abiertos}")
    print(f"  Podés volver a correr este comando cuando cierren los restantes")
    print(f"{'='*60}\n")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    fase = sys.argv[1].lower() if len(sys.argv) > 1 else ""
    if fase == "inicio":
        fase_inicio()
    elif fase == "cierre":
        fase_cierre()
    elif fase == "estado":
        fase_estado()
    elif fase == "capturar":
        if len(sys.argv) < 3:
            print("Uso: python pipeline.py capturar <ids_file> [fecha]")
            print("  Ejemplo: python pipeline.py capturar ids_2026-06-17.txt 2026-06-17")
            sys.exit(1)
        ids_file = sys.argv[2]
        fecha_override = sys.argv[3] if len(sys.argv) > 3 else None
        fase_capturar(ids_file, fecha_override)
    else:
        print("Uso: python pipeline.py [inicio|cierre|estado|capturar]")
        print()
        print("  inicio               -> Descarga lotes, genera Excel e IDs")
        print("  cierre               -> Captura precios finales, actualiza BD y Excel")
        print("  estado               -> Ver resumen de hoy (ACTIVO/CERRADO/RETIRADO)")
        print("  capturar <ids> [fecha] -> Captura IDs específicos con fecha override")
        print()
        print("  Ejemplo: python pipeline.py capturar ids_2026-06-17.txt 2026-06-17")
        sys.exit(1)
