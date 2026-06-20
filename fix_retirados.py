import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = sqlite3.connect('bstock_analytics.db')
cur = conn.cursor()

r = cur.execute("UPDATE subastas SET estado = 'ACTIVO' WHERE estado = 'RETIRADO'")
print(f"Reseteados {r.rowcount} registros RETIRADO -> ACTIVO")
conn.commit()

rows = cur.execute("""
    SELECT fecha_subasta, dia_semana, COUNT(*) as t,
           SUM(CASE WHEN precio_total>0 THEN 1 ELSE 0 END) as cp
    FROM subastas GROUP BY fecha_subasta ORDER BY fecha_subasta DESC
""").fetchall()
print()
print(f"{'Fecha':<14} {'Dia':<12} {'Total':>6} {'Con precio':>10}")
print('-'*46)
for r in rows:
    print(f"{r[0]:<14} {r[1]:<12} {r[2]:>6} {r[3]:>10}")
conn.close()
