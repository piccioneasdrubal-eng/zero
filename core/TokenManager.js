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
    if (this.usedTokens.size >= this.tokens.length) this.usedTokens.clear();
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
    // Fallback: all saturated — reset and return first
    logger.warn("TokenManager: tutti i token saturi, reset in corso...");
    this.tokenUsage = {};
    this.usedTokens.clear();
    this.tokenIndex = 0;
    this.tokenUsage[this.tokens[0]] = 1;
    this.usedTokens.add(this.tokens[0]);
    return this.tokens[0];
  }

  releaseToken(token) {
    if (token && this.tokenUsage[token]) {
      this.tokenUsage[token]--;
      if (this.tokenUsage[token] <= 0) delete this.tokenUsage[token];
      this.usedTokens.delete(token);
    }
  }

  buildLoginBuffer(token) {
    if (!token) {
      logger.warn("TokenManager: buildLoginBuffer called with null token!");
      return Buffer.from([80, 0]);
    }
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

  buildMassBoostBuffer() { return Buffer.from([85]); }

  getStatus() {
    const usagePreview = {};
    for (const [tok, count] of Object.entries(this.tokenUsage)) {
      usagePreview[tok.substring(0, 12) + "..."] = count;
    }
    return { total: this.tokens.length, used: this.usedTokens.size, usage: usagePreview, maxPerToken: this.maxBotsPerToken };
  }
}

export const manager = new TokenManager();
