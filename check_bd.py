import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
conn = sqlite3.connect('bstock_analytics.db')
conn.row_factory = sqlite3.Row

rows = conn.execute('''
    SELECT fecha_subasta, dia_semana,
           COUNT(*) as total,
           SUM(CASE WHEN precio_total > 0 THEN 1 ELSE 0 END) as con_precio,
           SUM(CASE WHEN precio_total = 0 THEN 1 ELSE 0 END) as sin_precio
    FROM subastas
    GROUP BY fecha_subasta
    ORDER BY fecha_subasta DESC
    LIMIT 10
''').fetchall()

print('Fecha        Dia       Total  Con precio  Sin precio')
print('-'*55)
for r in rows:
    print(f"{r['fecha_subasta']}  {r['dia_semana']:<8}  {r['total']:>5}  {r['con_precio']:>10}  {r['sin_precio']:>9}")
conn.close()
