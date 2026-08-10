import WebSocket from "ws";
import Entity from "./Entity.js";
import { SmartBuffer } from "smart-buffer";
import { buffers, helper, logger } from "../utils/index.js";
import { config } from "../config/index.js";
import { manager } from "./TokenManager.js";

export class Minion {
  constructor(client) {
    this.ws = null; this.rX = 1; this.rY = 1;
    this.offsetX = 0; this.offsetY = 0;
    this.borderX = 0; this.borderY = 0;
    this.myCellIds = {}; this.ownCells = []; this.moveInt = null;
    this.client = client;
    this.isAlive = false; this.isClosed = false;
    this.gameModeInt = -1;
    this.playerCells = [];
    this.encryptionKey = 0; this.decryptionKey = 0;
    this.followMouse = false;
    this.errorTimeout = null; this.spawnTimeout = null;
    this.isConnected = false; this.isNearMouse = false;
    this.facebookBots = true;
    this.mapOffsetFixed = false; this.followMouseTimeout = null;
    this.loginSent = false;
    this.token = config.tokenSettings.enableFacebook ? manager.getNextToken() : null;
    this.proxyAgent = helper.getProxy();
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.client.server, { agent: this.proxyAgent, headers: helper.generateHeaders(), rejectUnauthorized: true });
    this.ws.binaryType = "nodebuffer";
    this.ws.onopen = this.onopen.bind(this);
    this.ws.onclose = this.onclose.bind(this);
    this.ws.onerror = this.onerror.bind(this);
    this.ws.onmessage = this.onmessage.bind(this);
  }

  send(buffer, encrypt = true) {
    if (!this.ws) return;
    encrypt && (buffer = helper.xorBuffer(buffer, this.encryptionKey));
    this.encryptionKey && (this.encryptionKey = helper.rotateKey(this.encryptionKey));
    if (this.ws.readyState === 1) this.ws.send(buffer);
  }

  onopen() { this.send(buffers.protocolVersion()); this.send(buffers.protocolKey()); }

  onclose() {
    this.isClosed = true;
    this.client.connectedBots--;
    if (this.token) { manager.releaseToken(this.token); this.token = null; }
  }

  onerror() {
    this.isClosed = true;
    this.clearTimeouts(); this.clearIntervals();
    this.errorTimeout = setTimeout(() => { if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) this.ws.close(); }, 1000);
  }

  onmessage({ data: buffer }) {
    let pb = buffer;
    if (this.decryptionKey) pb = helper.xorBuffer(pb, this.decryptionKey ^ 31128);
    this.handleBuffer(pb);
  }

  handleBuffer(buffer) {
    const r = SmartBuffer.fromBuffer(buffer);
    switch (r.readUInt8()) {
      case 18: this.myCellIds = {}; this.ownCells = []; this.playerCells = []; break;
      case 32:
        const cid = r.readUInt32LE();
        this.myCellIds[cid] = cid;
        if (!this.isAlive) {
          this.isAlive = true;
          this.moveInterval = setInterval(() => this.move(), 50);
          if (!this.client.startedBots && !this.client.stoppedBots) { this.client.startedBots = true; logger.info("Bots started."); }
          if (!this.followMouseTimeout && !this.followMouse) { this.followMouseTimeout = setTimeout(() => (this.followMouse = true), 7000); }
          if (this.token && !this.loginSent) {
            this.loginSent = true;
            const tp = this.token.substring(0, 12) + "...";
            setTimeout(() => { this.send(manager.buildLoginBuffer(this.token), true); logger.info(`FB login: ${tp}`); }, config.tokenSettings.loginRequestDelay || 2000);
          }
        }
        break;
      case 69: this.ghostCells(r); break;
      case 85: logger.info("Mass boost activated"); break;
      case 103: if (config.facebookBotSettings.useMassBoost && this.facebookBots) this.send(Buffer.from([85]), true); break;
      case 104:
        logger.warn(`FB token rifiutato/scaduto, provo prossimo...`);
        if (this.token) { manager.releaseToken(this.token); this.token = config.tokenSettings.enableFacebook ? manager.getNextToken() : null; this.loginSent = false; }
        break;
      case 241:
        this.isConnected = true; this.client.connectedBots++;
        if (!this.client.server) break;
        this.decryptionKey = r.readUInt32LE();
        const sm = this.client.server.match(/wss:\/\/(web-arenas-live-[\w-]+\.agario\.miniclippt\.com\/[\w-]+\/[\d-]+)/);
        if (sm && sm[1]) this.encryptionKey = helper.murmur2("" + sm[1] + r.readStringNT("utf-8"), 255);
        break;
      case 242: this.send(buffers.spawn(this.client.botName), true); break;
      case 255: this.handleMessage(helper.uncompressBuffer(r.toBuffer().subarray(5), Buffer.alloc(r.readUInt32LE()))); break;
    }
  }

  handleMessage(buffer) {
    const r = SmartBuffer.fromBuffer(buffer);
    switch (r.readUInt8()) {
      case 16: this.updateNodes(r); break;
      case 64: this.updateOffset(r); break;
    }
  }

  ghostCells(r) {
    r.readOffset += 2;
    const x = r.readInt32LE() - this.offsetX, y = r.readInt32LE() - this.offsetY;
    let q;
    if (x < 0 && y < 0) q = 1; else if (x > 0 && y < 0) q = 2; else if (x > 0 && y > 0) q = 3; else q = 4;
    const qm = [[[1,1],[-1,1],[-1,-1],[1,-1]],[[-1,1],[1,1],[1,-1],[-1,-1]],[[-1,-1],[1,-1],[1,1],[-1,1]],[[1,-1],[-1,-1],[-1,1],[1,1]]];
    if (this.client.rQuadrant < 1 || this.client.rQuadrant > 4 || this.gameModeInt === 3) return;
    [this.rX, this.rY] = qm[this.client.rQuadrant - 1][q - 1];
  }

  updateNodes(r) {
    const rc = r.readUInt16LE();
    for (let i = 0; i < rc; i++) { if (this.playerCells[r.readUInt32LE()]) { const c = this.playerCells[r.readUInt32LE()]; if (c) c.destroy(this); } }
    while (true) {
      const cid = r.readUInt32LE(); if (cid === 0) break;
      const x = r.readInt32LE(), y = r.readInt32LE(), size = r.readUInt16LE(), flags = r.readUInt8();
      const isVirus = !!(flags & 1);
      let sn = null, color = null, name = null, ef = 0;
      if (flags & 128) ef = r.readUInt8();
      if (flags & 2) color = helper.intToHex((r.readUInt8() << 16) | (r.readUInt8() << 8) | r.readUInt8());
      if (flags & 4) name = r.readStringNT("utf8");
      if (flags & 8) sn = r.readStringNT("utf8");
      const isAgitated = !!(flags & 16), isFood = !!(ef & 1), isFriend = !!(ef & 2);
      let aid = 0;
      if (ef & 4) { r.readOffset += 4; aid = r.readUInt32LE(r.readOffset - 4); }
      let cell = this.playerCells[cid];
      if (!cell) { cell = new Entity(cid, aid); this.playerCells[cid] = cell; }
      if (color !== null) cell.color = color;
      if (sn !== null) cell.name = unescape(encodeURIComponent(sn));
      if (name !== null) cell.skinName = name;
      if (this.myCellIds[cid] && this.ownCells.indexOf(cell) === -1) { cell.isMine = true; this.ownCells.push(cell); }
      cell.x = x; cell.y = y; cell.size = size;
      cell.isFood = isFood; cell.isVirus = isVirus; cell.agitated = isAgitated; cell.isFriend = isFriend; cell.accountID = aid;
    }
    const ec = r.readUInt16LE();
    for (let i = 0; i < ec; i++) { const cid = r.readUInt32LE(); if (this.playerCells[cid]) this.playerCells[cid].destroy(this); }
    if (this.isAlive && this.ownCells.length === 0) {
      if (this.moveInterval) { clearInterval(this.moveInterval); this.moveInterval = null; }
      if (this.followMouseTimeout) { clearTimeout(this.followMouseTimeout); this.followMouse = false; this.followMouseTimeout = null; }
      this.isAlive = false; this.isNearMouse = false;
      const ss = config.facebookBotSettings.skin;
      if (ss.enable && this.facebookBots) {
        const ri = Math.floor(Math.random() * ss.names.length);
        this.send(manager.buildSkinChangeBuffer(ss.names[ri]), true);
      }
      this.spawnTimeout = setTimeout(() => this.send(buffers.spawn(this.client.botName), true), 0);
    }
  }

  updateOffset(r) {
    const minX = r.readDoubleLE(), minY = r.readDoubleLE(), maxX = r.readDoubleLE(), maxY = r.readDoubleLE();
    if (!this.mapOffsetFixed) {
      this.borderX = maxX - minX; this.borderY = maxY - minY;
      if (maxX - minX > 14000) this.offsetX = (minX + maxX) / 2;
      if (maxY - minY > 14000) this.offsetY = (minY + maxY) / 2;
      this.gameModeInt = r.readUInt8();
      this.mapOffsetFixed = true;
    }
  }

  checkEnemies(x, y, size) {
    const enemies = [];
    for (const cell of Object.values(this.playerCells)) {
      if (cell.isFood || cell.isMine || cell.isVirus || cell.isFriend) continue;
      if (helper.size2mass(size) > 2000) continue;
      if (cell.name == this.client.playerName && this.client.isAlive) continue;
      if (cell.name == unescape(encodeURIComponent(this.client.botName))) continue;
      const dx = cell.x - x, dy = cell.y - y;
      if (cell.size > size * 0.85 && Math.hypot(dx, dy) - size - cell.size < 150)
        enemies.push({ dx, dy, distance: Math.hypot(dx, dy) - size - cell.size, sizeRatio: helper.size2mass(cell.size) / helper.size2mass(size) });
    }
    return enemies;
  }

  nearestPlayer(x, y, size) {
    const md = 2000, dxtm = this.client.userX / this.rX - x, dytm = this.client.userY / this.rY - y;
    const msd = 1 + Math.hypot(dxtm, dytm);
    let mx = dxtm / msd, my = dytm / msd;
    const enemies = this.checkEnemies(x, y, size);
    if (enemies.length === 0) return { x: this.client.userX / this.rX + this.offsetX, y: this.client.userY / this.rY + this.offsetY };
    for (const { dx, dy, distance, sizeRatio } of enemies) {
      const f = -10 * sizeRatio;
      mx += ((dx / distance) * f) / distance;
      my += ((dy / distance) * f) / distance;
    }
    const tf = 1 + Math.hypot(mx, my);
    return { x: x + (mx / tf) * md, y: y + (my / tf) * md };
  }

  nearestEntity(type, x, y, size) {
    let nearest = null, minDist = Infinity;
    const enemies = type === "isFood" ? this.checkEnemies(x, y, size) : [];
    for (const cell of Object.values(this.playerCells)) {
      let valid = false;
      if (type === "isFood") valid = !cell.isFriend && !cell.isVirus && cell.isFood && !cell.agitated;
      else if (type === "isVirus") valid = !cell.isFriend && cell.isVirus && !cell.isFood && !cell.agitated;
      if (!valid) continue;
      const dist = helper.calculateDistance(x, y, cell.x, cell.y);
      if (type === "isFood") {
        let danger = false;
        for (const enemy of enemies) { if (helper.calculateDistance(enemy.dx + x, enemy.dy + y, cell.x, cell.y) < 1000) { danger = true; break; } }
        if (danger) continue;
      }
      if (dist < minDist) { nearest = cell; minDist = dist; }
    }
    return { distance: minDist, entity: nearest };
  }

  move() {
    const c = { x: 0, y: 0, size: 0 };
    for (const { x, y, size } of this.ownCells) { c.x += x; c.y += y; c.size += size; }
    c.x /= this.ownCells.length; c.y /= this.ownCells.length;
    const pt = this.nearestPlayer(c.x, c.y, c.size);
    const ft = this.nearestEntity("isFood", c.x, c.y, c.size);
    const vt = this.nearestEntity("isVirus", c.x, c.y, c.size);
    if (!this.isAlive) return;
    let tx = pt.x, ty = pt.y;
    this.isNearMouse = helper.calculateDistance(c.x, c.y, this.client.userX / this.rX, this.client.userY / this.rY) < 4000 + helper.size2mass(c.size) * 0.5;
    if (this.followMouse) {
      const ai = this.client.botAi, vs = this.client.botVShield;
      if (ai && vs) { if (vt.entity) { tx = vt.entity.x; ty = vt.entity.y; } else if (ft.entity) { tx = ft.entity.x; ty = ft.entity.y; } }
      else if (!ai && vs) { if (vt.entity && vt.distance < 10000) { tx = vt.entity.x; ty = vt.entity.y; } }
      else if (ai && !vs) { if (ft.entity) { tx = ft.entity.x; ty = ft.entity.y; } }
    } else if (ft.entity) { tx = ft.entity.x; ty = ft.entity.y; }
    this.send(buffers.moveTo(tx, ty, this.decryptionKey), true);
  }

  clearIntervals() { if (this.moveInterval) { clearInterval(this.moveInterval); this.moveInterval = null; } }
  clearTimeouts() {
    if (this.spawnTimeout) { clearTimeout(this.spawnTimeout); this.spawnTimeout = null; }
    if (this.errorTimeout) { clearTimeout(this.errorTimeout); this.errorTimeout = null; }
    if (this.followMouseTimeout) { clearTimeout(this.followMouseTimeout); this.followMouseTimeout = null; }
  }
  stop() {
    this.clearIntervals(); this.clearTimeouts();
    if (this.token) { manager.releaseToken(this.token); this.token = null; }
    this.ws?.terminate();
  }
}
