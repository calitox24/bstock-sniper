import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = sqlite3.connect('bstock_analytics.db')
cur = conn.cursor()

# Marcar CERRADO todo lo que tiene precio_total > 0
r = cur.execute("UPDATE subastas SET estado='CERRADO' WHERE precio_total > 0 AND estado != 'CERRADO'")
print(f"Marcados CERRADO: {r.rowcount} registros")

# Marcar los del June-17 con estado correcto segun precio
r2 = cur.execute("UPDATE subastas SET estado='ACTIVO' WHERE precio_total = 0 AND estado = 'CERRADO'")
print(f"Corregidos a ACTIVO: {r2.rowcount} registros")

conn.commit()

# Resumen final
print("\nEstado BD:")
for r in conn.execute("""
    SELECT fecha_subasta, dia_semana, estado, COUNT(*) as t
    FROM subastas GROUP BY fecha_subasta, estado ORDER BY fecha_subasta DESC, estado
""").fetchall():
    print(f"  {r[0]} {r[1]:<12} {r[2]:<10} {r[3]}")

conn.close()
