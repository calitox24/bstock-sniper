import sys, io, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = sqlite3.connect('bstock_analytics.db')
cur = conn.cursor()

# Los 993 registros del 17/Jun son capturas con fecha incorrecta (dia de captura, no de cierre)
# Los mismos lotes ya fueron re-capturados con fecha correcta (18, 19, 23 Jun)
# Eliminar los registros del 17-Jun cuyos listing_id ya existen en fechas posteriores

borrados = cur.execute("""
    DELETE FROM subastas
    WHERE fecha_subasta = '2026-06-17'
    AND listing_id IN (
        SELECT listing_id FROM subastas WHERE fecha_subasta > '2026-06-17'
    )
""").rowcount

print(f"Eliminados {borrados} registros duplicados de 2026-06-17")

# Ver cuantos quedan del 17-Jun (estos son los que realmente cerraron el 17)
restantes = cur.execute(
    "SELECT COUNT(*) FROM subastas WHERE fecha_subasta = '2026-06-17'"
).fetchone()[0]
print(f"Quedan {restantes} registros del 17-Jun (los que cerraron ese dia)")

conn.commit()

# Resumen final
print("\nEstado BD:")
rows = cur.execute("""
    SELECT fecha_subasta, dia_semana, COUNT(*) as total,
           SUM(CASE WHEN precio_total > 0 THEN 1 ELSE 0 END) as con_precio
    FROM subastas GROUP BY fecha_subasta ORDER BY fecha_subasta DESC
""").fetchall()
print(f"{'Fecha':<14} {'Dia':<12} {'Total':>6} {'Con precio':>10}")
print('-'*46)
for r in rows:
    print(f"{r[0]:<14} {r[1]:<12} {r[2]:>6} {r[3]:>10}")

conn.close()
