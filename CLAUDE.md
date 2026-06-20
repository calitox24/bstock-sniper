# BStock Analytics — Contexto del Proyecto

## Qué hace este sistema
Scraper + analytics para subastas de teléfonos en BStock.com (mayorista).
Las subastas son **martes y jueves**. Se capturan lotes de iPhones/Android con precio, modelo, capacidad, grado y carrier.

## Flujo actual
```
Martes/Jueves mañana:
  python fetch_ids_api.py <TOKEN>   → ids_{fecha}.txt  (lista de IDs)
  python export_subasta_excel.py <TOKEN>  → subasta_{fecha}.xlsx

Tarde (cuando cierran las subastas):
  python run.py MARTES              → captura + analítica + dashboard_data.json
  Abrir dashboard.html en el navegador
```

## Autenticación
- **Firefox** debe estar abierto y logueado en bstock.com
- `captura.py` lee automáticamente `bstock_access_token` de las cookies de Firefox (sin pegar tokens)
- `fetch_ids_api.py` y `export_subasta_excel.py` aún piden el token por argumento → **pendiente migrar a cookies Firefox**

## Archivos clave
| Archivo | Qué hace |
|---------|----------|
| `captura.py` | Scraper principal. Lee cookies Firefox, descarga cada lote, guarda en SQLite + CSV |
| `analitica.py` | Genera `dashboard_data.json` con tendencias, alertas, comparativa mar/jue |
| `run.py` | Orquestador: `python run.py MARTES` o `python run.py JUEVES` |
| `config.py` | Lee ACCOUNT_ID, DB_PATH, y LISTING_IDS del archivo `ids_{fecha}.txt` |
| `schema.sql` | Esquema SQLite: tablas `subastas` y `lote_items` |
| `dashboard.html` | Dashboard estático (Chart.js) que lee `dashboard_data.json` |
| `fetch_ids_api.py` | Descarga todos los listing IDs de la subasta vía API |
| `export_subasta_excel.py` | Exporta todas las listings a Excel formateado |

## Base de datos
- Archivo: `bstock_analytics.db` (SQLite)
- Tabla `subastas`: un registro por lote (listing_id + fecha_subasta = UNIQUE)
- Tabla `lote_items`: desglose por capacidad de cada lote
- `INSERT OR REPLACE` — re-capturar sobreescribe el mismo lote del mismo día

## Config importante
```python
ACCOUNT_ID = "67c38095b954cf41eef3a317"   # fijo, no cambia
STOREFRONT_ID = "67ec2a5fee190bcb0e7469af" # fijo, en fetch_ids_api y export_excel
```

## APIs que usa
- `https://bstock.com/buy/listings/details/{id}` → parsea `__NEXT_DATA__` JSON del HTML
- `https://order-process.bstock.com/v1/manifests/{lotId}` → fallback para capacidades
- `https://auction.bstock.com/v1/auctions/by-listing-id/{id}` → precio de cierre
- `https://search.bstock.com/v1/all-listings/listings` → búsqueda paginada (POST)

## Mejoras pendientes
1. **Pipeline automático**: unificar fetch_ids + export_excel + captura en `pipeline.py inicio` / `pipeline.py cierre`
2. **Cookies Firefox en todos los scripts**: `fetch_ids_api.py` y `export_subasta_excel.py` deben leer cookies como `captura.py`
3. **Scheduler Windows**: Task Scheduler para correr el pipeline automáticamente mar/jue
4. **Actualizar config.py dinámicamente**: que detecte el archivo `ids_{fecha_hoy}.txt` sin editar el archivo a mano

## Datos actuales
- 353 lotes capturados, 101 modelos, ~29,738 unidades (junio 2026)
- Múltiples capturas del 17-Jun-2026 en los CSV
- Dashboard funcional con tabs: Alertas, Histórico, Tendencias, Mar vs Jue, Por Capacidad
