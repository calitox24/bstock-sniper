#!/usr/bin/env python3
"""
Identifica y marca como RETIRADO los lotes que:
- precio_total = 0
- fecha_subasta ya paso (antes de hoy)
- NO estan en el archivo de lotes activos actuales (ids activos del martes 23)
"""
import sqlite3, sys, io, os
from datetime import date
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOY = date.today().isoformat()

# Leer IDs activos actuales (los del martes 23)
ids_activos = set()
for fname in ['ids_2026-06-19.txt', 'ids_2026-06-23.txt']:
    if os.path.exists(fname):
        with open(fname, encoding='utf-8') as f:
            ids_activos = set(x.strip() for x in f if x.strip())
        print(f"IDs activos leidos de: {fname} ({len(ids_activos)})")
        break

if not ids_activos:
    print("AVISO: No se encontro archivo de IDs activos, marcando solo por fecha y precio")

conn = sqlite3.connect('bstock_analytics.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Candidatos: precio=0, fecha pasada, estado ACTIVO
candidatos = cur.execute("""
    SELECT listing_id, titulo, fecha_subasta, dia_semana, estado
    FROM subastas
    WHERE precio_total = 0
      AND estado = 'ACTIVO'
      AND fecha_subasta < ?
""", (HOY,)).fetchall()

print(f"\nCandidatos con precio=0 y fecha pasada: {len(candidatos)}")

# Filtrar: los que NO estan en los activos del martes
a_retirar = [r for r in candidatos if r['listing_id'] not in ids_activos]
en_martes  = [r for r in candidatos if r['listing_id'] in ids_activos]

print(f"  En subasta activa (martes 23, precio aun 0): {len(en_martes)}")
print(f"  Sin actividad -> marcar RETIRADO:            {len(a_retirar)}")

if a_retirar:
    print("\nEjemplos a marcar RETIRADO:")
    for r in a_retirar[:10]:
        print(f"  {r['listing_id'][:30]}  {r['fecha_subasta']} {r['dia_semana']:<10}  {r['titulo'][:50]}")
    if len(a_retirar) > 10:
        print(f"  ... y {len(a_retirar)-10} mas")

    resp = input(f"\nMarcar {len(a_retirar)} lotes como RETIRADO? (s/n): ").strip().lower()
    if resp == 's':
        ids_retirar = [r['listing_id'] for r in a_retirar]
        placeholders = ','.join('?' * len(ids_retirar))
        cur.execute(f"""
            UPDATE subastas SET estado='RETIRADO'
            WHERE listing_id IN ({placeholders}) AND estado='ACTIVO'
        """, ids_retirar)
        conn.commit()
        print(f"Marcados RETIRADO: {cur.rowcount}")
    else:
        print("Cancelado.")
else:
    print("No hay lotes para marcar.")

conn.close()
