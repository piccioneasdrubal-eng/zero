import chalk from 'chalk';

export const logger = {
    info: (message, prefix = null) => {
        console.log(`${chalk.greenBright(prefix ? `[${prefix}]` : '[INFO]')} ${message}`);
    },
    warn: (message, prefix = null) => {
        console.log(`${chalk.yellowBright(prefix ? `[${prefix}]` : '[WARN]')} ${message}`);
    },
    error: (message) => {
        console.log(`${chalk.redBright('[ERROR]')} ${message}`);
    },
    process: (tried, length) => {
        let percent = Math.floor((tried / length) * 100);
        if (tried === length) percent = 100;
        const msg = `${chalk.yellowBright('[TokenManager]')} Checking tokens... ${percent}% (${tried}/${length})`;
        process.stdout.write('\r' + msg.padEnd(process.stdout.columns));
        if (tried === length) process.stdout.write('\n');
    }
};
