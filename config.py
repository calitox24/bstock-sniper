# ─── BStock Analytics · Config ───────────────────────────────────────────────
import os
from datetime import date

ACCOUNT_ID = "67c38095b954cf41eef3a317"
DB_PATH = "bstock_analytics.db"

# Detecta automáticamente ids_{fecha_hoy}.txt; si no existe usa el más reciente
_ids_file = f"ids_{date.today().strftime('%Y-%m-%d')}.txt"

if not os.path.exists(_ids_file):
    import re as _re
    _candidatos = sorted(
        [f for f in os.listdir('.') if _re.match(r'^ids_\d{4}-\d{2}-\d{2}\.txt$', f)],
        reverse=True
    )
    if _candidatos:
        _ids_file = _candidatos[0]
        _fecha_ids = date.fromisoformat(_candidatos[0][4:14])
        _dias = (date.today() - _fecha_ids).days
        print(f"WARN: No hay IDs de hoy, usando {_ids_file} ({_dias} dias de antiguedad)")
        if _dias > 1:
            print(f"WARN: Los lotes de hace {_dias} dias ya expiraron en BStock y la captura "
                  f"fallara con SIN_LOTE. Ejecuta fetch_ids_api.py para regenerar la lista.")
    else:
        raise FileNotFoundError("No se encontro ningun ids_*.txt. Ejecuta fetch_ids_api.py primero.")

with open(_ids_file, "r", encoding="utf-8") as f:
    LISTING_IDS = [x.strip() for x in f.readlines() if x.strip()]

print(f"IDs: {len(LISTING_IDS)} lotes desde {_ids_file}")