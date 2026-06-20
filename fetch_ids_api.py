#!/usr/bin/env python3
"""
Obtiene todos los listingIds de la subasta BStock via API directa.
Lee el token automáticamente de las cookies de Firefox.
Uso: python fetch_ids_api.py
"""
import json
import sys
import os
import shutil
import sqlite3
import requests
from datetime import date

STOREFRONT_ID = "67ec2a5fee190bcb0e7469af"


def leer_cookies_firefox():
    profile_dir = os.path.expandvars(r'%APPDATA%\Mozilla\Firefox\Profiles')
    if not os.path.exists(profile_dir):
        print("❌ No se encontró directorio de perfiles de Firefox")
        return {}
    for p in os.listdir(profile_dir):
        cookies_path = os.path.join(profile_dir, p, 'cookies.sqlite')
        if not os.path.exists(cookies_path):
            continue
        tmp = cookies_path + '.tmp_bstock'
        try:
            shutil.copy2(cookies_path, tmp)
            conn = sqlite3.connect(tmp)
            cur = conn.cursor()
            cur.execute("SELECT name, value FROM moz_cookies WHERE host LIKE '%bstock%'")
            cookies = {name: value for name, value in cur.fetchall()}
            conn.close()
            os.remove(tmp)
            if 'bstock_access_token' in cookies:
                print(f"✅ Token leído de Firefox ({len(cookies['bstock_access_token'])} chars)")
                return cookies
        except Exception as e:
            print(f"⚠️  Error leyendo cookies: {e}")
            if os.path.exists(tmp):
                os.remove(tmp)
    print("❌ No se encontraron cookies de bstock. ¿Estás logueado en Firefox?")
    return {}


def fetch_page(session, token, offset, limit=200):
    payload = {
        "limit": limit,
        "offset": offset,
        "sortBy": "endTime",
        "sortOrder": "asc",
        "storeFrontId": [STOREFRONT_ID]
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Origin": "https://bstock.com",
        "Referer": "https://bstock.com/",
    }
    try:
        r = session.post(
            "https://search.bstock.com/v1/all-listings/listings",
            json=payload, headers=headers, timeout=30
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"❌ Error en request: {e}")
        return None


def main():
    cookies = leer_cookies_firefox()
    if not cookies:
        sys.exit(1)

    token = cookies.get('bstock_access_token', '')
    session = requests.Session()
    session.cookies.update(cookies)
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
    })

    all_ids = []
    offset = 0
    limit = 200

    while True:
        print(f"Obteniendo lotes {offset} - {offset + limit}...")
        data = fetch_page(session, token, offset, limit)
        if not data:
            print("Error obteniendo datos")
            break

        total = data.get("total", 0)
        listings = data.get("listings", [])

        if offset == 0:
            print(f"Total en subasta: {total}")

        if not listings:
            break

        for item in listings:
            lid = item.get("listingId") or item.get("id")
            if lid and lid not in all_ids:
                all_ids.append(lid)

        print(f"  -> {len(listings)} lotes obtenidos (acumulado: {len(all_ids)})")
        offset += len(listings)
        if offset >= total:
            break

    print(f"\nTotal IDs: {len(all_ids)}")

    today = date.today().strftime("%Y-%m-%d")
    filename = f"ids_{today}.txt"
    with open(filename, "w") as f:
        for lid in all_ids:
            f.write(lid + "\n")

    print(f"✅ Guardado en: {filename}")
    return filename


if __name__ == "__main__":
    main()
