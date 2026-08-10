import fs from "fs";
import path from "path";
import http from "http";
import { HttpsProxyAgent } from "https-proxy-agent";
import { logger } from './logger.js';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const helper = {
    proxies: [],

    intToHex(color) {
        let c = color.toString(16);
        for (; c.length < 6;) c = "0" + c;
        return "#" + c;
    },

    size2mass(size) {
        return size * size / 100;
    },

    createServer() {
        return http.createServer();
    },

    setupProxies() {
        // Carica proxy da file
        const proxyFile = path.join(__dirname, '..', 'data', 'proxies.txt');
        if (fs.existsSync(proxyFile)) {
            const content = fs.readFileSync(proxyFile, 'utf-8');
            this.proxies = content.split('\n').map(l => l.trim()).filter(Boolean);
            logger.info(`Proxy: ${this.proxies.length} proxy caricati`);
        } else {
            this.proxies = [];
            logger.warn('Proxy: nessun file proxies.txt trovato');
        }
    },

    getProxy() {
        if (!config.proxySettings.enableProxy || this.proxies.length === 0) return undefined;
        const proxyUrl = this.proxies[Math.floor(Math.random() * this.proxies.length)];
        // Formato: http://ip:port o ip:port
        const url = proxyUrl.startsWith('http') ? proxyUrl : `http://${proxyUrl}`;
        try {
            return new HttpsProxyAgent(url);
        } catch (e) {
            logger.warn(`Proxy non valido: ${url}`);
            return undefined;
        }
    },

    generateHeaders() {
        const langs = [
            ['en-US', 'en'], ['en-GB', 'en'],
            ['fr-FR', 'fr'], ['de-DE', 'de'],
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

    rotateKey(key) {
        key = Math.imul(key, 1540483477) >> 0;
        key = (Math.imul(key >>> 24 ^ key, 1540483477) >> 0) ^ 114296087;
        key = Math.imul(key >>> 13 ^ key, 1540483477) >> 0;
        return key >>> 15 ^ key;
    },

    xorBuffer(buffer, key) {
        for (let i = 0; i < buffer.byteLength; i++)
            buffer.writeUInt8(buffer.readUInt8(i) ^ key >>> (i % 4 * 8) & 255, i);
        return buffer;
    },

    uncompressBuffer(input, output) {
        for (let i = 0, j = 0; i < input.length;) {
            const byte = input[i++];
            let literalsLength = byte >> 4;
            if (literalsLength > 0) {
                let length = literalsLength + 240;
                while (length === 255) { length = input[i++]; literalsLength += length; }
                const end = i + literalsLength;
                while (i < end) output[j++] = input[i++];
                if (i === input.length) return output;
            }
            const offset = input[i++] | (input[i++] << 8);
            if (offset === 0 || offset > j) return -(i - 2);
            let matchLength = byte & 15;
            let length = matchLength + 240;
            while (length === 255) { length = input[i++]; matchLength += length; }
            let pos = j - offset;
            const end = j + matchLength + 4;
            while (j < end) output[j++] = output[pos++];
        }
        return output;
    },

    murmur2(str, seed) {
        let l = str.length, h = seed ^ l, i = 0, k;
        while (l >= 4) {
            k = (str.charCodeAt(i) & 0xff) | ((str.charCodeAt(++i) & 0xff) << 8) |
                ((str.charCodeAt(++i) & 0xff) << 16) | ((str.charCodeAt(++i) & 0xff) << 24);
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
