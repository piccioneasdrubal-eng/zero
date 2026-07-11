import { config } from './config/index.js';
import Client from './core/Client.js';
import { helper, logger } from "./utils/index.js";
import { WebSocketServer } from 'ws';
import TokenManager from './core/TokenManager.js';
import { fetchProxies } from './scripts/fetchProxies.js';

const manager = new TokenManager();
const server = helper.createServer();
const wss = new WebSocketServer({ server: server });

// Health check HTTP per Render & co.
server.on('request', (req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('XevBots OK');
  }
});

let serverListening = false;

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
      logger.warn('Server: corrupted message – dropped');
    }
  });
  ws.on('close', handleDisconnect);
  ws.on('error', handleDisconnect);
});

const port = process.env.PORT || config.serverSettings.port;

// 1. Load existing proxies immediately
helper.setupProxies();

// 2. Start server immediately
server.listen(port, () => {
  serverListening = true;
  logger.info(`Server started on port ${port} with ${helper.proxies.length} proxies`);
});

// 3. Fetch + VALIDATE proxies in background, then reload
async function refreshProxies() {
  try {
    const count = await fetchProxies({ skipTest: true });
    if (count > 0) {
      helper.setupProxies(); // reload from file
      logger.info(`Fetched ${count} raw proxies, validating...`);
      const valid = await helper.validateProxies(helper.proxies);
      helper.proxies = valid;
      logger.info(`Validated: ${valid.length} working proxies ready`);
    }
  } catch (e) {
    logger.warn(`Proxy refresh failed: ${e.message}`);
  }
}

// Initial fetch + validate
refreshProxies();

// Refresh every hour
setInterval(refreshProxies, 60 * 60 * 1000);

export { manager };
