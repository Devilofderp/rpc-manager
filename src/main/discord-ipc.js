// Minimal Discord RPC client over the local named pipe (no dependencies).
// Frame format: int32 LE opcode, int32 LE payload length, JSON payload.
import net from "node:net";
import { randomUUID } from "node:crypto";

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

export const pipePath = index => `\\\\?\\pipe\\discord-ipc-${index}`;

export class RpcClient {
    constructor(clientId) {
        this.clientId = clientId;
        this.pending = new Map();
        this.buffer = Buffer.alloc(0);
    }

    // Resolves with the READY data ({ user, config, v }).
    connect(index) {
        return new Promise((resolve, reject) => {
            const socket = net.createConnection(pipePath(index));
            this.socket = socket;
            this.onReady = resolve;
            this.onFail = reject;
            socket.once("connect", () => this.send(OP.HANDSHAKE, { v: 1, client_id: this.clientId }));
            socket.once("error", err => this.fail(err));
            socket.on("data", chunk => this.receive(chunk));
            socket.on("close", () => {
                this.closed = true;
                this.fail(new Error("pipe closed before READY"));
                for (const { reject } of this.pending.values()) reject(new Error("pipe closed"));
                this.pending.clear();
                this.onClose?.();
            });
        });
    }

    fail(err) {
        this.onFail?.(err);
        this.onReady = this.onFail = null;
    }

    send(op, payload) {
        const json = Buffer.from(JSON.stringify(payload));
        const header = Buffer.alloc(8);
        header.writeInt32LE(op, 0);
        header.writeInt32LE(json.length, 4);
        this.socket.write(Buffer.concat([header, json]));
    }

    receive(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length >= 8) {
            const op = this.buffer.readInt32LE(0);
            const length = this.buffer.readInt32LE(4);
            if (this.buffer.length < 8 + length) return;
            const payload = JSON.parse(this.buffer.subarray(8, 8 + length).toString());
            this.buffer = this.buffer.subarray(8 + length);
            this.handle(op, payload);
        }
    }

    handle(op, payload) {
        if (op === OP.PING) return this.send(OP.PONG, payload);
        if (op === OP.CLOSE) {
            this.fail(new Error(`Discord closed the connection: ${payload.code} ${payload.message}`));
            return this.socket.destroy();
        }
        if (payload.evt === "READY" && this.onReady) {
            this.onReady(payload.data);
            this.onReady = this.onFail = null;
            return;
        }
        const request = this.pending.get(payload.nonce);
        if (!request) return;
        this.pending.delete(payload.nonce);
        if (payload.evt === "ERROR") request.reject(new Error(`${payload.data.code}: ${payload.data.message}`));
        else request.resolve(payload.data);
    }

    request(cmd, args) {
        if (this.closed) return Promise.reject(new Error("pipe closed"));
        const nonce = randomUUID();
        return new Promise((resolve, reject) => {
            this.pending.set(nonce, { resolve, reject });
            this.send(OP.FRAME, { cmd, args, nonce });
        });
    }

    // Omitting activity clears it.
    setActivity(activity, pid = process.pid) {
        return this.request("SET_ACTIVITY", activity ? { pid, activity } : { pid });
    }

    close() {
        this.onClose = null;
        this.socket?.destroy();
    }
}
