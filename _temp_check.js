
let D = null;
let chartTend = null;

function fmt$(n){ return n==null?'—':'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function fmtU$(n){ return n==null?'—':'$'+Number(n).toFixed(2); }
function fmtPct(n){ return (n>0?'+':'')+Number(n).toFixed(1)+'%'; }
function bstock(id){ return `https://bstock.com/buy/listings/details/${id}`; }

function gradeBadge(g){
  if(!g||g==='N/A') return `<span class="badge b-muted">N/A</span>`;
  if(g.includes('AA')) return `<span class="badge b-green">${g}</span>`;
  if(g.startsWith('A+')) return `<span class="badge b-green">${g}</span>`;
  if(g.startsWith('A')) return `<span class="badge b-blue">${g}</span>`;
  return `<span class="badge b-amber">${g}</span>`;
}

function pujasBadge(n){
  if(!n||n===0) return `<span class="muted">0</span>`;
  if(n>=5) return `<span class="badge b-red">${n}</span>`;
  if(n>=3) return `<span class="badge b-amber">${n}</span>`;
  return `<span class="badge b-muted">${n}</span>`;
}

// ─── TAB 1: ULTIMA SUBASTA ───────────────────────────────────────────────────
function buildSubasta(){
  const u = D.ultima_subasta || {};
  if(!u.fecha_subasta){ document.getElementById('tab-subasta').innerHTML='<div class="empty">Sin datos de subasta cerrada.</div>'; return; }

  const maxPrecio = Math.max(...(u.por_modelo||[]).map(r=>r.valor_total||0), 1);

  document.getElementById('tab-subasta').innerHTML = `
  <div class="kpis">
    <div class="kpi blue"><div class="kpi-val" style="color:var(--blue)">${u.total_cerrados||0}</div><div class="kpi-lbl">Lotes cerrados</div></div>
    <div class="kpi green"><div class="kpi-val" style="color:var(--green)">${fmt$(u.valor_total)}</div><div class="kpi-lbl">Valor total subastado</div></div>
    <div class="kpi amber"><div class="kpi-val" style="color:var(--amber)">${fmtU$(u.precio_prom)}/u</div><div class="kpi-lbl">Precio promedio/u</div></div>
    <div class="kpi red"><div class="kpi-val" style="color:var(--red)">${u.abiertos||0}</div><div class="kpi-lbl">Aun abiertos (proxima subasta)</div></div>
    <div class="kpi purple"><div class="kpi-val" style="color:var(--purple)">${(u.unidades_total||0).toLocaleString()}</div><div class="kpi-lbl">Unidades totales</div></div>
  </div>

  <div class="card">
    <div class="card-title">Valor total por modelo — ${u.dia_semana||''} ${u.fecha_subasta||''}</div>
    ${(u.por_modelo||[]).map(r=>`
      <div class="bar-row">
        <div class="bar-label">${r.modelo||'N/A'}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((r.valor_total/maxPrecio)*100)}%;background:var(--blue);"></div></div>
        <div class="bar-val">${fmt$(r.valor_total)}</div>
      </div>`).join('')}
  </div>

  <div class="g2">
    <div class="card">
      <div class="card-title" style="color:var(--green)">Mejores precios (mas barato/u)</div>
      <table>
        <tr><th>Modelo</th><th>Capacidad</th><th>Grado</th><th>$/u</th><th>Uds</th><th>Pujas</th><th></th></tr>
        ${(u.mejores||[]).map(r=>`
        <tr>
          <td>${r.modelo||'N/A'}</td>
          <td class="muted">${r.capacidad||'N/A'}</td>
          <td>${gradeBadge(r.grado)}</td>
          <td class="num" style="color:var(--green)">${fmtU$(r.precio_unitario_promedio)}</td>
          <td class="muted">${r.cantidad_total||0}</td>
          <td>${pujasBadge(r.numero_pujas)}</td>
          <td><a href="${bstock(r.listing_id)}" target="_blank">Ver</a></td>
        </tr>`).join('')}
      </table>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--red)">Subieron vs su promedio historico</div>
      ${(u.subieron_vs_hist||[]).length === 0
        ? `<div class="empty" style="padding:20px;">No hay datos historicos suficientes para comparar aun. Se necesitan subastas previas del mismo modelo+capacidad+grado.</div>`
        : `<table>
        <tr><th>Modelo</th><th>Capacidad</th><th>Grado</th><th>$/u esta vez</th><th>Hist. prom $/u</th><th>Subio</th><th>Pujas</th><th></th></tr>
        ${(u.subieron_vs_hist||[]).map(r=>`
        <tr>
          <td>${r.modelo||'N/A'}</td>
          <td class="muted">${r.capacidad||'N/A'}</td>
          <td>${gradeBadge(r.grado)}</td>
          <td class="num" style="color:var(--red)">${fmtU$(r.precio_unitario_promedio)}</td>
          <td class="num muted">${fmtU$(r.hist_avg)}</td>
          <td><span class="badge b-red">+${r.subio_pct}%</span></td>
          <td>${pujasBadge(r.numero_pujas)}</td>
          <td><a href="${bstock(r.listing_id)}" target="_blank">Ver</a></td>
        </tr>`).join('')}
      </table>`}
    </div>
  </div>

  <div class="card">
    <div class="card-title" style="color:var(--amber)">Lotes con mas competencia (mas pujados)</div>
    <table>
      <tr><th>Modelo</th><th>Capacidad</th><th>Grado</th><th>Pujas</th><th>$/u</th><th>Uds</th><th></th></tr>
      ${(u.mas_pujados||[]).map(r=>`
      <tr>
        <td>${r.modelo||'N/A'}</td>
        <td class="muted">${r.capacidad||'N/A'}</td>
        <td>${gradeBadge(r.grado)}</td>
        <td>${pujasBadge(r.numero_pujas)}</td>
        <td class="num">${fmtU$(r.precio_unitario_promedio)}</td>
        <td class="muted">${r.cantidad_total||0}</td>
        <td><a href="${bstock(r.listing_id)}" target="_blank">Ver</a></td>
      </tr>`).join('')}
    </table>
  </div>`;
}

// ─── SNIPER HELPERS ──────────────────────────────────────────────────────────
function parseCierreET(fecha, hora){
  // fecha="2026-06-23", hora="12:41 PM" (ET = UTC-4 en verano)
  if(!fecha||!hora) return null;
  const m = hora.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(!m) return null;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  const ap = m[3].toUpperCase();
  if(ap==='PM'&&h!==12) h+=12;
  if(ap==='AM'&&h===12) h=0;
  return new Date(Date.UTC(
    parseInt(fecha.slice(0,4)), parseInt(fecha.slice(5,7))-1, parseInt(fecha.slice(8,10)),
    h+4, min, 0
  ));
}

function fmtCountdown(ms){
  if(ms<=0) return '<span style="color:var(--red)">CERRADA</span>';
  const s=Math.floor(ms/1000), m=Math.floor(s/60), hh=Math.floor(m/60), d=Math.floor(hh/24);
  if(d>0) return `${d}d ${hh%24}h ${m%60}m`;
  if(hh>0) return `${hh}h ${m%60}m ${s%60}s`;
  if(m>0){
    const color = m<2?'var(--red)':m<10?'var(--amber)':'var(--text)';
    return `<span style="color:${color};font-weight:700;">${m}m ${s%60}s</span>`;
  }
  return `<span style="color:var(--red);font-weight:900;font-size:15px;">${s}s</span>`;
}

function getSniperCfg(lid){
  try{ return JSON.parse(localStorage.getItem('sniper_'+lid)||'{}'); }catch{ return {}; }
}
function saveSniperCfg(lid, cfg){
  localStorage.setItem('sniper_'+lid, JSON.stringify(cfg));
}

function sniperMotivo(r, cfg){
  const now = Date.now();
  const cierre = parseCierreET(r.fecha_cierre, r.hora_cierre);
  const secsLeft = cierre ? Math.floor((cierre.getTime()-now)/1000) : null;
  const maxUnit = parseFloat(cfg.maxUnit)||0;
  const seg     = parseInt(cfg.seg)||10;
  const on      = cfg.on||false;
  const qty     = r.unidades||0;
  const maxTotal = qty&&maxUnit ? qty*maxUnit : 0;
  const miPuja  = r.mi_puja||0;
  const pxUnit  = qty&&miPuja ? miPuja/qty : 0;

  if(!on)       return {txt:'Sniper OFF', cls:'muted'};
  if(!maxUnit)  return {txt:'Configura max $/u', cls:'amber'};
  if(!qty)      return {txt:'QTY desconocida', cls:'amber'};
  if(secsLeft===null) return {txt:'Sin tiempo', cls:'amber'};
  if(secsLeft<=0)     return {txt:'CERRADA', cls:'muted'};
  if(r.status==='WINNING') return {txt:'Vas ganando', cls:'green'};
  if(maxTotal && miPuja > maxTotal) return {txt:'Supera tu max', cls:'red'};
  if(secsLeft<=seg)  return {txt:'DISPARANDO', cls:'red'};
  return {txt:`Espera ${secsLeft-seg}s mas`, cls:'blue'};
}

// ─── TAB 2: MIS PUJAS PERDIDAS ───────────────────────────────────────────────
function buildPujas(){
  const mp = D.mis_pujas || {};
  const perdidas = mp.perdidas || [];
  const ganadas  = mp.ganadas  || [];
  const activas  = mp.activas  || [];
  const sc       = mp.status_count || {};

  if(!mp.total){
    document.getElementById('tab-pujas').innerHTML = `
    <div class="card">
      <div class="card-title">Mis pujas perdidas</div>
      <div class="empty">
        <p style="margin-bottom:12px;">No hay datos de pujas aun.</p>
        <p style="font-size:12px;color:var(--muted);">Corra <code>python fetch_mis_pujas.py</code> para descargar tu historial de pujas desde BStock.</p>
      </div>
    </div>`;
    return;
  }

  const totalDiff   = perdidas.reduce((s,r)=>s+(r.diferencia||0),0);
  const cercanas    = perdidas.filter(r=>(r.diferencia||0)>0&&r.diferencia<500).length;
  const fechaDesc   = (mp.fecha_descarga||'').replace('T',' ');

  const subieron = (D.ultima_subasta?.subieron_todos || []);
  const subioMap = {};
  for(const s of subieron){
    const k = `${s.modelo}|${s.capacidad}|${s.grado}`;
    subioMap[k] = s;
  }

  function getSubio(r){
    return subioMap[`${r.modelo}|${r.capacidad}|${r.grado}`] || null;
  }

  const perdidasYSubieron = perdidas.filter(r => getSubio(r));
  const modelosPujas = [...new Set(perdidas.map(r=>r.modelo).filter(Boolean))].sort();

  function rowsPujas(lista, showSubioCol=false){
    if(!lista.length) return `<tr><td colspan="${showSubioCol?11:10}" class="muted" style="text-align:center;padding:20px;">Sin resultados</td></tr>`;
    return lista.map(r=>{
      const diff = r.diferencia || 0;
      const cls  = diff>0&&diff<200?'b-amber':'b-red';
      const nombreModelo = r.modelo || r.titulo?.split(' - ')[0] || 'N/A';
      const cap  = r.capacidad && !r.capacidad.startsWith('MIXTO') ? r.capacidad : (r.titulo?.match(/\d+GB/)?.[0]||r.capacidad||'N/A');
      const sub  = showSubioCol ? getSubio(r) : null;
      const uds  = r.unidades || 0;
      const pxU  = uds && r.precio_ganador ? fmtU$(r.precio_ganador / uds) : '—';
      const miPxU= uds && r.mi_puja ? fmtU$(r.mi_puja / uds) : '—';
      return `<tr${sub?' style="background:rgba(245,166,35,.07)"':''}>
        <td>${nombreModelo}${sub?` <span class="badge b-amber" style="font-size:10px;">+${sub.subio_pct}%</span>`:''}</td>
        <td class="muted">${cap}</td>
        <td>${gradeBadge(r.grado)}</td>
        <td class="num" style="color:var(--teal);" title="Mi $/u: ${miPxU}">${pxU}</td>
        <td class="num">${fmt$(r.mi_puja)}</td>
        <td class="num" style="color:var(--red)">${fmt$(r.precio_ganador)}</td>
        <td>${diff>0?`<span class="badge ${cls}">+${fmt$(diff)}</span>`:'<span class="muted">—</span>'}</td>
        ${showSubioCol?`<td style="color:var(--amber);font-size:12px;">${sub?`${fmtU$(sub.precio_unitario_promedio)} <span class="muted">${sub.capacidad||''} ${sub.grado||''}</span>`:'—'}</td>`:''}
        <td class="muted">${uds||0}</td>
        <td class="muted">${r.fecha_cierre||''} ${r.hora_cierre||''}</td>
        <td><a href="${bstock(r.listing_id)}" target="_blank">Ver</a></td>
      </tr>`;
    }).join('');
  }

  // ── Sniper panel HTML ──
  function inputCfg(lid, field, val, extra=''){
    return `onchange="(function(el){const c=getSniperCfg('${lid}');c.${field}=${field==='on'?'el.checked':`(${field==='seg'?'parseInt':'parseFloat'}(el.value)||${field==='seg'?10:0})`};saveSniperCfg('${lid}',c);updateSniperRow('${lid}');})(this)"${extra}`;
  }

  function sniperRows(lista){
    return lista.map(r=>{
      const cfg     = getSniperCfg(r.listing_id);
      const maxUnit = cfg.maxUnit||'';
      const seg     = cfg.seg!==undefined ? cfg.seg : 10;
      const on      = cfg.on||false;
      const qty     = r.unidades||0;
      const pxUnit  = qty&&r.mi_puja ? r.mi_puja/qty : null;
      const mu      = parseFloat(maxUnit)||0;
      const maxTotal= qty&&mu ? qty*mu : null;
      const motivo  = sniperMotivo(r, cfg);
      const cierre  = parseCierreET(r.fecha_cierre, r.hora_cierre);
      const nombreCorto = r.modelo || r.titulo?.split(' - ')[1] || r.titulo?.split(' - ')[0] || 'N/A';
      const lid = r.listing_id;

      const estadoHtml = r.status==='WINNING'
        ? `<span class="badge b-green" style="font-size:12px;font-weight:800;">WINNING</span>`
        : r.status==='LOSING'
        ? `<span class="badge b-red" style="font-size:12px;font-weight:800;">LOSING</span>`
        : `<span class="badge b-muted" style="font-size:12px;">N/A</span>`;

      const motivoCls = {red:'background:#991b1b;color:#fca5a5',green:'background:#14532d;color:#86efac',
        blue:'background:#1e3a5f;color:#93c5fd',amber:'background:#78350f;color:#fcd34d',muted:'background:var(--bg3);color:var(--muted)'};

      return `<tr class="sniper-row" data-lid="${lid}" style="border-bottom:1px solid var(--border);">
        <td style="min-width:160px;padding:10px 10px;">
          <div style="font-weight:700;font-size:13px;color:var(--text);line-height:1.3;">${nombreCorto}</div>
          <div style="font-size:11px;margin-top:3px;display:flex;gap:4px;align-items:center;">
            <span class="muted">${r.capacidad||''}</span>
            ${r.grado?gradeBadge(r.grado):''}
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:3px;">${r.titulo?.split(' - ').slice(-1)[0]||''}</div>
        </td>
        <td style="text-align:center;padding:10px 8px;" class="sniper-estado-${lid}">${estadoHtml}</td>
        <td style="text-align:center;font-size:13px;font-weight:600;padding:10px 8px;" class="sniper-cd-${lid}">
          ${cierre ? fmtCountdown(cierre.getTime()-Date.now()) : '<span class="muted">—</span>'}
        </td>
        <td style="text-align:right;padding:10px 8px;">
          <div class="num" style="font-size:14px;font-weight:700;color:var(--amber)">${fmt$(r.mi_puja)}</div>
          <div style="font-size:10px;color:var(--muted);">mi max bid</div>
        </td>
        <td style="text-align:right;padding:10px 8px;">
          <div class="num muted" style="font-size:13px;">—</div>
          <div style="font-size:10px;color:var(--muted);">proxima</div>
        </td>
        <td style="text-align:center;padding:10px 8px;">
          <div style="font-size:15px;font-weight:700;">${qty||'—'}</div>
          <div style="font-size:10px;color:var(--muted);">QTY</div>
        </td>
        <td style="text-align:right;padding:10px 8px;">
          <div class="num" style="font-size:13px;color:var(--teal)">${pxUnit?'$'+pxUnit.toFixed(2):'—'}</div>
          <div style="font-size:10px;color:var(--muted);">$/u actual</div>
        </td>
        <td style="padding:10px 8px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px;text-align:center;">MAX $/u</div>
          <input type="number" value="${maxUnit}" placeholder="380" ${inputCfg(lid,'maxUnit',maxUnit)}
            style="width:80px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 8px;font-size:13px;font-weight:700;text-align:right;display:block;">
        </td>
        <td style="padding:10px 8px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px;text-align:center;">SEG.</div>
          <input type="number" value="${seg}" min="1" max="120" ${inputCfg(lid,'seg',seg)}
            style="width:60px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 8px;font-size:13px;font-weight:700;text-align:center;display:block;">
        </td>
        <td style="text-align:right;padding:10px 8px;" class="sniper-maxtotal-wrap-${lid}">
          <div class="num" style="font-size:13px;font-weight:700;color:var(--amber);">${maxTotal?fmt$(maxTotal):'—'}</div>
          <div style="font-size:10px;color:var(--muted);">${qty&&mu?`${qty} x ${fmt$(mu)}`:'max total'}</div>
        </td>
        <td style="text-align:center;padding:10px 12px;">
          <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="position:relative;width:40px;height:22px;">
              <input type="checkbox" ${on?'checked':''} ${inputCfg(lid,'on',on)}
                class="sniper-chk-${lid}"
                style="opacity:0;position:absolute;width:100%;height:100%;cursor:pointer;margin:0;z-index:1;">
              <div class="sniper-track-${lid}" style="position:absolute;inset:0;border-radius:11px;transition:background .2s;
                background:${on?'var(--green)':'#334155'};"></div>
              <div class="sniper-thumb-${lid}" style="position:absolute;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;
                left:${on?'21px':'3px'};"></div>
            </div>
            <span style="font-size:11px;font-weight:700;${on?'color:var(--green)':'color:var(--muted)'}" class="sniper-onlbl-${lid}">${on?'ON':'OFF'}</span>
          </label>
        </td>
        <td style="padding:10px 8px;" class="sniper-motivo-${lid}">
          <span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;${motivoCls[motivo.cls]||motivoCls.muted}">${motivo.txt}</span>
        </td>
        <td style="padding:10px 10px;white-space:nowrap;display:flex;flex-direction:column;gap:6px;border-bottom:none;">
          <a href="${bstock(lid)}" target="_blank"
            style="display:block;background:var(--blue);color:#fff;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;text-decoration:none;text-align:center;">
            Abrir
          </a>
          <button onclick="sniperDisparar('${lid}')"
            class="sniper-btn-${lid}"
            style="background:#15803d;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;width:100%;">
            Pujar
          </button>
          <div class="sniper-result-${lid}" style="font-size:10px;text-align:center;color:var(--muted);min-height:14px;"></div>
        </td>
      </tr>`;
    }).join('');
  }

  document.getElementById('tab-pujas').innerHTML = `
  <div class="kpis">
    <div class="kpi red"><div class="kpi-val" style="color:var(--red)">${sc.lost||perdidas.length}</div><div class="kpi-lbl">Subastas perdidas</div></div>
    <div class="kpi green"><div class="kpi-val" style="color:var(--green)">${sc.won||ganadas.length}</div><div class="kpi-lbl">Subastas ganadas</div></div>
    <div class="kpi amber"><div class="kpi-val" style="color:var(--amber)">${activas.length}</div><div class="kpi-lbl">Pujas activas ahora</div></div>
    <div class="kpi purple"><div class="kpi-val" style="color:var(--purple)">${cercanas}</div><div class="kpi-lbl">Perdiste por menos de $500</div></div>
    <div class="kpi blue"><div class="kpi-val" style="color:var(--blue)">${fmt$(totalDiff)}</div><div class="kpi-lbl">Dinero total que te falto</div></div>
  </div>

  ${activas.length ? `
  <div class="card" style="border-color:var(--amber);padding:0;overflow:hidden;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);">
      <div style="font-size:14px;font-weight:700;color:var(--amber);">
        Pujas activas &mdash; Panel Sniper (${activas.length})
      </div>
      <div class="muted" style="font-size:11px;">Config guardada por subasta en el browser. "Abrir" va a BStock donde el sniper se activa.</div>
    </div>
    <div style="overflow-x:auto;">
    <table id="sniper-table" style="margin:0;">
      <tr style="background:var(--bg3);">
        <th style="padding:8px 10px;">Subasta</th>
        <th style="padding:8px 8px;text-align:center;">Estado</th>
        <th style="padding:8px 8px;text-align:center;">Tiempo</th>
        <th style="padding:8px 8px;text-align:right;">P. Act</th>
        <th style="padding:8px 8px;text-align:right;">Proxima</th>
        <th style="padding:8px 8px;text-align:center;">QTY</th>
        <th style="padding:8px 8px;text-align:right;">$/u Act</th>
        <th style="padding:8px 8px;text-align:center;">Max $/u</th>
        <th style="padding:8px 8px;text-align:center;">Seg.</th>
        <th style="padding:8px 8px;text-align:right;">Max Total</th>
        <th style="padding:8px 12px;text-align:center;">ON</th>
        <th style="padding:8px 8px;">Motivo</th>
        <th style="padding:8px 10px;">Accion</th>
      </tr>
      ${sniperRows(activas)}
    </table>
    </div>
  </div>` : ''}

  <div class="card" style="${perdidasYSubieron.length?'border-color:var(--amber)':''}">
    <div class="card-title" style="color:var(--amber)">Modelos que perdiste y subieron de precio — mismo modelo+capacidad+grado</div>
    ${perdidasYSubieron.length ? `
    <p class="muted" style="font-size:12px;margin-bottom:12px;">Estos lotes los perdiste y en la ultima subasta el mismo modelo/capacidad/grado se vendio por encima de su promedio historico. Considera subir tu bid.</p>
    <div style="overflow-x:auto;">
    <table>
      <tr><th>Modelo</th><th>Capacidad</th><th>Grado</th><th>$/u final</th><th>Mi max bid</th><th>Precio final</th><th>Te falto</th><th>$/u ultima subasta</th><th>Uds</th><th>Fecha</th><th></th></tr>
      ${rowsPujas(perdidasYSubieron, true)}
    </table>
    </div>` : `

    <p class="muted" style="font-size:13px;padding:8px 0;">
      Sin coincidencias exactas por ahora. Los lotes que subieron en la ultima subasta son grado <strong>C(T)</strong> mientras tus pujas son grado <strong>B(T)+</strong>.
      A medida que se acumulen mas subastas con los mismos modelos/capacidad/grado apareceran aqui.
    </p>`}
  </div>

  <div class="card">
    <div class="card-title">Todas las pujas perdidas (${perdidas.length}) &nbsp;<span class="muted" style="font-size:11px;font-weight:400;">Actualizado: ${fechaDesc}</span></div>
    <div style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <input class="search-box" id="pujas-search" placeholder="Buscar titulo o modelo..." oninput="filtrarPujas()">
      <select id="pujas-modelo" onchange="filtrarPujas()" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;">
        <option value="">Todos los modelos</option>
        ${modelosPujas.map(m=>`<option value="${m}">${m}</option>`).join('')}
      </select>
    </div>
    <div style="overflow-x:auto;">
    <table id="pujas-table">
      <tr><th>Modelo</th><th>Capacidad</th><th>Grado</th><th>$/u final</th><th>Mi max bid</th><th>Precio final</th><th>Te falto</th><th>Uds</th><th>Fecha / Hora ET</th><th></th></tr>
      ${rowsPujas(perdidas)}
    </table>
    </div>
  </div>`;

  // guarda rows para filtrar
  window._pujasData = perdidas;
  window._rowsPujas = rowsPujas;
}

function filtrarPujas(){
  const q  = (document.getElementById('pujas-search')?.value||'').toLowerCase();
  const m  = document.getElementById('pujas-modelo')?.value||'';
  const t  = document.getElementById('pujas-table');
  if(!t) return;
  let lista = window._pujasData||[];
  if(q) lista = lista.filter(r=>(r.titulo||'').toLowerCase().includes(q)||(r.modelo||'').toLowerCase().includes(q));
  if(m) lista = lista.filter(r=>r.modelo===m);
  const tbody = t.querySelector('tbody') || t;
  const rows = window._rowsPujas(lista);
  // reemplazar todas las filas excepto header
  const header = t.querySelector('tr');
  t.innerHTML = '';
  t.appendChild(header);
  t.insertAdjacentHTML('beforeend', rows);
}

// ─── TAB 3: REFERENCIA DE PRECIOS ────────────────────────────────────────────
function buildReferencia(){
  const ref = D.referencia || [];
  const modelos = [...new Set(ref.map(r=>r.modelo))].sort();

  document.getElementById('tab-referencia').innerHTML = `
  <div class="card">
    <div class="card-title">Tabla de referencia historica — precios reales de cierre</div>
    <div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <input class="search-box" id="ref-search" placeholder="Buscar modelo..." oninput="filtrarRef()">
      <span class="muted" style="font-size:12px;">${ref.length} SKUs · Solo lotes CERRADO</span>
    </div>
    <div style="overflow-x:auto;">
    <table id="ref-table">
      <tr>
        <th>Modelo</th><th>Capacidad</th><th>Grado</th>
        <th>Promedio $/u</th><th>Minimo $/u</th><th>Maximo $/u</th>
        <th>Subastas</th><th>Pujas prom</th><th>Ultima vez</th>
      </tr>
      ${ref.map(r=>`
      <tr data-modelo="${(r.modelo||'').toLowerCase()}">
        <td>${r.modelo||'N/A'}</td>
        <td class="muted">${r.capacidad||'N/A'}</td>
        <td>${gradeBadge(r.grado)}</td>
        <td class="num" style="color:var(--blue)">${fmtU$(r.precio_prom)}</td>
        <td class="num" style="color:var(--green)">${fmtU$(r.precio_min)}</td>
        <td class="num" style="color:var(--red)">${fmtU$(r.precio_max)}</td>
        <td class="muted">${r.num_subastas||0}</td>
        <td class="muted">${r.pujas_prom!=null?Number(r.pujas_prom).toFixed(1):'—'}</td>
        <td class="muted">${r.ultima_vez||'—'}</td>
      </tr>`).join('')}
    </table>
    </div>
  </div>`;
}

function filtrarRef(){
  const q = document.getElementById('ref-search').value.toLowerCase();
  document.querySelectorAll('#ref-table tr[data-modelo]').forEach(tr=>{
    tr.style.display = tr.dataset.modelo.includes(q)?'':'none';
  });
}

// ─── TAB 4: OPORTUNIDADES ────────────────────────────────────────────────────
function buildOportunidades(){
  const ops = D.oportunidades || [];
  document.getElementById('tab-oportunidades').innerHTML = ops.length ? `
  <div class="card">
    <div class="card-title" style="color:var(--green)">Lotes que se fueron baratos (vs promedio historico)</div>
    <p class="muted" style="font-size:12px;margin-bottom:14px;">Lotes cerrados con precio/u al menos 10% por debajo del promedio historico. Estos son los que alguien ganó barato.</p>
    <table>
      <tr><th>Modelo</th><th>Capacidad</th><th>Grado</th><th>Precio real $/u</th><th>Hist. prom $/u</th><th>Descuento</th><th>Pujas</th><th>Uds</th><th>Fecha</th></tr>
      ${ops.map(r=>`
      <tr>
        <td>${r.modelo||'N/A'}</td>
        <td class="muted">${r.capacidad||'N/A'}</td>
        <td>${gradeBadge(r.grado)}</td>
        <td class="num" style="color:var(--green)">${fmtU$(r.precio_u)}</td>
        <td class="num muted">${fmtU$(r.hist_prom)}</td>
        <td><span class="badge b-green">${fmtPct(r.descuento_pct)}</span></td>
        <td>${pujasBadge(r.pujas)}</td>
        <td class="muted">${r.unidades||0}</td>
        <td class="muted">${r.dia||''} ${r.fecha||''}</td>
      </tr>`).join('')}
    </table>
  </div>` : `<div class="card"><div class="empty">No hay oportunidades detectadas aun.<br><span class="muted" style="font-size:12px;">Se necesitan al menos 2 subastas del mismo modelo+capacidad+grado para comparar.</span></div></div>`;
}

// ─── TAB 5: SUBIERON DE PRECIO ───────────────────────────────────────────────
function buildSubieron(){
  const u = D.ultima_subasta || {};
  const todos = u.subieron_todos || [];

  document.getElementById('tab-subieron').innerHTML = `
  <div class="card">
    <div class="card-title">Lotes que subieron vs su promedio historico — ${u.dia_semana||''} ${u.fecha_subasta||''}</div>
    <p class="muted" style="font-size:12px;margin-bottom:14px;">
      Lotes donde el precio de cierre supero al menos 5% el promedio historico de ese modelo+capacidad+grado.
      Esto indica alta competencia o demanda inusual.
    </p>
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
      <input class="search-box" id="sub-search" placeholder="Buscar modelo..." oninput="filtrarSubieron()" style="width:220px;">
      <select id="sub-grado" onchange="filtrarSubieron()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px;">
        <option value="">Todos los grados</option>
        <option>A+(T)</option><option>AA+(T)</option><option>A(T)</option><option>B+(T)</option><option>C(T)</option>
      </select>
      <span class="muted" style="font-size:12px;" id="sub-count">${todos.length} lotes</span>
    </div>
    ${todos.length === 0
      ? `<div class="empty">Sin datos historicos suficientes para comparar. Se necesitan subastas previas del mismo modelo.</div>`
      : `<div style="overflow-x:auto;">
      <table id="sub-table">
        <tr>
          <th>Modelo</th><th>Capacidad</th><th>Grado</th>
          <th>$/u esta vez</th><th>Hist. prom $/u</th>
          <th>Subio</th><th>Pujas</th><th>Uds</th><th></th>
        </tr>
        ${todos.map(r=>`
        <tr data-modelo="${(r.modelo||'').toLowerCase()}" data-grado="${r.grado||''}">
          <td>${r.modelo||'N/A'}</td>
          <td class="muted">${r.capacidad||'N/A'}</td>
          <td>${gradeBadge(r.grado)}</td>
          <td class="num" style="color:var(--red)">${fmtU$(r.precio_unitario_promedio)}</td>
          <td class="num muted">${fmtU$(r.hist_avg)}</td>
          <td><span class="badge b-red">+${r.subio_pct}%</span></td>
          <td>${pujasBadge(r.numero_pujas)}</td>
          <td class="muted">${r.cantidad_total||0}</td>
          <td><a href="${bstock(r.listing_id)}" target="_blank">Ver</a></td>
        </tr>`).join('')}
      </table></div>`}
  </div>`;
}

function filtrarSubieron(){
  const q = (document.getElementById('sub-search')?.value||'').toLowerCase();
  const g = document.getElementById('sub-grado')?.value||'';
  let visible = 0;
  document.querySelectorAll('#sub-table tr[data-modelo]').forEach(tr=>{
    const show = tr.dataset.modelo.includes(q) && (g===''||tr.dataset.grado===g);
    tr.style.display = show ? '' : 'none';
    if(show) visible++;
  });
  const cnt = document.getElementById('sub-count');
  if(cnt) cnt.textContent = visible+' lotes';
}

// ─── TAB 6: TENDENCIAS ───────────────────────────────────────────────────────
function buildTendencias(){
  const tend = D.tendencias || [];
  const modelos = [...new Set(tend.map(r=>r.modelo))].sort();

  document.getElementById('tab-tendencias').innerHTML = `
  <div class="card">
    <div class="card-title">Tendencia de precios por modelo</div>
    <div style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <select id="tend-modelo" onchange="renderTendencia()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px;">
        ${modelos.map(m=>`<option value="${m}">${m}</option>`).join('')}
      </select>
      <select id="tend-grado" onchange="renderTendencia()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px;">
        <option value="">Todos los grados</option>
        <option>A+(T)</option><option>AA+(T)</option><option>A(T)</option><option>B+(T)</option>
      </select>
    </div>
    <div style="position:relative;height:300px;"><canvas id="chart-tend"></canvas></div>
  </div>
  <div class="card" id="tend-tabla">
    <div class="card-title">Datos historicos del modelo seleccionado</div>
    <table id="tend-table-inner"></table>
  </div>`;

  renderTendencia();
}

function renderTendencia(){
  const tend = D.tendencias || [];
  const modelo = document.getElementById('tend-modelo')?.value || '';
  const grado  = document.getElementById('tend-grado')?.value  || '';

  const filtrado = tend.filter(r=>
    r.modelo===modelo &&
    (grado===''||r.grado===grado) &&
    r.precio_prom > 0
  );

  const caps = [...new Set(filtrado.map(r=>r.capacidad))].sort();
  const colors = ['#4f8ef7','#34c98a','#f5a623','#f05454','#a78bfa','#2dd4bf'];

  const datasets = caps.map((cap,i)=>{
    const pts = filtrado.filter(r=>r.capacidad===cap)
      .sort((a,b)=>a.anio-b.anio||a.semana_iso-b.semana_iso);
    return {
      label: cap,
      data: pts.map(r=>({x:`Sem ${r.semana_iso}/${r.anio}`, y:r.precio_prom})),
      borderColor: colors[i%colors.length],
      backgroundColor: 'transparent',
      tension:.3, pointRadius:4,
    };
  });

  if(chartTend){ chartTend.destroy(); chartTend=null; }
  const ctx = document.getElementById('chart-tend');
  if(!ctx) return;

  chartTend = new Chart(ctx,{
    type:'line',
    data:{ datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'#8b8fa8',font:{size:12}}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: $${Number(c.parsed.y).toFixed(2)}/u`}}
      },
      scales:{
        x:{ticks:{color:'#8b8fa8',font:{size:11}},grid:{color:'#2e3247'}},
        y:{ticks:{color:'#8b8fa8',font:{size:11},callback:v=>'$'+v},grid:{color:'#2e3247'}}
      }
    }
  });

  // Tabla historica
  const rows = filtrado.sort((a,b)=>b.anio-a.anio||b.semana_iso-a.semana_iso||a.capacidad.localeCompare(b.capacidad));
  const table = document.getElementById('tend-table-inner');
  if(table){
    table.innerHTML = `
    <tr><th>Semana</th><th>Dia</th><th>Capacidad</th><th>Grado</th><th>Prom $/u</th><th>Min $/u</th><th>Max $/u</th><th>Lotes</th><th>Pujas prom</th></tr>
    ${rows.map(r=>`
    <tr>
      <td class="muted">Sem ${r.semana_iso}/${r.anio}</td>
      <td class="muted">${r.dia_semana||''}</td>
      <td>${r.capacidad||'N/A'}</td>
      <td>${gradeBadge(r.grado)}</td>
      <td class="num" style="color:var(--blue)">${fmtU$(r.precio_prom)}</td>
      <td class="num" style="color:var(--green)">${fmtU$(r.precio_min)}</td>
      <td class="num" style="color:var(--red)">${fmtU$(r.precio_max)}</td>
      <td class="muted">${r.num_lotes||0}</td>
      <td class="muted">${r.pujas_prom!=null?Number(r.pujas_prom).toFixed(1):'—'}</td>
    </tr>`).join('')}`;
  }
}

// ─── CARGA PRINCIPAL ─────────────────────────────────────────────────────────
// ─── SNIPER: actualizar fila individual ──────────────────────────────────────
function updateSniperRow(lid){
  if(!D) return;
  const activas = (D.mis_pujas||{}).activas||[];
  const r = activas.find(x=>x.listing_id===lid);
  if(!r) return;
  const cfg = getSniperCfg(lid);
  const motivo = sniperMotivo(r, cfg);
  const on = cfg.on||false;
  const qty = r.unidades||0;
  const mu  = parseFloat(cfg.maxUnit)||0;
  const maxTotal = qty&&mu ? qty*mu : null;

  // motivo
  const motivoCls = {red:'background:#991b1b;color:#fca5a5',green:'background:#14532d;color:#86efac',
    blue:'background:#1e3a5f;color:#93c5fd',amber:'background:#78350f;color:#fcd34d',muted:'background:var(--bg3);color:var(--muted)'};
  const mEl = document.querySelector('.sniper-motivo-'+lid);
  if(mEl) mEl.innerHTML = `<span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;${motivoCls[motivo.cls]||motivoCls.muted}">${motivo.txt}</span>`;

  // ON label + toggle track + thumb
  const lEl = document.querySelector('.sniper-onlbl-'+lid);
  if(lEl){ lEl.textContent=on?'ON':'OFF'; lEl.style.color=on?'var(--green)':'var(--muted)'; lEl.style.fontWeight='700'; }
  const track = document.querySelector('.sniper-track-'+lid);
  if(track) track.style.background = on ? 'var(--green)' : '#334155';
  const thumb = document.querySelector('.sniper-thumb-'+lid);
  if(thumb) thumb.style.left = on ? '21px' : '3px';

  // max total cell
  const mtWrap = document.querySelector('.sniper-maxtotal-wrap-'+lid);
  if(mtWrap) mtWrap.innerHTML = `
    <div class="num" style="font-size:13px;font-weight:700;color:var(--amber);">${maxTotal?'$'+maxTotal.toLocaleString('en-US',{maximumFractionDigits:0}):'—'}</div>
    <div style="font-size:10px;color:var(--muted);">${qty&&mu?`${qty} x $${mu.toLocaleString('en-US',{maximumFractionDigits:0})}`:'max total'}</div>`;
}

// ─── SNIPER: disparar puja desde el dashboard via server.py ─────────────────
async function sniperDisparar(lid){
  if(!D) return;
  const activas = (D.mis_pujas||{}).activas||[];
  const r = activas.find(x=>x.listing_id===lid);
  if(!r) return;

  const cfg = getSniperCfg(lid);
  const mu  = parseFloat(cfg.maxUnit)||0;
  const qty = r.unidades||0;
  if(!mu){ sniperSetResult(lid,'Configura Max $/u primero','var(--amber)'); return; }

  // Calcula monto: max total = qty * maxUnit (redondeado)
  const amount = qty ? Math.floor(qty * mu) : Math.floor(mu);

  const btn = document.querySelector('.sniper-btn-'+lid);
  if(btn){ btn.disabled=true; btn.textContent='Enviando...'; btn.style.background='#334155'; }
  sniperSetResult(lid,'Enviando comando...','var(--muted)');

  try {
    const res = await fetch('http://localhost:8080/sniper/cmd', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({lid, amount})
    });
    if(!res.ok) throw new Error('Server error '+res.status);
    sniperSetResult(lid,'Esperando userscript...','var(--amber)');
    if(btn){ btn.textContent='Esperando...'; }
    // Polling de resultado hasta 30 segundos
    sniperPollResult(lid, Date.now()+30000, btn);
  } catch(e) {
    sniperSetResult(lid,'Error: server.py no esta corriendo','var(--red)');
    if(btn){ btn.disabled=false; btn.textContent='Pujar'; btn.style.background='#15803d'; }
  }
}

function sniperSetResult(lid, msg, color){
  const el = document.querySelector('.sniper-result-'+lid);
  if(el){ el.textContent=msg; el.style.color=color; }
}

async function sniperPollResult(lid, deadline, btn){
  if(Date.now() > deadline){
    sniperSetResult(lid,'Timeout: abre la pagina en BStock','var(--amber)');
    if(btn){ btn.disabled=false; btn.textContent='Pujar'; btn.style.background='#15803d'; }
    return;
  }
  try {
    const res = await fetch('http://localhost:8080/sniper/status/'+lid);
    const data = await res.json();
    if(data.result && data.result !== 'PENDING'){
      const colorMap = {OK:'var(--green)', WINNING:'var(--green)', LOSING:'var(--red)', ERROR:'var(--red)', UNKNOWN:'var(--muted)'};
      const c = colorMap[data.result] || 'var(--muted)';
      sniperSetResult(lid, `${data.result}${data.status?' · '+data.status:''}${data.msg?' · '+data.msg:''}`, c);
      if(btn){ btn.disabled=false; btn.textContent='Pujar'; btn.style.background='#15803d'; }
      return;
    }
  } catch(e) {}
  setTimeout(()=>sniperPollResult(lid, deadline, btn), 1500);
}

// ─── SNIPER: ticker de countdown (corre cada segundo) ────────────────────────
if(window._sniperTicker) clearInterval(window._sniperTicker);
window._sniperTicker = setInterval(()=>{
  const activas = (D?.mis_pujas||{}).activas||[];
  for(const r of activas){
    const cdEl = document.querySelector('.sniper-cd-'+r.listing_id);
    if(!cdEl) continue;
    const cierre = parseCierreET(r.fecha_cierre, r.hora_cierre);
    if(cierre) cdEl.innerHTML = fmtCountdown(cierre.getTime()-Date.now());
    // actualizar motivo cada tick si sniper ON
    const cfg = getSniperCfg(r.listing_id);
    if(cfg.on) updateSniperRow(r.listing_id);
  }
}, 1000);

function cargar(){
  fetch('dashboard_data.json?t='+Date.now())
    .then(r=>r.json())
    .then(data=>{
      D = data;
      const ts = data.generado_en ? new Date(data.generado_en).toLocaleString('es') : '';
      document.getElementById('ts').textContent = 'Actualizado: '+ts;
      buildSubasta();
      buildPujas();
      buildReferencia();
      buildOportunidades();
      buildSubieron();
      buildTendencias();
    })
    .catch(()=>{ document.querySelector('main').innerHTML='<div style="text-align:center;padding:60px;color:#8b8fa8">Error cargando dashboard_data.json. Corra python analitica.py primero.</div>'; });
}

document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='tendencias') setTimeout(renderTendencia,50);
  });
});

cargar();
