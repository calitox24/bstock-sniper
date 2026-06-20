// ==UserScript==
// @name         BStock Sniper MINI 0.6 + Dashboard Bridge
// @namespace    celularesrd
// @version      0.6
// @description  Sniper BStock MINI compatible con pagina nueva y vieja legacy + bridge con dashboard local
// @match        https://bstock.com/buy/listings/details/*
// @match        https://www.bstock.com/buy/listings/details/*
// @match        https://bstock.com/*/auction/auction/view/id/*
// @match        https://www.bstock.com/*/auction/auction/view/id/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    CHECK_MS: 700,
    DEFAULT_MAX_UNIT: 380,
    DEFAULT_SECONDS: 10,
    AUTO_CONFIRM: false,
    DEBUG: true,
    COOLDOWN_MS: 8000
  };

  const PATH = location.pathname;
  const IS_LEGACY = /\/auction\/auction\/view\/id\//i.test(PATH);
  const IS_MODERN = /\/buy\/listings\/details\//i.test(PATH);

  if (!IS_LEGACY && !IS_MODERN) return;

  let sniperEnabled = false;
  let maxUnitPrice = CONFIG.DEFAULT_MAX_UNIT;
  let bidAtSeconds = CONFIG.DEFAULT_SECONDS;
  let bidInProgress = false;
  let lastBidAt = 0;

  const PANEL_ID = 'bstockMiniPanel';
  const AUCTION_ID =
    document.querySelector('#auction_id')?.value ||
    location.pathname.match(/\/id\/(\d+)/)?.[1] ||
    location.pathname.split('/').filter(Boolean).pop() ||
    'unknown';

  const STORAGE_KEY = 'bstock_sniper_mini_' + AUCTION_ID;
  const VISTA360_KEY = 'bstock_vista_360_items_v1';

  function loadVista360() {
    try { return JSON.parse(localStorage.getItem(VISTA360_KEY) || '[]'); } catch { return []; }
  }

  function saveVista360(list) {
    localStorage.setItem(VISTA360_KEY, JSON.stringify(list));
  }

  function addCurrentAuctionToVista360() {
    const st = readState();
    const item = {
      auctionId: AUCTION_ID, title: st.title, url: location.href,
      status: st.status, secondsLeft: st.secondsLeft, currentBid: st.currentBid,
      currentMax: st.currentMax, nextMinBid: st.nextMinBid, qty: st.qty,
      unitPrice: st.unitPrice, maxUnitPrice: st.maxUnitPrice, maxTotal: st.maxTotal,
      addedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const list = loadVista360();
    const index = list.findIndex(x => x.auctionId === AUCTION_ID);
    if (index >= 0) list[index] = item;
    else list.unshift(item);
    saveVista360(list);
    setPanelLog('Agregado a Vista 360');
  }

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[BStock MINI]', ...args);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ maxUnitPrice, bidAtSeconds, sniperEnabled }));
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (Number(data.maxUnitPrice)) maxUnitPrice = Number(data.maxUnitPrice);
      if (Number(data.bidAtSeconds)) bidAtSeconds = Number(data.bidAtSeconds);
      if (typeof data.sniperEnabled === 'boolean') sniperEnabled = data.sniperEnabled;
    } catch (e) { log('No se pudo cargar configuracion:', e); }
  }

  load();

  function money(n) {
    if (n == null || !Number.isFinite(Number(n))) return '-';
    return '$' + Math.round(Number(n)).toLocaleString('en-US');
  }

  function money2(n) {
    if (n == null || !Number.isFinite(Number(n))) return '-';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseMoneyUS(value) {
    let s = String(value || '').replace(/\s+/g, ' ').replace(/US\$/gi, '').replace(/\$/g, '').replace(/[^\d.,]/g, '').trim();
    if (!s) return null;
    s = s.replace(/\.(?=\d{3}\b)/g, '').replace(/,/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function getText() { return document.body?.innerText || ''; }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function getTitle() {
    return document.querySelector('.product-name h1')?.innerText?.trim() ||
           document.querySelector('h1')?.innerText?.trim() || '-';
  }

  function getRealStatus() {
    const text = getText();
    if (/auction has ended|auction ended|auction closed|ended at/i.test(text)) return 'ENDED';
    if (/you won|winning bid/i.test(text) && !/Losing/i.test(text)) return 'WON';
    if (IS_MODERN) {
      const candidates = [...document.querySelectorAll('div, span')].filter(el => {
        const t = (el.textContent || '').trim();
        return t === 'Winning' || t === 'Losing';
      });
      const tag = candidates.find(el => String(el.className || '').includes('Tag__StyledTag')) || candidates[0];
      if (tag) return tag.textContent.trim().toUpperCase();
      if (text.includes('Place a new max Bid') || text.includes('Enter Max Bid')) return 'N/A';
      return 'N/A';
    }
    if (/highest bidder|you are winning|winning/i.test(text)) return 'WINNING';
    if (/outbid|losing/i.test(text)) return 'LOSING';
    return 'N/A';
  }

  function getCurrentBid() {
    if (IS_LEGACY) {
      const el = document.querySelector('#current_bid_amount');
      if (el) return parseMoneyUS(el.innerText);
      const m = getText().match(/Current bid\s*\$?([\d,]+)/i);
      if (m) return parseMoneyUS(m[1]);
      return null;
    }
    const text = getText();
    let m = text.match(/\b(?:Winning|Losing)\s*([\d.,]+)\s*US\$/i);
    if (m) return parseMoneyUS(m[1]);
    m = text.match(/([\d.,]+)\s*US\$\s*\/\s*[\d.,]+\s*US\$\s*per unit/i);
    if (m) return parseMoneyUS(m[1]);
    m = text.match(/Enter Max Bid\s*\(([\d.,]+)\s*US\$\+\)/i);
    if (m) return parseMoneyUS(m[1]);
    return null;
  }

  function getCurrentMax() {
    if (IS_LEGACY) {
      const input = document.querySelector('#maxBid');
      return input?.value ? parseMoneyUS(input.value) : null;
    }
    const m = getText().match(/Your current max:\s*([\d.,]+)\s*US\$/i);
    if (m) return parseMoneyUS(m[1]);
    return null;
  }

  function getNextMinBid() {
    if (IS_LEGACY) {
      const el = document.querySelector('#next_current_bid');
      if (el) return parseMoneyUS(el.innerText);
      const m = getText().match(/Enter\s*\$?([\d,]+)\s*or more/i);
      if (m) return parseMoneyUS(m[1]);
      return null;
    }
    const m = getText().match(/Enter Max Bid\s*\(([\d.,]+)\s*US\$\+\)/i);
    if (m) return parseMoneyUS(m[1]);
    return null;
  }

  function getQty() {
    if (IS_LEGACY) {
      const h = document.querySelector('#productUnits');
      if (h?.value) return Number(h.value);
      const tm = getTitle().match(/,\s*(\d+)\s*Units/i);
      if (tm) return Number(tm[1]);
    }
    const text = getText();
    for (const p of [/Manifest Summary\s*(\d+)\s*Units/i, /Total Units\s*(\d+)/i, /(\d+)\s*Units/i]) {
      const m = text.match(p);
      if (m) return Number(m[1]);
    }
    return null;
  }

  function getVisibleUnitPrice() {
    if (IS_LEGACY) {
      const el = document.querySelector('#unit_per_price_span');
      if (el) return parseMoneyUS(el.innerText);
      const h = document.querySelector('#pricePerUnitOrigin');
      if (h?.value) return parseMoneyUS(h.value);
    }
    const text = getText();
    const m = text.match(/\/\s*([\d.,]+)\s*US\$\s*per unit/i);
    if (m) return parseMoneyUS(m[1]);
    const bid = getCurrentBid(), qty = getQty();
    if (bid && qty) return bid / qty;
    return null;
  }

  function parseTimeTextToSeconds(t) {
    if (!t) return null;
    let m;
    m = t.match(/(\d+)\s*d\s*(\d+)\s*h\s*(\d+)\s*m\s*(\d+)\s*s/i);
    if (m) return +m[1]*86400 + +m[2]*3600 + +m[3]*60 + +m[4];
    m = t.match(/(\d+)\s*h\s*(\d+)\s*m\s*(\d+)\s*s/i);
    if (m) return +m[1]*3600 + +m[2]*60 + +m[3];
    m = t.match(/(\d+)\s*h\s*(\d+)\s*m/i);
    if (m) return +m[1]*3600 + +m[2]*60;
    m = t.match(/(\d+)\s*m\s*(\d+)\s*s/i);
    if (m) return +m[1]*60 + +m[2];
    m = t.match(/(\d+)\s*s/i);
    if (m) return +m[1];
    return null;
  }

  function getSecondsLeft() {
    if (IS_LEGACY) {
      const el = document.querySelector('#auction_time_remaining') || document.querySelector('#time_remaining');
      const txt = el?.innerText?.trim() || el?.textContent?.trim() || '';
      const parsed = parseTimeTextToSeconds(txt);
      if (parsed != null) return parsed;
    }
    const text = getText();
    let m = text.match(/(\d+)\s*d\s*(\d+)\s*h\s*left/i);
    if (m) return Number(m[1]) * 86400 + Number(m[2]) * 3600;
    m = text.match(/(\d+)\s*h\s*(\d+)\s*m\s*left/i);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60;
    m = text.match(/(\d+)\s*h\s*(\d+)\s*m\s*(\d+)\s*s/i);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    m = text.match(/(\d+)\s*m\s*(\d+)\s*s\s*left/i);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    m = text.match(/(\d+)\s*s\s*left/i);
    if (m) return Number(m[1]);
    return null;
  }

  function formatTime(sec) {
    if (sec == null) return '-';
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  function readState() {
    const qty = getQty(), currentBid = getCurrentBid(), currentMax = getCurrentMax();
    const nextMinBid = getNextMinBid(), unitPrice = getVisibleUnitPrice();
    const maxTotal = qty && maxUnitPrice ? Math.floor(qty * maxUnitPrice) : null;
    return {
      title: getTitle(), status: getRealStatus(), secondsLeft: getSecondsLeft(),
      currentBid, currentMax, nextMinBid, qty, unitPrice, maxUnitPrice, maxTotal,
      canBidNext: nextMinBid && maxTotal ? nextMinBid <= maxTotal : false
    };
  }

  function findBidInput() {
    if (IS_LEGACY) {
      return document.querySelector('#maxBid') || document.querySelector('input[name="bidamount"]') || null;
    }
    const inputs = [...document.querySelectorAll('input')]
      .filter(i => !i.closest('#' + PANEL_ID)).filter(isVisible);
    return inputs.find(i => /Enter Max Bid/i.test(i.placeholder || '')) ||
           inputs.find(i => {
             const s = `${i.name||''} ${i.id||''} ${i.placeholder||''}`.toLowerCase();
             return s.includes('bid') || s.includes('amount') || i.inputMode === 'decimal';
           }) || null;
  }

  function findRaiseButton() {
    if (IS_LEGACY) {
      return document.querySelector('#bid_now_button') ||
             [...document.querySelectorAll('button, input[type="submit"]')]
               .filter(b => !b.closest('#' + PANEL_ID)).filter(isVisible)
               .find(b => /bid now|place bid|raise/i.test((b.innerText || b.value || '').toLowerCase())) || null;
    }
    const buttons = [...document.querySelectorAll('button')]
      .filter(b => !b.closest('#' + PANEL_ID)).filter(isVisible);
    return buttons.find(b => /Raise Max Bid/i.test(b.innerText || '')) ||
           buttons.find(b => /Bid Now|Place Bid|Raise/i.test(b.innerText || '')) || null;
  }

  function findConfirmButton() {
    if (IS_LEGACY) {
      return document.querySelector('#submit_bid_button') ||
             document.querySelector('#bidSubmitForm button[type="submit"]') ||
             [...document.querySelectorAll('button, input[type="submit"]')]
               .filter(b => !b.closest('#' + PANEL_ID)).filter(isVisible)
               .find(b => /confirm|submit bid|place bid/i.test((b.innerText || b.value || '').toLowerCase())) || null;
    }
    const buttons = [...document.querySelectorAll('button')]
      .filter(b => !b.closest('#' + PANEL_ID)).filter(isVisible);
    return buttons.find(b => /Confirm/i.test(b.innerText || '')) || null;
  }

  function setNativeValue(input, value) {
    const clean = String(Math.round(Number(value)));
    input.scrollIntoView({ block: 'center', inline: 'center' });
    input.focus(); input.click();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, ''); else input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (const char of clean) {
      const keyCode = char.charCodeAt(0);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: `Digit${char}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
      const current = input.value || '';
      if (setter) setter.call(input, current + char); else input.value = current + char;
      try {
        input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: char }));
      } catch (e) {
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }
      input.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: `Digit${char}`, keyCode, which: keyCode, bubbles: true, cancelable: true }));
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('keyup', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }

  function realClick(el) {
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    ['pointerover','mouseover','mousemove','pointerdown','mousedown','pointerup','mouseup','click'].forEach(type => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    });
    el.click();
    return true;
  }

  async function placeBid(amount, options = {}) {
    if (bidInProgress) { setPanelLog('Ya hay una accion en proceso'); return; }
    bidInProgress = true;
    try {
      const input = findBidInput();
      if (!input) { setPanelLog('No encontre input de puja'); return; }
      setPanelLog('Escribiendo ' + money(amount));
      setNativeValue(input, amount);
      await wait(600);
      input.blur();
      if (window.jQuery && IS_LEGACY) { try { window.jQuery(input).trigger('change').trigger('keyup'); } catch {} }
      await wait(400);
      const button = findRaiseButton();
      if (!button) { setPanelLog('No encontre boton Bid Now'); return; }
      setPanelLog('Clic en Bid Now: ' + money(amount));
      realClick(button);
      await wait(1000);
      if (options.confirm || CONFIG.AUTO_CONFIRM) {
        const confirm = findConfirmButton();
        if (confirm) {
          setPanelLog('AUTO: confirmando modal ' + money(amount));
          realClick(confirm);
          lastBidAt = Date.now();
          await wait(3000);
          render();
          const freshState = readState();
          if (freshState.status === 'WINNING') setPanelLog('OK: AUTO puja aceptada. WINNING');
          else if (freshState.status === 'LOSING') setPanelLog('ALERTA: AUTO puja enviada, pero sigues LOSING');
          else setPanelLog('AUTO confirmado. Estado: ' + freshState.status);
        } else {
          setPanelLog('No encontre boton Confirm');
        }
      } else {
        setPanelLog('Puja enviada al modal. Confirmacion manual.');
      }
    } finally {
      setTimeout(() => { bidInProgress = false; }, 2500);
    }
  }

  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID} { position:fixed;right:18px;bottom:18px;width:360px;background:#07111f;color:#fff;z-index:2147483647;border-radius:14px;box-shadow:0 12px 35px rgba(0,0,0,.45);font-family:Arial,sans-serif;overflow:hidden;border:1px solid rgba(255,255,255,.12); }
      #${PANEL_ID} .mini-header { background:#0f2138;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;cursor:move;user-select:none; }
      #${PANEL_ID} .mini-title { font-size:14px;font-weight:900;color:#38bdf8; }
      #${PANEL_ID} .mini-body { padding:12px; }
      #${PANEL_ID} .mini-desc { font-size:12px;line-height:1.35;color:#e0f2fe;font-weight:700;margin-bottom:10px; }
      #${PANEL_ID} .mini-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
      #${PANEL_ID} .mini-box { background:#0b1729;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:7px 8px; }
      #${PANEL_ID} .mini-label { color:#94a3b8;font-size:10px;margin-bottom:4px;text-transform:uppercase; }
      #${PANEL_ID} .mini-value { font-size:14px;font-weight:900;color:#fff;text-align:right; }
      #${PANEL_ID} .wide { grid-column:1 / -1; }
      #${PANEL_ID} input { width:100%;box-sizing:border-box;background:#020617;color:#fff;border:1px solid #334155;border-radius:8px;padding:7px;text-align:right;font-weight:800; }
      #${PANEL_ID} button { border:none;border-radius:8px;padding:8px 9px;cursor:pointer;font-weight:900; }
      #${PANEL_ID} .btn-green { background:#15803d;color:white; }
      #${PANEL_ID} .btn-red { background:#991b1b;color:white; }
      #${PANEL_ID} .btn-gray { background:#334155;color:white; }
      #${PANEL_ID} .mini-actions { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px; }
      #${PANEL_ID} .mini-log { margin-top:10px;background:#020617;border-radius:9px;padding:8px;font-size:12px;color:#fde68a;min-height:18px;border:1px solid rgba(255,255,255,.08); }
      #${PANEL_ID}.collapsed .mini-body { display:none; }
    `;
    document.head.appendChild(style);

    const modeName = IS_LEGACY ? 'LEGACY' : 'MODERN';
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="mini-header">
        <div class="mini-title">BStock MINI 0.6 ${modeName}</div>
        <div>
          <button id="miniCollapse" class="btn-gray" style="padding:4px 8px;">v</button>
          <button id="miniToggle" class="${sniperEnabled ? 'btn-green' : 'btn-red'}" style="padding:4px 8px;">${sniperEnabled ? 'ON' : 'OFF'}</button>
        </div>
      </div>
      <div class="mini-body">
        <div id="miniDesc" class="mini-desc">DESC: -</div>
        <div class="mini-grid">
          <div class="mini-box"><div class="mini-label">Estado</div><div id="miniStatus" class="mini-value">-</div></div>
          <div class="mini-box"><div class="mini-label">Tiempo</div><div id="miniTime" class="mini-value">-</div></div>
          <div class="mini-box"><div class="mini-label">P. Act</div><div id="miniCurrent" class="mini-value">-</div></div>
          <div class="mini-box"><div class="mini-label">Proxima</div><div id="miniNext" class="mini-value">-</div></div>
          <div class="mini-box"><div class="mini-label">QTY</div><div id="miniQty" class="mini-value">-</div></div>
          <div class="mini-box"><div class="mini-label">PxUnit actual</div><div id="miniPxUnit" class="mini-value">-</div></div>
          <div class="mini-box"><div class="mini-label">Precio Max/Ud</div><input id="miniMaxUnit" value="${maxUnitPrice}"></div>
          <div class="mini-box"><div class="mini-label">Faltando seg.</div><input id="miniSeconds" value="${bidAtSeconds}"></div>
          <div class="mini-box wide"><div class="mini-label">Maximo Total = QTY x Precio Max</div><div id="miniMaxTotal" class="mini-value">-</div></div>
        </div>
        <div class="mini-actions">
          <button id="miniBidNext" class="btn-green">Pujar proxima</button>
          <button id="miniConfirm" class="btn-red">Confirmar modal</button>
        </div>
        <div class="mini-actions" style="grid-template-columns:1fr;">
          <button id="miniAddVista360" class="btn-gray">+ Agregar a Vista 360</button>
        </div>
        <div class="mini-log" id="miniLog">Listo para probar.</div>
      </div>`;
    document.body.appendChild(panel);

    // Drag
    const header = panel.querySelector('.mini-header');
    let dragging = false, offsetX = 0, offsetY = 0;
    header.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      offsetX = e.clientX - r.left; offsetY = e.clientY - r.top;
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      panel.style.left = e.clientX - offsetX + 'px';
      panel.style.top  = e.clientY - offsetY + 'px';
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { dragging = false; });

    document.getElementById('miniCollapse').addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      document.getElementById('miniCollapse').innerText = panel.classList.contains('collapsed') ? '>' : 'v';
    });
    document.getElementById('miniToggle').addEventListener('click', () => {
      sniperEnabled = !sniperEnabled;
      const btn = document.getElementById('miniToggle');
      btn.innerText = sniperEnabled ? 'ON' : 'OFF';
      btn.className = sniperEnabled ? 'btn-green' : 'btn-red';
      save();
    });
    document.getElementById('miniMaxUnit').addEventListener('input', e => {
      maxUnitPrice = Number(String(e.target.value).replace(/[^\d.]/g, '') || 0); save(); render();
    });
    document.getElementById('miniSeconds').addEventListener('input', e => {
      bidAtSeconds = Number(String(e.target.value).replace(/[^\d]/g, '') || CONFIG.DEFAULT_SECONDS); save(); render();
    });
    document.getElementById('miniBidNext').addEventListener('click', () => {
      const st = readState();
      if (!st.nextMinBid) return setPanelLog('No detecto proxima puja');
      if (st.maxTotal && st.nextMinBid > st.maxTotal) return setPanelLog('Proxima supera tu maximo');
      placeBid(st.nextMinBid, { confirm: false });
    });
    document.getElementById('miniAddVista360').addEventListener('click', () => { addCurrentAuctionToVista360(); });
    document.getElementById('miniConfirm').addEventListener('click', async () => {
      const btn = findConfirmButton();
      if (!btn) return setPanelLog('No hay modal de confirmacion visible');
      realClick(btn);
      setPanelLog('Modal confirmado. Verificando estado...');
      await wait(3000);
      render();
      const freshState = readState();
      if (freshState.status === 'WINNING') setPanelLog('OK: Puja aceptada. WINNING');
      else if (freshState.status === 'LOSING') setPanelLog('ALERTA: Confirmado, pero sigues LOSING');
      else setPanelLog('Confirmado. Estado actual: ' + freshState.status);
    });
  }

  function setPanelLog(text) { const el = document.getElementById('miniLog'); if (el) el.innerText = text; log(text); }
  function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }

  function render() {
    createPanel();
    const st = readState();
    setText('miniDesc', 'DESC: ' + st.title);
    setText('miniStatus', st.status);
    setText('miniTime', formatTime(st.secondsLeft));
    setText('miniCurrent', money(st.currentBid));
    setText('miniNext', money(st.nextMinBid));
    setText('miniQty', st.qty || '-');
    setText('miniPxUnit', money2(st.unitPrice));
    setText('miniMaxTotal', st.maxTotal ? `${money(st.maxTotal)} = ${st.qty} x ${money2(maxUnitPrice)}` : '-');
    const statusEl = document.getElementById('miniStatus');
    if (statusEl) {
      statusEl.style.color = st.status==='WINNING'?'#86efac':st.status==='LOSING'?'#fca5a5':st.status==='ENDED'?'#94a3b8':'#facc15';
    }
    return st;
  }

  async function tick() {
    const st = render();
    if (!sniperEnabled) return;
    if (bidInProgress) return;
    if (Date.now() - lastBidAt < CONFIG.COOLDOWN_MS) return;
    if (st.status === 'ENDED') return setPanelLog('Subasta terminada.');
    if (st.status === 'WON') return setPanelLog('Ganaste la subasta.');
    if (st.status === 'WINNING') return setPanelLog('Escuchando: vas ganando. No pujo.');
    if (!st.nextMinBid) return setPanelLog('Escuchando: esperando proxima puja');
    if (!st.maxTotal || !st.qty) return setPanelLog('Configura Precio Max/Ud / QTY');
    if (st.nextMinBid > st.maxTotal) return setPanelLog('STOP: proxima supera tu maximo');
    if (st.secondsLeft == null) return setPanelLog('Escuchando: no detecto tiempo');
    if (st.secondsLeft > bidAtSeconds) return setPanelLog(`Escuchando: espera ${bidAtSeconds}s. Actual ${formatTime(st.secondsLeft)}`);
    setPanelLog('AUTO: faltan ' + st.secondsLeft + 's, pujando ' + money(st.nextMinBid));
    await placeBid(st.nextMinBid, { confirm: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BRIDGE — comunicacion con dashboard local (http://localhost:8080)
  // ═══════════════════════════════════════════════════════════════════════════
  const BRIDGE_URL = 'http://localhost:8080';
  const BRIDGE_POLL_MS = 1500;

  function bridgeGet(path) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET', url: BRIDGE_URL + path,
        onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch { resolve(null); } },
        onerror: () => resolve(null), ontimeout: () => resolve(null), timeout: 3000
      });
    });
  }

  function bridgePost(path, data) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'POST', url: BRIDGE_URL + path,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(data),
        onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch { resolve(null); } },
        onerror: () => resolve(null), timeout: 3000
      });
    });
  }

  async function reportResult(lid, result, status, msg, amount) {
    await bridgePost('/sniper/status', { lid, result, status, msg, amount });
    log(`[BRIDGE] Resultado reportado: ${result} / ${status}`);
  }

  async function bridgeTick() {
    const cmd = await bridgeGet('/sniper/cmd/' + AUCTION_ID);
    if (!cmd || !cmd.ok) return;

    const amount = cmd.amount;
    log(`[BRIDGE] Comando recibido del dashboard: $${amount}`);
    setPanelLog(`[BRIDGE] Comando del dashboard: ${money(amount)}`);

    const st = readState();
    if (st.status === 'ENDED') return reportResult(AUCTION_ID, 'ERROR', 'ENDED', 'Subasta ya cerrada', amount);
    if (st.status === 'WON')   return reportResult(AUCTION_ID, 'OK',    'WON',   'Ya ganaste', amount);

    if (st.nextMinBid && amount < st.nextMinBid) {
      return reportResult(AUCTION_ID, 'ERROR', st.status, `Monto ${money(amount)} menor que proxima ${money(st.nextMinBid)}`, amount);
    }

    setPanelLog(`[BRIDGE] Pujando ${money(amount)} desde dashboard...`);
    await placeBid(amount, { confirm: true });

    await wait(3500);
    const fresh = readState();
    const result = (fresh.status === 'WINNING' || fresh.status === 'WON') ? 'OK' : 'LOSING';
    const msg = fresh.status === 'WINNING' ? 'Puja aceptada, vas ganando'
              : fresh.status === 'WON'     ? 'Ganaste'
              : fresh.status === 'LOSING'  ? 'Puja enviada pero sigues perdiendo'
              : 'Estado: ' + fresh.status;

    await reportResult(AUCTION_ID, result, fresh.status, msg, amount);
  }

  setInterval(bridgeTick, BRIDGE_POLL_MS);
  log('[BRIDGE] Bridge con dashboard activo. Polling /sniper/cmd/' + AUCTION_ID);

  // ═══════════════════════════════════════════════════════════════════════════

  function boot() {
    createPanel(); render();
    setTimeout(render, 1200);
    setTimeout(render, 3000);
    setInterval(tick, CONFIG.CHECK_MS);
    log('BStock MINI 0.6 iniciado', { IS_LEGACY, IS_MODERN, AUCTION_ID, url: location.href });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})();
