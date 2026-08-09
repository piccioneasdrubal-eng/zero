import WebSocket from "ws";
import Entity from "./Entity.js";
import { manager, updateLastBotAlive } from "../server.js";
import { SmartBuffer } from "smart-buffer";
import { buffers, helper, logger } from "../utils/index.js";
import { config } from "../config/index.js";

export class TurboMinion {
  constructor(client, team = 0) {
    this.ws = null; this.rX = 1; this.rY = 1; this.offsetX = 0; this.offsetY = 0;
    this.borderX = 0; this.borderY = 0;
    this.myCellIds = {}; this.ownCells = []; this.moveInt = null;
    this.t = manager.t(); this.client = client; this.team = team;
    this.isAlive = false; this.isClosed = false; this.gameModeInt = -1;
    this.playerCells = []; this.encryptionKey = 0; this.decryptionKey = 0;
    this.followMouse = false; this.errorTimeout = null;
    this.spawnTimeout = null; this.spawnInterval = null;
    this.isConnected = false; this.isNearMouse = false;
    this.facebookBots = false; this.mapOffsetFixed = false;
    this.followMouseTimeout = null;
    this.proxyAgent = helper.getProxy();
    this.connect();
  }

  connect() {
    const url = this.client.getServer(this.team);
    this.ws = new WebSocket(url, {
      agent: this.proxyAgent, headers: helper.generateHeaders(), rejectUnauthorized: false
    });
    this.ws.binaryType = "nodebuffer";
    this.ws.onopen = this.onopen.bind(this);
    this.ws.onclose = this.onclose.bind(this);
    this.ws.onerror = this.onerror.bind(this);
    this.ws.onmessage = this.onmessage.bind(this);
  }

  send(buffer, encrypt = false) {
    if (!this.ws) return;
    encrypt && (buffer = helper.xorBuffer(buffer, this.encryptionKey));
    this.encryptionKey && (this.encryptionKey = helper.rotateKey(this.encryptionKey));
    if (this.ws.readyState === 1) this.ws.send(buffer);
  }

  onopen() { this.send(buffers.protocolVersion()); this.send(buffers.protocolKey()); }

  onclose() {
    this.isClosed = true;
    if (this.team === 0) this.client.connectedBotsA--;
    else this.client.connectedBotsB--;
    if (this.t !== -1 && this.facebookBots)
      manager.releaseToken(this.t, () => { this.t = -1; this.facebookBots = false; });
  }

  onerror() {
    this.isClosed = true;
    this.clearTimeouts(); this.clearIntervals();
    this.facebookBots = false;
    this.errorTimeout = setTimeout(() => {
      if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN)
        this.ws.close();
    }, 1000);
  }

  onmessage({ data: buffer }) {
    try {
      let pb = buffer;
      if (this.decryptionKey) pb = helper.xorBuffer(pb, this.decryptionKey ^ 31128);
      this.handleBuffer(pb);
    } catch (e) {
      logger.warn(`[TurboMinion] Pacchetto corrotto dal proxy: ${e.message}`);
    }
  }

  handleBuffer(buffer) {
    try {
      if (!buffer || buffer.length === 0) return;
      const r = SmartBuffer.fromBuffer(buffer);
      if (r.remaining() < 1) return;
      switch (r.readUInt8()) {
      case 18: this.myCellIds = {}; this.ownCells = []; this.playerCells = []; break;
      case 32:
        const id = r.readUInt32LE(); this.myCellIds[id] = id;
        if (!this.isAlive) {
          this.isAlive = true; updateLastBotAlive();
          this.moveInterval = setInterval(() => this.move(), 100);
          if (!this.client.startedBots && !this.client.stoppedBots)
            { this.client.startedBots = true; logger.info("Bots started."); }
          if (!this.followMouseTimeout && !this.followMouse)
            this.followMouseTimeout = setTimeout(() => (this.followMouse = true), 7000);
          if (this.t !== -1 && !this.facebookBots)
            manager.requestLogin(this.t, (lb) => { this.send(lb, true); });
        }
        break;
      case 69: this.ghostCells(r); break;
      case 103:
        this.facebookBots = true; this.useMassBoost();
        manager.buyMassBoost(this.t, (mb) => { this.send(mb, true); });
        break;
      case 104:
        this.facebookBots = false;
        manager.releaseToken(this.t, () => { this.t = -1; this.facebookBots = false; });
        break;
      case 241:
        this.isConnected = true;
        if (this.team === 0) this.client.connectedBotsA++;
        else this.client.connectedBotsB++;
        const srv = this.client.getServer(this.team);
        if (!srv) break;
        this.decryptionKey = r.readUInt32LE();
        const m = srv.match(/wss:\/\/((web-arenas-live-[\w-]+\.agario\.miniclippt\.com\/[\w-]+\/[\d-]+))/);
        if (m && m[1]) this.encryptionKey = helper.murmur2("" + m[1] + r.readStringNT("utf-8"), 255);
        break;
      case 242:
        this.send(buffers.spawn(this.client.getBotName(this.team)), true);
        break;
      case 255:
        this.handleMessage(helper.uncompressBuffer(r.toBuffer().subarray(5), Buffer.alloc(r.readUInt32LE())));
        break;
    }
    } catch (e) {
      logger.warn(`[TurboMinion] handleBuffer error: ${e.message}`);
    }
  }

  useMassBoost() {
    const t = Date.now();
    const n = manager.ut[this.t]?.name; if (!n) return;
    const e = helper.getMassBoostExpire(n);
    if (e && t < e) return;
    if (config.facebookBotSettings.useMassBoost && this.facebookBots) {
      manager.buyMassBoost(this.t, (b) => { this.send(b, true); });
      manager.setMassBoostExpire(this.t, (b) => { this.send(b, true); });
      helper.clearExpiredMassBoosts();
      helper.setMassBoostExpire(n, t + 3600000);
    }
  }

  handleMessage(buffer) {
    try {
      if (!buffer || buffer.length === 0) return;
      const r = SmartBuffer.fromBuffer(buffer);
      if (r.remaining() < 1) return;
      switch (r.readUInt8()) {
        case 16: this.updateNodes(r); break;
        case 64: this.updateOffset(r); break;
      }
    } catch (e) {
      logger.warn(`[TurboMinion] handleMessage error: ${e.message}`);
    }
  }

  ghostCells(r) {
    r.readOffset += 2;
    const x = r.readInt32LE() - this.offsetX, y = r.readInt32LE() - this.offsetY;
    let q;
    if (x < 0 && y < 0) q = 1; else if (x > 0 && y < 0) q = 2;
    else if (x > 0 && y > 0) q = 3; else q = 4;
    const qm = [[[1,1],[-1,1],[-1,-1],[1,-1]],[[-1,1],[1,1],[1,-1],[-1,-1]],[[-1,-1],[1,-1],[1,1],[-1,1]],[[1,-1],[-1,-1],[-1,1],[1,1]]];
    if (this.client.rQuadrant < 1 || this.client.rQuadrant > 4 || this.gameModeInt === 3) return;
    [this.rX, this.rY] = qm[this.client.rQuadrant - 1][q - 1];
  }

  updateNodes(r) {
    try {
    const rc = r.readUInt16LE();
    for (let i = 0; i < rc; i++) {
      const id = r.readUInt32LE();
      if (this.playerCells[id]) this.playerCells[id].destroy(this);
    }
    while (true) {
      const id = r.readUInt32LE(); if (id === 0) break;
      const x = r.readInt32LE(), y = r.readInt32LE(), s = r.readUInt16LE(), f = r.readUInt8();
      const iv = !!(f & 1); let sn = null, c = null, nm = null, ef = 0;
      if (f & 128) ef = r.readUInt8();
      if (f & 2) c = helper.intToHex((r.readUInt8()<<16)|(r.readUInt8()<<8)|r.readUInt8());
      if (f & 4) nm = r.readStringNT("utf8");
      if (f & 8) sn = r.readStringNT("utf8");
      const ia = !!(f & 16), iFd = !!(ef & 1), iFr = !!(ef & 2);
      let aid = 0;
      if (ef & 4) { r.readOffset += 4; aid = r.readUInt32LE(r.readOffset - 4); }
      let cl = this.playerCells[id];
      if (!cl) { cl = new Entity(id, aid); this.playerCells[id] = cl; }
      if (c !== null) cl.color = c;
      if (sn !== null) cl.name = unescape(encodeURIComponent(sn));
      if (nm !== null) cl.skinName = nm;
      if (this.myCellIds[id] && this.ownCells.indexOf(cl) === -1)
        { cl.isMine = true; this.ownCells.push(cl); }
      cl.x = x; cl.y = y; cl.size = s;
      cl.isFood = iFd; cl.isVirus = iv;
      cl.agitated = ia; cl.isFriend = iFr; cl.accountID = aid;
    }
    const ec = r.readUInt16LE();
    for (let i = 0; i < ec; i++) {
      const id = r.readUInt32LE();
      if (this.playerCells[id]) this.playerCells[id].destroy(this);
    }
    if (this.isAlive && this.ownCells.length === 0) {
      if (this.moveInterval) { clearInterval(this.moveInterval); this.moveInterval = null; }
      if (!this.facebookBots && this.followMouseTimeout) {
        clearTimeout(this.followMouseTimeout); this.followMouse = false; this.followMouseTimeout = null;
      }
      this.isAlive = false; this.isNearMouse = false;
      const ss = config.facebookBotSettings.skin;
      if (ss.enable && this.facebookBots) {
        const ri = Math.floor(Math.random() * ss.names.length);
        manager.changeSkin(this.t, ss.names[ri], (sb) => { this.send(sb, true); });
      }
      if (this.spawnInterval) clearInterval(this.spawnInterval);
      this.spawnInterval = setInterval(() => {
        if (this.isAlive) { clearInterval(this.spawnInterval); this.spawnInterval = null; return; }
        this.send(buffers.spawn(this.client.getBotName(this.team)), true);
      }, 50);
    }
    } catch (e) {
      logger.warn(`[TurboMinion] updateNodes error: ${e.message}`);
    }
  }

  updateOffset(r) {
    const mnX = r.readDoubleLE(), mnY = r.readDoubleLE();
    const mxX = r.readDoubleLE(), mxY = r.readDoubleLE();
    if (!this.mapOffsetFixed) {
      this.borderX = mxX - mnX; this.borderY = mxY - mnY;
      if (mxX - mnX > 14000) this.offsetX = (mnX + mxX) / 2;
      if (mxY - mnY > 14000) this.offsetY = (mnY + mxY) / 2;
      this.gameModeInt = r.readUInt8(); this.mapOffsetFixed = true;
    }
  }

  move() {
    if (!this.isAlive) return;
    const cs = this.ownCells; if (cs.length === 0) return;
    let cx = 0, cy = 0, cz = 0;
    for (const { x, y, size } of cs) { cx += x; cy += y; cz += size; }
    cx /= cs.length; cy /= cs.length;
    const tX = this.client.userX / this.rX + this.offsetX;
    const tY = this.client.userY / this.rY + this.offsetY;
    this.isNearMouse = Math.hypot(tX - cx, tY - cy) < 4000 + helper.size2mass(cz) * 0.5;
    let gX = tX, gY = tY;
    const uAI = (this.team === 0 ? this.client.botAiA : this.client.botAiB);
    const uVS = (this.team === 0 ? this.client.botVShieldA : this.client.botVShieldB);
    const cM = helper.size2mass(cz), mO2 = cM > 2000;
    const bn = this.client.getBotName(this.team);
    const bnE = unescape(encodeURIComponent(bn));
    const pn = this.client.playerName, pa = this.client.isAlive;
    let nF = null, mFd = Infinity, nV = null, mVd = Infinity;
    const en = [];
    for (const cl of Object.values(this.playerCells)) {
      if (cl.isMine) continue;
      if (cl.isFood && !cl.isFriend && !cl.isVirus && !cl.agitated) {
        if (uAI || !this.followMouse) {
          const d = helper.calculateDistance(cx, cy, cl.x, cl.y);
          if (d < mFd) { nF = cl; mFd = d; }
        }
        continue;
      }
      if (cl.isVirus && !cl.isFriend && !cl.isFood && !cl.agitated) {
        if (uVS) {
          const d = helper.calculateDistance(cx, cy, cl.x, cl.y);
          if (d < mVd) { nV = cl; mVd = d; }
        }
        continue;
      }
      if (cl.isFood || cl.isFriend || cl.isVirus) continue;
      if (mO2) continue;
      if (cl.name === pn && pa) continue;
      if (cl.name === bnE) continue;
      if (cl.size <= cz * 0.85) continue;
      const dx = cl.x - cx, dy = cl.y - cy;
      const d = Math.hypot(dx, dy) - cz - cl.size;
      if (d < 150) en.push({ dx, dy, distance: d, sizeRatio: helper.size2mass(cl.size) / cM });
    }
    if (en.length > 0) {
      const dmX = tX - cx, dmY = tY - cy, md = 1 + Math.hypot(dmX, dmY);
      let mX = dmX / md, mY = dmY / md;
      for (const { dx, dy, distance, sizeRatio } of en) {
        const f = -10 * sizeRatio;
        mX += ((dx / distance) * f) / distance;
        mY += ((dy / distance) * f) / distance;
      }
      const tf = 1 + Math.hypot(mX, mY);
      gX = cx + (mX / tf) * 2000;
      gY = cy + (mY / tf) * 2000;
    } else if (this.followMouse) {
      if (uAI && uVS) {
        if (nV) { gX = nV.x; gY = nV.y; }
        else if (nF) { gX = nF.x; gY = nF.y; }
      } else if (!uAI && uVS) {
        if (nV && mVd < 10000) { gX = nV.x; gY = nV.y; }
      } else if (uAI && !uVS) {
        if (nF) { gX = nF.x; gY = nF.y; }
      }
    } else {
      if (nF) { gX = nF.x; gY = nF.y; }
    }
    this.send(buffers.moveTo(gX, gY, this.decryptionKey), true);
  }

  clearIntervals() {
    if (this.moveInterval) { clearInterval(this.moveInterval); this.moveInterval = null; }
    if (this.spawnInterval) { clearInterval(this.spawnInterval); this.spawnInterval = null; }
  }
  clearTimeouts() {
    if (this.spawnTimeout) { clearTimeout(this.spawnTimeout); this.spawnTimeout = null; }
    if (this.errorTimeout) { clearTimeout(this.errorTimeout); this.errorTimeout = null; }
    if (this.followMouseTimeout) { clearTimeout(this.followMouseTimeout); this.followMouseTimeout = null; }
  }
  stop() {
    this.clearIntervals(); this.clearTimeouts();
    this.ws?.terminate(); manager.clearTokenUsage();
  }
}