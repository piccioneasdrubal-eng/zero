// server.js – Turbo Engine v7
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
      logger.warn("Watchdog: restarting...");
      res.writeHead(503); res.end("UNHEALTHY");
      setTimeout(() => process.exit(1), 500);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("XEVBots Turbo OK");
  }
});

manager.checkTokens((v) => {});

wss.on("connection", (ws, req) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  logger.info("Turbo Client Connected from " + ip);
  
  const client = new TurboClient(ws);
  
  ws.on("message", (buffer) => {
    // DEBUG: log first 16 bytes of every message
    const arr = Buffer.isBuffer(buffer) ? buffer : buffer;
    const hex = Array.from(arr.slice(0, Math.min(16, arr.length))).map(b => b.toString(16).padStart(2,'0')).join(' ');
    logger.info("Turbo RAW (len=" + arr.length + "): " + hex);
    
    try { client.handleMessage(buffer); }
    catch (e) { logger.warn("Turbo: bad msg - " + e.message); }
  });
  
  ws.on("close", () => { client.stopAll(); logger.warn("Turbo Client Disconnected"); });
  ws.on("error", () => { client.stopAll(); });
});

const port = process.env.PORT || config.serverSettings.port;
helper.setupProxies();

server.listen(port, () => {
  logger.info(`Turbo Server on ${port} with ${helper.proxies.length} proxies`);
});

fetchProxies({skipTest:true}).then(count => {
  if (count > 0) helper.setupProxies();
}).catch(e => {});

setInterval(() => {
  fetchProxies({skipTest:true}).then(count => {
    if (count > 0) helper.setupProxies();
  }).catch(e => {});
}, 60 * 60 * 1000);

export { manager };
