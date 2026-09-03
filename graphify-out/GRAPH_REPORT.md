# Graph Report - bstock-sniper  (2026-09-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 219 nodes · 394 edges · 34 communities (11 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51cd4dc0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12

## God Nodes (most connected - your core abstractions)
1. `BStockCaptura` - 15 edges
2. `placeBid()` - 14 edges
3. `readState()` - 14 edges
4. `createPanel()` - 11 edges
5. `generar_reporte_json()` - 11 edges
6. `BStockCaptura` - 10 edges
7. `render()` - 10 edges
8. `Handler` - 9 edges
9. `bridgeTick()` - 9 edges
10. `sniperRows()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `fase_capturar()` --calls--> `BStockCaptura`  [EXTRACTED]
  pipeline.py → captura.py
- `fase_cierre()` --calls--> `BStockCaptura`  [EXTRACTED]
  pipeline.py → captura.py
- `main()` --calls--> `BStockCaptura`  [EXTRACTED]
  run.py → captura.py
- `fase_cierre()` --calls--> `generar_reporte_json()`  [EXTRACTED]
  pipeline.py → analitica.py
- `fase_cierre()` --calls--> `build_excel()`  [EXTRACTED]
  pipeline.py → export_subasta_excel.py

## Import Cycles
- None detected.

## Communities (34 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (39): addCurrentAuctionToVista360(), boot(), bridgeGet(), bridgePost(), bridgeTick(), createPanel(), findBidInput(), findConfirmButton() (+31 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (26): bstock(), buildOportunidades(), buildPujas(), getSubio(), inputCfg(), rowsPujas(), sniperRows(), buildReferencia() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (10): agrupar_por_capacidad(), BStockCaptura, get_listing_data(), get_manifest_items(), leer_cookies_firefox(), main(), parsear_capacidad(), Agrupa items del manifest por capacidad (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (20): build_excel(), capacity_str(), fetch_all(), fetch_page(), grade_str(), leer_cookies_firefox(), lot_id_str(), main() (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.16
Nodes (10): agrupar_por_capacidad(), BStockCaptura, get_listing_data(), get_manifest_items(), leer_cookies_firefox(), main(), parsear_capacidad(), Agrupa items del manifest por capacidad → {cap: {cantidad, grado, modelo}} (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (16): _enriquecer_capacidad(), generar_reporte_json(), get_conn(), mis_pujas_perdidas(), oportunidades(), Tabla de referencia historica: modelo + capacidad + grado. Precio promedio,…, Para lotes MIXTO reemplaza 'MIXTO:...' con '128GB(11) / 256GB(8)' desde…, Lotes que cerraron muy por debajo del promedio historico. Requiere al menos 2… (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.48
Nodes (6): extract_bids_data(), fetch_page(), get_firefox_token(), main(), normalizar(), Extrae la query uniqueUserBids del __NEXT_DATA__ de la pagina.

### Community 8 - "Community 8"
Cohesion: 0.38
Nodes (6): extraer_capacidad(), extraer_listing_id(), importar_csv(), Extrae listing_id del URL de B-stock, Extrae capacidad desde descripción, Importa CSV a la BD Args: csv_path: ruta del CSV fecha_subasta: ej "2026-06-11"…

### Community 9 - "Community 9"
Cohesion: 0.70
Nodes (4): bridgeGet(), bridgePost(), bridgeTick(), reportResult()

### Community 10 - "Community 10"
Cohesion: 0.83
Nodes (3): fetch_all_ids(), leer_cookies_firefox(), main()

### Community 11 - "Community 11"
Cohesion: 0.83
Nodes (3): fetch_page(), leer_cookies_firefox(), main()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BStockCaptura` connect `Community 2` to `Community 3`, `Community 5`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `generar_reporte_json()` connect `Community 5` to `Community 3`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14615384615384616 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._