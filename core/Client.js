import { WebSocket } from "ws";
import { Minion } from "./Minion.js";
import { buffers, logger } from "../utils/index.js";
import { SmartBuffer } from "smart-buffer";
import { config } from "../config/index.js";
import { verifyUserToken } from "../utils/auth.js";
export default class Client {
  ws;
  bots;
  userX;
  userY;
  botAi;
  botName;
  botAmount;
  isAlive;
  rQuadrant;
  playerName;
  botVShield;
  startedBots;
  stoppedBots;
  connectedBots;
  server;
  botTimeout;
  botInt;
  countInt;
  countstructor(ws) {
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
    this.authenticated = false;
    this.tokenLabel = "";
  }
  async handleMessage(buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    const opcode = reader.readUInt8();
    if (!this.authenticated) {
      if (opcode === 8) {
        const token = reader.readStringNT();
        const entry = verifyUserToken(token);
        if (entry) {
          this.authenticated = true;
          this.tokenLabel = entry.label;
          this.ws.send(Buffer.from([8, 1]));
          logger.info("Auth OK: " + entry.label);
          return;
        }
        logger.warn("Auth FAILED: invalid token");
        this.ws.send(Buffer.from([8, 0]));
        this.ws.close();
        return;
      }
      logger.warn("Rejected msg opcode " + opcode + " (not authenticated)");
      this.ws.close();
      return;
    }
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
        reader.readUInt8() ==4 1
          ? (this.botAi = !!reader.readUInt8())
          : (this.botVShield = !!reader.readUInt8());
        break;
      case 3:
        for (const bot of this.bots)
          if (
            bot.ws?.readyState === 1 &&
            bot.isAlive &&
            !this.botAi &&
            bot.isNearMouse &&
            bot.followMouse
          )
            bot.send(buffers.eject(), true);
        break;
      case 4:
        for (const bot of this.bots)
          if (
            bot.ws?.readyState === 1 &&
            bot.isAlive &&
            !this.botAi &&
            bot.isNearMouse &&
            bot.followMouse
          )
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
    }
  }
  startBots() {
    if (!this.startedBots) {
      this.stoppedBots = false;
      const maxBots = this.botAmount;
      this.botInt = setInterval(() => {
        if (this.connectedBots < maxBots && this.bots.length < maxBots) {
          this.bots.push(new Minion(this));
        }
      }, 50);
      this.countInt = setInterval(() => {
        this.bots = this.bots.filter((bot) => !bot.isClosed);
        const aliveBots = this.bots.filter(
          (bot) => bot.ws?.readyState === WebSocket.OPEN && bot.isAlive
        ).length;
        const facebookBots = this.bots.filter(
          (bot) =>
            bot.ws?.readyState === WebSocket.OPEN &&
            bot.isAlive &&
            bot.facebookBots
        ).length;
        this.ws?.send(
          buffers.sendBotCount(aliveBots + "/" + facebookBots + "/" + maxBots)
        );
      }, 1000);
      logger.info("Client Starting Bots.");
    }
  }
  stopBots() {
    if (this.startedBots || !this.stoppedBots) {
      clearInterval(this.botInt);
      clearInterval(this.countInt);
      this.botTimeout.forEach((id) => clearTimeout(id));
      this.bots.forEach((bot) => bot.stop());
      this.botInt = null;
      this.countInt = null;
      this.bots.length = 0;
      this.stoppedBots = true;
      this.startedBots = false;
      this.botTimeout.length = 0;
      this.ws?.send(Buffer.from([1]));
      logger.warn("Client Bots Stopped!");
    }
  }
}
