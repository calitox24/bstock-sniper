import sqlite3, sys, io
from datetime import datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DIAS = {0:'LUNES',1:'MARTES',2:'MIERCOLES',3:'JUEVES',4:'VIERNES',5:'SABADO',6:'DOMINGO'}

conn = sqlite3.connect('bstock_analytics.db')
cur = conn.cursor()

fechas = cur.execute("SELECT DISTINCT fecha_subasta FROM subastas").fetchall()
actualizados = 0
for (fecha,) in fechas:
    dia_real = DIAS[datetime.strptime(fecha, '%Y-%m-%d').weekday()]
    r = cur.execute(
        "UPDATE subastas SET dia_semana = ? WHERE fecha_subasta = ? AND dia_semana != ?",
        (dia_real, fecha, dia_real)
    )
    if r.rowcount > 0:
        print(f"  {fecha} -> {dia_real} ({r.rowcount} registros)")
        actualizados += r.rowcount

conn.commit()
conn.close()
print(f"\nTotal corregidos: {actualizados} registros")
