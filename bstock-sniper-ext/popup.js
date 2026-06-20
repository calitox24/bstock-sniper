// popup.js

let activas = [];
let cfgCache = {};
let cdInterval = null;
let lastWinTs = {};   // lid -> timestamp del ultimo WINNING conocido

// ── Utilidades ───────────────────────────────────────────────────────────────
function fmt$(n){ return n==null?'—':'$'+Math.round(Number(n)).toLocaleString('en-US'); }
function fmtU$(n){ return n==null?'—':'$'+Number(n).toFixed(2); }

function bstockUrl(lid){ return `https://bstock.com/buy/listings/details/${lid}`; }

function parseCierreET(fecha, hora){
  if(!fecha||!hora) return null;
  const m = hora.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(!m) return null;
  let h=parseInt(m[1]), min=parseInt(m[2]);
  const ap=m[3].toUpperCase();
  if(ap==='PM'&&h!==12) h+=12;
  if(ap==='AM'&&h===12) h=0;
  return new Date(Date.UTC(
    parseInt(fecha.slice(0,4)), parseInt(fecha.slice(5,7))-1, parseInt(fecha.slice(8,10)),
    h+4, min, 0
  ));
}

function fmtCountdown(ms){
  if(ms<=0) return '<span class="cd-red">CERRADA</span>';
  const s=Math.floor(ms/1000), m=Math.floor(s/60), hh=Math.floor(m/60), d=Math.floor(hh/24);
  if(d>0) return `${d}d ${hh%24}h ${m%60}m`;
  if(hh>0) return `${hh}h ${m%60}m ${s%60}s`;
  if(m>0){
    const cls = m<2?'cd-red':m<10?'cd-amber':'';
    return `<span class="${cls}">${m}m ${s%60}s</span>`;
  }
  return `<span class="cd-red" style="font-size:15px;">${s}s</span>`;
}

function getCfg(lid){ return cfgCache[lid] || {}; }

function saveCfg(lid, cfg){
  cfgCache[lid] = cfg;
  chrome.runtime.sendMessage({action:'saveCfg', lid, cfg});
}

function motivo(r, cfg){
  const secs = calcSecs(r);
  const mu   = parseFloat(cfg.maxUnit)||0;
  const seg  = parseInt(cfg.seg)||10;
  const on   = cfg.on||false;
  const qty  = r.unidades||0;
  const maxTotal = qty&&mu ? qty*mu : 0;
  const miPuja = r.mi_puja||0;

  if(!on) return {txt:'Sniper OFF', cls:'m-off'};
  if(!mu) return {txt:'Config Max $/u', cls:'m-cfg'};
  if(!qty) return {txt:'QTY desconocida', cls:'m-cfg'};
  if(secs===null) return {txt:'Sin tiempo', cls:'m-cfg'};
  if(secs<=0) return {txt:'CERRADA', cls:'m-off'};
  if(r.status==='WINNING') return {txt:'Vas ganando', cls:'m-win'};
  if(maxTotal && miPuja > maxTotal) return {txt:'Supera tu max', cls:'m-dis'};
  if(secs<=seg) return {txt:'DISPARANDO', cls:'m-dis'};
  return {txt:`Espera ${secs-seg}s`, cls:'m-wait'};
}

function calcSecs(r){
  if(r._endTimeUTC) return Math.floor((r._endTimeUTC - Date.now())/1000);
  const cierre = parseCierreET(r.fecha_cierre, r.hora_cierre);
  return cierre ? Math.floor((cierre.getTime()-Date.now())/1000) : null;
}

// ── Render tabla ─────────────────────────────────────────────────────────────
function render(){
  const tbody = document.getElementById('tbody');
  if(!activas.length){
    tbody.innerHTML = `<tr><td colspan="13" class="empty">No hay pujas activas</td></tr>`;
    return;
  }

  tbody.innerHTML = activas.map(r=>{
    const lid  = r.listing_id;
    const cfg  = getCfg(lid);
    const on   = cfg.on||false;
    const mu   = cfg.maxUnit||'';
    const seg  = cfg.seg!==undefined ? cfg.seg : 10;
    const qty  = r.unidades||0;
    const pxU  = qty&&r.mi_puja ? r.mi_puja/qty : null;
    const maxT = qty&&parseFloat(mu) ? qty*parseFloat(mu) : null;
    const mot  = motivo(r, cfg);
    const nombre = r.modelo || r.titulo?.split(' - ')[1] || r.titulo?.split(' - ')[0] || 'N/A';
    const secsR  = calcSecs(r);

    const estadoBadge = r.status==='WINNING'
      ? `<span class="badge b-green">WINNING</span>`
      : r.status==='LOSING'
      ? `<span class="badge b-red">LOSING</span>`
      : `<span class="badge b-muted">${r.status||'N/A'}</span>`;

    const gradeBadge = r.grado
      ? `<span class="badge b-amber" style="font-size:10px;">${r.grado}</span>`
      : '';

    return `<tr data-lid="${lid}">
      <td>
        <div style="font-weight:700;color:#e0f2fe;">${nombre}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">${r.capacidad||''} ${gradeBadge}</div>
        <div style="font-size:10px;color:#334155;margin-top:2px;">${lid.slice(-8)}</div>
      </td>
      <td>${estadoBadge}</td>
      <td class="cd-cell" data-lid="${lid}" style="font-size:12px;font-weight:600;">
        ${secsR !== null ? fmtCountdown(secsR * 1000) : '<span class="muted">—</span>'}
      </td>
      <td class="num" style="color:#fcd34d;">${fmt$(r.mi_puja)}<br><span class="muted" style="font-size:10px;font-weight:400;">mi max</span></td>
      <td class="num proxima-cell" data-lid="${lid}" style="color:#a78bfa;">
        ${r._nextMin ? fmt$(r._nextMin) : '<span class="muted">—</span>'}
        <br><span style="font-size:10px;color:#475569;">proxima</span>
      </td>
      <td style="text-align:center;">
        <div style="font-size:15px;font-weight:700;">${qty||'—'}</div>
      </td>
      <td class="num" style="color:#2dd4bf;">${pxU?fmtU$(pxU):'—'}</td>
      <td>
        <input type="number" value="${mu}" placeholder="380" class="cfg-maxunit" data-lid="${lid}"
          style="width:80px;">
      </td>
      <td>
        <input type="number" value="${seg}" min="1" class="cfg-seg" data-lid="${lid}"
          style="width:55px;text-align:center;">
      </td>
      <td class="num maxtotal-cell" data-lid="${lid}" style="color:#fcd34d;">
        ${maxT ? fmt$(maxT)+'<br><span class="muted" style="font-size:10px;font-weight:400;">'+qty+' x '+fmt$(parseFloat(mu))+'</span>' : '<span class="muted">—</span>'}
      </td>
      <td>
        <div class="toggle-wrap">
          <label class="toggle">
            <input type="checkbox" class="cfg-on" data-lid="${lid}" ${on?'checked':''}>
            <span class="slider"></span>
          </label>
          <span class="toggle-lbl ${on?'':'muted'}" style="color:${on?'#86efac':'#475569'}" data-lid-lbl="${lid}">${on?'ON':'OFF'}</span>
        </div>
      </td>
      <td>
        <span class="motivo ${mot.cls}" data-lid-mot="${lid}">${mot.txt}</span>
      </td>
      <td style="min-width:90px;">
        <button class="btn-pujar" data-lid="${lid}">Pujar</button>
        <a href="${bstockUrl(lid)}" target="_blank" class="btn-abrir">Abrir</a>
        ${r._manual ? `<button class="btn-quitar" data-lid="${lid}" title="Quitar del sniper" style="display:block;width:100%;margin-top:4px;background:#7f1d1d;color:#fca5a5;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px;">× Quitar</button>` : ''}
        <div class="result-lbl muted" data-lid-res="${lid}"></div>
      </td>
    </tr>`;
  }).join('');

  // Event listeners
  document.querySelectorAll('.cfg-maxunit').forEach(el=>{
    el.addEventListener('change', ()=>{
      const lid=el.dataset.lid, cfg=getCfg(lid);
      cfg.maxUnit=parseFloat(el.value)||0;
      saveCfg(lid,cfg);
      updateRow(lid);
    });
  });
  document.querySelectorAll('.cfg-seg').forEach(el=>{
    el.addEventListener('change', ()=>{
      const lid=el.dataset.lid, cfg=getCfg(lid);
      cfg.seg=parseInt(el.value)||10;
      saveCfg(lid,cfg);
      updateRow(lid);
    });
  });
  document.querySelectorAll('.cfg-on').forEach(el=>{
    el.addEventListener('change', ()=>{
      const lid=el.dataset.lid, cfg=getCfg(lid);
      cfg.on=el.checked;
      saveCfg(lid,cfg);
      const lbl=document.querySelector(`[data-lid-lbl="${lid}"]`);
      if(lbl){ lbl.textContent=cfg.on?'ON':'OFF'; lbl.style.color=cfg.on?'#86efac':'#475569'; }
      updateRow(lid);
    });
  });
  document.querySelectorAll('.btn-pujar').forEach(btn=>{
    btn.addEventListener('click', ()=>manualBid(btn.dataset.lid));
  });
  document.querySelectorAll('.btn-quitar').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      chrome.runtime.sendMessage({action:'removeManual', lid:btn.dataset.lid}, ()=>cargar());
    });
  });
}

function updateRow(lid){
  const r = activas.find(x=>x.listing_id===lid);
  if(!r) return;
  const cfg = getCfg(lid);
  const mot = motivo(r, cfg);
  const mu  = parseFloat(cfg.maxUnit)||0;
  const qty = r.unidades||0;
  const maxT = qty&&mu ? qty*mu : null;

  const mEl = document.querySelector(`[data-lid-mot="${lid}"]`);
  if(mEl){ mEl.textContent=mot.txt; mEl.className=`motivo ${mot.cls}`; }

  const mtEl = document.querySelector(`.maxtotal-cell[data-lid="${lid}"]`);
  if(mtEl) mtEl.innerHTML = maxT
    ? `${fmt$(maxT)}<br><span class="muted" style="font-size:10px;font-weight:400;">${qty} x ${fmt$(mu)}</span>`
    : '<span class="muted">—</span>';
}

function updateCountdowns(){
  document.querySelectorAll('.cd-cell').forEach(el=>{
    const lid = el.dataset.lid;
    const r = activas.find(x=>x.listing_id===lid);
    if(!r) return;
    const secs = calcSecs(r);
    if(secs !== null){
      el.innerHTML = fmtCountdown(secs * 1000);
    }
    updateRow(lid);
  });
}

// ── Puja manual ──────────────────────────────────────────────────────────────
async function manualBid(lid){
  const r = activas.find(x=>x.listing_id===lid);
  if(!r) return;
  const cfg = getCfg(lid);
  const mu  = parseFloat(cfg.maxUnit)||0;
  const qty = r.unidades||0;
  if(!mu){ setResult(lid,'Config Max $/u primero','#fcd34d'); return; }
  const amount = qty ? Math.floor(qty*mu) : Math.floor(mu);
  const maxTotal = qty && mu ? qty * mu : null;

  const btn = document.querySelector(`.btn-pujar[data-lid="${lid}"]`);
  if(btn){ btn.disabled=true; btn.textContent='Pujando...'; }
  setResult(lid,'Enviando...','#94a3b8');

  chrome.runtime.sendMessage({action:'manualBid', lid, amount, maxTotal}, result=>{
    if(btn){ btn.disabled=false; btn.textContent='Pujar'; }
    if(result?.result?.ok){
      lastWinTs[lid] = Date.now();
      setResult(lid, `OK · ${result.result.status||''}`, '#86efac');
    } else {
      setResult(lid, result?.result?.msg||'Error', '#fca5a5');
    }
  });
}

function setResult(lid, msg, color){
  const el = document.querySelector(`[data-lid-res="${lid}"]`);
  if(el){ el.textContent=msg; el.style.color=color; }
}

// ── Cargar datos ─────────────────────────────────────────────────────────────
async function cargar(){
  document.getElementById('loading').style.display='block';
  document.getElementById('content').style.display='none';
  setStatus('Conectando...','');

  // Cargar configs guardadas
  const allKeys = await new Promise(r=>{
    chrome.storage.local.get(null, items=>{
      const cfg={};
      for(const [k,v] of Object.entries(items)){
        if(k.startsWith('sniper_')){
          const lid=k.replace('sniper_','');
          try{ cfg[lid]=JSON.parse(v); }catch{}
        }
      }
      r(cfg);
    });
  });
  cfgCache = allKeys;

  chrome.runtime.sendMessage({action:'getActivas'}, resp=>{
    document.getElementById('loading').style.display='none';
    if(!resp||!resp.ok){
      setStatus('Error: server.py no responde — corra python server.py','err');
      document.getElementById('content').style.display='block';
      activas=[];
      render();
      return;
    }
    activas = resp.activas||[];
    setStatus(`${activas.length} subastas activas · server.py conectado`, 'ok');
    document.getElementById('content').style.display='block';
    render();

    if(cdInterval) clearInterval(cdInterval);
    cdInterval = setInterval(updateCountdowns, 1000);
  });
}

function setStatus(msg, cls){
  const el=document.getElementById('status-bar');
  el.textContent=msg; el.className=cls;
}

// ── Recibir resultados del sniper automatico ─────────────────────────────────
chrome.runtime.onMessage.addListener(msg=>{
  if(msg.action==='bidResult'){
    const {lid, result} = msg;
    if(result?.ok){
      setResult(lid, `✓ WINNING · $${result.winningBid||''}`, '#86efac');
    } else {
      setResult(lid, `${result?.msg||'Error'}`, '#fca5a5');
    }
    // Auto-recargar en 4 segundos para mostrar estado real
    setTimeout(()=>cargar(), 4000);
  }
});

// ── Actualizacion live desde API de BStock (cada 3 segundos) ─────────────────
function liveUpdate(){
  if(!activas.length) return;
  const lids = activas.map(r=>r.listing_id);
  chrome.runtime.sendMessage({action:'getLiveStatus', lids}, resp=>{
    if(!resp||!resp.ok) return;
    let changed = false;
    for(const r of activas){
      const st = resp.results[r.listing_id];
      if(!st||st.error) continue;
      // Actualizar estado en tiempo real
      if(st.winning !== undefined){
        const lid = r.listing_id;
        if(st.winning){
          lastWinTs[lid] = Date.now();
          if(r.status !== 'WINNING'){ r.status = 'WINNING'; changed = true; }
        } else {
          // No cambiar a LOSING si ganamos hace menos de 15 segundos (BStock tiene delay)
          const msSinceWin = Date.now() - (lastWinTs[lid] || 0);
          const newStatus = st.status==='ENDED' ? 'ENDED' : 'LOSING';
          if(msSinceWin > 15000 && r.status !== newStatus){ r.status = newStatus; changed = true; }
        }
      }
      if(st.currentBidAmount != null && r.mi_puja !== st.currentBidAmount){
        r.mi_puja = st.currentBidAmount; changed = true;
      }
      if(st.nextMinBidAmount != null) r._nextMin = st.nextMinBidAmount;
      // Actualizar hora de cierre para listings manuales (sin fecha_cierre)
      if(st._endTimeUTC && !r._endTimeUTC){
        r._endTimeUTC = st._endTimeUTC; changed = true;
      }
    }
    if(changed) render();
    // Actualizar celdas en tiempo real sin re-render completo
    for(const r of activas){
      const st = resp.results[r.listing_id];
      if(!st||st.error) continue;
      const lid = r.listing_id;

      const badge = document.querySelector(`tr[data-lid="${lid}"] .badge`);
      if(badge){
        const win = st.winning;
        badge.textContent = win ? 'WINNING' : (st.status==='ENDED'?'ENDED':'LOSING');
        badge.className = 'badge ' + (win?'b-green':st.status==='ENDED'?'b-muted':'b-red');
      }

      // P.ACT — precio actual
      if(st.currentBidAmount != null){
        const pactEl = document.querySelector(`tr[data-lid="${lid}"] td.num`);
        if(pactEl) pactEl.innerHTML = `${fmt$(st.currentBidAmount)}<br><span class="muted" style="font-size:10px;font-weight:400;">mi max</span>`;
      }

      // PROXIMA — próxima puja mínima
      if(st.nextMinBidAmount != null){
        const proxEl = document.querySelector(`.proxima-cell[data-lid="${lid}"]`);
        if(proxEl) proxEl.innerHTML = `${fmt$(st.nextMinBidAmount)}<br><span style="font-size:10px;color:#475569;">proxima</span>`;
      }
    }
  });
}

document.getElementById('btn-reload').addEventListener('click', cargar);
cargar();
setInterval(liveUpdate, 3000);
