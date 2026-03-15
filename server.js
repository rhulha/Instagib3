const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const url = require('url');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

var rooms = {};

class Room {
    constructor(name) {
        this.name = name;
        this.players = [];
    }
}

function broadcastRoom(room, msg, skipWS) {
    room.players.forEach((player) => {
        if (player.ws !== skipWS && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(msg));
        }
    });
}

class Player {
    constructor(id, name, color, room, ws) {
        this.id = id;
        this.name = name;
        this.color = color;
        Object.defineProperty(this, 'room', { value: null, writable: true });
        this.room = room;
        Object.defineProperty(this, 'ws', { value: null, writable: true });
        this.ws = ws;
        this.frags = 0;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.rx = 0;
        this.ry = 0;
        this.run = false;
    }

    handleUpdate(msg) {
        if (!msg.startsWith("{")) return;
        msg = JSON.parse(msg);
        if (msg.cmd == "pos") {
            this.x = parseFloat(msg.pos.x);
            this.y = parseFloat(msg.pos.y);
            this.z = parseFloat(msg.pos.z);
            this.rx = parseFloat(msg.rot.x);
            this.ry = parseFloat(msg.rot.y);
            this.run = msg.run ? true : false;
        } else if (msg.cmd == "rail") {
            msg.id = this.id;
            msg.color = this.color;
            broadcastRoom(this.room, msg, this.ws);
        } else if (msg.cmd == "hit") {
            this.frags++;
            msg.source_id = this.id;
            broadcastRoom(this.room, msg, this.ws);
        } else if (msg.cmd == "fragself") {
            this.frags--;
        } else if (msg.cmd == "respawn") {
            broadcastRoom(this.room, { cmd: "respawn", id: this.id }, this.ws);
        }
    }

    handleDisconnect() {
        console.log("disconnected:", this.name, this.room.name);
        broadcastRoom(this.room, { cmd: "disconnect", id: this.id }, this.ws);
        var idx = this.room.players.indexOf(this);
        if (idx > -1) this.room.players.splice(idx, 1);
    }
}

function sendPlayerPositions() {
    for (var room_name in rooms) {
        var room = rooms[room_name];
        for (var player of room.players) {
            if (player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify({
                    cmd: "packet",
                    this_player_id: player.id,
                    room: room_name,
                    players: room.players
                }));
            }
        }
    }
}

setInterval(sendPlayerPositions, 16);

wss.on('connection', (ws, req) => {
    var { query: { name, room, color } } = url.parse(req.url, true);
    var id = crypto.randomBytes(6).toString('hex');
    name = (name || "Player").replace(/[^A-Za-z0-9]/g, '').substring(0, 32) || "Player";
    room = (room || "q3dm17").replace(/[^A-Za-z0-9_-]/g, '').substring(0, 64) || "q3dm17";
    color = (color || "yellow").replace(/[^A-Za-z0-9]/g, '').substring(0, 30) || "yellow";
    console.log("connected:", id, name, room, color);
    if (!rooms[room]) rooms[room] = new Room(room);
    var player = new Player(id, name, color, rooms[room], ws);
    rooms[room].players.push(player);
    ws.on('message', player.handleUpdate.bind(player));
    ws.on('close', player.handleDisconnect.bind(player));
});

app.use(express.static(__dirname));

var port = process.env.PORT || 8080;
server.listen(port, () => console.log("Listening on http://localhost:" + port));
