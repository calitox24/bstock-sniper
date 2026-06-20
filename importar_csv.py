#!/usr/bin/env python3
"""
Importador de CSV histórico a BStock Analytics
Lee CSV de inventario y lo agrega a la BD
"""
import csv
import sqlite3
import re
from datetime import datetime
from pathlib import Path

DB_PATH = "bstock_analytics.db"

def extraer_listing_id(url):
    """Extrae listing_id del URL de B-stock"""
    match = re.search(r'/details/([a-f0-9]+)', url)
    return match.group(1) if match else None

def extraer_capacidad(descripcion):
    """Extrae capacidad desde descripción"""
    if not descripcion:
        return 'N/A'
    
    # Buscar patrón: 256GB, 512GB, 1TB, etc
    m = re.search(r'\b(128|256|512|1024|64|32)(?:\s*)?(?:GB|TB)\b', descripcion, re.IGNORECASE)
    if m:
        return f"{m.group(1)}GB"
    
    return 'N/A'

def importar_csv(csv_path, fecha_subasta, dia_subasta, precio_total=0):
    """
    Importa CSV a la BD
    
    Args:
        csv_path: ruta del CSV
        fecha_subasta: ej "2026-06-11"
        dia_subasta: "MARTES" o "JUEVES"
        precio_total: precio total (si aplica)
    """
    
    if not Path(csv_path).exists():
        print(f"❌ Archivo no encontrado: {csv_path}")
        return
    
    print(f"📂 Leyendo {csv_path}...")
    
    # Agrupar por listing_id
    lotes = {}
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            url = row.get('URL', '')
            listing_id = extraer_listing_id(url)
            
            if not listing_id:
                print(f"⚠️  No se pudo extraer ID de: {url[:50]}")
                continue
            
            if listing_id not in lotes:
                lotes[listing_id] = {
                    'titulo': row.get('Item Description', 'N/A'),
                    'fabricante': row.get('OEM', 'N/A'),
                    'modelo': row.get('Model', 'N/A'),
                    'grado': row.get('Grade', 'N/A'),
                    'color': row.get('Color', 'N/A'),
                    'carrier_lock': 'N/A',
                    'cantidad_total': 0,
                    'capacidad': extraer_capacidad(row.get('Item Description', '')),
                    'precio_total': precio_total,
                    'precio_unitario_promedio': 0,
                    'numero_pujas': 0,
                    'precio_inicio': 0,
                    'url': url,
                    'items': []
                }
            
            # Agregar item
            qty = int(row.get('Qty', 0))
            lotes[listing_id]['cantidad_total'] += qty
            lotes[listing_id]['items'].append({
                'qty': qty,
                'descripcion': row.get('Item Description'),
                'capacidad': extraer_capacidad(row.get('Item Description'))
            })
    
    print(f"✅ {len(lotes)} lotes únicos encontrados\n")
    
    # Guardar en BD
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        
        for listing_id, data in lotes.items():
            # Calcular precio unitario
            precio_unitario = round(data['precio_total'] / data['cantidad_total'], 2) if data['precio_total'] else 0
            
            print(f"💾 {listing_id[:16]}… | {data['modelo']} | {data['cantidad_total']}u | ${precio_total:,.0f}")
            
            cur.execute("""
                INSERT OR REPLACE INTO subastas
                (listing_id, titulo, fabricante, modelo, capacidad,
                 grado, carrier_lock, cantidad_total, precio_total,
                 precio_unitario_promedio, fecha_subasta, dia_semana, hora_cierre,
                 semana_iso, anio, numero_pujas, precio_inicio, url)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                listing_id,
                data['titulo'],
                data['fabricante'],
                data['modelo'],
                data['capacidad'],
                data['grado'],
                data['carrier_lock'],
                data['cantidad_total'],
                data['precio_total'],
                precio_unitario,
                fecha_subasta,
                dia_subasta,
                datetime.now().strftime("%H:%M:%S"),
                datetime.strptime(fecha_subasta, "%Y-%m-%d").isocalendar()[1],
                datetime.strptime(fecha_subasta, "%Y-%m-%d").year,
                data['numero_pujas'],
                data['precio_inicio'],
                data['url']
            ))
        
        conn.commit()
    
    print(f"\n✅ Importación completada: {len(lotes)} lotes agregados a la BD")
    print(f"📊 Fecha: {fecha_subasta} ({dia_subasta})")
    print(f"💰 Precio total: ${precio_total:,.0f}" if precio_total else "💰 Precios: NO especificados (agregar después)")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Uso:")
        print("  python importar_csv.py <archivo.csv> [fecha YYYY-MM-DD] [dia MARTES|JUEVES] [precio_total]")
        print("\nEjemplo:")
        print("  python importar_csv.py B-Stock_listings.csv 2026-06-11 JUEVES 0")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    fecha = sys.argv[2] if len(sys.argv) > 2 else "2026-06-11"
    dia = sys.argv[3].upper() if len(sys.argv) > 3 else "JUEVES"
    precio = float(sys.argv[4]) if len(sys.argv) > 4 else 0
    
    importar_csv(csv_file, fecha, dia, precio)