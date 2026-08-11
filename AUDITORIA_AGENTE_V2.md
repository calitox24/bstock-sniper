# Auditoría — Agente de pujas V2

**Fecha:** 2026-08-08 · **Rama:** `claude/auditoria-agente-ia-v2-u93ckj` · **Alcance:** agente automático de pujas (dashboard V2 + bridge + server + datos que alimentan sus decisiones).

> **Nota de alcance.** El repositorio no contiene ningún componente de IA/LLM (no hay llamadas a Anthropic, OpenAI ni ningún modelo). El único agente autónomo del proyecto es el **sniper de pujas**, cuya versión 2 vive en `_temp_check.js` (dashboard) + `sniper_bridge.js` / `bstock_sniper_mini_v06.user.js` (navegador) + `server.py` (puente). Esa es la V2 auditada aquí.

## Resumen ejecutivo

El agente V2 **no está operativo y, si se conectara tal como está, tampoco pujaría solo.** Tres problemas se combinan de la peor manera posible en un sistema que compromete dinero real:

1. El código de la V2 (`_temp_check.js`) **no lo carga nadie**: `dashboard.html` tiene su propia copia inline sin sniper.
2. Aunque se cargara, el interruptor **ON** y el badge **DISPARANDO** son puramente decorativos: ninguna ruta automática llama a `sniperDisparar()`.
3. Los datos sobre los que decide están **congelados en un snapshot manual**, y en el estado actual del repo eso ya produce subastas cerradas hace dos días mostradas como activas y "pujables".

A esto se suma que `server.py` acepta órdenes de puja **desde cualquier sitio web** y publica la base de datos completa a toda la red local.

| Severidad | Cantidad |
|---|---|
| Crítico | 5 |
| Alto | 7 |
| Medio | 6 |
| Bajo / higiene | 5 |

---

## Críticos

### C1 · La V2 no está conectada al dashboard
`_temp_check.js` (788 líneas) contiene el agente completo. `dashboard.html` tiene un `<script>` inline propio de 514 líneas **sin nada de sniper**, y su único `<script src>` es Chart.js — nunca carga `_temp_check.js`.

Las 7 funciones que sólo existen en la V2: `parseCierreET`, `fmtCountdown`, `getSniperCfg`, `saveSniperCfg`, `sniperMotivo`, `updateSniperRow`, `sniperSetResult` (más `sniperDisparar`, `sniperPollResult` y el ticker).

**Efecto:** el agente V2 no existe en tiempo de ejecución. Agravante: el archivo más crítico del sistema se llama `_temp_check.js` y hay dos copias divergentes del dashboard sin una fuente de verdad — es fácil editar la equivocada y creer que se arregló algo.

### C2 · El modo automático nunca puja
`sniperDisparar()` se invoca **exclusivamente** desde el `onclick` del botón "Pujar" (`_temp_check.js:324`). El ticker de un segundo (`_temp_check.js:748`) sólo repinta la interfaz mediante `updateSniperRow()`.

```js
// _temp_check.js:748 — el "automático" sólo pinta
window._sniperTicker = setInterval(()=>{
  for(const r of activas){
    if(cierre) cdEl.innerHTML = fmtCountdown(...);   // countdown
    if(cfg.on) updateSniperRow(r.listing_id);        // repinta el badge
  }                                                   // ← no hay disparo
}, 1000);
```

Poner MAX $/u, activar el toggle **ON** y ver el badge rojo **DISPARANDO** (`sniperMotivo` devuelve ese texto cuando `secsLeft <= seg`) **no envía ninguna puja**. Es automatización cosmética: el usuario cree estar cubierto, se va, y pierde el lote. Es el peor modo de fallo posible aquí — falla en silencio y en la dirección cara.

### C3 · Decide sobre datos obsoletos (demostrable en el repo)
`mis_pujas.activas` proviene de `mis_pujas.json`, un snapshot manual generado por `fetch_mis_pujas.py`. `analitica.py:enriquecer()` sólo lo cruza con la BD; no refresca nada en vivo. El estado actual del repositorio lo demuestra:

- `fecha_descarga` del snapshot: **2026-06-19**
- `generado_en` del dashboard: **2026-06-25**
- Las 4 subastas "activas" cerraron el **2026-06-23**

Es decir: el dashboard del día 25 lista como activas cuatro subastas cerradas dos días antes, con estados WINNING/LOSING de seis días antes, con countdown en vivo y botón "Pujar" habilitado. `sniperMotivo` sí devuelve `CERRADA` cuando el tiempo es negativo, pero **es sólo una etiqueta: no deshabilita el botón** ni bloquea `sniperDisparar`.

### C4 · CSRF — cualquier web puede pujar con tu dinero
`server.py` expone `POST /sniper/cmd` sin autenticación, sin token y con CORS abierto:

```python
def _cors(self):
    self.send_header('Access-Control-Allow-Origin', '*')      # cualquier origen
    self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    self.send_header('Access-Control-Allow-Headers', 'Content-Type')

def do_OPTIONS(self):            # el preflight pasa siempre
    self.send_response(204); self._cors(); self.end_headers()
```

Cualquier pestaña abierta en cualquier sitio puede hacer `fetch('http://localhost:8080/sniper/cmd', {method:'POST', ...})` y encolar una puja arbitraria, que el userscript ejecuta **y auto-confirma**. Además `HTTPServer(('', PORT))` escucha en **todas las interfaces**, no sólo en loopback.

### C5 · La base de datos completa, publicada a la red local
`Handler(SimpleHTTPRequestHandler)` sirve el directorio de trabajo entero. Combinado con el bind a `0.0.0.0:8080`, cualquiera en la red puede descargar `bstock_analytics.db` (1,4 MB — histórico completo de precios), `mis_pujas.json` (tus montos y estrategia), `captura.log` (448 KB) y los `.xlsx`. Es exactamente la ventaja competitiva del proyecto, servida sin credenciales.

---

## Altos

### A1 · Comandos sin expiración → puja fantasma
`_cmds[lid]` guarda un `ts` que **nunca se valida**. `_cmds.pop(lid)` entrega el comando al primer poller sin importar cuánto lleve encolado. Si se envía una puja con la pestaña de BStock cerrada, el comando queda en memoria y se dispara cuando esa página se abra — horas después, a un precio de mercado completamente distinto.

### A2 · Puja a ciegas: no conoce el precio de mercado
La columna "proxima" está **hardcodeada a `—`** (`_temp_check.js:276`). `sniperMotivo` nunca compara contra la puja mínima siguiente. Su única guarda de precio es:

```js
if(maxTotal && miPuja > maxTotal) return {txt:'Supera tu max', cls:'red'};
```

Compara **tu propia puja** contra tu propio techo, no el mercado contra el techo. Y como `sniperDisparar` envía exactamente `qty*maxUnit`, `miPuja` termina igual a `maxTotal` y nunca lo supera: **la guarda es código muerto**. El userscript sí hace la comprobación correcta (`st.nextMinBid > st.maxTotal`); el dashboard no tiene forma de saber si el lote ya se fue de precio.

### A3 · Dos estrategias económicas contradictorias
- **Userscript** (`tick`): puja **incremental**, `st.nextMinBid`, el mínimo siguiente.
- **Dashboard** (`sniperDisparar`): envía **el techo completo**, `Math.floor(qty*mu)`, de una sola vez.

En una subasta con proxy bidding entregar el máximo es defendible, y pujar el mínimo también — pero son decisiones opuestas conviviendo bajo el mismo concepto de "pujar", sin que esté escrito en ningún lado cuál aplica. Hoy no es posible saber cuánto se va a pagar sin leer el código.

### A4 · Un clic gasta el techo entero, sin confirmación
"Pujar" envía `Math.floor(qty*mu)` inmediatamente. Con `qty=25` y `max=$380/u` son **$9.500** sin diálogo de confirmación y sin mostrar el monto antes de enviarlo. El primer feedback del importe llega cuando ya se envió.

### A5 · Zona horaria fijada a horario de verano
```js
return new Date(Date.UTC(..., h+4, min, 0));   // ET = UTC-4, siempre
```
De noviembre a marzo ET es UTC-5. Todos los countdowns quedan **una hora adelantados**: el agente cree que falta una hora más de la que hay y no entra nunca en la ventana de disparo. Falla toda la temporada de invierno.

### A6 · Un falso "WON" congela el sniper del userscript
```js
if (/you won|winning bid/i.test(text) && !/Losing/i.test(text)) return 'WON';
```
Se evalúa sobre `document.body.innerText` completo. En el HTML real capturado (`debug_bids_page.html`) hay **35 ocurrencias de "winning" contra 2 de "losing"**: "winning bid" es parte normal del layout de una subasta. Si esa frase aparece y "Losing" no, `tick()` corta con "Ganaste la subasta" y no puja jamás.

### A7 · `N/A` se interpreta como "no vas ganando" → te sobrepujás solo
En páginas MODERN, `getRealStatus` cae a `'N/A'` si no encuentra el tag exacto `Winning`/`Losing`. `tick()` sólo se detiene ante `WINNING`, así que con `N/A` continúa y puja. Si en realidad ibas ganando, **subís tu propio precio contra vos mismo**. El bridge repite el criterio: `reportResult` etiqueta `'LOSING'` cualquier estado que no reconozca.

---

## Medios

**M1 · Bridge roto en páginas legacy.** El dashboard indexa comandos por `listing_id` (hex de 24 caracteres, p. ej. `6a3c6b3734015a7205d0c5d6`). El userscript usa `AUCTION_ID`, que en URLs legacy `/auction/auction/view/id/{n}` resuelve al **id numérico**. `GET /sniper/cmd/{numérico}` nunca coincide con la clave guardada → los comandos se pierden en silencio y el dashboard reporta "Timeout" a los 30 s.

**M2 · `qty=0` produce una puja de magnitud equivocada.** `enriquecer()` asigna `unidades: bd.get('cantidad_total', 0)`; si el lote no está en la BD queda 0, y `sniperDisparar` cae a `Math.floor(mu)`, enviando $380 como **total del lote**. Lo rechaza el mínimo, pero el usuario ve un ERROR sin causa clara en el peor momento posible.

**M3 · Estado del server sólo en memoria.** Reiniciar `server.py` borra `_cmds` y `_status`; el dashboard espera 30 s y reporta Timeout sin explicación.

**M4 · Ventana de re-puja no determinista.** `tick` corre cada 700 ms, con cooldown de 8 s y ventana `secondsLeft <= bidAtSeconds` (10 s por defecto); `placeBid` con confirmación tarda ~5 s. Alcanza para 1–2 disparos. Está acotado por `maxTotal`, pero el escalado en los segundos finales no es predecible.

**M5 · Sin traza de decisiones.** Ni el userscript ni el server persisten por qué se pujó o no. `setPanelLog` sobrescribe una única línea en pantalla. Hacer el post-mortem de un lote perdido es imposible.

**M6 · `bidAtSeconds` sin validar en el userscript.** El input del dashboard acota `min=1 max=120`; el del userscript no. `Number(String(v).replace(/[^\d]/g,''))` puede dar 0 → nunca entra en ventana.

---

## Bajos / higiene

- **B1** · El componente más crítico se llama `_temp_check.js` y no hay fuente de verdad única del dashboard.
- **B2** · Raíz del repo sin `.gitignore`: `captura_backup.py`, 6 `fix_*.py`, 3 `debug_bids*.py`, 2 `find_bids*.py`, 3 `check*.py`, 3 `test_*.py`, ~25 CSV, `.xlsx`, `captura.log` (448 KB) y el `.db` de 1,4 MB versionados.
- **B3** · `inputCfg` construye handlers `onchange` por interpolación de strings — inofensivo con IDs hexadecimales, pero es inyección de código por construcción.
- **B4** · `CONFIG.AUTO_CONFIRM: false` es engañoso: `tick()` llama `placeBid(..., {confirm:true})`, así que la ruta automática auto-confirma siempre, sin importar esa bandera.
- **B5** · `dashboard_data.json` (843 KB, regenerado en cada corrida) versionado.

---

## Orden de arreglo recomendado

**Antes de volver a usar el agente**

1. **C4 + C5** — atar el server a loopback y cerrar CORS. Es el arreglo más barato y el de mayor impacto:
   ```python
   server = HTTPServer(('127.0.0.1', PORT), Handler)
   # y en _cors():
   self.send_header('Access-Control-Allow-Origin', 'http://localhost:8080')
   ```
   Añadir además un token compartido en `POST /sniper/cmd`.
2. **C2** — decidir explícitamente: o el ticker llama a `sniperDisparar` cuando `cfg.on && secsLeft<=seg` (y entonces hacen falta A1, A2 y A4 antes), o se renombra el toggle a algo que no prometa automatismo. Lo que no puede quedar es un botón que dice DISPARANDO y no dispara.
3. **C3 + A1** — bloquear el botón cuando `secsLeft<=0`, mostrar la antigüedad de `fecha_descarga` en pantalla, y descartar en el server comandos con `ts` de más de ~60 s.

**Antes de automatizar de verdad**

4. **A2** — poblar la columna "proxima" con la puja mínima real y hacer que la guarda compare mercado contra techo, no tu puja contra tu techo.
5. **A3 + A4** — fijar y documentar una sola estrategia; mostrar el importe y pedir confirmación antes de comprometerlo.
6. **A6 + A7** — endurecer `getRealStatus`: acotar la búsqueda al contenedor de estado en vez de a `body.innerText`, y tratar `N/A` como "no pujar" en lugar de "no vas ganando".
7. **A5** — calcular el offset ET real (DST) en vez de `h+4`.

**Deuda**

8. **C1 + B1** — unificar el dashboard en un solo archivo y borrar la copia muerta.
9. **M1, M2, M3, M5** — alinear el id del bridge, validar `qty>0`, persistir el estado del server y registrar las decisiones.
10. **B2** — `.gitignore` y limpieza de la raíz.
