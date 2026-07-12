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

// â”€â”€â”€ Parser â”€â”€â”€
const PROXY_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}(:.+)?$/;
function parseProxies(raw) {
  return raw.split(/[\r\n]+/).map(l => l.trim()).filter(l => PROXY_RE.test(l));
}
function parseProxifly(raw) {
  return raw.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.startsWith('http://')).map(l => l.replace(/^https?:\/\//, '')).filter(l => PROXY_RE.test(l));
}
function getHostPort(raw) {
  const p = raw.split(':');
  return { host: p[0], port: parseInt(p[1]) };
}

// â”€â”€â”€ ProxyListPlus HTML parser (multi-page) â”€â”€â”€
async function fetchProxyListPlus() {
  const all = [];
  const urls = ['https://list.proxylistplus.com/Fresh-HTTP-Proxy'];
  for (let i = 2; i <= 10; i++) urls.push(`https://list.proxylistplus.com/Fresh-HTTP-Proxy-List-${i}`);
  console.log(`  ProxyListPlus: fetching ${urls.length} pages...`);
  for (const url of urls) {
    try {
      const text = await fetchText(url);
      const re = /<td[^>]*>\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*<\/td>\s*<td[^>]*>\s*(\d{2,5})\s*<\/td>/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const proxy = `${m[1]}:${m[2]}`;
        if (PROXY_RE.test(proxy)) all.push(proxy);
      }
    } catch { /* skip dead page */ }
  }
  return [...new Set(all)];
}

// â”€â”€â”€ Fonti â”€â”€â”€
const SOURCES = [
  { name:'ProxyScrape',       type:'HTTP',   url:'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all', parser:parseProxies },
  { name:'ProxyListDownload', type:'HTTP',   url:'https://www.proxy-list.download/api/v1/get?type=http', parser:parseProxies },
  { name:'Geonode',           type:'HTTP',   url(¡ÑÑÁÌè¼½ÁÉ½áå±¥ÍÐ¹•½¹½‘”¹½´½…Á¤½ÁÉ½áäµ±¥ÍÐý±¥µ¥ÐôÔÀÀ™Á…”ôÄ™Í½ÉÑ}‰äõ±…ÍÑ¡•­•™Í½ÉÑ}ÑåÁ”õ‘•ÍŒ™ÁÉ½Ñ½½±Ìõ¡ÑÑÀ™…¹½¹åµ¥Ñå1•Ù•°õ•±¥Ñ”™…¹½¹åµ¥Ñå1•Ù•°õ…¹½¹åµ½ÕÌ™ÍÁ••õ™…ÍÐœ°Á…ÉÍ•r(r){ try{return(JSON.parse(r).data||[]).map(p=>`${p.ip}:${p.port}`)}catch{return[]} } },
  { name:'ProxyScan',         type:'HTTP',   url:'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',   parser:parseProxies },
  { name:'ProxyScan',         type:'SOCKS4', url:'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt', parser:parseProxies },
  { name:'ProxyScan',         type:'SOCKS5', url:'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt', parser:parseProxies },
  { name:'MultiProxy',        type:'HTTP',   url:'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt', parser:parseProxifly },
  { name:'OpenProxyList',     type:'HTTP',   url:'https://api.openproxylist.xyz/http.txt',   parser:parseProxies },
  { name:'OpenProxyList',     type:'SOCKS5', url:'https://api.openproxylist.xyz/socks5.txt', parser:parseProxies },
  { name:'ProxyListPlus',     type:'HTTP',   special:'proxylistplus' },
];

// â”€â”€â”€ Test TCP â”€â”€â”€
async function testAllProxies(proxies, timeout=3000) {
  const total=proxies.length, results=[];
  for(let i=0;i<proxies.length;i+=50){
    const batch=proxies.slice(i,i+50);
    const settled=await Promise.allSettled(batch.map(p=>{
      const{host,port}=getHostPort(p);const start=performance.now();
      return new Promise((res,rej)=>{
        const s=new net.Socket();s.setTimeout(timeout);
        s.on('connect',()=>{const ms=Math.round(performance.now()-start);s.destroy();res({proxy:p,ms})});
        s.on('timeout',()=>{s.destroy();rej()});
        s.on('error',()=>{s.destroy();rej()});
        s.connect(port,host);
      });
    }));
    for(const r of settled) if(r.status==='fulfilled') results.push(r.value);
    if(total>50){const avg=results.length?Math.round(results.reduce((a,r)=>a+r.ms,0)/results.length):0;process.stdout.write(`  Testing: ${Math.min(results.length+((i/50|0)*50-batch.length<0?0:0),total)}/${total}  (${results.length} alive, avg ${avg}ms)\r`)}
  }
  if(total>50) const console.log('');
  results.sort((a,b)=>a.ms-b.ms);
  return results;
}

function loadExistingProxies() {
  try{return fs.readFileSync(PROXY_FILE,'utf-8').split(/[\r\n]+/).map(l=>l.trim()).filter(l=>PROXY_RE.test(l))}catch{return[]}
}

// â”€â”€â”€ Main â”€â”€â”€
async function fetchProxies(opts={}) {
  const skipTest = SKIP_TEST || opts.skipTest;
  const ts = new Date().toISOString();
  console.log(`[ProxyFetcher] ${ts} â€” fetching ${skipTest?'(skip test) ':`(max ${MAX_LATENCY}ms, SOCKS5 <${S5_MAX}ms) `}...`);

  const existing=loadExiqueFree.map(p=>({proxy:p,ms:null}));
  }else{
    const allAlive=await testAllProxies(uniqueFree,3000);
    if(allAlive.length>0){
      const times=allAlive.map(r=>r.ms), s=[...times].sort((a,b)=>a-b);
      console.log(`  All alive: ${allAlive.length}  |  min:${s[0]}ms  med:${s[Math.floor(s.length/2)]}ms  avg:${Math.round(times.reduce((a,t)=>a+t,0)/times.length)}ms  max:${s[s.length=1]}ms`);
    }
    const fastFree=allAlive.filter(r=>r.ms<MAX_LATENCY);
    console.log(`  Under ${MAX_LATENCY}ms: ${fastFree.length}`);
    toSave=fastFree.length>=5?fastFree:allAlive;

    // Filtro SOCKS5 <5ms (solo se testato)
    const socks5Fast=toSave.filter(r=>{
      const m=proxyMeta.get(r.proxy);
      return m && m.types.has('SOCKS5') && r.ms<S5_MAX;
    });
    console.log(`  SOCKS5 under ${S5_MAX}ms: ${socks5Fast.length}`);
    // SOCKS5 TXT
    fs.writeFileSync(S5_FILE,rocks5Fast.map(r=>r.proxy).join('\n')+'\n','utf-8');
    // SOCKS5 JSON
    fs.writeFileSync(S5_JSON,JSON.stringify(socks5Fast.map(r=>{const m=proxyMeta.get(r.proxy);return{proxy:r.proxy,latency_ms:r.ms,type:'SOCKS5',sources:m?[...m.sources].sort():['unknown']}}),null,2),'utf-8');
    console.log(`[ProxyFetcher] SOCKS5 â†’ ${socks5Fast.length}  (TXT+JSON)`);

    // HTTP <3ms CSV (solo se testato)
    const http3fast=toSave.filter(r=>{const m=proxyMeta.get(r.proxy);return m&&m.types.has('HTTP')&&!m.types.has('SOCKS4')&&!m.types.has('SOCKS5')&&r.ms<3});
    fs.writeFileSync(HTTP3_CSV,'proxy,latency_ms,type,sources\n'+http3fast.map(r=>{const m=proxyMeta.get(r.proxy);return`${r.proxy},${r.ms},HTTP,${m?[...m.sources].sort().join(';'):'unknown'}`}).join('\n')+'\n','utf-8');
    console.log(`[ProxyFetcher] HTTP <3ms CSV â†’ ${http3fast.length}`);
  }

  const proxyList=toSave.map(r=>r.proxy);
  const all=[...authProxies,...proxyList];
  const clean=[...new Set(all.filter(p=>p&&p.trim()))];

  fs.mkdirSync(CFG,{recursive:true});

  // TXT
  fs.writeFileSync(PROXY_FILE,clean.join('\n')+'\n','utf-8');
  console.log(`[ProxyFetcher] TXT â†’ ${clean.length} â†’ ${PROXY_FILE}`);

  // â”€â”€â”€ JSON â”€â”€â”€
  const jsonProxies=[
    ...authProxies.map(p=>({proxy:p,latency_ms:null,type:'HTTP',sources:['auth']})),
    ...toSave.map(r=>{
      const m=proxyMeta.get(r.proxy);
      return {proxy:r.proxy,latency_ms:r.ms,type:m?[...m.types].sort().join(','):'HTTP',sources:m?[...m.sources].sort():['unknown']};
    })
  ];
  fs.writeFileSync(PROXY_JSON,JSON.stringify(jsonProxies,null,2),'utf-8');
  console.log(`[ProxyFetcher] JSON â†’ ${jsonProxies.length} â†’ ${PROXY_JSON}`);

  // â”€â”€â”€ CSV â”€â”€â”€
  const csvHeader='proxy,latency_ms,type,sources';
  const csvRows=jsonProxies.map(p=>{
    const srcs=p.sources.join(';');
    return `${p.proxy},${p.latency_ms??''},${p.type},${srcs}`;
  });
  fs.writeFileSync(PROXY_CSV,csvHeader+'\n'+csvRows.join('\n')+'\n','utf-8');
  console.log(`[ProxyFetcher] CSV â†’ ${csvRows.length} â†’ ${PROXY_CSV}`);

  const top3=toSave.slice(0,3).map(r=>`${r.proxy}(${r.ms??'?'}ms)`).join(', ');
  console.log(``           fastest: ${top3}\n a);
  return clean.length;
}

// â”€â”€â”€ Entry â”€â”€â”€
export { fetchProxies };
const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]);
if(isMain){
  if(ONCE){const c=await fetchProxies();process.exit(c>0?0:1)}
  else{auait fetchProxies();setInterval(()=>fetchProxies(),60*60*1000);console.log('[ProxyFetcher] Running â€” next fetch in 60 min')}
}
