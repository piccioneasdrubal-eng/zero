import { logger } from "../utils/index.js";

export default class CrasherCoordinator {
  constructor() {
    this.activeCrashers = new Map();
  }

  startCrash(client, target, batchSize, delay, maxConns) {
    const info = { target, batchSize, delay, maxConns, startedAt: new Date().toISOString(), connCount: 0 };
    this.activeCrashers.set(client.tokenLabel, info);
    logger.info("CRASH STARTED by " + client.tokenLabel + " on " + target + " (batch=" + batchSize + " max=" + maxConns + ")");
    return info;
  }

  stopCrash(client) {
    this.activeCrashers.delete(client.tokenLabel);
    logger.warn("CRASH STOPPED by " + client.tokenLabel);
  }

  updateCount(client, count) {
    const info = this.activeCrashers.get(client.tokenLabel);
    if (info) info.connCount = count;
  }

  getStatus() {
    return Array.from(this.activeCrashers.entries()).map(([label, info]) => ({ label, ...info }));
  }
}
