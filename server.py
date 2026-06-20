#!/usr/bin/env python3
"""
server.py — reemplaza "python -m http.server 8080"
Sirve el dashboard igual + bridge para el sniper.

Uso: python server.py
"""
import json, threading, time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

# ── Estado en memoria (se limpia al reiniciar el server) ─────────────────────
_cmds   = {}   # lid -> {amount, ts}
_status = {}   # lid -> {result, status, ts}
_lock   = threading.Lock()

class Handler(SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        # Solo loguear errores, no cada request de archivos estaticos
        if args and str(args[1]) not in ('200', '304'):
            super().log_message(fmt, *args)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        # GET /sniper/cmd/{lid} — userscript pregunta si hay comando pendiente
        if path.startswith('/sniper/cmd/'):
            lid = path.split('/')[-1]
            with _lock:
                cmd = _cmds.pop(lid, None)
            if cmd:
                print(f"[SNIPER] Comando entregado a userscript: {lid} -> ${cmd['amount']:,}")
                self._json(200, {'ok': True, 'amount': cmd['amount']})
            else:
                self._json(200, {'ok': False})
            return

        # GET /sniper/status/{lid} — dashboard consulta resultado
        if path.startswith('/sniper/status/'):
            lid = path.split('/')[-1]
            with _lock:
                st = _status.get(lid)
            self._json(200, st or {'result': None})
            return

        # GET /sniper/all — dashboard consulta todos los estados activos
        if path == '/sniper/all':
            with _lock:
                data = dict(_status)
            self._json(200, data)
            return

        # Todo lo demas: servir archivos estaticos igual que http.server
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path

        # POST /sniper/cmd — dashboard envia comando de puja
        if path == '/sniper/cmd':
            body = self._read_body()
            lid    = body.get('lid', '')
            amount = body.get('amount', 0)
            if not lid or not amount:
                self._json(400, {'error': 'lid y amount requeridos'})
                return
            with _lock:
                _cmds[lid] = {'amount': amount, 'ts': time.time()}
                _status[lid] = {'result': 'PENDING', 'amount': amount, 'ts': time.time()}
            print(f"[SNIPER] Comando recibido del dashboard: {lid} -> ${amount:,}")
            self._json(200, {'ok': True})
            return

        # POST /sniper/status — userscript reporta resultado
        if path == '/sniper/status':
            body = self._read_body()
            lid  = body.get('lid', '')
            if not lid:
                self._json(400, {'error': 'lid requerido'})
                return
            with _lock:
                _status[lid] = {
                    'result':  body.get('result', 'UNKNOWN'),
                    'status':  body.get('status', ''),
                    'amount':  body.get('amount', 0),
                    'msg':     body.get('msg', ''),
                    'ts':      time.time()
                }
            print(f"[SNIPER] Resultado del userscript: {lid} -> {body.get('result')} / {body.get('status')}")
            self._json(200, {'ok': True})
            return

        self._json(404, {'error': 'Not found'})

if __name__ == '__main__':
    PORT = 8080
    server = HTTPServer(('', PORT), Handler)
    print(f"Dashboard: http://localhost:{PORT}/dashboard.html")
    print(f"Sniper bridge activo en /sniper/cmd  /sniper/status")
    print("Ctrl+C para detener\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer detenido.")
