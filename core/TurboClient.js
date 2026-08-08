import { WebSocket } from "ws";
import { TurboMinion } from "./TurboMinion.js";
import { buffers, logger } from "../utils/index.js";
import { SmartBuffer } from "smart-buffer";
import { verifyUserToken } from "../utils/auth.js";
import { updateStartRequest } from "../server.js";

export default class TurboClient {
  ws;
  botsA; botNameA; botAmountA; botAiA; botVShieldA; serverA;
  botsB; botNameB; botAmountB; botAiB; botVShieldB; serverB;
  userX; userY; isAlive; rQuadrant; playerName;
  startedBots; stoppedBots; connectedBotsA; connectedBotsB;
  botTimeout; botIntA; botIntB; countIntA; countIntB;
  authenticated; tokenLabel;
  formationA; formationB; autoReconnect;

  constructor(ws) {
    this.ws = ws;
    this.botsA = []; this.botNameA = "TEAM A"; this.botAmountA = 5;
    this.botAiA = false; this.botVShieldA = false; this.serverA = null;
    this.botIntA = null; this.countIntA = null; this.connectedBotsA = 0;
    this.formationA = 0;
    this.botsB = []; this.botNameB = "TEAM B"; this.botAmountB = 5;
    this.botAiB = false; this.botVShieldB = false; this.serverB = null;
    this.botIntB = null; this.countIntB = null; this.connectedBotsB = 0;
    this.formationB = 0;
    this.userX = 0; this.userY = 0; this.rQuadrant = 0;
    this.playerName = ""; this.isAlive = false;
    this.botTimeout = []; this.stoppedBots = true;
    this.startedBots = false; this.autoReconnect = false;
    this.authenticated = false; this.tokenLabel = "";
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
          logger.info("Turbo Auth OK: " + entry.label);
          return;
        }
        logger.warn("Turbo Auth FAILED");
        this.ws.send(Buffer.from([8, 0]));
        this.ws.close();
        return;
      }
      logger.warn("Turbo: Rejected opcode " + opcode);
      this.ws.close();
      return;
    }

    switch (opcode) {
      case 0:
        this.serverA = reader.readStringNT();
        this.botNameA = reader.readStringNT();
        this.botAmountA = reader.readUInt16LE();
        this.startTeamA();
        break;
      case 1:
        this.stopAll();
        break;
      case 2:
        const sub = reader.readUInt8();
        const val = !!reader.readUInt8();
        if (sub === 0) { this.botVShieldA = val; this.botVShieldB = val; }
        else if (sub === 1) { this.botAiA = val; this.botAiB = val; }
        break;
      case 3:
        for (const bot of this.getAllBots())
          if (bot.ws?.readyState === 1 && bot.isAlive && bot.isNearMouse && bot.followMouse)
            bot.send(buffers.eject(), true);
        break;
      case 4:
        for (const bot of this.getAllBots())
          if (bot.ws?.readyState === 1 && bot.isAlive && bot.isNearMouse && bot.followMouse)
            bot.send(buffers.split(), true);
        break;
      case 5:
        this.userX = reader.readInt32LE();
        this.userY = reader.readInt32LE();
        break;
      case 6:
        const fType = reader.readUInt8();
        this.formationA = fType; this.formationB = fType;
        this.applyFormation(this.botsA, fType);
        this.applyFormation(this.botsB, fType);
        break;
      case 7:
        this.autoReconnect = !!reader.readUInt8();
        break;
      case 8:
        const team = reader.readUInt8();
        if (team === 1) {
          this.serverB = reader.readStringNT();
          this.botNameB = reader.readStringNT();
          this.botAmountB = reader.readUInt16LE();
          this.startTeamB();
        }
        break;
      case 9:
        const stopTeam = reader.readUInt8();
        if (stopTeam === 0) this.stopTeamA();
        else if (stopTeam === 1) this.stopTeamB();
        break;
      case 10:
        reader.readUInt8();
        this.userX = reader.readInt32LE();
        this.userY = reader.readInt32LE();
        break;
      case 11:
        const modeTeam = reader.readUInt8();
        const mode = reader.readUInt8();
        if (modeTeam === 0) { this.botAiA = (mode === 0); this.botVShieldA = false; }
        else if (modeTeam === 1) { this.botAiB = (mode === 0); this.botVShieldB = false; }
        break;
      case 12:
        const fTeam = reader.readUInt8();
        const fType2 = reader.readUInt8();
        if (fTeam === 0) { this.formationA = fType2; this.applyFormation(this.botsA, fType2); }
        else if (fTeam === 1) { this.formationB = fType2; this.applyFormation(this.botsB, fType2); }
        break;
      default:
        logger.warn("Turbo: Unknown opcode " + opcode);
    }
  }

  startTeamA() {
    if (this.botsA.length > 0) return;
    this.stoppedBots = false;
    updateStartRequest();
    this.botIntA = setInterval(() => {
      if (this.connectedBotsA < this.botAmountA && this.botsA.length < this.botAmountA)
        this.botsA.push(new TurboMinion(this, 0));
    }, 30);
    this.countIntA = setInterval(() => {
      this.botsA = this.botsA.filter(bot => !bot.isClosed);
      this.sendCountUpdate();
    }, 1000);
    logger.info("Turbo: Team A Starting (" + this.botNameA + " x" + this.botAmountA + ")");
  }

  startTeamB() {
    if (this.botsB.length > 0) return;
    this.stoppedBots = false;
    updateStartRequest();
    this.botIntB = setInterval(() => {
      if (this.connectedBotsB < this.botAmountB && this.botsB.length < this.botAmountB)
        this.botsB.push(new TurboMinion(this, 1));
    }, 30);
    this.countIntB = setInterval(() => {
      this.botsB = this.botsB.filter(bot => !bot.isClosed);
      this.sendCountUpdate();
    }, 1000);
    logger.info("Turbo: Team B Starting (" + this.botNameB + " x" + this.botAmountB + ")");
  }

  stopTeamA() {
    clearInterval(this.botIntA); clearInterval(this.countIntA);
    this.botIntA = null; this.countIntA = null;
    this.botsA.forEach(bot => bot.stop());
    this.botsA.length = 0; this.connectedBotsA = 0;
    logger.warn("Turbo: Team A Stopped");
    this.sendCountUpdate();
  }

  stopTeamB() {
    clearInterval(this.botIntB); clearInterval(this.countIntB);
    this.botIntB = null; this.countIntB = null;
    this.botsB.forEach(bot => bot.stop());
    this.botsB.length = 0; this.connectedBotsB = 0;
    logger.warn("Turbo: Team B Stopped");
    this.sendCountUpdate();
  }

  stopAll() {
    this.stopTeamA(); this.stopTeamB();
    this.stoppedBots = true; this.startedBots = false;
    this.botTimeout.forEach(id => clearTimeout(id));
    this.botTimeout.length = 0;
    this.ws?.send(Buffer.from([1]));
    logger.warn("Turbo: All Bots Stopped!");
  }

  getAllBots() { return [...this.botsA, ...this.botsB]; }
  getServer(team) { return team === 0 ? this.serverA : this.serverB; }
  getBotName(team) { return team === 0 ? this.botNameA : this.botNameB; }

  applyFormation(bots, type) {
    const count = bots.length;
    if (count === 0) return;
    if (type === 1) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        if (bots[i]) { bots[i].offsetX = Math.cos(angle) * 300; bots[i].offsetY = Math.sin(angle) * 300; }
      }
    } else if (type === 2) {
      for (let i = 0; i < count; i++)
        if (bots[i]) { bots[i].offsetX = i * 80 - ((count - 1) * 40); bots[i].offsetY = 0; }
    } else {
      for (const bot of bots) { bot.offsetX = 0; bot.offsetY = 0; }
    }
  }

  sendCountUpdate() {
    const aliveA = this.botsA.filter(b => b.ws?.readyState === WebSocket.OPEN && b.isAlive).length;
    const aliveB = this.botsB.filter(b => b.ws?.readyState === WebSocket.OPEN && b.isAlive).length;
    const totalAlive = aliveA + aliveB;
    const totalMax = this.botAmountA + this.botAmountB;
    this.ws?.send(buffers.sendBotCount(totalAlive + "/0/" + totalMax));
  }
}