import { registerUser, loginUser } from './utils/auth.js';
import { config } from './config/index.js';
import Client from './core/Client.js';
import { helper, logger } from "./utils/index.js";
import { WebSocketServer } from 'ws';
import TokenManager from './core/TokenManager.js';

const manager = new TokenManager();
const server = helper.createServer();
const wss = new WebSocketServer({ server: server });

// ═══ Servizio Web Router per la Registrazione & Frontend ═══
const __dirname = path.dirname(fileURLToPath(import.meta.url));

server.on('request', async (req, res) => {
  const url = req.url;
  const method = req.method;

  // Health check
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('XevBots OK');
  }

  // API Registrazione
  if (url === '/api/register' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (!username || !password || username.trim() === "" || password.trim() === "") {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: "Username e Password sono obbligatori." }));
        }
        if (username.length < 3 || password.length < 5) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: "Lo username deve avere almeno 3 caratteri e la password almeno 5." }));
        }
        const result = registerUser(username.trim(), password);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, user: result }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message || "Errore durante la registratone." }));
      J
    });
    return;
  }

  // API Login
  if (url === '/api/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: "Username e Password sono obbligatori." }));
        }
        const result = loginUser(username.trim(), password);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, user: result }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message || "Errore durante l'accesso." }));
      }
    });
    return;
  }

  // API Stats (informazioni generali per il pannello)
  if (url === '/api/stats' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      proxiesCount: helper.proxies.length,
      facebookBotsLoaded: manager.ut ? Object.keys(manager.ut).length : 0,
      uptime: process.uptime()
    }));
  }

  // Serve static frontend (index.html)
  if (url === '/' || url === '/index.html') {
    const indexPath = path.join(__dirname, 'public/index.html');
    fs.readFile(indexPath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end("Errore interno del server (index.html non trovato)");
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(content);
    });
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

manager.checkTokens((v) => { });

wss.on('connection', (ws) => {
  const client = new Client(ws);
  logger.info('Client Connected');

  const authTimeout = setTimeout(() => {
    if (!client.authenticated) {
      logger.warn('Client auth timeout (10s) \u2014 closing');
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
