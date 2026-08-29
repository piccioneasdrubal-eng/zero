# XevBots — versione privacy

Archivio aggiornato del server bot con le correzioni applicate.

## Cosa cambia rispetto all'originale

### 1. Privacy dei token (importante)
Nel `TokenManager.js` originale i token venivano inviati al server esterno
`wss://svr99.xevbots.com:3000` tramite `connect()` e `checkTokens()`.

In questa versione **la connessione a `svr99` è stata rimossa**: i token vengono
letti dal file `data/tokens.json` e gestiti **solo in locale**. Non escono mai
dal tuo computer.

Conseguenza onesta: le azioni di gioco che prima svolgeva il server remoto
(mass boost, login bot, skin) ora sono **inattive**, perché dipendevano proprio
da `svr99`. Per tenere i token privati, queste funzioni restano disabilitate.

### 2. Mass boost 150 (timing)
In `core/Minion.js`, il mass boost viene ora attivato **subito** quando il token
si collega (messaggio tipo 32), invece di aspettare il messaggio 103 che arriva
dopo lo spawn. Così le celle nascono già con massa 150.

### 3. Config
In `config/index.js` (sezione `facebookBotSettings`):
- `botAmount`: quanti bot lanciare di default (es. `10`, `50`, `150`).
- `maxBots`: tetto massimo di bot per partita (protezione dal sovraccarico).
- `useFacebookTokens`: `true` = usa i token dal file `data/tokens.json`;
  `false` = tutti i bot sono ospiti anonimi e i token NON vengono usati.
- `maxMassValues`: valori del boost (`{ delt: 150, agar: 150, doublesplit: 150 }`).

### 4. Verifica token (fix "0 token validi")
La verifica di validità è ora **disattivata** (`VERIFY_WITH_FACEBOOK = false`):
tutti i token letti vengono caricati come validi e **non vengono mai inviati**
a Facebook né ad altri servizi. I token restano sempre sul tuo computer.
Per riattivare la verifica, imposta `VERIFY_WITH_FACEBOOK = true` in
`core/TokenManager.js` (in quel caso, se Facebook non risponde, il token
viene comunque considerato valido).

## Struttura

```
config/index.js        configurazione
core/Client.js         gestione client
core/Entity.js         entità di gioco
core/Minion.js         bot di gioco (con fix massa)
core/TokenManager.js   gestione token — PRIVACY (senza svr99)
server.js              server HTTP + WebSocket
utils/                 helper, buffers, logger
data/tokens.json       metti qui i tuoi token ([] di esempio)
data/boost.json        stato mass boost (vuoto)
```

## Avvio

```bash
npm install
npm start
```

## Sicurezza

- I token appaiono **solo** come contatore nel pannello, mai come testo.
- Non condividere `data/tokens.json` con servizi di terze parti.
- Tenere il file dei token fuori dal repository (aggiungilo al `.gitignore`).
