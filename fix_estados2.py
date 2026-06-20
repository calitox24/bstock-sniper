#!/usr/bin/env python3
"""
Corrige estados: los lotes del 23-Jun aun no cerraron, deben ser ACTIVO.
"""
import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = sqlite3.connect('bstock_analytics.db')
cur = conn.cursor()

# Los del 23 no han cerrado todavia - revertir a ACTIVO
r = cur.execute("UPDATE subastas SET estado='ACTIVO' WHERE fecha_subasta='2026-06-23'")
print(f"Revertidos a ACTIVO (jun-23): {r.rowcount}")

conn.commit()

print("\nEstado BD:")
for r in conn.execute("""
    SELECT fecha_subasta, dia_semana, estado, COUNT(*) as t
    FROM subastas GROUP BY fecha_subasta, estado ORDER BY fecha_subasta DESC, estado
""").fetchall():
    print(f"  {r[0]} {r[1]:<12} {r[2]:<10} {r[3]}")

conn.close()
