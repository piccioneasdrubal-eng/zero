import { SmartBuffer } from "smart-buffer";

export const buffers = {
    protocolVersion() {
        return SmartBuffer.fromSize(5).writeUInt8(254).writeUInt32LE(23).toBuffer();
    },
    protocolKey() {
        return SmartBuffer.fromSize(5).writeUInt8(255).writeUInt32LE(31128).toBuffer();
    },
    spawn(name = "XEVBOTS") {
        return new SmartBuffer().writeUInt8(0).writeStringNT(name, 'utf8').toBuffer();
    },
    spawnWithToken(name = "XEVBOTS", token = "") {
        const buf = Buffer.alloc(3 + name.length + token.length);
        buf.writeUInt8(0, 0);
        buf.write(name, 1, name.length, 'utf8');
        buf.write(token, 2 + name.length, token.length, 'utf8');
        return buf;
    },
    split() {
        return Buffer.from([17]);
    },
    eject() {
        return Buffer.from([21]);
    },
    moveTo(x, y, key) {
        return SmartBuffer.fromSize(13).writeUInt8(16).writeInt32LE(x).writeInt32LE(y).writeUInt32LE(key).toBuffer();
    },
    sendBotCount(data) {
        return new SmartBuffer().writeUInt8(0).writeStringNT(data, 'utf8').toBuffer();
    },
};
