import fs from "fs";
import path from "path";
import { SmartBuffer } from "smart-buffer";
import { helper, logger } from "../utils/index.js";
import { config } from "../config/index.js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(__dirname, "..", "data", "tokens.json");

export class TokenManager {
  constructor() {
    this.tokens = [];
    this.tokenIndex = -1;
    this.usedTokens = new Set();
    this.tokenUsage = {};
    this.maxBotsPerToken = config.tokenSettings.maxBotsPerToken;
    this.loadTokens();
  }

  loadTokens() {
    try {
      const data = fs.readFileSync(TOKENS_FILE, "utf-8");
      this.tokens = JSON.parse(data);
      logger.info(`TokenManager: ${this.tokens.length} token caricati`);
    } catch (e) {
      logger.warn("TokenManager: nessun token trovato");
      this.tokens = [];
    }
  }

  getNextToken() {
    if (this.tokens.length === 0) return null;
    
    if (this.usedTokens.size >= this.tokens.length) {
      this.usedTokens.clear();
    }
    
    for (let i = 0; i < this.tokens.length; i++) {
      const idx = (this.tokenIndex + 1 + i) % this.tokens.length;
      const token = this.tokens[idx];
      const usage = this.tokenUsage[token] || 0;
      if (usage < this.maxBotsPerToken && !this.usedTokens.has(token)) {
        this.tokenIndex = idx;
        this.usedTokens.add(token);
        this.tokenUsage[token] = usage + 1;
        return token;
      }
    }
    
    let best = null;
    let minUsage = Infinity;
    for (const token of this.tokens) {
      const usage = this.tokenUsage[token] || 0;
      if (usage < minUsage) {
        minUsage = usage;
        best = token;
      }
    }
    this.tokenUsage[best] = minUsage + 1;
    return best;
  }

  releaseToken(token) {
    if (token && this.tokenUsage[token]) {
      this.tokenUsage[token]--;
      if (this.tokenUsage[token] <= 0) {
        delete this.tokenUsage[token];
      }
      this.usedTokens.delete(token);
    }
  }

  buildLoginBuffer(token) {
    const buf = new SmartBuffer();
    buf.writeUInt8(80);
    buf.writeStringNT(token, "utf8");
    return buf.toBuffer();
  }

  buildSkinChangeBuffer(skinName) {
    const buf = new SmartBuffer();
    buf.writeUInt8(82);
    buf.writeStringNT(skinName, "utf8");
    return buf.toBuffer();
  }

  buildMassBoostBuffer() {
    return Buffer.from([85]);
  }
}

export const manager = new TokenManager();
