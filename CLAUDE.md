# REGLA OBLIGATORIA — GRAPHIFY FIRST

Este proyecto usa Graphify para reducir consumo de contexto/tokens.

Antes de explorar el repositorio, buscar archivos relacionados o leer múltiples
archivos, SIEMPRE consulta primero Graphify.

Flujo obligatorio:

1. Ejecuta una consulta Graphify relacionada con la tarea.
2. Identifica únicamente los archivos, símbolos y dependencias relevantes.
3. Lee solamente esos archivos.
4. No recorras src/ completo.
5. No leas archivos grandes "por si acaso".
6. No vuelvas a leer archivos que ya están en el contexto.
7. Amplía la búsqueda únicamente si Graphify no proporciona información suficiente.

Para cambios pequeños:
Graphify → archivos afectados → editar → verificar.

Para bugs:
Graphify → localizar flujo/dependencias → leer archivos implicados → diagnosticar → editar.

PROHIBIDO comenzar una tarea haciendo búsquedas masivas por todo el repositorio
si Graphify puede localizar primero el código relevante.

---

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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
