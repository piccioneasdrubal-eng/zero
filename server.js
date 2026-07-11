import { config } from './config/index.js';
import Client from './core/Client.js';
import { helper, logger } from "./utils/index.js";
import { WebSocketServer } from 'ws';
import TokenManager from './core/TokenManager.js';

const manager = new TokenManager();
const server = helper.createServer();
const wss = new WebSocketServer({ server: server });

server.on('request', (req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('XevBots OK');
  }
});

manager.checkTokens((v) => { });

wss.on('connection', (ws) => {
  const client = new Client(ws);
  logger.info('Client Connected');

  const authTimeout = setTimeout(() => {
    if (!client.authenticated) {
      logger.warn('Client auth timeout (10s) — closing');
      ws.close();
    }
  }, 10000);

  const handleDisconnect = () => {
    clearTimeout(authTimeout);
    if (client.authenticated) {
      logger.warn('Client Disconnected! (' + client.tokenLabel + ')');
    } else {
      logger.warn('Client Disconnected! (unauthenticated)');
    }
    client.stopBots();
  };
  ws.on('message', (buffer) => {
    try { client.handleMessage(buffer); } catch (e) { logger.warn('Server: corrupted message - dropped'); }
  });
  ws.on('close', handleDisconnect);
  ws.on('error', handleDisconnect);
});

const port = process.env.PORT || config.serverSettings.port;

helper.proxies = [];

server.listen(port, () => {
  logger.info('Server started on port ' + port);
  if (config.proxySettings.enableProxy) {
    logger.info('Proxy enabled, bots direct during validation');
    refreshProxies();
    setInterval(refreshProxies, 60 * 60 * 1000);
  } else {
    logger.info('Proxy DISABLED: all bots connect direct');
  }
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchProxies } from './scripts/fetchProxies.js';

async function refreshProxies() {
  try {
    const count = await fetchProxies({ skipTest: true });
    if (count > 0) {
      const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'config/proxies.txt');
      const data = fs.readFileSync(filePath, 'utf-8');
      const allProxies = data.split('\n').map(p => p.trim()).filter(p => p);
      logger.info('Fetched ' + count + ' raw proxies, validating...');
      const valid = await helper.validateProxies(allProxies);
      helper.proxies = valid;
      logger.info('Validated: ' + valid.length + ' working proxies ready!');
    }
  } catch (e) {
    logger.warn('Proxy refresh failed: ' + e.message);
  }
}

export { manager };