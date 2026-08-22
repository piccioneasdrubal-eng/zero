#!/usr/bin/env node
/**
 * ZeroExtens PRO Patcher - Aggiorna URL server e aggiunge autenticazione
 * 
 * Uso: node patch-zerox.cjs ZeroExtens-Bots-PRO.user.js
 *      node patch-zerox.js ZeroExtens-Bots-PRO.user.js
 * Output: ZeroExtens-Bots-PRO-PATCHED.user.js
 * 
 * NOTA: Se hai "type":"module" nel package.json, usa l'estensione .cjs
 */

// Supporta sia CommonJS che ES modules
let fs, path;
try {
  // CommonJS (funziona sempre)
  fs = require('fs');
  path = require('path');
} catch(e) {
  // ES module fallback (non dovrebbe servire, ma per sicurezza)
  console.log('Usa .cjs se vedi errori ES module');
  process.exit(1);
}

const inputFile = process.argv[2];
if (!inputFile) {
  console.log('Uso: node patch-zerox.js <file-userscript.user.js>');
  process.exit(1);
}

const NEW_SERVER = 'zero-xx2-tq-production.up.railway.app';
const AUTH_TOKEN = 'ZERO_THE_LEGEND_X_LIFE';

console.log('🔧 ZeroExtens PRO Patcher');
console.log('   Server: wss://' + NEW_SERVER);
console.log('   Token:  ' + AUTH_TOKEN);
console.log('');

let content = fs.readFileSync(inputFile, 'utf-8');
let changes = 0;

// ============================================================
// STEP 1: Patch INDEX_B64 (il grosso del codice e' in base64)
// ============================================================
const b64Match = content.match(/var INDEX_B64='([^']+)'/);
if (b64Match) {
  const originalB64 = b64Match[1];
  let decoded;
  try {
    decoded = Buffer.from(originalB64, 'base64').toString('utf-8');
  } catch(e) {
    console.error('❌ Errore decodifica base64:', e.message);
    process.exit(1);
  }
  
  console.log('✓ INDEX_B64 decodificato (' + decoded.length + ' bytes)');
  
  // 1a. Set devMode to false (cosi' usa URL produzione invece di localhost)
  if (decoded.includes('this.devMode=!0')) {
    decoded = decoded.replace('this.devMode=!0', 'this.devMode=!1');
    console.log('✓ devMode impostato a false');
    changes++;
  }
  
  // 1b. Cambia URL server
  const oldUrls = ['wss://svr99.xevbots.com:8080', 'ws://localhost'];
  for (const oldUrl of oldUrls) {
    while (decoded.includes(oldUrl)) {
      decoded = decoded.replace(oldUrl, 'wss://' + NEW_SERVER);
      console.log('✓ URL sostituito: ' + oldUrl + ' → wss://' + NEW_SERVER);
      changes++;
    }
  }
  
  // 1c. Inietta auth nell'onopen handler
  const onopenPatterns = [
    'onopen(){nr("Follow"),un("Ready"),ir("Connected")}',
    'onopen(){nr("Follow"),un("Ready"),ir("Connected")}'
  ];
  
  let authInjected = false;
  for (const pat of onopenPatterns) {
    if (decoded.includes(pat)) {
      const authCode = 'var e=(new TextEncoder).encode("'+AUTH_TOKEN+'"),t=new ArrayBuffer(1+e.length+1);new DataView(t).setUint8(0,8);for(var n=0;n<e.length;n++)new DataView(t).setUint8(1+n,e[n]);new DataView(t).setUint8(1+e.length,0);this.ws.send(t);';
      decoded = decoded.replace(pat, 'onopen(){'+authCode+'nr("Follow"),un("Ready"),ir("Connected")}');
      console.log('✓ Auth iniettato in onopen');
      authInjected = true;
      changes++;
      break;
    }
  }
  
  if (!authInjected) {
    // Fallback: cerca onopen(){ e inietta prima
    const match = decoded.match(/onopen\(\)\{/);
    if (match) {
      const authCode = 'var e=(new TextEncoder).encode("'+AUTH_TOKEN+'"),t=new ArrayBuffer(1+e.length+1);new DataView(t).setUint8(0,8);for(var n=0;n<e.length;n++)new DataView(t).setUint8(1+n,e[n]);new DataView(t).setUint8(1+e.length,0);this.ws.send(t);';
      decoded = decoded.replace('onopen(){', 'onopen(){'+authCode);
      console.log('✓ Auth iniettato in onopen (regex fallback)');
      authInjected = true;
      changes++;
    }
  }
  
  if (!authInjected) {
    console.log('⚠ Non trovato onopen handler - verra usato solo il fallback JS');
  }
  
  // Re-encode
  const newB64 = Buffer.from(decoded, 'utf-8').toString('base64');
  content = content.replace("'" + originalB64 + "'", "'" + newB64 + "'");
  console.log('✓ INDEX_B64 ri-codificato');
}

// ============================================================
// STEP 2: Cambia URL anche nel codice JS non-base64
// ============================================================
const plainOldUrls = ['svr99.xevbots.com:8080', 'ws://localhost'];
for (const oldUrl of plainOldUrls) {
  if (content.includes(oldUrl)) {
    content = content.split(oldUrl).join(NEW_SERVER);
    console.log('✓ URL plain-text sostituito: ' + oldUrl);
    changes++;
  }
}

// ============================================================
// STEP 3: Aggiungi auth fallback nel codice JS
// ============================================================
const authFallback = `
// ============ AUTH PATCH per server ZeroTheLegend ============
(function patchAuth(){
var tries=0;
var interval=setInterval(function(){
tries++;
if(window.gg&&window.gg.ws&&window.gg.ws.readyState===1){
clearInterval(interval);
try{
var enc=new TextEncoder();
var token="${AUTH_TOKEN}";
var tokenBytes=enc.encode(token);
var buf=new ArrayBuffer(1+tokenBytes.length+1);
var view=new DataView(buf);
view.setUint8(0,8);
for(var i=0;i<tokenBytes.length;i++)view.setUint8(1+i,tokenBytes[i]);
view.setUint8(1+tokenBytes.length,0);
window.gg.ws.send(buf);
console.log("%c[ZeroExtens]","color:#ffd54d;font-weight:bold","Auth token sent to custom server");
}catch(e){console.warn("%c[ZeroExtens]","color:#ff6b6b","Auth error: "+e);}
}
if(tries>300)clearInterval(interval);
},100);
})();
`;

// Inserisci prima di function init()
if (content.includes('// ============ INIT ============\nfunction init(){')) {
  content = content.replace(
    '// ============ INIT ============\nfunction init(){',
    authFallback + '\n// ============ INIT ============\nfunction init(){'
  );
  console.log('✓ Auth fallback JS aggiunto prima di init()');
  changes++;
} else {
  console.log('⚠ Blocco INIT non trovato, cerco alternativa...');
  if (content.includes('function init(){')) {
    content = content.replace('function init(){', authFallback + '\nfunction init(){');
    console.log('✓ Auth fallback JS aggiunto (match generico)');
    changes++;
  }
}

// ============================================================
// SALVA
// ============================================================
const outputFile = inputFile.replace('.user.js', '-PATCHED.user.js');
fs.writeFileSync(outputFile, content, 'utf-8');

console.log('');
console.log('✅ PATCH COMPLETATO!');
console.log('   File output: ' + outputFile);
console.log('   Modifiche: ' + changes);
console.log('');
console.log('📋 Riepilogo modifiche:');
console.log('   1. Server URL → wss://' + NEW_SERVER);
console.log('   2. Auth token → ' + AUTH_TOKEN + ' (opcode 8)');
console.log('   3. devMode → false (usa Railway, non localhost)');
console.log('');
console.log('⚠  IMPORTANTE: Prima di usare lo script, assicurati che Railway sia attivo:');
console.log('   https://' + NEW_SERVER + '/health');
