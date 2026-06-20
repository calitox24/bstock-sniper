import requests, json, sqlite3, os, shutil

# Leer token de Firefox
profile_dir = os.path.expandvars(r'%APPDATA%\Mozilla\Firefox\Profiles')
token = ''
for p in os.listdir(profile_dir):
    cookies_path = os.path.join(profile_dir, p, 'cookies.sqlite')
    if not os.path.exists(cookies_path): continue
    tmp = cookies_path + '.tmp'
    shutil.copy2(cookies_path, tmp)
    conn = sqlite3.connect(tmp)
    cur = conn.cursor()
    cur.execute("SELECT value FROM moz_cookies WHERE host LIKE '%bstock%' AND name='bstock_access_token'")
    row = cur.fetchone()
    conn.close()
    os.remove(tmp)
    if row: token = row[0]; break

headers = {
    'Authorization': f'Bearer {token}',
    'Accept': 'application/json',
    'X-Account-ID': '67c38095b954cf41eef3a317',
    'Origin': 'https://bstock.com',
    'Referer': 'https://bstock.com/',
}

LISTING_ID = '6a2879ca9aaced62204472a3'

# Test 1: buscar manifestId por listingId
r = requests.get(
    f'https://order-process.bstock.com/v1/manifests?listingId={LISTING_ID}&limit=1',
    headers=headers, timeout=20
)
print(f'Test 1 (manifests?listingId): {r.status_code}')
print(r.text[:300])
print()

# Test 2: el lotId que vimos en __NEXT_DATA__ es 6a2879b29aaced6220446e75
# Probar con ese como manifestId directo
LOT_ID = '6a2879b29aaced6220446e75'
r2 = requests.get(
    f'https://order-process.bstock.com/v1/manifests/{LOT_ID}?limit=20&offset=0&exclude=metadata',
    headers=headers, timeout=20
)
print(f'Test 2 (manifest por lotId): {r2.status_code}')
print(r2.text[:300])