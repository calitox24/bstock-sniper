# BStock Analytics — Sistema completo

## Archivos
```
bstock_system/
├── config.py          ← TOKEN, ACCOUNT_ID, DB_PATH
├── schema.sql         ← Estructura de la base de datos
├── captura.py         ← Captura precios + desglose por capacidad
├── analitica.py       ← Motor de tendencias, alertas, comparativas
├── run.py             ← Runner principal (captura + analítica de una vez)
├── dashboard.html     ← Dashboard visual (abrir en navegador)
├── ids_productos.txt  ← IDs de los lotes
└── bstock_analytics.db← Base de datos (se crea automáticamente)
```

## Uso

### Captura semanal
```bash
# Cada martes después de que cierren las subastas:
python run.py MARTES

# Cada jueves:
python run.py JUEVES
```

### Ver el dashboard
Abre `dashboard.html` directamente en Firefox/Chrome.

### Solo analítica (sin capturar)
```bash
python analitica.py
```

## Configuración del TOKEN
1. Abre bstock.com en Firefox → F12 → Red
2. Navega a cualquier subasta
3. Clic en cualquier petición a `auction.bstock.com`
4. Copia el valor completo de `Authorization: Bearer ...`
5. Pégalo en `config.py` → variable `TOKEN`

El token dura ~1 hora. Si ves errores 401, actualízalo.

## Base de datos
Tablas:
- `subastas` — un registro por lote, con precio unitario promedio
- `lote_items` — desglose por capacidad/SKU dentro de cada lote

## Lo que analiza el dashboard
- **Alertas** — modelos con precio >10% bajo el promedio (buen momento de compra)
- **Tendencias** — precio/unidad por semana, por modelo
- **Martes vs Jueves** — si el precio sube o baja entre días
- **Por Capacidad** — precio promedio segmentado por 128GB / 256GB / 1TB / etc.
- **Todos los lotes** — tabla filtrable con búsqueda por modelo
