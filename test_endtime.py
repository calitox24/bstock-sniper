import sys, io, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from captura import leer_cookies_firefox, get_listing_data
from config import ACCOUNT_ID

cookies = leer_cookies_firefox()
token = cookies.get('bstock_access_token', '')
api_headers = {
    'Authorization': f'Bearer {token}', 'Accept': 'application/json',
    'X-Account-ID': ACCOUNT_ID, 'Origin': 'https://bstock.com', 'Referer': 'https://bstock.com/',
}
session = requests.Session()
session.cookies.update(cookies)
session.headers.update({'User-Agent': 'Mozilla/5.0'})

with open('ids_2026-06-17.txt') as f:
    lids = [l.strip() for l in f.readlines()[:3] if l.strip()]

for lid in lids:
    datos, err = get_listing_data(lid, session, api_headers)
    if err:
        print(f"{lid}: ERROR {err}")
    else:
        print(f"{lid} | {datos['modelo']:<25} | cierre: {datos['dia_cierre']} {datos['fecha_cierre']} {datos['hora_cierre']} | ${datos['precio_total']:,.0f}")
