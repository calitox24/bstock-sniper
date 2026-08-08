"""Verifica que get_listing_data reporte la causa REAL en vez de un mensaje generico."""
import json, sys

import requests
import captura

HDRS = {}


class FakeResp:
    def __init__(self, status=200, text='', url='https://bstock.com/buy/listings/details/6a1f321d74cd6714ed8bcc55'):
        self.status_code = status
        self.text = text
        self.url = url

    @property
    def ok(self):
        return 200 <= self.status_code < 400


class FakeSession:
    def __init__(self, resp):
        self.resp = resp
        self.calls = 0

    def get(self, url, timeout=None):
        self.calls += 1
        if isinstance(self.resp, Exception):
            raise self.resp
        return self.resp


def pagina(next_data, url='https://bstock.com/buy/listings/details/6a1f321d74cd6714ed8bcc55'):
    html = ('<html><body><script id="__NEXT_DATA__" type="application/json">'
            + json.dumps(next_data) + '</script></body></html>')
    return FakeResp(200, html, url)


def nd(queries, page='/buy/listings/details/[id]', props_extra=None):
    props = {'dehydratedState': {'queries': queries}}
    props.update(props_extra or {})
    return {'page': page, 'props': {'pageProps': props}}


casos = []

# 1. EL CASO DEL LOG: 200 OK, NEXT_DATA valido, queries sin 'lotId' (lote expirado)
queries_exp = [
    {'queryKey': ['listing', 'X'], 'state': {'data': {'id': 'X', 'status': 'CLOSED', 'expired': True}}},
    {'queryKey': ['storefront'], 'state': {'data': {'name': 'BStock'}}},
]
casos.append(('lote expirado (caso del log)', FakeSession(pagina(nd(queries_exp))), 1))

# 2. notFound
casos.append(('listing borrado', FakeSession(pagina(nd([], props_extra={'notFound': True}))), 1))

# 3. sesion caida: sin queries + marcador de login
html_login = ('<html><body>Please sign in<script id="__NEXT_DATA__" type="application/json">'
              + json.dumps(nd([])) + '</script></body></html>')
casos.append(('sesion caida', FakeSession(FakeResp(200, html_login)), 1))

# 4. esquema cambiado
casos.append(('esquema cambiado',
              FakeSession(pagina({'page': '/x', 'props': {'pageProps': {'otraCosa': 1}}})), 1))

# 5. WAF / sin NEXT_DATA
casos.append(('sin NEXT_DATA', FakeSession(FakeResp(200, '<html>captcha</html>')), 1))

# 6. 503 persistente -> SI reintenta 3 veces
casos.append(('503 persistente', FakeSession(FakeResp(503, '')), 3))

# 7. 404 -> no reintenta
casos.append(('404', FakeSession(FakeResp(404, '')), 1))

# 8. error de red -> reintenta
casos.append(('timeout de red', FakeSession(requests.exceptions.ConnectTimeout('sin ruta')), 3))

# 9. JSON truncado -> reintenta
html_trunc = '<html><script id="__NEXT_DATA__">{"props": {"pageP</script></html>'
casos.append(('JSON truncado', FakeSession(FakeResp(200, html_trunc)), 3))

print('=' * 78)
fallos = 0
for nombre, sess, intentos_esperados in casos:
    captura.time.sleep = lambda s: None  # no dormir en el test
    datos, err = captura.get_listing_data('6a1f321d74cd6714ed8bcc55', sess, HDRS)
    ok_msg = err is not None and 'Fallido tras' not in err
    ok_reintentos = sess.calls == intentos_esperados
    estado = 'OK ' if (ok_msg and ok_reintentos) else 'FAIL'
    if estado == 'FAIL':
        fallos += 1
    print(f"[{estado}] {nombre}")
    print(f"       peticiones={sess.calls} (esperadas {intentos_esperados})")
    print(f"       motivo: {err}")
print('=' * 78)

# 10. Caso feliz: un lote real se sigue parseando igual
listing_ok = {
    'lotId': 'LOT1',
    'lot': {
        'title': 'iPhone 12 lote',
        'capacities': [{'capacities': ['128'], 'quantity': 10}],
        'models': [{'models': ['iPhone 12']}],
        'manufacturers': [{'manufacturers': ['Apple']}],
        'mobileDevice': {'sellerGrades': [{'sellerGrades': ['AA+(T)']}],
                         'carrierLockStatuses': [{'carrierLockStatuses': ['Unlocked']}]},
        'itemConditions': [{'quantity': 10}],
    },
    'auction': {'actualEndTime': '2026-06-09T18:30:00Z', 'winningBidAmount': 6875,
                'numberOfBids': 12, 'startPrice': 100},
}
sess = FakeSession(pagina(nd([{'queryKey': ['listing'], 'state': {'data': listing_ok}}])))
datos, err = captura.get_listing_data('X', sess, HDRS)
if err or not datos:
    print(f"[FAIL] caso feliz -> {err}")
    fallos += 1
else:
    print(f"[OK ] caso feliz: {datos['modelo']} | {datos['grado']} | "
          f"{datos['dia_cierre']} {datos['fecha_cierre']} | {datos['capacidades']}")

print('=' * 78)
print('FALLOS:', fallos)
sys.exit(1 if fallos else 0)
