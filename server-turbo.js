// ═══════════════════════════════════════════
//  server-turbo.js — Turbo Engine v7 compatible
//  Supporto 2 team (A + B), auth, formazioni
//  Sostituisce server.js
// ═══════════════════════════════════════════

import { config } from "./config/index.js";
import TurboClient from "./core/TurboClient.js";
import { helper, logger } from "./utils/index.js";
import { WebSocketServer } from "ws";
import TokenManager from "./core/TokenManager.js";
import { fetchProxies } from "./scripts/fetchProxies.js";

const manager = new TokenManager();
const server = helper.createServer();
const wss = new WebSocketServer({ server: server });

let lastBotAliveTime = 0;
let startRequestTime = 0;

export function updateLastBotAlive() { lastBotAliveTime = Date.now(); }
export function updateStartRequest() { startRequestTime = Date.now(); }

server.on("request", (req, res) => {
  if (req.url === "/" || req.url === "/health") {
    const now = Date.now();
    if (startRequestTime > 0 && (now - startRequestTime > 60000) && (lastBotAliveTime < startRequestTime)) {
      logger.warn("Watchdog: no bots alive after 60s, restarting...");
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("UNHEALTHY - restarting");
      setTimeout(() => process.exit(1), 500);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("XEVBots Turbo OK");
  }
});

manager.checkTokens((v) => {});

wss.on("connection", (ws) => {
  const client = new TurboClient(ws);
  logger.info("Turbo Client Connected");
  const handleDisconnect = () => {
    client.stopAll();
    logger.warn("Turbo Client Disconnected!");
  };
  ws.on("message", (buffer) => {
    try { client.handleMessage(buffer); }
    catch (e) { logger.warn("Turbo: corrupted message — dropped"); }
  });
  ws.on("close", handleDisconnect);
  ws.on("error", handleDisconnect);
});

const port = process.env.PORT || config.serverSettings.port;
helper.setupProxies();

server.listen(port, () => {
  logger.info(`Turbo Server started on port ${port} with ${helper.proxies.length} proxies`);
});

fetchProxies({ skipTest: true }).then(count => {
  if (count > 0) helper.setupProxies();
  logger.info(`Fetched ${count} fresh proxies`);
}).catch(e => { logger.warn(`Proxy fetch failed: ${e.message}`); });

setInterval(() => {
  fetchProxies({ skipTest: true }).then(count => {
    if (count > 0) helper.setupProxies();
    logger.info(`Refreshed ${count} proxies`);
  }).catch(e => { logger.warn(`Proxy refresh failed: ${e.message}`); });
}, 60 * 60 * 1000);

export { manager };