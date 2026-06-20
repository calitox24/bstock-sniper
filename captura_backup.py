#!/usr/bin/env python3
"""
BStock Analytics - Captura con capacidades reales desde manifest
Flujo: __NEXT_DATA__ (lotId, precio) → /v1/manifests/{lotId} (capacidad real por item)
"""
import requests, json, sqlite3, csv, re, logging, sys, os, shutil, time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import ACCOUNT_ID, DB_PATH, LISTING_IDS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("captura.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

MAX_WORKERS = 8
MAX_RETRIES = 2


# ─── COOKIES DE FIREFOX ───────────────────────────────────────────────────────

def leer_cookies_firefox():
    profile_dir = os.path.expandvars(r'%APPDATA%\Mozilla\Firefox\Profiles')
    if not os.path.exists(profile_dir):
        logger.error("No se encontró directorio de perfiles de Firefox")
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
                logger.info(f"✅ Token extraído de Firefox ({len(cookies['bstock_access_token'])} chars)")
                return cookies
        except Exception as e:
            logger.warning(f"Error leyendo cookies: {e}")
            if os.path.exists(tmp):
                os.remove(tmp)
    logger.error("No se encontraron cookies de bstock. ¿Estás logueado en Firefox?")
    return {}


# ─── PARSEAR CAPACIDAD DESDE DESCRIPCIÓN ──────────────────────────────────────

def parsear_capacidad(desc, memory=None, capacity=None):
    """Extrae la capacidad del item. Usa campos directos primero, luego parsea descripción."""
    # Campos directos del manifest
    for campo in [capacity, memory]:
        if campo and campo not in ('N/A', '', 'null'):
            c = campo.strip().upper()
            if not c.endswith('GB') and not c.endswith('TB'):
                c += 'GB'
            return c

    # Parsear desde descripción: "BBA SAM GS25U 256 SMS938U SLV" → "256GB"
    if desc:
        m = re.search(r'\b(\d+(?:TB|GB))\b', desc, re.IGNORECASE)
        if m:
            return m.group(1).upper()
        # Número solo ej: "GS25U 256" → 256GB
        m = re.search(r'\b(128|256|512|1024|64|32)\b', desc)
        if m:
            n = int(m.group(1))
            return f"{n}GB" if n < 1000 else f"{n//1024}TB"
        # 1TB, 2TB explícito
        m = re.search(r'\b([12])TB\b', desc, re.IGNORECASE)
        if m:
            return f"{m.group(1)}TB"

    return 'N/A'


# ─── MANIFEST ENDPOINT ────────────────────────────────────────────────────────

def get_manifest_items(lot_id, api_headers, retries=2):
    """
    GET /v1/manifests/{lotId} — devuelve items con capacity/memory reales.
    Retorna lista de {capacidad, cantidad, grado, modelo, descripcion}
    """
    url = f"https://order-process.bstock.com/v1/manifests/{lot_id}?limit=500&offset=0&exclude=metadata"

    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=api_headers, timeout=20)
            if r.status_code == 200:
                items = r.json().get('items', [])
                result = []
                for item in items:
                    attrs = item.get('attributes', {})
                    item_attrs = attrs.get('item', {})
                    cap = parsear_capacidad(
                        attrs.get('description', ''),
                        item_attrs.get('memory'),
                        item_attrs.get('capacity')
                    )
                    mobile = item.get('mobileDevice', {})
                    result.append({
                        'capacidad':  cap,
                        'cantidad':   item.get('quantity', 0),
                        'grado':      mobile.get('sellerGrade', 'N/A'),
                        'modelo':     attrs.get('model', 'N/A'),
                        'carrier':    mobile.get('carrierLockStatus', 'N/A'),
                        'descripcion': attrs.get('description', ''),
                    })
                return result
            elif r.status_code in (429, 503):
                time.sleep(2 ** attempt)
            else:
                return []
        except Exception as e:
            if attempt < retries:
                time.sleep(1)
    return []


def agrupar_por_capacidad(items):
    """Agrupa items del manifest por capacidad → {cap: {cantidad, grado, modelo}}"""
    grupos = {}
    for item in items:
        cap = item['capacidad']
        if cap not in grupos:
            grupos[cap] = {'cantidad': 0, 'grado': item['grado'], 'modelo': item['modelo'], 'carrier': item['carrier']}
        grupos[cap]['cantidad'] += item['cantidad']
    resultado = []
    for cap, data in grupos.items():
        resultado.append({
            'capacidad': cap,
            'cantidad':  data['cantidad'],
            'porcentaje': 0,
            'grado':     data['grado'],
            'modelo':    data['modelo'],
            'carrier':   data['carrier'],
        })
    total = sum(x['cantidad'] for x in resultado)
    for x in resultado:
        x['porcentaje'] = round(x['cantidad'] / total * 100, 1) if total else 0
    resultado.sort(key=lambda x: -x['cantidad'])
    return resultado


# ─── EXTRACCIÓN DE __NEXT_DATA__ ──────────────────────────────────────────────

def get_listing_data(listing_id, session, api_headers, retries=MAX_RETRIES):
    url = f'https://bstock.com/buy/listings/details/{listing_id}'

    for attempt in range(retries + 1):
        try:
            r = session.get(url, timeout=30)
            if r.status_code == 503:
                time.sleep(2 ** attempt)
                continue
            if not r.ok:
                return None, f"HTTP {r.status_code}"

            match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.DOTALL)
            if not match:
                return None, "No __NEXT_DATA__"

            data = json.loads(match.group(1))
            queries = data['props']['pageProps']['dehydratedState']['queries']

            for q in queries:
                listing = q.get('state', {}).get('data', {})
                if not isinstance(listing, dict) or 'lotId' not in listing:
                    continue

                lot     = listing.get('lot', {})
                auction = listing.get('auction', {})
                lot_id  = listing.get('lotId')

                # Capacidades desde __NEXT_DATA__
                caps_raw = lot.get('capacities', [])
                caps_next = []
                seen = {}
                for c in caps_raw:
                    for cap in c.get('capacities', []):
                        cap_norm = cap.strip()
                        if cap_norm.isdigit():
                            cap_norm += 'GB'
                        qty = c.get('quantity', 0)
                        seen[cap_norm] = seen.get(cap_norm, 0) + qty
                for cap_norm, qty in seen.items():
                    caps_next.append({'capacidad': cap_norm, 'cantidad': qty})
                caps_next.sort(key=lambda x: -x['cantidad'])

                # Si capacidades vienen del __NEXT_DATA__ y son útiles, usar esas
                # Si no (N/A o vacías), consultar el manifest
                caps_validas = [c for c in caps_next if c['capacidad'] not in ('N/A', '')]
                if not caps_validas and lot_id:
                    manifest_items = get_manifest_items(lot_id, api_headers)
                    if manifest_items:
                        caps_manifest = agrupar_por_capacidad(manifest_items)
                        caps_validas = caps_manifest
                    else:
                        caps_validas = caps_next  # fallback

                # Modelo
                modelos = lot.get('models', [])
                modelo = modelos[0]['models'][0] if modelos and modelos[0].get('models') else 'N/A'

                # Grado
                grades = lot.get('mobileDevice', {}).get('sellerGrades', [])
                grado = grades[0]['sellerGrades'][0] if grades and grades[0].get('sellerGrades') else 'N/A'

                # Carrier
                carriers = lot.get('mobileDevice', {}).get('carrierLockStatuses', [])
                carrier = carriers[0]['carrierLockStatuses'][0] if carriers and carriers[0].get('carrierLockStatuses') else 'N/A'

                # Cantidad total
                item_conditions = lot.get('itemConditions', [])
                cantidad_total = sum(ic.get('quantity', 0) for ic in item_conditions) or 1

                # Fabricante
                manufacturers = lot.get('manufacturers', [])
                fabricante = manufacturers[0]['manufacturers'][0] if manufacturers and manufacturers[0].get('manufacturers') else 'N/A'

                return {
                    'lot_id':         lot_id,
                    'titulo':         lot.get('title', 'N/A'),
                    'fabricante':     fabricante,
                    'modelo':         modelo,
                    'grado':          grado,
                    'carrier_lock':   carrier,
                    'cantidad_total': cantidad_total,
                    'precio_total':   auction.get('winningBidAmount') or 0,
                    'numero_pujas':   auction.get('numberOfBids', 0),
                    'precio_inicio':  auction.get('startPrice') or 0,
                    'capacidades':    caps_validas,
                }, None

        except Exception as e:
            if attempt < retries:
                time.sleep(1)
            else:
                return None, str(e)

    return None, f"Fallido tras {retries+1} intentos"


# ─── CLASE PRINCIPAL ──────────────────────────────────────────────────────────

class BStockCaptura:

    def __init__(self):
        self._init_db()
        self.cookies = leer_cookies_firefox()
        if not self.cookies:
            sys.exit(1)
        self.token = self.cookies.get('bstock_access_token', '')
        self.api_headers = {
            'Authorization': f'Bearer {self.token}',
            'Accept': 'application/json',
            'X-Account-ID': ACCOUNT_ID,
            'Origin': 'https://bstock.com',
            'Referer': 'https://bstock.com/',
        }

    def _init_db(self):
        with sqlite3.connect(DB_PATH) as conn:
            conn.executescript(open("schema.sql").read())
        logger.info("BD inicializada")

    def _make_session(self):
        s = requests.Session()
        s.cookies.update(self.cookies)
        s.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8',
        })
        return s

    def _get_winning_bid(self, listing_id):
        r = requests.get(
            f"https://auction.bstock.com/v1/auctions/by-listing-id/{listing_id}",
            headers=self.api_headers, timeout=20
        )
        if not r.ok:
            return 0
        auction = r.json()
        precio = auction.get('winningBidAmount')
        if precio:
            return precio
        auction_id = auction.get('_id')
        if auction_id and auction.get('numberOfBids', 0) > 0:
            r2 = requests.get(
                f"https://auction.bstock.com/v1/auctions/{auction_id}/bids",
                headers=self.api_headers, timeout=20
            )
            if r2.ok:
                for bid in r2.json().get('bids', []):
                    if bid.get('winning'):
                        return bid.get('bidAmount', 0)
        return 0

    def _capacidad_resumen(self, caps):
        if not caps:
            return 'N/A'
        validas = [c for c in caps if c['capacidad'] not in ('N/A', '')]
        if not validas:
            return 'N/A'
        if len(validas) == 1:
            return validas[0]['capacidad']
        return 'MIXTO:' + '/'.join(c['capacidad'] for c in validas)

    def capturar(self, listing_ids, dia_subasta):
        listing_ids = [x.strip() for x in listing_ids if x.strip()]
        total = len(listing_ids)
        t0 = time.time()

        logger.info("=" * 60)
        logger.info(f"CAPTURA {dia_subasta} — {total} lotes | {MAX_WORKERS} hilos")
        logger.info("=" * 60)

        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        hora_ahora = datetime.now().strftime("%H:%M:%S")
        semana = datetime.now().isocalendar()[1]
        anio   = datetime.now().year

        resultados = []
        errores    = []
        completados = 0

        def fetch(listing_id):
            session = self._make_session()
            return listing_id, get_listing_data(listing_id, session, self.api_headers)

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(fetch, lid): lid for lid in listing_ids}

            for future in as_completed(futures):
                listing_id, (datos, err) = future.result()
                completados += 1

                if err or not datos:
                    errores.append(f"{listing_id}: {err}")
                    logger.warning(f"⚠️  [{completados}/{total}] {listing_id[:18]}… | {err}")
                    continue

                precio_total   = datos['precio_total']
                cantidad_total = datos['cantidad_total']

                if precio_total == 0 and datos['numero_pujas'] > 0:
                    precio_total = self._get_winning_bid(listing_id)

                precio_unitario = round(precio_total / cantidad_total, 2) if precio_total else 0
                caps_str = ' | '.join(
                    f"{c['capacidad']}({c['cantidad']}u)" for c in datos['capacidades']
                ) or 'N/A'

                emoji = "✅" if precio_total > 0 else "⚠️ "
                logger.info(
                    f"{emoji} [{completados}/{total}] {listing_id[:16]}… | "
                    f"${precio_total:>8,.0f} | {cantidad_total:>3}u | "
                    f"${precio_unitario:>7,.0f}/u | {caps_str}"
                )

                resultados.append({
                    'listing_id':               listing_id,
                    'titulo':                   datos['titulo'],
                    'fabricante':               datos['fabricante'],
                    'modelo':                   datos['modelo'],
                    'capacidad':                self._capacidad_resumen(datos['capacidades']),
                    'grado':                    datos['grado'],
                    'carrier_lock':             datos['carrier_lock'],
                    'cantidad_total':           cantidad_total,
                    'precio_total':             precio_total,
                    'precio_unitario_promedio': precio_unitario,
                    'fecha_subasta':            fecha_hoy,
                    'dia_semana':               dia_subasta,
                    'hora_cierre':              hora_ahora,
                    'semana_iso':               semana,
                    'anio':                     anio,
                    'numero_pujas':             datos['numero_pujas'],
                    'precio_inicio':            datos['precio_inicio'],
                    'url':                      f"https://bstock.com/buy/listings/details/{listing_id}",
                    'capacidades_lista':        datos['capacidades'],
                })

        elapsed = round(time.time() - t0, 1)
        logger.info("=" * 60)
        logger.info(f"✅ COMPLETADO: {len(resultados)}/{total} lotes en {elapsed}s")
        if errores:
            logger.warning(f"⚠️  {len(errores)} errores:")
            for e in errores[:5]:
                logger.warning(f"   {e}")

        self._guardar(resultados)
        csv_file = self._exportar_csv(resultados)
        logger.info(f"📊 CSV: {csv_file}")
        logger.info("=" * 60)
        return resultados

    def _guardar(self, resultados):
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            for r in resultados:
                cur.execute("""
                    INSERT OR REPLACE INTO subastas
                    (listing_id, titulo, fabricante, modelo, capacidad,
                     grado, carrier_lock, cantidad_total, precio_total,
                     precio_unitario_promedio, fecha_subasta, dia_semana, hora_cierre,
                     semana_iso, anio, numero_pujas, precio_inicio, url)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    r['listing_id'], r['titulo'], r['fabricante'], r['modelo'],
                    r['capacidad'], r['grado'], r['carrier_lock'],
                    r['cantidad_total'], r['precio_total'],
                    r['precio_unitario_promedio'], r['fecha_subasta'],
                    r['dia_semana'], r['hora_cierre'], r['semana_iso'],
                    r['anio'], r['numero_pujas'], r['precio_inicio'], r['url']
                ))

                cur.execute("DELETE FROM lote_items WHERE listing_id = ?", (r['listing_id'],))
                precio_u = r['precio_unitario_promedio']
                for cap in r['capacidades_lista']:
                    cur.execute("""
                        INSERT OR IGNORE INTO lote_items
                        (id, listing_id, modelo, capacidad, grado, color,
                         carrier_lock, fuente_inventario, cantidad, precio_unitario_estimado)
                        VALUES (?,?,?,?,?,?,?,?,?,?)
                    """, (
                        f"{r['listing_id']}_{cap['capacidad']}",
                        r['listing_id'], r['modelo'], cap['capacidad'],
                        r['grado'], 'N/A', r['carrier_lock'], 'N/A',
                        cap['cantidad'], precio_u
                    ))
            conn.commit()
        logger.info(f"Guardados {len(resultados)} lotes en BD")

    def _exportar_csv(self, resultados):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        fname = f"subastas_{ts}.csv"
        with open(fname, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow([
                "Listing ID", "Título", "Fabricante", "Modelo", "Capacidad",
                "Grado", "Unidades", "Precio Total", "Precio/Unidad",
                "Día", "Fecha", "Pujas", "URL"
            ])
            for r in resultados:
                w.writerow([
                    r['listing_id'], r['titulo'], r['fabricante'], r['modelo'],
                    r['capacidad'], r['grado'], r['cantidad_total'],
                    r['precio_total'], r['precio_unitario_promedio'],
                    r['dia_semana'], r['fecha_subasta'], r['numero_pujas'], r['url']
                ])
        return fname


def main():
    dia = sys.argv[1].upper() if len(sys.argv) >= 2 else "MARTES"
    if dia not in ("MARTES", "JUEVES"):
        print("Uso: python captura.py MARTES  |  python captura.py JUEVES")
        sys.exit(1)
    BStockCaptura().capturar(LISTING_IDS, dia)

if __name__ == "__main__":
    main()
