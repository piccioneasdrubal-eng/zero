export const config = {
    serverSettings: {
        port: 80,
        secure: false,
        keyPath: 'path/to/privkey.pem',
        certPath: 'path/to/fullchain.pem'
    },
    proxySettings: {
        protocol: "http",
        enableProxy: false
    },
    facebookBotSettings: {
        skin: {
            names: [
                'fly',
                'spider',
                'lizard',
                'bat',
                'snake',
                'fox',
                'coyote',
                'hunter',
                'sumo',
                'bear',
                'cougar',
                'panther',
                'lion',
                'crocodile',
                'shark',
                'mammoth',
                'raptor',
                't_rex',
                'kraken',
                'tiny_fairy',
                'small_goblin',
                'young_elf',
                'grove_spirit',
                'mystical_dwarf',
                'brave_halfling',
                'wild_werewolf',
                'powerful_sorcerer',
                'stealthy_assassin',
                'valiant_knight',
            ],
            enable: true,
        },
        useMassBoost: true,
    },
};
