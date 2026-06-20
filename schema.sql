CREATE TABLE IF NOT EXISTS subastas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id TEXT,
    auction_internal_id TEXT,
    titulo TEXT,
    fabricante TEXT,
    modelo TEXT,
    capacidad TEXT,
    grado TEXT,
    carrier_lock TEXT,
    cantidad_total INTEGER,
    precio_total REAL,
    precio_unitario_promedio REAL,
    moneda TEXT DEFAULT 'USD',
    fecha_subasta DATE,
    dia_semana TEXT,
    hora_cierre TIME,
    semana_iso INTEGER,
    anio INTEGER,
    numero_pujas INTEGER,
    precio_inicio REAL,
    url TEXT,
    estado TEXT DEFAULT 'ACTIVO',
    capturado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(listing_id, fecha_subasta)
);

CREATE TABLE IF NOT EXISTS lote_items (
    id TEXT PRIMARY KEY,
    listing_id TEXT,
    modelo TEXT,
    capacidad TEXT,
    grado TEXT,
    color TEXT,
    carrier_lock TEXT,
    fuente_inventario TEXT,
    cantidad INTEGER,
    precio_unitario_estimado REAL,
    FOREIGN KEY (listing_id) REFERENCES subastas(listing_id)
);

CREATE INDEX IF NOT EXISTS idx_modelo     ON subastas(modelo);
CREATE INDEX IF NOT EXISTS idx_capacidad  ON subastas(modelo, capacidad);
CREATE INDEX IF NOT EXISTS idx_fecha      ON subastas(fecha_subasta);
CREATE INDEX IF NOT EXISTS idx_semana     ON subastas(semana_iso, anio);
CREATE INDEX IF NOT EXISTS idx_items_lid  ON lote_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_items_cap  ON lote_items(modelo, capacidad);
