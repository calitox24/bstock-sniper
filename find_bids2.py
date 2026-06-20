#!/usr/bin/env python3
import sys, json, urllib.request, urllib.error

TOKEN = sys.argv[1]
ACCOUNT_ID = "67c38095b954cf41eef3a317"
STOREFRONT_ID = "67ec2a5fee190bcb0e7469af"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/json",
    "Origin": "https://bstock.com",
    "Referer": "https://bstock.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
}

ENDPOINTS = [
    # Con storefrontId
    f"https://auction.bstock.com/v1/accounts/{ACCOUNT_ID}/bids?storefrontId={STOREFRONT_ID}&limit=10",
    f"https://auction.bstock.com/v1/accounts/{ACCOUNT_ID}/bids?storefrontId={STOREFRONT_ID}&s=auction.actualEndTime&o=asc&limit=10&p=1",
    f"https://auction.bstock.com/v1/accounts/{ACCOUNT_ID}/unique-bids?storefrontId={STOREFRONT_ID}&limit=10",
    # Otras variantes
    f"https://auction.bstock.com/v1/auctions?accountId={ACCOUNT_ID}&limit=10",
    f"https://auction.bstock.com/v1/accounts/{ACCOUNT_ID}/auctions?limit=10",
    f"https://search.bstock.com/v1/accounts/{ACCOUNT_ID}/bids?limit=10",
]

for url in ENDPOINTS:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            print(f"\n✓ ENCONTRADO: {url}")
            print(json.dumps(json.loads(body), indent=2)[:3000])
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  {e.code} {url}")
        print(f"    Resp: {body[:300]}")
    except Exception as e:
        print(f"  ERR {url}: {e}")
