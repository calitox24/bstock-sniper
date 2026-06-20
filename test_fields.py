import sys, io, shutil, os, sqlite3, requests, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from captura import leer_cookies_firefox

cookies = leer_cookies_firefox()
token = cookies.get('bstock_access_token', '')
session = requests.Session()
session.cookies.update(cookies)
session.headers.update({'User-Agent': 'Mozilla/5.0'})

# Traer un lote abierto (martes 23) y uno cerrado para comparar campos
payload = {"limit": 5, "offset": 0, "sortBy": "endTime", "sortOrder": "asc",
           "storeFrontId": ["67ec2a5fee190bcb0e7469af"]}
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json",
           "Origin": "https://bstock.com", "Referer": "https://bstock.com/"}

r = session.post("https://search.bstock.com/v1/all-listings/listings",
                 json=payload, headers=headers, timeout=30)
listings = r.json().get("listings", [])

campos_interes = ['listingId','winningBidAmount','closed','canceled','status','endTime','upcoming']
for item in listings[:3]:
    print(f"\nListing: {item.get('listingId','')[:20]}")
    for k in campos_interes:
        if k in item:
            print(f"  {k}: {item[k]}")
