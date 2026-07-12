/**
 * fetchProxies.js â€” scarica proxy freschi ogni ora
 *
 * Output:
 *   core/config/proxies.txt         â€” ip:port, tutti i tipi <10ms
 *   core/config/proxies.json        â€” {proxy, latency_ms, type, sources}
 *   core/config/proxies.csv         â€” CSV riepilogativo
 *   core/config/proxies_http3ms.csv  â€” HTTP <3ms
 *   core/config/proxies_socks5.txt  â€” SOCKS5 <5ms
 *   core/config/proxies_socks5.json â€” SOCKS5 <5ms con metadati
 *
 * Fonti:
 *   ProxyScrape, ProxyScan (HTTP/SOCKS4/SOCKS5), MultiProxy,
 *   OpenProxyList (HTTP/SOCKS5), Geonode, ProxyListDownload
 */

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(__dirname, '..', 'config');
const PROXY_FILE   = path.join(CFG, 'proxies.txt');
const PROXY_JSON   = path.join(CFG, 'proxies.json');
const PROXY_CSV    = path.join(CFG, 'proxies.csv');
const ROCKS5      = path.join(CFG, 'proxies_socks5.txt');
const S5_JSON      = path.join(CFG, 'proxies_socks5.json');
const HTTP3_CSV    = path.join(CFG, 'proxies_http3ms.csv');
const ONCE = process.argv.includes('--once');
const SKIP_TEST = process.argv.includes('--skip-test');
const MAX_LATENCY = 10;
const S5_MAX = 5;

// â”€â”€â”€ Fetch â”€â”€â”€
async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return await r.text();
  } finally { clearTimeout(t); }
}
