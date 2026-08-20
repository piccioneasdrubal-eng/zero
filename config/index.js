export const config = {
    serverSettings: {
        port: 8080,
        secure: false,
        keyPath: '',
        certPath: ''
    },
    proxySettings: {
        protocol: "https",
        enableProxy: true
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
            enable: true,
        },
        useMassBoost: true,
    },
    tokenSettings: {
        enableFacebook: true,
        maxBotsPerToken: 5,
        loginRequestDelay: 1000,
    },
};
