import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = sqlite3.connect('bstock_analytics.db')
conn.row_factory = sqlite3.Row

# Total por fecha
print("=== Por fecha ===")
for r in conn.execute("SELECT fecha_subasta, dia_semana, COUNT(*) as t, COUNT(DISTINCT listing_id) as unicos, SUM(CASE WHEN precio_total>0 THEN 1 ELSE 0 END) as cp, estado FROM subastas GROUP BY fecha_subasta, estado ORDER BY fecha_subasta DESC"):
    print(f"  {r['fecha_subasta']} {r['dia_semana']:<12} total={r['t']} unicos={r['unicos']} con_precio={r['cp']} estado={r['estado']}")

# Cuantos listing_id aparecen en MAS de una fecha
print("\n=== listing_ids en multiples fechas ===")
multi = conn.execute("""
    SELECT listing_id, COUNT(DISTINCT fecha_subasta) as fechas, GROUP_CONCAT(fecha_subasta) as fs
    FROM subastas
    GROUP BY listing_id
    HAVING fechas > 1
    LIMIT 10
""").fetchall()
print(f"  Total con multiples fechas: {len(multi)}")
for r in multi[:5]:
    print(f"  {r['listing_id'][:20]} -> {r['fs']}")

conn.close()
