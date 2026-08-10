import { config } from './config/index.js';
import Client from './core/Client.js';
import { helper, logger } from "./utils/index.js";
import { WebSocketServer } from 'ws';
import { fetchProxies } from './scripts/fetchProxies.js';

const wss = new WebSocketServer({ port: config.serverSettings.port });

logger.info("============================================");
logger.info("  ZeroExtens Bots PRO - Server");
logger.info(`  Porta: ${config.serverSettings.port}`);
logger.info(`  Proxy: ${config.proxySettings.enableProxy ? "ON" : "OFF"}`);
logger.info("============================================");

wss.on('connection', (ws) => {
  const client = new Client(ws);
  logger.info('Client Connesso!');

  const logLocalIPs = () => {
    logger.info(`Bot name: ${client.botName || '(non impostato)'} | Bot max: ${client.botAmount}`);
  };

  ws.on('message', (buffer) => {
    try {
      client.handleMessage(buffer);
    } catch (e) {
      logger.warn('Pacchetto corrotto - ignorato');
    }
  });

  ws.on('close', () => {
    client.stopBots();
    logger.warn('Client Disconnesso!');
  });

  ws.on('error', (err) => {
    logger.warn(`Errore WebSocket: ${err.message}`);
  });

  setTimeout(logLocalIPs, 1000);
});

fetchProxies({ skipTest: true }).then(count => {
  if (count > 0) logger.info(`Proxy caricati: ${count}`);
});

logger.info(`Server in ascolto su porta ${config.serverSettings.port}`);
