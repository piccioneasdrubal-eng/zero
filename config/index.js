export const config = {
    serverSettings: {
        port: 8080,           // locale: 8080 (Render usava 80)
        secure: false,        // niente HTTPS in locale
        keyPath: '',
        certPath: ''
    },
    proxySettings: {
        protocol: "http",
        enableProxy: true     // proxy enabled
    },
    facebookBotSettings: {
        skin: {
            names: [
                'fly','spider','lizard','bat','snake','fox',
                'coyote','hunter','sumo','bear','cougar',
                'panther','lion','crocodile','shark','mammoth',
                'raptor','t_rex','kraken','tiny_fairy',
                'small_goblin','young_elf','grove_spirit',
                'mystical_dwarf','brave_halfling','wild_werewolf',
                'powerful_sorcerer','stealthy_assassin','valiant_knight',
            ],
            enable: true,      // skin Facebook abilitato
        },
        useMassBoost: true,    // mass boost abilitato
    },
    tokenSettings: {
        enableFacebook: true,       // usa token Facebook
        maxBotsPerToken: 50,        // max bot per token
        loginRequestDelay: 1000,    // delay tra login (ms)
    },
};
