// content.js — inyectado en bstock.com/buy/listings/details/*
// Basado en BStock Sniper MINI 0.5 — misma logica de DOM

(function(){
  if(window.__bstockSniperLoaded) return;
  window.__bstockSniperLoaded = true;

  function isVisible(el){
    if(!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function parseMoneyUS(value){
    let s = String(value||'').replace(/\s+/g,' ').replace(/US\$/gi,'').replace(/\$/g,'')
              .replace(/[^\d.,]/g,'').trim();
    if(!s) return null;
    s = s.replace(/\.(?=\d{3}\b)/g,'').replace(/,/g,'');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function getText(){ return document.body?.innerText || ''; }

  // ── Lectura de estado de la pagina ──────────────────────────────────────────
  function getStatus(){
    const text = getText();
    if(/auction has ended|auction ended|auction closed|ended at/i.test(text)) return 'ENDED';
    if(/you won|winning bid/i.test(text) && !/Losing/i.test(text)) return 'WON';

    const candidates = [...document.querySelectorAll('div,span')].filter(el=>{
      const t=(el.textContent||'').trim();
      return t==='Winning'||t==='Losing';
    });
    const tag = candidates.find(el=>String(el.className||'').includes('Tag__StyledTag'))||candidates[0];
    if(tag) return tag.textContent.trim().toUpperCase();

    if(text.includes('Place a new max Bid')||text.includes('Enter Max Bid')) return 'N/A';
    return 'N/A';
  }

  function getNextMinBid(){
    const text = getText();
    const m = text.match(/Enter Max Bid\s*\(([\d.,]+)\s*US\$\+\)/i);
    return m ? parseMoneyUS(m[1]) : null;
  }

  function getQty(){
    const text = getText();
    const patterns = [
      /Manifest Summary\s*(\d+)\s*Units/i,
      /Total Units\s*(\d+)/i,
      /(\d+)\s*Units/i
    ];
    for(const p of patterns){
      const m = text.match(p);
      if(m) return Number(m[1]);
    }
    return null;
  }

  function getCurrentBid(){
    const text = getText();
    let m = text.match(/\b(?:Winning|Losing)\s*([\d.,]+)\s*US\$/i);
    if(m) return parseMoneyUS(m[1]);
    m = text.match(/([\d.,]+)\s*US\$\s*\/\s*[\d.,]+\s*US\$\s*per unit/i);
    if(m) return parseMoneyUS(m[1]);
    return null;
  }

  // ── Interaccion con el formulario ───────────────────────────────────────────
  function findBidInput(){
    const inputs = [...document.querySelectorAll('input')].filter(isVisible);
    return inputs.find(i=>/Enter Max Bid/i.test(i.placeholder||'')) ||
           inputs.find(i=>{
             const s=`${i.name||''} ${i.id||''} ${i.placeholder||''}`.toLowerCase();
             return s.includes('bid')||s.includes('amount')||i.inputMode==='decimal';
           }) || null;
  }

  function findRaiseButton(){
    const buttons = [...document.querySelectorAll('button')].filter(isVisible);
    return buttons.find(b=>/Raise Max Bid/i.test(b.innerText||'')) ||
           buttons.find(b=>/Bid Now|Place Bid|Raise/i.test(b.innerText||'')) || null;
  }

  function findConfirmButton(){
    const buttons = [...document.querySelectorAll('button')].filter(isVisible);
    return buttons.find(b=>/Confirm/i.test(b.innerText||'')) || null;
  }

  function setNativeValue(input, value){
    const clean = String(Math.round(Number(value)));
    input.scrollIntoView({block:'center', inline:'center'});
    input.focus();
    input.click();

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')?.set;
    if(setter) setter.call(input,''); else input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));

    for(const char of clean){
      const keyCode = char.charCodeAt(0);
      input.dispatchEvent(new KeyboardEvent('keydown',{key:char,code:`Digit${char}`,keyCode,which:keyCode,bubbles:true,cancelable:true}));
      const cur = input.value||'';
      if(setter) setter.call(input,cur+char); else input.value=cur+char;
      try{
        input.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,inputType:'insertText',data:char}));
      }catch{ input.dispatchEvent(new Event('input',{bubbles:true})); }
      input.dispatchEvent(new KeyboardEvent('keyup',{key:char,code:`Digit${char}`,keyCode,which:keyCode,bubbles:true,cancelable:true}));
    }

    input.dispatchEvent(new Event('change',{bubbles:true}));
    input.dispatchEvent(new Event('keyup',{bubbles:true}));
    input.dispatchEvent(new FocusEvent('blur',{bubbles:true}));
    input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
  }

  function realClick(el){
    if(!el) return false;
    el.scrollIntoView({block:'center', inline:'center'});
    const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
    ['pointerover','mouseover','mousemove','pointerdown','mousedown','pointerup','mouseup','click'].forEach(type=>{
      el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y}));
    });
    el.click();
    return true;
  }

  function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

  // ── Ejecutar una puja (un intento) ──────────────────────────────────────────
  async function executeBid(amount){
    const status = getStatus();
    if(status==='ENDED') return {ok:false, msg:'Subasta cerrada', status};
    if(status==='WON')   return {ok:true,  msg:'Ya ganaste', status};

    const nextMin = getNextMinBid();
    if(nextMin && amount < nextMin){
      return {ok:false, msg:`Monto $${amount} < proxima $${nextMin}`, status, nextMin};
    }

    const input = findBidInput();
    if(!input) return {ok:false, msg:'No encontre input de puja', status};

    setNativeValue(input, amount);
    await wait(600);
    input.blur();
    await wait(400);

    const raiseBtn = findRaiseButton();
    if(!raiseBtn) return {ok:false, msg:'No encontre boton Raise/Bid', status};
    realClick(raiseBtn);
    await wait(1000);

    const confirmBtn = findConfirmButton();
    if(!confirmBtn) return {ok:false, msg:'No encontre Confirm en modal', status};
    realClick(confirmBtn);
    await wait(3000);

    const freshStatus = getStatus();
    const freshNextMin = getNextMinBid();
    const ok = freshStatus==='WINNING'||freshStatus==='WON';
    return {
      ok,
      status: freshStatus,
      nextMin: freshNextMin,
      msg: ok ? 'Puja aceptada' : 'Puja enviada — status: '+freshStatus
    };
  }

  // ── Mensajes desde background.js ────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
    if(msg.action==='ping'){
      sendResponse({ok:true, status:getStatus(), url:location.href});
      return true;
    }
    if(msg.action==='executeBid'){
      executeBid(msg.amount).then(sendResponse);
      return true;
    }
    if(msg.action==='getStatus'){
      sendResponse({
        status:   getStatus(),
        nextMin:  getNextMinBid(),
        currentBid: getCurrentBid(),
        qty:      getQty()
      });
      return true;
    }
  });

  // ── Botón flotante "Agregar al Sniper" ────────────────────────────────────
  function addSniperButton(){
    if(document.getElementById('__bsBtn')) return;
    const btn = document.createElement('button');
    btn.id = '__bsBtn';
    btn.textContent = '+ Agregar al Sniper';
    Object.assign(btn.style, {
      position:'fixed', bottom:'80px', right:'18px', zIndex:'2147483647',
      background:'#0f172a', color:'#38bdf8', border:'2px solid #38bdf8',
      borderRadius:'10px', padding:'10px 18px', cursor:'pointer',
      fontSize:'13px', fontWeight:'800', boxShadow:'0 4px 16px rgba(0,0,0,.5)',
      fontFamily:'Arial,sans-serif', lineHeight:'1'
    });

    btn.addEventListener('click', ()=>{
      const listingId = location.pathname.split('/').filter(Boolean).pop();
      const qty    = getQty();
      const status = getStatus();
      const bid    = getCurrentBid();
      const next   = getNextMinBid();
      const titulo = document.querySelector('h1')?.innerText?.trim() || document.title;

      btn.textContent = 'Enviando...';
      btn.style.color = '#fcd34d';

      chrome.runtime.sendMessage({
        action: 'addManual',
        listing: { listing_id: listingId, titulo, unidades: qty, status, mi_puja: bid, nextMin: next }
      }, result=>{
        if(result?.ok){
          btn.textContent = '✓ En el Sniper';
          btn.style.color = '#86efac';
          btn.style.borderColor = '#86efac';
        } else {
          btn.textContent = '✗ ' + (result?.msg||'Error');
          btn.style.color = '#fca5a5';
          setTimeout(()=>{
            btn.textContent = '+ Agregar al Sniper';
            btn.style.color = '#38bdf8';
            btn.style.borderColor = '#38bdf8';
          }, 3000);
        }
      });
    });

    document.body.appendChild(btn);
  }

  // Esperar a que cargue el contenido antes de agregar el botón
  setTimeout(addSniperButton, 2000);

  console.log('[BStock Sniper] Content script listo en', location.href);
})();
