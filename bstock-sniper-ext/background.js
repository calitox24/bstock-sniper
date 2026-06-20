// background.js — BStock Sniper con API directa (sin DOM, sin pestanas)
const SERVER = 'http://localhost:8080';

let activasData  = [];
let sniperFired  = {};   // lid -> timestamp ultimo disparo
let auctionCache = {};   // lid -> auctionId (cache para no llamar by-listing-id cada vez)
const COOLDOWN_MS      = 8000;
const COOLDOWN_WIN_MS  = 60000; // si ya ganamos, no volver a verificar por 60s

// ── Token desde cookie de Firefox ────────────────────────────────────────────
async function getToken(){
  return new Promise(resolve=>{
    chrome.cookies.get({url:'https://bstock.com', name:'bstock_access_token'}, cookie=>{
      resolve(cookie?.value || null);
    });
  });
}

// ── Helpers de API ────────────────────────────────────────────────────────────
const API_HEADERS = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Origin': 'https://bstock.com',
  'Referer': 'https://bstock.com/'
});

async function apiGet(url, token){
  const resp = await fetch(url, {headers: API_HEADERS(token)});
  if(!resp.ok) throw new Error(`HTTP ${resp.status} GET ${url}`);
  return resp.json();
}

// ── Obtener estado de subasta (y cachear auctionId) ──────────────────────────
async function getAuctionState(listingId, token){
  const data = await apiGet(
    `https://auction.bstock.com/v1/auctions/by-listing-id/${listingId}`,
    token
  );
  const auctionId = data._id || data.id || data.auctionId;
  if(auctionId) auctionCache[listingId] = auctionId;
  return {auctionId, ...data};
}

// ── Ejecutar puja via API ─────────────────────────────────────────────────────
async function placeBidAPI(auctionId, amount, token){
  const resp = await fetch(`https://auction.bstock.com/v1/auctions/${auctionId}/bids`, {
    method: 'POST',
    headers: API_HEADERS(token),
    body: JSON.stringify({amount})
  });
  const data = await resp.json();
  return {httpStatus: resp.status, ...data};
}

// ── Config storage ────────────────────────────────────────────────────────────
async function getCfg(lid){
  return new Promise(resolve=>{
    chrome.storage.local.get('sniper_'+lid, r=>{
      try{ resolve(JSON.parse(r['sniper_'+lid]||'{}')); }catch{ resolve({}); }
    });
  });
}

// ── Detectar hora de cierre en respuesta de API (cualquier campo) ─────────────
function extractEndTime(state){
  const now = Date.now();
  // Campos conocidos primero
  const known = ['endTime','closeTime','endDate','auctionEndTime','closingTime',
                 'closedAt','scheduledCloseTime','closeAt','endsAt','endAt',
                 'scheduledEnd','auctionEnd','lotCloseTime','biddingEnds',
                 'end_time','close_time','auction_close'];
  for(const k of known){
    if(state[k]){
      const t = new Date(state[k]).getTime();
      if(t > now) return t;
    }
  }
  // Escanear TODOS los campos buscando fecha futura (ISO string o unix timestamp)
  for(const [k, val] of Object.entries(state)){
    if(typeof val==='string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)){
      const t = new Date(val).getTime();
      if(t > now && t < now + 86400000*60) return t; // dentro de 60 dias
    }
    if(typeof val==='number' && val > now/1000 && val < now/1000 + 86400*60){
      return val * 1000; // unix timestamp en segundos
    }
  }
  return null;
}

// ── Segundos restantes desde dashboard_data ───────────────────────────────────
function secsLeft(fecha, hora){
  if(!fecha||!hora) return null;
  const m = hora.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(!m) return null;
  let h=parseInt(m[1]), min=parseInt(m[2]);
  const ap=m[3].toUpperCase();
  if(ap==='PM'&&h!==12) h+=12;
  if(ap==='AM'&&h===12) h=0;
  const utc = Date.UTC(
    parseInt(fecha.slice(0,4)), parseInt(fecha.slice(5,7))-1, parseInt(fecha.slice(8,10)),
    h+4, min, 0
  );
  return Math.floor((utc - Date.now()) / 1000);
}

// ── Puja directa via API al minimo requerido por BStock ──────────────────────
async function fireBid(listingId, amount, maxTotal){
  const token = await getToken();
  if(!token) return {ok:false, msg:'Sin token — iniciá sesión en bstock.com'};

  try{
    // Siempre consultar estado actual para obtener nextMinBidAmount y auctionId
    const state = await getAuctionState(listingId, token);
    const auctionId = state.auctionId || state._id || state.id;
    console.log(`[BStock Sniper] Estado actual lid=${listingId}:`, JSON.stringify(state).slice(0,300));

    if(!auctionId) return {ok:false, msg:'No se pudo obtener auctionId'};
    if(state.status==='ENDED'||state.status==='CLOSED') return {ok:false, msg:'Subasta cerrada', status:'ENDED'};
    if(state.winning===true) return {ok:true, msg:`Ya ganando en $${state.currentBidAmount||''}`, status:'WINNING'};

    // Pujar al MINIMO que requiere BStock (nextMinBidAmount), no al max total
    const nextMin = state.nextMinBidAmount || state.nextUserMinBidAmount || state.nextMinUserBidAmount || amount;
    if(maxTotal && nextMin > maxTotal){
      return {ok:false, msg:`Mínimo $${nextMin} supera tu max $${Math.round(maxTotal)}`, status:'LOSING'};
    }

    const bidAmount = Math.ceil(nextMin);
    console.log(`[BStock Sniper] API bid lid=${listingId} $${bidAmount} (nextMin=${nextMin} max=${maxTotal})`);

    const result = await placeBidAPI(auctionId, bidAmount, token);
    console.log(`[BStock Sniper] API result:`, result);

    const ok = result.winning === true;
    return {
      ok,
      status: ok ? 'WINNING' : 'LOSING',
      nextMin: result.nextMinBidAmount,
      winningBid: result.winningBidAmount,
      bidAmount,
      msg: ok
        ? `Ganando en $${result.winningBidAmount}`
        : result.message || result.error || 'LOSING'
    };
  }catch(e){
    console.error('[BStock Sniper] API error en fireBid:', e);
    return {ok:false, msg: String(e)};
  }
}

// ── Tick del sniper (cada 5 seg via alarm) ────────────────────────────────────
async function sniperTick(){
  // Cargar dashboard (puede fallar si server.py no corre)
  let dashActivas = [];
  try{
    const resp = await fetch(`${SERVER}/dashboard_data.json?t=${Date.now()}`);
    const data = await resp.json();
    dashActivas = data?.mis_pujas?.activas || [];
  }catch(e){
    console.warn('[BStock Sniper] dashboard_data.json no disponible:', e.message);
  }

  // Mezclar con manuales guardados en storage
  const manuals = await new Promise(r=>chrome.storage.local.get('manual_listings', d=>{
    try{ r(JSON.parse(d.manual_listings||'[]')); }catch{ r([]); }
  }));
  const dashIds = new Set(dashActivas.map(x=>x.listing_id));
  activasData = [...dashActivas, ...manuals.filter(x=>!dashIds.has(x.listing_id))];

  for(const r of activasData){
    const lid = r.listing_id;
    const cfg = await getCfg(lid);
    if(!cfg.on) continue;

    const mu  = parseFloat(cfg.maxUnit)||0;
    const seg = parseInt(cfg.seg)||10;
    if(!mu) continue;

    const qty      = r.unidades||0;
    const maxTotal = qty&&mu ? qty*mu : null;

    // Calcular segundos restantes — usar _endTimeUTC si está disponible (listings manuales)
    let secs;
    if(r._endTimeUTC){
      secs = Math.floor((r._endTimeUTC - Date.now()) / 1000);
    } else {
      secs = secsLeft(r.fecha_cierre, r.hora_cierre);
    }

    // Para listings manuales sin tiempo conocido, consultar la API en vivo
    if(secs===null && r._manual){
      try{
        const token = await getToken();
        if(token){
          const state = await getAuctionState(lid, token);
          const endUTC = extractEndTime(state);
          console.log(`[BStock Sniper] Buscando tiempo para ${lid}: fields=`, Object.keys(state).join(','), 'endUTC=', endUTC);
          if(endUTC){
            r._endTimeUTC = endUTC;
            secs = Math.floor((r._endTimeUTC - Date.now()) / 1000);
            // Persistir en storage para proximos ticks
            chrome.storage.local.get('manual_listings', d=>{
              try{
                const list = JSON.parse(d.manual_listings||'[]');
                const idx = list.findIndex(x=>x.listing_id===lid);
                if(idx>=0){ list[idx]._endTimeUTC = r._endTimeUTC; chrome.storage.local.set({manual_listings: JSON.stringify(list)}); }
              }catch{}
            });
          }
        }
      }catch(e){ console.warn('[BStock Sniper] No se pudo obtener tiempo para', lid, e.message); }
    }

    if(secs===null||secs<=0) continue;
    if(secs>seg) continue;

    const lastFired = sniperFired[lid]||0;
    if(Date.now()-lastFired < COOLDOWN_MS) continue;

    const amount = qty ? Math.floor(qty*mu) : Math.floor(mu);
    console.log(`[BStock Sniper] AUTO lid=${lid} $${amount} (${secs}s restantes, seg=${seg})`);
    sniperFired[lid] = Date.now();

    const result = await fireBid(lid, amount, maxTotal);

    if(result.status==='WINNING'){
      // Ya ganando — cooldown largo para no volver a pujar innecesariamente
      sniperFired[lid] = Date.now() - COOLDOWN_MS + COOLDOWN_WIN_MS;
    } else if(!result.ok && result.status==='LOSING'){
      // LOSING y nextMin dentro del presupuesto → reintentar en próximo tick
      if(!maxTotal || !result.nextMin || result.nextMin <= maxTotal){
        delete sniperFired[lid];
      }
    }

    chrome.runtime.sendMessage({action:'bidResult', lid, amount, result}).catch(()=>{});
  }
}

// ── Alarm cada 5 segundos ─────────────────────────────────────────────────────
chrome.alarms.create('sniperTick', {periodInMinutes:1/12});
chrome.alarms.onAlarm.addListener(a=>{
  if(a.name==='sniperTick') sniperTick();
});

// ── Mensajes desde popup ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{

  if(msg.action==='getActivas'){
    Promise.all([
      fetch(`${SERVER}/dashboard_data.json?t=${Date.now()}`).then(r=>r.json()).catch(()=>null),
      new Promise(r=>chrome.storage.local.get('manual_listings', d=>{
        try{ r(JSON.parse(d.manual_listings||'[]')); }catch{ r([]); }
      }))
    ]).then(([data, manuals])=>{
      const fromDash = data?.mis_pujas?.activas || [];
      // Agregar manuales que no esten en el dashboard
      const dashIds = new Set(fromDash.map(x=>x.listing_id));
      const extra   = manuals.filter(x=>!dashIds.has(x.listing_id));
      activasData = [...fromDash, ...extra];
      sendResponse({ok:true, activas: activasData});
    }).catch(e=>{
      // Si falla el server.py, igual mostrar manuales
      chrome.storage.local.get('manual_listings', d=>{
        try{ activasData = JSON.parse(d.manual_listings||'[]'); }catch{ activasData=[]; }
        sendResponse({ok: activasData.length>0, activas: activasData, msg: e.message});
      });
    });
    return true;
  }

  if(msg.action==='addManual'){
    const {listing} = msg;
    const lid = listing.listing_id;
    getToken().then(async token=>{
      try{
        // Obtener estado real de la API (tiempo de cierre, precio actual)
        let auctionData = {};
        if(token){
          try{
            auctionData = await apiGet(
              `https://auction.bstock.com/v1/auctions/by-listing-id/${lid}`, token
            );
            const aid = auctionData._id||auctionData.id||auctionData.auctionId;
            if(aid) auctionCache[lid] = aid;
          }catch(e){ console.warn('addManual auctionData error:', e.message); }
        }

        const endTimeUTC = extractEndTime(auctionData);

        const full = {
          ...listing,
          _manual: true,
          _endTimeUTC: endTimeUTC,
          status: auctionData.winning ? 'WINNING' : (listing.status||'N/A'),
          mi_puja: auctionData.currentBidAmount || listing.mi_puja,
        };

        console.log('[BStock Sniper] addManual data:', JSON.stringify(auctionData).slice(0,400));

        chrome.storage.local.get('manual_listings', d=>{
          let list = [];
          try{ list = JSON.parse(d.manual_listings||'[]'); }catch{}
          const idx = list.findIndex(x=>x.listing_id===lid);
          if(idx>=0) list[idx]=full; else list.push(full);
          chrome.storage.local.set({manual_listings: JSON.stringify(list)}, ()=>{
            sendResponse({ok:true});
          });
        });
      }catch(e){
        sendResponse({ok:false, msg:String(e)});
      }
    });
    return true;
  }

  if(msg.action==='removeManual'){
    chrome.storage.local.get('manual_listings', d=>{
      let list = [];
      try{ list = JSON.parse(d.manual_listings||'[]'); }catch{}
      list = list.filter(x=>x.listing_id!==msg.lid);
      chrome.storage.local.set({manual_listings: JSON.stringify(list)}, ()=>sendResponse({ok:true}));
    });
    return true;
  }

  if(msg.action==='manualBid'){
    const {lid, amount, maxTotal} = msg;
    sniperFired[lid] = Date.now();
    fireBid(lid, amount, maxTotal).then(result=>{
      if(!result.ok && result.status==='LOSING'){
        if(!maxTotal || !result.nextMin || result.nextMin<=maxTotal){
          delete sniperFired[lid];
        }
      }
      sendResponse({ok:result.ok, result});
      chrome.runtime.sendMessage({action:'bidResult', lid, amount, result}).catch(()=>{});
    });
    return true;
  }

  if(msg.action==='saveCfg'){
    chrome.storage.local.set({['sniper_'+msg.lid]: JSON.stringify(msg.cfg)});
    sendResponse({ok:true});
    return true;
  }

  if(msg.action==='getCfg'){
    getCfg(msg.lid).then(cfg=>sendResponse({cfg}));
    return true;
  }

  if(msg.action==='getToken'){
    getToken().then(t=>sendResponse({token: t ? '✓ Token OK' : '✗ Sin token'}));
    return true;
  }

  // Estado live desde la API de BStock para cada listing activo
  if(msg.action==='getLiveStatus'){
    const lids = msg.lids || [];
    getToken().then(async token=>{
      if(!token){ sendResponse({ok:false, msg:'Sin token'}); return; }
      const results = {};
      for(const lid of lids){
        try{
          const state = await apiGet(
            `https://auction.bstock.com/v1/auctions/by-listing-id/${lid}`, token
          );
          const aid = state._id||state.id||state.auctionId;
          if(aid) auctionCache[lid] = aid;

          state._endTimeUTC = extractEndTime(state);

          results[lid] = state;
        }catch(e){
          results[lid] = {error: String(e)};
        }
      }
      sendResponse({ok:true, results});
    });
    return true;
  }
});

// ── Ventana flotante al click del icono ───────────────────────────────────────
let sniperWindowId = null;

chrome.action.onClicked.addListener(async ()=>{
  if(sniperWindowId!==null){
    try{ await chrome.windows.update(sniperWindowId,{focused:true}); return; }
    catch(e){ sniperWindowId=null; }
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 1050,
    height: 520,
    left: 80,
    top: 80
  });
  sniperWindowId = win.id;
});

chrome.windows.onRemoved.addListener(id=>{
  if(id===sniperWindowId) sniperWindowId=null;
});

console.log('[BStock Sniper] Background iniciado — modo API directa');
