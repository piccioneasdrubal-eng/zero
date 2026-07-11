import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import net from "net";
import { config } from "../config/index.js";
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { HttpsProxyAgent } from "https-proxy-agent";
const MASS_BOOST_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/boost.json');
export const helper = {
    proxies: [],
    intToHex(color) {
        let c = color.toString(16);
        for (; c.length < 6;){ c = "0" + c }
        return "#" + c.toString(16);
    },
    size2mass(size) { return size * size / 100; },
    createServer() {
        if (config.serverSettings.secure) {
            return https.createServer({
                key: fs.readFileSync(config.serverSettings.keyPath),
                cert: fs.readFileSync(config.serverSettings.certPath),
            });
        } else { return http.createServer(); }
    },
    loadMassBoostData() {
        try {
            const raw = fs.readFileSync(MASS_BOOST_FILE, "utf8");
            return JSON.parse(raw);
        } catch { return {}; }
    },
    saveMassBoostData(data) {
        fs.writeFileSync(MASS_BOOST_FILE, JSON.stringify(data, null, 2));
    },
    getMassBoostExpire(name) {
        const data = this.loadMassBoostData();
        return data[name] ?? null;
    },
    setMassBoostExpire(name, expireAt) {
        const data = this.loadMassBoostData();
        data[name] = expireAt;
        this.saveMassBoostData(data);
    },
    clearExpiredMassBoosts() {
        const now = Date.now();
        const data = this.loadMassBoostData();
        let changed = false;
        for (const [name, expire] of Object.entries(data)) {
            if (expire < now) { delete data[name]; changed = true; }
        }
        if (changed) this.saveMassBoostData(data);
    },
    testProxyTcp(proxyStr, timeout = 2000) {
        const [host, portStr] = proxyStr.split(':');
        const port = parseInt(portStr) || 80;
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeout);
            socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
            socket.on('error', () => { clearTimeout(timer); resolve(false); });
            try { socket.connect(port, host); } catch { clearTimeout(timer); resolve(false); }
        });
    },
    testProxyHttps(proxyStr, timeout = 5000) {
        const protocol = config.proxySettings.protocol;
        const proxyUrl = `${protocol}://${proxyStr}`;
        return new Promise((resolve) => {
            try {
                const agent = new HttpsProxyAgent(proxyUrl);
                const req = https.get('https://agar.io', {
                    agent,
                    timeout,
                    rejectUnauthorized: false,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                }, (res) => {
                    resolve(true);
                    res.resume();
                    req.destroy();
                });
                req.on('error', () => resolve(false));
                req.on('timeout', () => { req.destroy(); resolve(false); });
            } catch { resolve(false); }
        });
    },
    async validateProxies(proxies, concurrency = 200) {
        const total = proxies.length;
        logger.info(`Validating ${total} proxies (TCP → HTTPS)...`);
        let stage1 = [];
        let tested = 0;
        for (let i = 0; i < proxies.length; i += concurrency) {
            const batch = proxies.slice(i, i + concurrency);
            const results = await Promise.all(batch.map(p => this.testProxyTcp(p)));
            for (let j = 0; j < batch.length; j++) {
                if (results[j]) stage1.push(batch[j]);
            }
            tested += batch.length;
            if (tested % 2000 === 0 || tested === total) {
                logger.process(tested, total, `TCP: ${stage1.length} alive`);
            }
        }
        logger.info(`Stage 1 (TCP): ${stage1.length}/${total} reachable`);
        if (stage1.length === 0) { logger.warn('No proxies passed TCP test'); return []; }
        const working = [];
        tested = 0;
        const stage1Total = stage1.length;
        for (let i = 0; i < stage1.length; i += concurrency) {
            const batch = stage1.slice(i, i + concurrency);
            const results = await Promise.all(batch.map(p => this.testProxyHttps(p)));
            for (let j = 0; j < batch.length; j++) {
                if (results[j]) working.push(batch[j]);
            }
            tested += batch.length;
            if (tested % 1000 === 0 || tested === stage1Total) {
                logger.process(tested, stage1Total, `HTTPS: ${working.length} working`);
            }
        }
        logger.info(`Stage 2 (HTTPS): ${working.length}/${stage1Total} working proxies ready`);
        return working;
    },
    setupProxies() {
        try {
            const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../config/proxies.txt');
            const data = fs.readFileSync(filePath, 'utf-8');
            this.proxies = data.split('\n').filter(proxy => proxy.trim() !== '');
        } catch (error) {
            logger.warn(`Error reading proxies from file: ${error.message}`);
        }
    },
    getProxy() {
        const protocol = config.proxySettings.protocol;
        if (!config.proxySettings.enableProxy || this.proxies.length === 0)
            return undefined;
        const proxy = this.proxies.shift();
        this.proxies.push(proxy);
        return new HttpsProxyAgent(`${protocol}://${proxy}`);
    },
    generateHeaders() {
        const langs = [
            ['en-US', 'en'], ['en-GB', 'en'], ['fr-FR', 'fr'], ['de-DE', 'de'],
        ];
        const lang = langs[Math.floor(Math.random() * langs.length)];
        const weight = Math.max(0.1, Math.random() * 0.9).toFixed(1);
        return {
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': `${lang[0]},${lang[1]};q=${weight}`,
            'Pragma': 'no-cache',
            'Connection': 'Upgrade',
            'Cache-Control': 'no-cache',
            'Origin': 'https://agar.io',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
        };
    },
    calculateDistance(botX, botY, targetX, targetY) {
        return Math.hypot(targetX - botX, targetY - botY);
    },
    rotateKey: function (key) {
        key = Math.imul(key, 1540483477) >> 0;
        key = (Math.imul(key >>> 24 ^ key, 1540483477) >> 0) ^ 114296087;
        key = Math.imul(key >>> 13 ^ key, 1540483477) >> 0;
        return key >>> 15 ^ key;
    },
    xorBuffer: function (buffer, key) {
        for (let i = 0; i < buffer.byteLength; i++)
            buffer.writeUInt8(buffer.readUInt8(i) ^ key >>> (i % 4 * 8) & 255, i);
        return buffer;
    },
    uncompressBuffer: function (input, output) {
        for (let i = 0, j = 0; i < input.length;) {
            const byte = input[i++];
            let literalsLength = byte >> 4;
            if (literalsLength > 0) {
                let length = literalsLength + 240;
                while (length === 255) { length = input[i++]; literalsLength += length; };
                const end = i + literalsLength;
                while (i < end) output[j++] = input[i++];
                if (i === input.length) return output;
            };
            const offset = input[i++] | (input[i++] << 8);
            if (offset === 0 || offset > j) return -(i - 2);
            let matchLength = byte & 15;
            let length = matchLength + 240;
            while (length === 255) { length = input[i++]; matchLength += length; };
            let pos = j - offset;
            const end = j + matchLength + 4;
            while (j < end) output[j++] = output[pos++];
        }
        return output;
    },
    murmur2(str, seed) {
        let l = str.length, h = seed ^ l, i = 0, k;
        while (l >= 4) {
            k = (str.charCodeAt(i) & 0xff) | ((str.charCodeAt(++i) & 0xff) << 8) | ((str.charCodeAt(++i) & 0xff) << 16) | ((str.charCodeAt(++i) & 0xff) << 24);
            k = (k & 0xffff) * 0x5bd1e995 + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16);
            k ^= k >>> 24;
            k = (k & 0xffff) * 0x5bd1e995 + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16);
            h = ((h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^ k;
            l -= 4; ++i;
        }
        switch (l) {
            case 3: h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
            case 2: h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
            case 1: h ^= str.charCodeAt(i) & 0xff;
                h = (h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16);
        }
        h ^= h >>> 13;
        h = (h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16);
        h ^= h >>> 15;
        return h >>> 0;
    }
};
