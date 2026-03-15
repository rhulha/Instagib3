const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// ─── Static file server ───────────────────────────────────────────────────────

const mimeTypes = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
    '.json': 'application/json',
    '.glb':  'model/gltf-binary',
    '.mp3':  'audio/mpeg',
    '.ttf':  'font/ttf',
};

function serveStatic(pathname, response) {
    pathname = decodeURI(pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(__dirname, pathname);
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
        if (err) {
            response.writeHead(404);
            response.end('404 Not Found');
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(data);
        }
    });
}

// ─── WebSocket implementation ─────────────────────────────────────────────────

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsHandshake(socket, req) {
    const key = req.headers['sec-websocket-key'];
    const accept = crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
    );
}

function parseFrames(buffer, onMessage) {
    while (buffer.length >= 2) {
        const opcode = buffer[0] & 0x0f;
        const masked  = (buffer[1] & 0x80) !== 0;
        let payloadLen = buffer[1] & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
            if (buffer.length < 4) break;
            payloadLen = buffer.readUInt16BE(2);
            offset = 4;
        } else if (payloadLen === 127) {
            if (buffer.length < 10) break;
            payloadLen = Number(buffer.readBigUInt64BE(2));
            offset = 10;
        }

        const maskLen = masked ? 4 : 0;
        if (buffer.length < offset + maskLen + payloadLen) break;

        let maskKey;
        if (masked) {
            maskKey = buffer.slice(offset, offset + 4);
            offset += 4;
        }

        let payload = Buffer.from(buffer.slice(offset, offset + payloadLen));
        if (masked) {
            for (let i = 0; i < payload.length; i++)
                payload[i] ^= maskKey[i % 4];
        }

        if (opcode === 0x8) {
            onMessage(null); // close
        } else if (opcode === 0x1 || opcode === 0x2) {
            onMessage(payload.toString());
        }

        buffer = buffer.slice(offset + payloadLen);
    }
    return buffer;
}

function wsSend(socket, data) {
    if (socket.destroyed) return;
    const payload = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
    let header;
    if (payload.length < 126) {
        header = Buffer.from([0x81, payload.length]);
    } else if (payload.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81; header[1] = 126;
        header.writeUInt16BE(payload.length, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81; header[1] = 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    socket.write(Buffer.concat([header, payload]));
}

// ─── Game logic ───────────────────────────────────────────────────────────────

var rooms = {};

class Room {
    constructor(name) {
        this.name = name;
        this.players = [];
    }
}

function broadcastRoom(room, msg, skipSocket) {
    const data = JSON.stringify(msg);
    room.players.forEach(p => {
        if (p.socket !== skipSocket && !p.socket.destroyed)
            wsSend(p.socket, data);
    });
}

class Player {
    constructor(id, name, color, room, socket) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.room = room;
        this.socket = socket;
        this.frags = 0;
        this.x = 0; this.y = 0; this.z = 0;
        this.rx = 0; this.ry = 0;
        this.run = false;
    }

    handleMessage(raw) {
        if (!raw || !raw.startsWith('{')) return;
        var msg = JSON.parse(raw);
        if (msg.cmd === 'pos') {
            this.x = parseFloat(msg.pos.x);
            this.y = parseFloat(msg.pos.y);
            this.z = parseFloat(msg.pos.z);
            this.rx = parseFloat(msg.rot.x);
            this.ry = parseFloat(msg.rot.y);
            this.run = msg.run ? true : false;
        } else if (msg.cmd === 'rail') {
            msg.id = this.id;
            msg.color = this.color;
            broadcastRoom(this.room, msg, this.socket);
        } else if (msg.cmd === 'hit') {
            this.frags++;
            msg.source_id = this.id;
            broadcastRoom(this.room, msg, this.socket);
        } else if (msg.cmd === 'fragself') {
            this.frags--;
        } else if (msg.cmd === 'respawn') {
            broadcastRoom(this.room, { cmd: 'respawn', id: this.id }, this.socket);
        }
    }

    handleDisconnect() {
        console.log('disconnected:', this.name, this.room.name);
        broadcastRoom(this.room, { cmd: 'disconnect', id: this.id }, this.socket);
        var idx = this.room.players.indexOf(this);
        if (idx > -1) this.room.players.splice(idx, 1);
    }
}

function sendPlayerPositions() {
    for (var room_name in rooms) {
        var room = rooms[room_name];
        for (var player of room.players) {
            if (!player.socket.destroyed) {
                wsSend(player.socket, {
                    cmd: 'packet',
                    this_player_id: player.id,
                    room: room_name,
                    players: room.players.map(p => ({
                        id: p.id, name: p.name, color: p.color, frags: p.frags,
                        x: p.x, y: p.y, z: p.z, rx: p.rx, ry: p.ry, run: p.run
                    }))
                });
            }
        }
    }
}

setInterval(sendPlayerPositions, 16);

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────

const httpServer = http.createServer((req, res) => {
    serveStatic(url.parse(req.url).pathname, res);
});

httpServer.on('upgrade', (req, socket, _head) => {
    if (req.headers['upgrade'] !== 'websocket') {
        socket.destroy();
        return;
    }

    wsHandshake(socket, req);

    var { query: { name, room, color } } = url.parse(req.url, true);
    var id = crypto.randomBytes(6).toString('hex');
    name  = ((name  || 'Player').replace(/[^A-Za-z0-9]/g, '') || 'Player').substring(0, 32);
    room  = ((room  || 'q3dm17').replace(/[^A-Za-z0-9_-]/g, '') || 'q3dm17').substring(0, 64);
    color = ((color || 'yellow').replace(/[^A-Za-z0-9]/g, '') || 'yellow').substring(0, 30);

    console.log('connected:', id, name, room, color);

    if (!rooms[room]) rooms[room] = new Room(room);
    var player = new Player(id, name, color, rooms[room], socket);
    rooms[room].players.push(player);

    var buf = Buffer.alloc(0);
    socket.on('data', chunk => {
        buf = Buffer.concat([buf, chunk]);
        buf = parseFrames(buf, msg => {
            if (msg === null) player.handleDisconnect();
            else player.handleMessage(msg);
        });
    });
    socket.on('close', () => player.handleDisconnect());
    socket.on('error', () => {});
});

const port = process.env.PORT || 8080;
httpServer.listen(port, () => console.log('Listening on http://localhost:' + port));
