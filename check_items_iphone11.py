import sqlite3
conn = sqlite3.connect('bstock_analytics.db')
lid = conn.execute("SELECT listing_id FROM subastas WHERE modelo LIKE '%iPhone 11%' AND capacidad LIKE 'MIXTO%' LIMIT 1").fetchone()
if lid:
    lid = lid[0]
    print(f"listing_id: {lid}")
    rows = conn.execute("SELECT capacidad, cantidad FROM lote_items WHERE listing_id=?", (lid,)).fetchall()
    print(f"lote_items: {rows}")
else:
    print("No se encontro iPhone 11 MIXTO en la BD")
conn.close()
