import WebSocket from "ws";
import Entity from "./Entity.js";
import { manager } from "../server.js";
import { SmartBuffer } from "smart-buffer";
import { buffers, helper, logger } from "../utils/index.js";
import { config } from "../config/index.js";

export class Minion {
  t;
  token;
  ws;
  rX;
  rY;
  client;
  isAlive;
  proxyAgent;
  offsetX;
  offsetY;
  borderX;
  borderY;
  isClosed;
  ownCells;
  gameModeInt;
  playerCells;
  followMouse;
  isConnected;
  isNearMouse;
  encryptionKey;
  facebookBots;
  decryptionKey;
  mapOffsetFixed;
  moveInt;
  errorTimeout;
  myCellIds;
  loggedIn;
  followMouseTimeout;
  spawnTimeout;
  xpBoostUntil;
  xpBoostTimeout;

  constructor(client) {
    this.ws = null;
    this.rX = 1;
    this.rY = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.borderX = 0;
    this.borderY = 0;
    this.myCellIds = {};
    this.ownCells = [];
    this.moveInt = null;
    // FIX: assegna il token al campo giusto. Prima veniva salvato in "t"
    // ma il resto del codice leggeva "token" (mai valorizzato) -> i bot
    // non usavano mai i token Facebook (niente login, niente livello, niente boost).
    this.token = manager.t();
    this.t = this.token; // alias per la compatibilità con onclose/release
    this.client = client;
    this.isAlive = false;
    this.isClosed = false;
    this.gameModeInt = -1;
    this.playerCells = [];
    this.encryptionKey = 0;
    this.decryptionKey = 0;
    this.followMouse = false;
    this.errorTimeout = null;
    this.spawnTimeout = null;
    this.isConnected = false;
    this.isNearMouse = false;
    this.facebookBots = true;
    this.mapOffsetFixed = false;
    this.loggedIn = false;
    this.followMouseTimeout = null;
    this.xpBoostUntil = 0;
    this.xpBoostTimeout = null;
    this.proxyAgent = helper.getProxy();
    this.connect();
  }
  connect() {
    this.ws = new WebSocket(this.client.server, {
      agent: this.proxyAgent,
      headers: helper.generateHeaders(),
      rejectUnauthorized: true,
    });
    this.ws.binaryType = "nodebuffer";
    this.ws.onopen = this.onopen.bind(this);
    this.ws.onclose = this.onclose.bind(this);
    this.ws.onerror = this.onerror.bind(this);
    this.ws.onmessage = this.onmessage.bind(this);
  }
  send(buffer, encrypt = true) {
    if (!this.ws) return;
    encrypt && (buffer = helper.xorBuffer(buffer, this.encryptionKey));
    this.encryptionKey &&
      (this.encryptionKey = helper.rotateKey(this.encryptionKey));
    if (this.ws.readyState === 1) this.ws.send(buffer);
  }
  onopen() {
    this.send(buffers.protocolVersion());
    this.send(buffers.protocolKey());
  }
  onclose() {
    this.isClosed = true;
    this.client.connectedBots--;
    if (this.t !== -1 && this.facebookBots) {
      manager.releaseToken(this.t, () => {
        this.t = -1;
        this.token = -1;
        this.facebookBots = true;
      });
    }
  }
  onerror() {
    this.isClosed = true;
    this.clearTimeouts();
    this.clearIntervals();
    this.facebookBots = true;
    this.errorTimeout = setTimeout(() => {
      if (
        this.ws?.readyState === WebSocket.CONNECTING ||
        this.ws?.readyState === WebSocket.OPEN
      ) {
        this.ws.close();
      }
    }, 1000);
  }
  onmessage({ data: buffer }) {
    let processedBuffer = buffer;
    if (this.decryptionKey) {
      processedBuffer = helper.xorBuffer(
        processedBuffer,
        this.decryptionKey ^ 31128
      );
    }
    this.handleBuffer(processedBuffer);
  }
  handleBuffer(buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    const messageType = reader.readUInt8();
    switch (messageType) {
      case 18:
        this.myCellIds = {};
        this.ownCells = [];
        this.playerCells = [];
        break;
      case 32:
        const cellId = reader.readUInt32LE();
        this.myCellIds[cellId] = cellId;
        if (!this.isAlive) {
          this.isAlive = true;
          this.moveInterval = setInterval(() => this.move(), 50);
          if (!this.client.startedBots && !this.client.stoppedBots) {
            this.client.startedBots = true;
            logger.info("Bots started.");
          }
          if (!this.followMouseTimeout && !this.followMouse) {
            this.followMouseTimeout = setTimeout(
              () => (this.followMouse = true),
              7000
            );
          }
          // FIX: fai il login con il token Facebook al primo spawn, così il
          // bot gioca con l'account (livello, bonus ecc.). Prima la condizione
          // (facebookBots) impediva sempre il login -> bot anonimi.
          if (this.token !== -1 && !this.loggedIn) {
            this.loggedIn = true;
            manager.requestLogin(this.token, (loginBuffer) => {
              this.send(loginBuffer, true);
            });
            // FIX (nuovo): dopo il login attiva anche lo XP boost così i bot
            // salgono di livello più in fretta fino al massimo.
            this.useXpBoost();
          }
        }
        break;
      case 69:
        this.ghostCells(reader);
        break;
      case 85:
        logger.info("Mass boost activated");
        break;
      case 103:
        this.facebookBots = true;
        // FIX: solo con un token reale. buyMassBoost(-1) crasha.
        if (this.token === -1) break;
        this.useMassBoost();
        manager.buyMassBoost(this.token, (massBoostBuffer) => {
          this.send(massBoostBuffer, true);
        });
        break;
      case 104:
        this.facebookBots = true;
        // FIX: solo con un token reale. releaseToken(-1) crasha.
        if (this.token === -1) break;
        manager.releaseToken(this.token, () => {
          this.token = -1;
          this.t = -1;
          this.facebookBots = true;
        });
        break;
      case 241:
        this.isConnected = true;
        this.client.connectedBots++;
        if (!this.client.server) break;
        this.decryptionKey = reader.readUInt32LE();
        const serverMatch = this.client.server.match(
          /wss:\/\/(web-arenas-live-[\w-]+\.agario\.miniclippt\.com\/[\w-]+\/[\d-]+)/
        );
        if (serverMatch && serverMatch[1]) {
          this.encryptionKey = helper.murmur2(
            "" + serverMatch[1] + reader.readStringNT("utf-8"),
            255
          );
        }
        break;
      case 242:
        this.send(buffers.spawn(this.client.botName), true);
        break;
      case 255:
        this.handleMessage(
          helper.uncompressBuffer(
            reader.toBuffer().subarray(5),
            Buffer.alloc(reader.readUInt32LE())
          )
        );
        break;
    }
  }
  useMassBoost() {
    if (this.token === -1) return;
    const currentTime = Date.now();
    const accountName = manager.ut[this.token]?.name;
    if (!accountName) return;
    const massBoostExpire = helper.getMassBoostExpire(accountName);
    if (massBoostExpire && currentTime < massBoostExpire) return;
    if (config.facebookBotSettings.useMassBoost && this.facebookBots) {
      manager.buyMassBoost(this.token, (buyBuffer) => {
        this.send(buyBuffer, true);
      });
      // FIX: prima chiamava "manager.setMassBoostExpire" che NON esiste ->
      // crash. Quello giusto è "useMassBoost" del TokenManager (attiva il boost).
      manager.useMassBoost(this.token, (useBuffer) => {
        this.send(useBuffer, true);
      });
      helper.clearExpiredMassBoosts();
      helper.setMassBoostExpire(accountName, currentTime + 60 * 60 * 1000);
      logger.info("Mass boost activated");
    }
  }
  // FIX (nuovo): attiva lo XP boost del TokenManager (buyXpBoost + useXpBoost)
  // così i bot accumulano XP più in fretta e raggiungono il livello massimo.
  // Riapplicato ogni ora mentre il bot resta connesso.
  useXpBoost() {
    if (this.token === -1) return;
    if (!manager.ut[this.token]?.name) return;
    const now = Date.now();
    if (now < this.xpBoostUntil) return;
    const enabled =
      config.facebookBotSettings.useXpBoost === undefined ||
      config.facebookBotSettings.useXpBoost;
    if (!enabled || !this.facebookBots) return;
    manager.buyXpBoost(this.token, (buyBuffer) => {
      this.send(buyBuffer, true);
    });
    manager.useXpBoost(this.token, (useBuffer) => {
      this.send(useBuffer, true);
    });
    this.xpBoostUntil = now + 60 * 60 * 1000;
    logger.info("XP boost activated");
    if (this.xpBoostTimeout) clearTimeout(this.xpBoostTimeout);
    this.xpBoostTimeout = setTimeout(() => {
      this.xpBoostUntil = 0;
      this.xpBoostTimeout = null;
      if (!this.isClosed && this.isAlive && this.loggedIn) this.useXpBoost();
    }, 60 * 60 * 1000);
  }
  handleMessage(buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    const messageType = reader.readUInt8();
    switch (messageType) {
      case 16:
        this.updateNodes(reader);
        break;
      case 64:
        this.updateOffset(reader);
        break;
    }
  }
  ghostCells(reader) {
    reader.readOffset += 2;
    const x = reader.readInt32LE() - this.offsetX;
    const y = reader.readInt32LE() - this.offsetY;
    let quadrant;
    if (x < 0 && y < 0) quadrant = 1;
    else if (x > 0 && y < 0) quadrant = 2;
    else if (x > 0 && y > 0) quadrant = 3;
    else quadrant = 4;
    const quadrantMappings = [
      [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ],
      [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ],
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ],
      [
        [1, -1],
        [-1, -1],
        [-1, 1],
        [1, 1],
      ],
    ];
    if (
      this.client.rQuadrant < 1 ||
      this.client.rQuadrant > 4 ||
      this.gameModeInt === 3
    ) {
      return;
    }
    const mapping = quadrantMappings[this.client.rQuadrant - 1];
    [this.rX, this.rY] = mapping[quadrant - 1];
  }
  updateNodes(reader) {
    const removedCount = reader.readUInt16LE();
    for (let i = 0; i < removedCount; i++) {
      if (this.playerCells[reader.readUInt32LE()]) {
        const cell = this.playerCells[reader.readUInt32LE()];
        if (cell) cell.destroy(this);
      }
    }
    while (true) {
      const cellId = reader.readUInt32LE();
      if (cellId === 0) break;
      const x = reader.readInt32LE();
      const y = reader.readInt32LE();
      const size = reader.readUInt16LE();
      const flags = reader.readUInt8();
      const isVirus = !!(flags & 1);
      let skinName = null;
      let color = null;
      let name = null;
      let extraFlags = 0;
      if (flags & 128) {
        extraFlags = reader.readUInt8();
      }
      if (flags & 2) {
        color = helper.intToHex(
          (reader.readUInt8() << 16) |
            (reader.readUInt8() << 8) |
            reader.readUInt8()
        );
      }
      if (flags & 4) name = reader.readStringNT("utf8");
      if (flags & 8) skinName = reader.readStringNT("utf8");
      const isAgitated = !!(flags & 16);
      const isFood = !!(extraFlags & 1);
      const isFriend = !!(extraFlags & 2);
      let accountId = 0;
      if (extraFlags & 4) {
        reader.readOffset += 4;
        accountId = reader.readUInt32LE(reader.readOffset - 4);
      }
      let cell = this.playerCells[cellId];
      if (!cell) {
        cell = new Entity(cellId, accountId);
        this.playerCells[cellId] = cell;
      }
      if (color !== null) {
        cell.color = color;
      }
      if (skinName !== null) {
        cell.name = unescape(encodeURIComponent(skinName));
      }
      if (name !== null) {
        cell.skinName = name;
      }
      if (this.myCellIds[cellId] && this.ownCells.indexOf(cell) === -1) {
        cell.isMine = true;
        this.ownCells.push(cell);
      }
      cell.x = x;
      cell.y = y;
      cell.size = size;
      cell.isFood = isFood;
      cell.isVirus = isVirus;
      cell.agitated = isAgitated;
      cell.isFriend = isFriend;
      cell.accountID = accountId;
    }
    const eatenCount = reader.readUInt16LE();
    for (let i = 0; i < eatenCount; i++) {
      const cellId = reader.readUInt32LE();
      if (this.playerCells[cellId]) {
        this.playerCells[cellId].destroy(this);
      }
    }
    if (this.isAlive && this.ownCells.length === 0) {
      if (this.moveInterval) {
        clearInterval(this.moveInterval);
        this.moveInterval = null;
      }
      if (!this.facebookBots && this.followMouseTimeout) {
        clearTimeout(this.followMouseTimeout);
        this.followMouse = false;
        this.followMouseTimeout = null;
      }
      this.isAlive = false;
      this.isNearMouse = false;
      const skinSettings = config.facebookBotSettings.skin;
      // FIX: solo i bot con token possono cambiare skin. Con lo spawn infinito
      // molti bot non hanno token (-1) e changeSkin(-1) faceva CRASH.
      if (
        this.token !== -1 &&
        skinSettings.enable &&
        this.facebookBots
      ) {
        const randomIndex = Math.floor(
          Math.random() * skinSettings.names.length
        );
        const skinName = skinSettings.names[randomIndex];
        manager.changeSkin(this.token, skinName, (skinBuffer) => {
          this.send(skinBuffer, true);
        });
      }
      this.spawnTimeout = setTimeout(
        () => this.send(buffers.spawn(this.client.botName), true),
        0
      ); // 1000
    }
  }
  updateOffset(reader) {
    const minX = reader.readDoubleLE();
    const minY = reader.readDoubleLE();
    const maxX = reader.readDoubleLE();
    const maxY = reader.readDoubleLE();
    if (!this.mapOffsetFixed) {
      this.borderX = maxX - minX;
      this.borderY = maxY - minY;
      if (maxX - minX > 14000) {
        this.offsetX = (minX + maxX) / 2;
      }
      if (maxY - minY > 14000) {
        this.offsetY = (minY + maxY) / 2;
      }
      this.gameModeInt = reader.readUInt8();
      this.mapOffsetFixed = true;
    }
  }
  checkEnemies(x, y, size) {
    const enemies = [];
    for (const cell of Object.values(this.playerCells)) {
      if (cell.isFood) continue;
      if (cell.isMine) continue;
      if (cell.isVirus) continue;
      if (cell.isFriend) continue;
      if (helper.size2mass(size) > 2000) continue;
      if (cell.name == this.client.playerName && this.client.isAlive) continue;
      if (cell.name == unescape(encodeURIComponent(this.client.botName)))
        continue;
      const dx = cell.x - x;
      const dy = cell.y - y;
      const isBigger = cell.size > size * 0.85;
      const distance = Math.hypot(dx, dy) - size - cell.size;
      const isClose = distance < 300;
      const sizeRatio = helper.size2mass(cell.size) / helper.size2mass(size);
      if (isBigger && isClose) {
        enemies.push({
          dx: dx,
          dy: dy,
          distance: distance,
          sizeRatio: sizeRatio,
        });
      }
    }
    return enemies;
  }
  // "enemies" calcolati UNA volta per tick in move() e riusati qui
  // (prima venivano ricalcolati 2-3 volte: meno lavoro = meno lag).
  nearestPlayer(x, y, size, enemies) {
    const maxDistance = 2000;
    const dxToMouse = this.client.userX / this.rX - x;
    const dyToMouse = this.client.userY / this.rY - y;
    const mouseDistance = 1 + Math.hypot(dxToMouse, dyToMouse);
    let moveX = dxToMouse / mouseDistance;
    let moveY = dyToMouse / mouseDistance;
    if (enemies.length === 0) {
      return {
        x: this.client.userX / this.rX + this.offsetX,
        y: this.client.userY / this.rY + this.offsetY,
      };
    }
    for (const { dx, dy, distance, sizeRatio } of enemies) {
      const force = -10 * sizeRatio;
      moveX += ((dx / distance) * force) / distance;
      moveY += ((dy / distance) * force) / distance;
    }
    const totalForce = 1 + Math.hypot(moveX, moveY);
    const targetX = x + (moveX / totalForce) * maxDistance;
    const targetY = y + (moveY / totalForce) * maxDistance;
    return { x: targetX, y: targetY };
  }
  nearestEntity(type, x, y, size, enemies) {
    let nearest = null;
    let minDistance = Infinity;
    const hasEnemies = enemies && enemies.length > 0;
    for (const cell of Object.values(this.playerCells)) {
      let isValid = false;
      switch (type) {
        case "isFood":
          isValid =
            !cell.isFriend && !cell.isVirus && cell.isFood && !cell.agitated;
          break;
        case "isVirus":
          isValid =
            !cell.isFriend && cell.isVirus && !cell.isFood && !cell.agitated;
          break;
      }
      if (!isValid) continue;
      const distance = helper.calculateDistance(x, y, cell.x, cell.y);
      if (type === "isFood" && hasEnemies) {
        let isDangerous = false;
        for (const enemy of enemies) {
          const enemyDistance = helper.calculateDistance(
            enemy.dx + x,
            enemy.dy + y,
            cell.x,
            cell.y
          );
          if (enemyDistance < 1000) {
            isDangerous = true;
            break;
          }
        }
        if (isDangerous) continue;
      }
      if (distance < minDistance) {
        nearest = cell;
        minDistance = distance;
      }
    }
    return { distance: minDistance, entity: nearest };
  }
  move() {
    // Se il bot è morto / in respawn non c'è nulla da calcolare:
    // prima questo lavoro girava comunque a ogni tick (e generava NaN).
    if (!this.isAlive) return;
    const cells = this.ownCells;
    const cellCount = cells.length;
    if (cellCount === 0) return;
    const center = { x: 0, y: 0, size: 0 };
    for (const { x, y, size } of cells) {
      center.x += x;
      center.y += y;
      center.size += size;
    }
    center.x /= cellCount;
    center.y /= cellCount;
    const enemies = this.checkEnemies(center.x, center.y, center.size);
    const mouseDistance = helper.calculateDistance(
      center.x,
      center.y,
      this.client.userX / this.rX,
      this.client.userY / this.rY
    );
    this.isNearMouse =
      mouseDistance < 4000 + helper.size2mass(center.size) * 0.5;

    let targetX;
    let targetY;

    // 1) FUGA: se c'è un nemico più grande e vicino, scappa via subito.
    //    Più il nemico è grande rispetto a noi, più forte è la spinta.
    if (enemies.length > 0) {
      let fleeX = 0;
      let fleeY = 0;
      for (const enemy of enemies) {
        const strength = Math.min(enemy.sizeRatio * 12, 30);
        // enemy.dx punta verso il nemico -> sottraiamo per scappare in senso opposto
        fleeX -= (enemy.dx / enemy.distance) * strength;
        fleeY -= (enemy.dy / enemy.distance) * strength;
      }
      const norm = 1 + Math.hypot(fleeX, fleeY);
      targetX = center.x + (fleeX / norm) * 2000;
      targetY = center.y + (fleeY / norm) * 2000;
    } else {
      // 2) CRESCITA: senza pericoli, mangia il cibo più vicino in continuazione.
      //    Questo fa crescere il bot molto più in fretta -> vince di più.
      const food = this.nearestEntity(
        "isFood",
        center.x,
        center.y,
        center.size,
        enemies
      );
      if (food.entity) {
        targetX = food.entity.x;
        targetY = food.entity.y;
      } else {
        // 3) Nessun cibo in vista: vai verso il bersaglio / il mouse.
        const pt = this.nearestPlayer(
          center.x,
          center.y,
          center.size,
          enemies
        );
        targetX = pt.x;
        targetY = pt.y;
      }
    }
    // Nessun freno sulla banda: il bot invia sempre il movimento,
    // anche se la connessione/proxy è lenta (richiesto dall'utente).
    this.send(buffers.moveTo(targetX, targetY, this.decryptionKey), true);
  }
  clearIntervals() {
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }
  }
  clearTimeouts() {
    if (this.spawnTimeout) {
      clearTimeout(this.spawnTimeout);
      this.spawnTimeout = null;
    }
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }
    if (this.followMouseTimeout) {
      clearTimeout(this.followMouseTimeout);
      this.followMouseTimeout = null;
    }
    if (this.xpBoostTimeout) {
      clearTimeout(this.xpBoostTimeout);
      this.xpBoostTimeout = null;
    }
  }
  stop() {
    this.clearIntervals();
    this.clearTimeouts();
    this.ws?.terminate();
    manager.clearTokenUsage();
  }
}
