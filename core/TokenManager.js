import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { SmartBuffer } from "smart-buffer";
import { helper, logger } from "../utils/index.js";
import { config } from "../config/index.js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(__dirname, "..", "data", "tokens.json");
const FB_APP_ID = "677505792353827";

export class TokenManager {
  constructor() {
    this.tokens = [];
    this.oauthTokens = [];
    this.tokenIndex = -1;
    this.oauthIndex = -1;
    this.usedTokens = new Set();
    this.tokenUsage = {};
    this.maxBotsPerToken = config.tokenSettings.maxBotsPerToken;
    this.refreshingOAuth = false;
    this.loadTokens();
    this.loadFacebookCookies();
  }

  loadTokens() {
    try {
      const data = fs.readFileSync(TOKENS_FILE, "utf-8");
      this.tokens = JSON.parse(data);
      logger.info(`TokenManager: ${this.tokens.length} token EAA caricati`);
    } catch (e) {
      logger.warn("TokenManager: nessun token trovato");
      this.tokens = [];
    }
  }

  loadFacebookCookies() {
    const cookiesFile = path.join(__dirname, "..", "data", "fb-cookies.json");
    try {
      const data = fs.readFileSync(cookiesFile, "utf-8");
      this.fbCookies = JSON.parse(data);
      logger.info(`TokenManager: cookie FB caricati (c_user=${this.fbCookies.c_user})`);
    } catch (e) {
      logger.warn("TokenManager: nessun cookie FB trovato");
      this.fbCookies = null;
    }
  }

  addOAuthToken(token) {
    if (!this.oauthTokens.includes(token)) {
      this.oauthTokens.push(token);
      logger.info(`TokenManager: OAuth token aggiunto (totale: ${this.oauthTokens.length})`);
    }
  }

  async refreshOAuthToken() {
    if (!this.fbCookies) {
      logger.warn("TokenManager: impossibile refresh OAuth - cookie FB non configurati");
      return null;
    }
    if (this.refreshingOAuth) {
      logger.info("TokenManager: refresh OAuth gia in corso...");
      return null;
    }
    this.refreshingOAuth = true;

    const { c_user, datr, xs } = this.fbCookies;
    const cookieStr = `c_user=${c_user}; datr=${datr}; xs=${xs}`;

    logger.info("TokenManager: richiedo nuovo OAuth token da Facebook...");

    return new Promise((resolve) => {
      const options = {
        hostname: "www.facebook.com",
        path: `/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=https://agar.io&scope=public_profile,email&response_type=token`,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          "Cookie": cookieStr,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
        },
        redirect: "manual",
        timeout: 15000,
      };

      const req = https.request(options, (res) => {
        this.refreshingOAuth = false;
        const location = res.headers.location;
        if (location) {
          logger.info(`TokenManager: redirect -> ${location.substring(0, 100)}...`);
          const tokenMatch = location.match(/access_token=([a-zA-Z0-9_-]+)/);
          if (tokenMatch && tokenMatch[1]) {
            const token = tokenMatch[1];
            this.oauthTokens = [token];
            logger.info(`TokenManager: OAuth token ottenuto! (${token.substring(0, 12)}...)`);
            resolve(token);
            return;
          }
        }
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          const tokenMatch = body.match(/access_token=([a-zA-Z0-9_-]+)/);
          if (tokenMatch) {
            const token = tokenMatch[1];
            this.oauthTokens = [token];
            logger.info(`TokenManager: OAuth token ottenuto dal body! (${token.substring(0, 12)}...)`);
            resolve(token);
          } else {
            logger.warn(`TokenManager: nessun access_token trovato. Status=${res.statusCode}`);
            if (body.includes("login")) {
              logger.warn("TokenManager: Facebook richiede login - cookie probabilmente scaduti");
            }
            resolve(null);
          }
        });
      });

      req.on("error", (e) => {
        this.refreshingOAuth = false;
        logger.error(`TokenManager: errore richiesta OAuth: ${e.message}`);
        resolve(null);
      });

      req.on("timeout", () => {
        this.refreshingOAuth = false;
        req.destroy();
        logger.error("TokenManager: timeout richiesta OAuth");
        resolve(null);
      });

      req.end();
    });
  }

  async getNextToken() {
    if (this.oauthTokens.length > 0) {
      this.oauthIndex = (this.oauthIndex + 1) % this.oauthTokens.length;
      return this.oauthTokens[this.oauthIndex];
    }
    if (this.fbCookies) {
      const oauth = await this.refreshOAuthToken();
      if (oauth) return oauth;
    }
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
    logger.warn("TokenManager: tutti i token saturi, reset in corso...");
    this.tokenUsage = {};
    this.usedTokens.clear();
    this.tokenIndex = 0;
    this.tokenUsage[this.tokens[0]] = 1;
    this.usedTokens.add(this.tokens[0]);
    return this.tokens[0];
  }

  getNextTokenSync() {
    if (this.oauthTokens.length > 0) {
      this.oauthIndex = (this.oauthIndex + 1) % this.oauthTokens.length;
      return this.oauthTokens[this.oauthIndex];
    }
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
      return Buffer.from([82, 0]);
    }
    const buf = new SmartBuffer();
    buf.writeUInt8(82);
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

  getStatus() {
    return {
      total: this.tokens.length,
      oauth: this.oauthTokens.length,
      used: this.usedTokens.size,
      usage: { ...this.tokenUsage },
      maxPerToken: this.maxBotsPerToken,
    };
  }
}

export const manager = new TokenManager();
