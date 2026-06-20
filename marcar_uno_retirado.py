import sqlite3
lid = '6a3331c15c2074d81eabc583'
conn = sqlite3.connect('bstock_analytics.db')
r = conn.execute("UPDATE subastas SET estado='RETIRADO' WHERE listing_id=?", (lid,))
conn.commit()
print(f"Marcado RETIRADO: {r.rowcount} registro(s)")
conn.close()
