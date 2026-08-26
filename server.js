import { config } from './config/index.js';
import Client from './core/Client.js';
import { helper, logger } from "./utils/index.js";
import { WebSocketServer } from 'ws';
import TokenManager from './core/TokenManager.js';
import { fetchProxies } from './scripts/fetchProxies.js';

const manager = new TokenManager();
const server = helper.createServer();
const wss = new WebSocketServer({ server: server });

// ═══ Health check HTTP per Render & co. ═══
// IMPORTANTE: deve rispondere 200, altrimenti Render considera il servizio
// "non sano", lo fa ripartire e ogni riavvio provoca lag (cold start).
server.on('request', (req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('XevBots OK');
  }
});

let serverListening = true;

manager.checkTokens((v) => {
  // TokenManager handles its own logging
});

wss.on('connection', (ws) => {
  const client = new Client(ws);
  logger.info('Client Connected');
  const handleDisconnect = () => {
    client.stopBots();
    logger.warn('Client Disconnected!');
  };
  ws.on('message', (buffer) => {
    try {
      client.handleMessage(buffer);
    } catch (e) {
      logger.warn('Server: corrupted message — dropped');
    }
  });
  ws.on('close', handleDisconnect);
  ws.on('error', handleDisconnect);
});

// Avvia server SUBITO, fetch proxy in background (non bloccare l'avvio)
// Port: Render assegna PORT env, altrimenti usa config
const port = process.env.PORT || config.serverSettings.port;

// 1. Carica proxy esistenti subito
helper.setupProxies();

// 2. Avvia server immediatamente (non aspettare fetchProxies)
server.listen(port, () => {
  serverListening = true;
  logger.info(`Server started on port ${port} with ${helper.proxies.length} proxies`);
});

// 3. Refresh proxy in background (skip test, usa pre-validati)
fetchProxies({skipTest:true}).then(count => {
  if (count > 0) helper.setupProxies(); // ricarica con i nuovi
  logger.info(`Fetched ${count} fresh proxies`);
}).catch(e => {
  logger.warn(`Proxy fetch failed: ${e.message}`);
});

// Aggiorna proxy ogni ora
setInterval(() => {
  fetchProxies({skipTest:true}).then(count => {
    logger.info(`Refreshed ${count} proxies`);
  }).catch(e => {
    logger.warn(`Proxy refresh failed: ${e.message}`);
  });
}, 60 * 60 * 150);

// ═══ IP di uscita (per whitelist del proxy) ═══
// Render NON ha un IP fisso: cambia a ogni riavvio. Questo stampa nei log
// l'IP attuale. Usalo solo se il tuo proxy richiede davvero la whitelist IP;
// se invece supporta login utente/password, quello è molto più affidabile.
async function logOutboundIP() {
  try {
    const res = await fetch('https://api.ipify.org');
    const ip = (await res.text()).trim();
    logger.info(`Outbound IP: ${ip}`);
  } catch (e) {
    logger.warn(`Could not fetch outbound IP: ${e.message}`);
  }
}
logOutboundIP();

export { manager };
