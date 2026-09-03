# Graph Report - bstock-sniper  (2026-09-03)

## Corpus Check
- 46 files · ~110,960 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 256 nodes · 427 edges · 38 communities (14 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `17fd3f46`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- bstock_sniper_mini_v06.user.js
- _temp_check.js
- BStockCaptura
- pipeline.py
- BStockCaptura
- analitica.py
- Handler
- fetch_mis_pujas.py
- importar_csv
- sniper_bridge.js
- cruce_subasta.py
- fetch_ids_api.py
- schema.sql
- check.py
- BStock Analytics — Contexto del Proyecto
- BStock Analytics — Contexto del Proyecto
- BStock Analytics — Sistema completo
- setup-graphify.sh

## God Nodes (most connected - your core abstractions)
1. `BStockCaptura` - 15 edges
2. `readState()` - 14 edges
3. `placeBid()` - 14 edges
4. `generar_reporte_json()` - 11 edges
5. `createPanel()` - 11 edges
6. `BStock Analytics — Contexto del Proyecto` - 11 edges
7. `render()` - 10 edges
8. `BStockCaptura` - 10 edges
9. `BStock Analytics — Contexto del Proyecto` - 10 edges
10. `sniperRows()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `fase_cierre()` --calls--> `generar_reporte_json()`  [EXTRACTED]
  pipeline.py → analitica.py
- `fase_capturar()` --calls--> `BStockCaptura`  [EXTRACTED]
  pipeline.py → captura.py
- `fase_cierre()` --calls--> `BStockCaptura`  [EXTRACTED]
  pipeline.py → captura.py
- `main()` --calls--> `BStockCaptura`  [EXTRACTED]
  run.py → captura.py
- `main()` --calls--> `generar_reporte_json()`  [EXTRACTED]
  run.py → analitica.py

## Import Cycles
- None detected.

## Communities (38 total, 4 thin omitted)

### Community 0 - "bstock_sniper_mini_v06.user.js"
Cohesion: 0.15
Nodes (39): addCurrentAuctionToVista360(), boot(), bridgeGet(), bridgePost(), bridgeTick(), createPanel(), findBidInput(), findConfirmButton() (+31 more)

### Community 1 - "_temp_check.js"
Cohesion: 0.16
Nodes (26): bstock(), buildOportunidades(), buildPujas(), getSubio(), inputCfg(), rowsPujas(), sniperRows(), buildReferencia() (+18 more)

### Community 2 - "BStockCaptura"
Cohesion: 0.13
Nodes (10): agrupar_por_capacidad(), BStockCaptura, get_listing_data(), get_manifest_items(), leer_cookies_firefox(), main(), parsear_capacidad(), Agrupa items del manifest por capacidad (+2 more)

### Community 3 - "pipeline.py"
Cohesion: 0.16
Nodes (20): build_excel(), capacity_str(), fetch_all(), fetch_page(), grade_str(), leer_cookies_firefox(), lot_id_str(), main() (+12 more)

### Community 4 - "BStockCaptura"
Cohesion: 0.16
Nodes (10): agrupar_por_capacidad(), BStockCaptura, get_listing_data(), get_manifest_items(), leer_cookies_firefox(), main(), parsear_capacidad(), Agrupa items del manifest por capacidad → {cap: {cantidad, grado, modelo}} (+2 more)

### Community 5 - "analitica.py"
Cohesion: 0.22
Nodes (16): _enriquecer_capacidad(), generar_reporte_json(), get_conn(), mis_pujas_perdidas(), oportunidades(), Tabla de referencia historica: modelo + capacidad + grado. Precio promedio,…, Para lotes MIXTO reemplaza 'MIXTO:...' con '128GB(11) / 256GB(8)' desde…, Lotes que cerraron muy por debajo del promedio historico. Requiere al menos 2… (+8 more)

### Community 7 - "fetch_mis_pujas.py"
Cohesion: 0.48
Nodes (6): extract_bids_data(), fetch_page(), get_firefox_token(), main(), normalizar(), Extrae la query uniqueUserBids del __NEXT_DATA__ de la pagina.

### Community 8 - "importar_csv"
Cohesion: 0.38
Nodes (6): extraer_capacidad(), extraer_listing_id(), importar_csv(), Extrae listing_id del URL de B-stock, Extrae capacidad desde descripción, Importa CSV a la BD Args: csv_path: ruta del CSV fecha_subasta: ej "2026-06-11"…

### Community 9 - "sniper_bridge.js"
Cohesion: 0.70
Nodes (4): bridgeGet(), bridgePost(), bridgeTick(), reportResult()

### Community 10 - "cruce_subasta.py"
Cohesion: 0.83
Nodes (3): fetch_all_ids(), leer_cookies_firefox(), main()

### Community 11 - "fetch_ids_api.py"
Cohesion: 0.83
Nodes (3): fetch_page(), leer_cookies_firefox(), main()

### Community 35 - "BStock Analytics — Contexto del Proyecto"
Cohesion: 0.15
Nodes (12): APIs que usa, Archivos clave, Autenticación, Base de datos, BStock Analytics — Contexto del Proyecto, Config importante, Datos actuales, Estado de las mejoras (verificado 2026-09-03) (+4 more)

### Community 36 - "BStock Analytics — Contexto del Proyecto"
Cohesion: 0.18
Nodes (10): APIs que usa, Archivos clave, Autenticación, Base de datos, BStock Analytics — Contexto del Proyecto, Config importante, Datos actuales, Flujo actual (+2 more)

### Community 38 - "BStock Analytics — Sistema completo"
Cohesion: 0.20
Nodes (9): Archivos, Base de datos, BStock Analytics — Sistema completo, Captura semanal, Configuración del TOKEN, Lo que analiza el dashboard, Solo analítica (sin capturar), Uso (+1 more)

## Knowledge Gaps
- **28 isolated node(s):** `setup-graphify.sh script`, `Qué hace este sistema`, `Flujo actual`, `Autenticación`, `Archivos clave` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 85 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BStockCaptura` connect `BStockCaptura` to `pipeline.py`, `analitica.py`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `generar_reporte_json()` connect `analitica.py` to `pipeline.py`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `setup-graphify.sh script`, `Qué hace este sistema`, `Flujo actual` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `bstock_sniper_mini_v06.user.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14615384615384616 - nodes in this community are weakly interconnected._
- **Should `BStockCaptura` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._