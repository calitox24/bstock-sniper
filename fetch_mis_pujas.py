#!/usr/bin/env python3
"""
Descarga las pujas del usuario desde la pagina My Bids de BStock.
Lee el token de las cookies de Firefox automaticamente.
Guarda los datos en mis_pujas.json para usar en el dashboard.

Uso: python fetch_mis_pujas.py
"""
import sys, io, json, os, re, sqlite3, shutil, tempfile, time
import urllib.request, urllib.error
from datetime import datetime, timedelta

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ACCOUNT_ID = "67c38095b954cf41eef3a317"
BASE_URL   = f"https://bstock.com/buy/user/{ACCOUNT_ID}/bids"

# ── Leer token de Firefox ──────────────────────────────────────────────────────
def get_firefox_token():
    import glob
    base = os.path.expandvars(r"%APPDATA%\Mozilla\Firefox\Profiles")
    patterns = [
        os.path.join(base, "*.default-release", "cookies.sqlite"),
        os.path.join(base, "*.default",         "cookies.sqlite"),
        os.path.join(base, "*",                  "cookies.sqlite"),
    ]
    db_path = None
    for pat in patterns:
        found = glob.glob(pat)
        if found:
            db_path = found[0]
            break
    if not db_path:
        return None
    tmp = tempfile.mktemp(suffix=".sqlite")
    shutil.copy2(db_path, tmp)
    try:
        conn = sqlite3.connect(tmp)
        row = conn.execute(
            "SELECT value FROM moz_cookies "
            "WHERE name='bstock_access_token' AND host LIKE '%bstock%' "
            "ORDER BY lastAccessed DESC LIMIT 1"
        ).fetchone()
        conn.close()
        return row[0] if row else None
    finally:
        try: os.remove(tmp)
        except: pass

# ── Descargar una pagina ──────────────────────────────────────────────────────
def fetch_page(token, page=1):
    url = f"{BASE_URL}?s=auction.actualEndTime&o=asc&p={page}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cookie": f"bstock_access_token={token}",
        "Referer": "https://bstock.com/",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")

def extract_bids_data(html):
    """Extrae la query uniqueUserBids del __NEXT_DATA__ de la pagina."""
    m = re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return None
    next_data = json.loads(m.group(1))
    queries = next_data.get("props", {}).get("pageProps", {}).get("dehydratedState", {}).get("queries", [])
    for q in queries:
        if "uniqueUserBids" in str(q.get("queryKey", "")):
            return q["state"]["data"]
    return None

# ── Normalizar puja ──────────────────────────────────────────────────────────
def normalizar(bid):
    auction = bid.get("auction") or {}
    attrs   = auction.get("attributes") or {}

    listing_id = auction.get("listingId") or ""
    titulo     = attrs.get("title") or ""

    # Precios (BStock los da en USD directamente, no en centavos)
    mi_puja       = float(bid.get("bidAmount") or 0)
    precio_ganador = float(auction.get("winningBidAmount") or 0)

    # Status derivado
    winning = bid.get("winning", False)
    canceled = bid.get("canceled", False) or auction.get("canceled", False)
    closed   = auction.get("closed", False)

    if canceled:
        status = "CANCELED"
    elif not closed:
        status = "WINNING" if winning else "LOSING"
    else:
        status = "WON" if winning else "LOST"

    # Fecha cierre en ET
    end_utc = auction.get("actualEndTime") or auction.get("initialEndTime") or ""
    fecha_cierre = ""
    hora_cierre  = ""
    if end_utc:
        try:
            dt_utc = datetime.strptime(end_utc[:19], "%Y-%m-%dT%H:%M:%S")
            dt_et  = dt_utc - timedelta(hours=4)
            fecha_cierre = dt_et.strftime("%Y-%m-%d")
            hora_cierre  = dt_et.strftime("%I:%M %p").lstrip("0")
        except Exception:
            fecha_cierre = end_utc[:10]

    diferencia = round(precio_ganador - mi_puja, 2) if (precio_ganador and mi_puja) else 0

    return {
        "listing_id":      listing_id,
        "titulo":          titulo,
        "mi_puja":         mi_puja,
        "precio_ganador":  precio_ganador,
        "diferencia":      diferencia,       # cuanto gano el ganador vs mi max
        "status":          status,
        "fecha_cierre":    fecha_cierre,
        "hora_cierre":     hora_cierre,
        "numero_pujas":    auction.get("numberOfBids") or 0,
        "unicos_pujadores": auction.get("uniqueBidders") or 0,
    }

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Leyendo token de Firefox...")
    token = get_firefox_token()
    if not token:
        print("ERROR: No se encontro bstock_access_token en Firefox.")
        sys.exit(1)
    print(f"  Token: {token[:30]}...")

    # Pagina 1 para saber el total
    print("Descargando pagina 1...")
    html1 = fetch_page(token, page=1)
    data1 = extract_bids_data(html1)
    if not data1:
        print("ERROR: No se pudo extraer datos de pujas.")
        sys.exit(1)

    total      = data1["total"]
    limit      = data1["limit"]
    all_bids   = list(data1["bids"])
    status_cnt = data1.get("statusCount", {})
    total_pages = (total + limit - 1) // limit

    print(f"  Total pujas: {total} | Por pagina: {limit} | Paginas: {total_pages}")
    print(f"  Status: {status_cnt}")

    # Paginas restantes
    for page in range(2, total_pages + 1):
        print(f"  Descargando pagina {page}/{total_pages}...")
        time.sleep(0.5)
        html = fetch_page(token, page=page)
        data = extract_bids_data(html)
        if data and data.get("bids"):
            all_bids.extend(data["bids"])
        else:
            print(f"  WARN: pagina {page} sin datos")

    print(f"\nTotal descargadas: {len(all_bids)}")

    # Normalizar
    pujas = [normalizar(b) for b in all_bids]

    perdidas = [p for p in pujas if p["status"] == "LOST"]
    ganadas  = [p for p in pujas if p["status"] == "WON"]
    activas  = [p for p in pujas if p["status"] in ("LOSING", "WINNING")]

    print(f"  Perdidas : {len(perdidas)}")
    print(f"  Ganadas  : {len(ganadas)}")
    print(f"  Activas  : {len(activas)}")

    # Ordenar perdidas: mas recientes primero
    perdidas.sort(key=lambda x: x["fecha_cierre"], reverse=True)

    output = {
        "fecha_descarga": datetime.now().isoformat()[:19],
        "total":          len(pujas),
        "status_count":   status_cnt,
        "perdidas":       perdidas,
        "ganadas":        ganadas,
        "activas":        activas,
        "todas":          pujas,
    }

    with open("mis_pujas.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nGuardado: mis_pujas.json")

    # Resumen de perdidas
    print("\n--- Ultimas 5 pujas perdidas ---")
    for p in perdidas[:5]:
        diff_str = f"+${p['diferencia']:,.0f}" if p["diferencia"] else ""
        print(f"  {p['fecha_cierre']} | {p['titulo'][:50]:50s} | Mi puja: ${p['mi_puja']:,.0f} | Ganador: ${p['precio_ganador']:,.0f} {diff_str}")

if __name__ == "__main__":
    main()
