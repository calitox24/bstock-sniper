// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE BRIDGE — agregar al final del userscript BStock MINI, antes del
// ultimo })();
// Requiere agregar en el header del userscript:
//   // @grant        GM_xmlhttpRequest
//   // @connect      localhost
// ═══════════════════════════════════════════════════════════════════════════

const BRIDGE_URL = 'http://localhost:8080';
const BRIDGE_POLL_MS = 1500;

function bridgeGet(path) {
  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url: BRIDGE_URL + path,
      onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch { resolve(null); } },
      onerror: () => resolve(null),
      ontimeout: () => resolve(null),
      timeout: 3000
    });
  });
}

function bridgePost(path, data) {
  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: 'POST',
      url: BRIDGE_URL + path,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(data),
      onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch { resolve(null); } },
      onerror: () => resolve(null),
      timeout: 3000
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

  // Verificar que la subasta sigue abierta
  const st = readState();
  if (st.status === 'ENDED') {
    return reportResult(AUCTION_ID, 'ERROR', 'ENDED', 'Subasta ya cerrada', amount);
  }
  if (st.status === 'WON') {
    return reportResult(AUCTION_ID, 'OK', 'WON', 'Ya ganaste', amount);
  }

  // Verificar que el monto es razonable
  if (st.nextMinBid && amount < st.nextMinBid) {
    return reportResult(AUCTION_ID, 'ERROR', st.status, `Monto $${amount} menor que proxima puja $${st.nextMinBid}`, amount);
  }

  // Ejecutar la puja
  setPanelLog(`[BRIDGE] Pujando $${amount} desde dashboard...`);
  await placeBid(amount, { confirm: true });

  // Esperar y reportar resultado
  await wait(3500);
  const fresh = readState();
  const result = fresh.status === 'WINNING' ? 'OK' : fresh.status === 'WON' ? 'OK' : 'LOSING';
  const msg = fresh.status === 'WINNING' ? 'Puja aceptada, vas ganando'
            : fresh.status === 'WON'     ? 'Ganaste'
            : fresh.status === 'LOSING'  ? 'Puja enviada pero sigues perdiendo'
            : 'Puja enviada, estado: ' + fresh.status;

  await reportResult(AUCTION_ID, result, fresh.status, msg, amount);
}

// Polling cada 1.5 segundos
setInterval(bridgeTick, BRIDGE_POLL_MS);
log('[BRIDGE] Bridge con dashboard activo. Polling cada ' + BRIDGE_POLL_MS + 'ms');
