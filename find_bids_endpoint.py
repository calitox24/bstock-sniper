#!/usr/bin/env python3
"""
Prueba endpoints posibles de la API de BStock para obtener las pujas del usuario.
Uso: python find_bids_endpoint.py <bearer_token>
"""
import sys, json, urllib.request, urllib.error

TOKEN = sys.argv[1] if len(sys.argv) > 1 else ""
ACCOUNT_ID = "67c38095b954cf41eef3a317"
PERSON_ID  = "67c38095b954cf41eef3a319"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/json",
    "Origin": "https://bstock.com",
    "Referer": "https://bstock.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
}

ENDPOINTS = [
    f"https://auction.bstock.com/v1/accounts/{ACCOUNT_ID}/bids?limit=10",
    f"https://auction.bstock.com/v1/accounts/{ACCOUNT_ID}/bids?s=auction.actualEndTime&o=asc&limit=10",
    f"https://auction.bstock.com/v1/accounts/{ACCOUNT_ID}/unique-bids?limit=10",
    f"https://auction.bstock.com/v1/people/{PERSON_ID}/bids?limit=10",
    f"https://order-process.bstock.com/v1/accounts/{ACCOUNT_ID}/bids?limit=10",
    f"https://bid.bstock.com/v1/accounts/{ACCOUNT_ID}/bids?limit=10",
    f"https://api.bstock.com/v1/accounts/{ACCOUNT_ID}/bids?limit=10",
]

for url in ENDPOINTS:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            data = json.loads(body)
            print(f"\n✓ ENCONTRADO: {url}")
            print(json.dumps(data, indent=2)[:2000])
            break
    except urllib.error.HTTPError as e:
        print(f"  {e.code} {url}")
    except Exception as e:
        print(f"  ERR {url}: {e}")
