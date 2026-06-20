#!/usr/bin/env python3
"""
Corrige fecha_subasta y dia_semana para registros cuya hora_cierre UTC
es entre 00:00 y 03:59 (que en ET corresponden al dia anterior).
"""
import sqlite3, sys, io
from datetime import datetime, timedelta
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DIAS = {0:'LUNES',1:'MARTES',2:'MIERCOLES',3:'JUEVES',4:'VIERNES',5:'SABADO',6:'DOMINGO'}

conn = sqlite3.connect('bstock_analytics.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Traer todos los registros que tienen hora_cierre y podrian estar mal
rows = cur.execute("""
    SELECT listing_id, fecha_subasta, dia_semana, hora_cierre
    FROM subastas
    WHERE hora_cierre IS NOT NULL AND hora_cierre < '04:00:00'
""").fetchall()

print(f"Registros con hora_cierre UTC entre 00:00-03:59: {len(rows)}")

corregidos = 0
for r in rows:
    # La fecha en BD es UTC; el dia de negocio ET = fecha - 1 dia
    try:
        dt_utc = datetime.strptime(f"{r['fecha_subasta']} {r['hora_cierre']}", '%Y-%m-%d %H:%M:%S')
        dt_et  = dt_utc - timedelta(hours=4)
        nueva_fecha = dt_et.strftime('%Y-%m-%d')
        nuevo_dia   = DIAS[dt_et.weekday()]

        if nueva_fecha != r['fecha_subasta']:
            cur.execute("""
                UPDATE subastas SET fecha_subasta=?, dia_semana=?
                WHERE listing_id=? AND fecha_subasta=?
            """, (nueva_fecha, nuevo_dia, r['listing_id'], r['fecha_subasta']))
            corregidos += 1
    except Exception as e:
        print(f"  Error en {r['listing_id']}: {e}")

conn.commit()
print(f"Registros corregidos: {corregidos}")

# Resumen post-fix
print("\nEstado BD tras correccion:")
for r in conn.execute("""
    SELECT fecha_subasta, dia_semana, COUNT(*) as t
    FROM subastas GROUP BY fecha_subasta ORDER BY fecha_subasta DESC
""").fetchall():
    print(f"  {r['fecha_subasta']} {r['dia_semana']:<12} {r['t']} registros")

conn.close()
