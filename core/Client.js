import { WebSocket } from "ws";
import { Minion } from "./Minion.js";
import { buffers, logger } from "../utils/index.js";
import { SmartBuffer } from "smart-buffer";
import { manager } from "./TokenManager.js";

export default class Client {
  constructor(ws) {
    this.ws = ws;
    this.bots = [];
    this.userX = 0;
    this.userY = 0;
    this.botAi = false;
    this.server = null;
    this.botName = "RayDay";
    this.botAmount = 10;
    this.rQuadrant = 0;
    this.botInt = null;
    this.playerName = "";
    this.countInt = null;
    this.botTimeout = [];
    this.isAlive = false;
    this.connectedBots = 0;
    this.botVShield = false;
    this.stoppedBots = true;
    this.startedBots = false;
  }

  async handleMessage(buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    const opcode = reader.readUInt8();
    switch (opcode) {
      case 0:
        this.server = reader.readStringNT();
        this.botName = reader.readStringNT();
        this.botAmount = reader.readUInt16LE();
        this.startBots();
        break;
      case 1:
        this.stopBots();
        break;
      case 2:
        reader.readUInt8() == 1
          ? (this.botAi = !!reader.readUInt8())
          : (this.botVShield = !!reader.readUInt8());
        break;
      case 3:
        for (const bot of this.bots)
          if (bot.ws?.readyState === 1 && bot.isAlive && !this.botAi && bot.isNearMouse && bot.followMouse)
            bot.send(buffers.eject(), true);
        break;
      case 4:
        for (const bot of this.bots)
          if (bot.ws?.readyState === 1 && bot.isAlive && !this.botAi && bot.isNearMouse && bot.followMouse)
            bot.send(buffers.split(), true);
        break;
      case 5:
        this.userX = reader.readInt32LE();
        this.userY = reader.readInt32LE();
        break;
      case 6:
        this.isAlive = !!reader.readUInt8();
        this.playerName = reader.readStringNT();
        break;
      case 7:
        this.rQuadrant = reader.readUInt8();
        break;
      case 8:
        this.sendTokenStatus();
        break;
      case 9:
        const oauthToken = reader.readStringNT();
        if (oauthToken && oauthToken.length > 20) {
          manager.addOAuthToken(oauthToken);
          logger.info(`Client: ricevuto token OAuth (${oauthToken.substring(0, 12)}...)`);
        }
        break;
    }
  }

  sendTokenStatus() {
    const status = manager.getStatus();
    const msg = `Tokens: ${status.total} EAA + ${status.oauth||0} OAuth | ${JSON.stringify(status.usage)}`;
    logger.info(msg);
    this.ws?.send(buffers.sendBotCount(msg));
  }

  startBots() {
    if (!this.startedBots) {
      this.stoppedBots = false;
      const maxBots = this.botAmount;
      this.botInt = setInterval(() => {
        if (this.bots.length < maxBots && !this.stoppedBots) {
          this.bots.push(new Minion(this));
        }
      }, 600);
      this.startedBots = true;
      logger.info(`Client Starting Bots.`);
      this.sendTokenStatus();
    }
  }

  stopBots() {
    if (!this.stoppedBots) {
      this.stoppedBots = true;
      this.startedBots = false;
      clearInterval(this.botInt);
      this.botInt = null;
      for (const bot of this.bots) bot.stop();
      this.bots = [];
      logger.warn("Client Bots Stopped!");
    }
  }

  disconnect() {
    this.stopBots();
    this.ws?.terminate();
  }
}
