import { config } from './config/index.js';
import Client from './core/Client.js';
import { helper, logger } from "./utils/index.js";
import { WebSocketServer } from 'ws';
import TokenManager from './core/TokenManager.js';
import { fetchProxies } from './scripts/fetchProxies.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const manager = new TokenManager();
const server = helper.createServer();
const wss = new WebSocketServer({ server: server });

server.on('request', (req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('XevBots OK');
  }
});

manager.checkTokens((v) => { /* TokenManager handles its own logging */ });

wss.on('connection', (ws) => {
  const client = new Client(ws);
  logger.info('Client Connected');
  const handleDisconnect = () => {
    client.stopBots();
    logger.warn('Client Disconnected!');
  };
  ws.on('message', (buffer) => {
    try { client.handleMessage(buffer); } catch (e) { logger.warn('Server: corrupted message - dropped'); }
  });
  ws.on('close', handleDisconnect);
  ws.on('error', handleDisconnect);
});

const port = process.env.PORT || config.serverSettings.port;

// Start with NO proxies - bots connect directly
helper.proxies = [];

server.listen(port, () => {
  logger.info(`Server started on port ${port} (bots go DIRECT until proxy validation completes)`);
});

// Fetch + validate proxies in background - NEVER pollute helper.proxies until done
async function refreshProxies() {
  try {
    const count = await fetchProxies({ skipTest: true });
    if (count > 0) {
      // Read from file directly - does NOT touch helper.proxies
      const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'config/proxies.txt');
      const data = fs.readFileSync(filePath, 'utf-8');
      const allProxies = data.split('\n').map(p => p.trim()).filter(p => p);

      logger.info(`Fetched ${count} raw proxies, validating (TCP -> HTTPS)...`);
      const valid = await helper.validateProxies(allProxies);

      // ATOMIC: only now set the pool
      helper.proxies = valid;
      logger.info(`Validated: ${valid.length} working proxies ready! Bots will use them now.`);
    }
  } catch (e) {
    logger.warn(`Proxy refresh failed: ${e.message}`);
  }
}

// Kick off validation
refreshProxies();

// Refresh every hour
setInterval(refreshProxies, 60 * 60 * 1000);

export { manager };
