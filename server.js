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
      }
    });
    return;
  }

api_login:
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

  // API Stats (informazioni generili per il pannello)
  if (url === '/api/stats' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      proxiesCount: helper.proxies.length,
      facebookBotsLoaded: manager.ut ? Object.keys(manager.ut).length : 0,
      uptime: process.uptime()
    }));
  }
	J});
export { manager };