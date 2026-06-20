#!/usr/bin/env python3
import csv
import re
from pathlib import Path

def extraer_ids_desde_csv(csv_path, output_file="ids_productos_11junio.txt"):
    if not Path(csv_path).exists():
        print(f"❌ Archivo no encontrado: {csv_path}")
        return
    
    print(f"📂 Leyendo {csv_path}...")
    ids_unicos = set()
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            url = row.get('URL', '')
            match = re.search(r'/details/([a-f0-9]+)', url)
            if match:
                listing_id = match.group(1)
                ids_unicos.add(listing_id)
    
    print(f"✅ {len(ids_unicos)} IDs únicos encontrados\n")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        for listing_id in sorted(ids_unicos):
            f.write(listing_id + "\n")
    
    print(f"📄 Archivo generado: {output_file}")
    print(f"   Contenido: {len(ids_unicos)} listing IDs")

if __name__ == "__main__":
    import sys
    csv_file = sys.argv[1] if len(sys.argv) > 1 else "B-Stock listings 2026-06-11T1544.csv"
    output = sys.argv[2] if len(sys.argv) > 2 else "ids_productos_11junio.txt"
    extraer_ids_desde_csv(csv_file, output)