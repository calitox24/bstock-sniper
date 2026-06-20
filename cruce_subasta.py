#!/usr/bin/env python3
"""
Cruza los IDs actuales en BStock con un archivo de IDs previo.
Uso: python cruce_subasta.py ids_2026-06-17.txt
"""
import sys, io, shutil, os, sqlite3, requests, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

STOREFRONT_ID = "67ec2a5fee190bcb0e7469af"

def leer_cookies_firefox():
    profile_dir = os.path.expandvars(r'%APPDATA%\Mozilla\Firefox\Profiles')
    for p in os.listdir(profile_dir):
        cookies_path = os.path.join(profile_dir, p, 'cookies.sqlite')
        if not os.path.exists(cookies_path):
            continue
        tmp = cookies_path + '.tmp_cruce'
        try:
            shutil.copy2(cookies_path, tmp)
            conn = sqlite3.connect(tmp)
            cur = conn.cursor()
            cur.execute("SELECT name, value FROM moz_cookies WHERE host LIKE '%bstock%'")
            cookies = {n: v for n, v in cur.fetchall()}
            conn.close()
            os.remove(tmp)
            if 'bstock_access_token' in cookies:
                return cookies
        except Exception as e:
            if os.path.exists(tmp): os.remove(tmp)
    print("ERROR: No se encontraron cookies de bstock")
    sys.exit(1)

def fetch_all_ids(session, token):
    ids = []
    offset = 0
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Origin": "https://bstock.com",
        "Referer": "https://bstock.com/",
    }
    while True:
        payload = {
            "limit": 200, "offset": offset,
            "sortBy": "endTime", "sortOrder": "asc",
            "storeFrontId": [STOREFRONT_ID]
        }
        r = session.post(
            "https://search.bstock.com/v1/all-listings/listings",
            json=payload, headers=headers, timeout=30
        )
        data = r.json()
        listings = data.get("listings", [])
        total = data.get("total", 0)
        if not listings:
            break
        for item in listings:
            ids.append({
                "id": item.get("listingId", ""),
                "modelo": ", ".join(item.get("model") or []),
                "capacidad": ", ".join(item.get("capacity") or item.get("memory") or []),
                "grado": ", ".join(item.get("sellerGrade") or []),
                "unidades": item.get("units", 0),
                "precio_actual": item.get("winningBidAmount", 0) or 0,
                "end_time": (item.get("endTime") or "")[:16].replace("T"," "),
                "lot": ", ".join(item.get("sellerLotId") or []),
            })
        offset += len(listings)
        if offset >= total:
            break
    return ids, total

def main():
    ids_file = sys.argv[1] if len(sys.argv) > 1 else None
    if not ids_file or not os.path.exists(ids_file):
        print("Uso: python cruce_subasta.py ids_2026-06-17.txt")
        sys.exit(1)

    with open(ids_file, encoding='utf-8') as f:
        ids_previos = set(x.strip() for x in f if x.strip())

    print(f"IDs archivo anterior ({ids_file}): {len(ids_previos)}")

    cookies = leer_cookies_firefox()
    token = cookies.get('bstock_access_token', '')
    session = requests.Session()
    session.cookies.update(cookies)
    session.headers.update({'User-Agent': 'Mozilla/5.0'})

    print("Descargando lotes actuales de BStock...")
    actuales, total_api = fetch_all_ids(session, token)
    ids_actuales = set(item["id"] for item in actuales)
    print(f"Lotes actuales en BStock (API total={total_api}): {len(actuales)}")

    # Cruce
    en_ambos   = [x for x in actuales if x["id"] in ids_previos]
    solo_nuevo = [x for x in actuales if x["id"] not in ids_previos]
    solo_viejo = ids_previos - ids_actuales

    print(f"\n=== RESULTADO DEL CRUCE ===")
    print(f"  Re-listados (estaban en {ids_file} y siguen activos): {len(en_ambos)}")
    print(f"  Lotes NUEVOS (no estaban antes):                      {len(solo_nuevo)}")
    print(f"  Lotes del archivo que ya NO estan en BStock:          {len(solo_viejo)}")

    if en_ambos:
        print(f"\n--- Re-listados ({len(en_ambos)}) ---")
        for x in en_ambos[:20]:
            print(f"  {x['id'][:30]:<32} {x['modelo']:<25} {x['capacidad']:<10} {x['grado']:<6} {x['unidades']:>4}u  cierra:{x['end_time']}")
        if len(en_ambos) > 20:
            print(f"  ... y {len(en_ambos)-20} mas")

    if solo_nuevo:
        print(f"\n--- Lotes NUEVOS ({len(solo_nuevo)}) ---")
        for x in solo_nuevo[:20]:
            print(f"  {x['id'][:30]:<32} {x['modelo']:<25} {x['capacidad']:<10} {x['grado']:<6} {x['unidades']:>4}u  cierra:{x['end_time']}")
        if len(solo_nuevo) > 20:
            print(f"  ... y {len(solo_nuevo)-20} mas")

    # Guardar IDs actuales para la proxima subasta
    from datetime import date
    out_file = f"ids_{date.today().strftime('%Y-%m-%d')}.txt"
    with open(out_file, 'w', encoding='utf-8') as f:
        for item in actuales:
            f.write(item["id"] + "\n")
    print(f"\nIDs actuales guardados en: {out_file} ({len(actuales)} IDs)")

if __name__ == "__main__":
    main()
