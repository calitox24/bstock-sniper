import sqlite3
conn = sqlite3.connect('bstock_analytics.db')
r = conn.execute("DELETE FROM subastas WHERE fecha_subasta='2026-06-19' AND hora_cierre < '04:00:00'")
print(f"Eliminados: {r.rowcount}")
conn.commit()
conn.close()
