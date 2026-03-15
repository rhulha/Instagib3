import {MathUtils, Color} from './three/build/three.module.js';
import {AnimationMixer} from './three/build/three.module.js';
import {SkeletonUtils} from './three/examples/jsm/utils/SkeletonUtils.js';
import {soldierSingleton} from './soldier.js';
import webSocket from './lib/webSocket.js';
import {explosion} from './railgun.js';
import { addRailToScene } from './rail.js';
import game from './setup.js';
import scene from './scene.js';
import * as hud from './hud.js';
import {audioHolder} from './audio.js';

var enemies = {};
var this_player_id;

function damp(source, target, smoothing, dt) {
    return MathUtils.lerp(source, target, 1 - Math.pow(smoothing, dt));
}

class Enemy {
    constructor(id, name, color) {
        this.id = id;
        this.name = name.substring(0, 40).replace(/[^A-Za-z0-9]/g, '');
        if (color === undefined) color = 'yellow';
        this.color = color.substring(0, 30).replace(/[^A-Za-z0-9]/g, '');
        this.frags = 0;
        this.obj3d = SkeletonUtils.clone(soldierSingleton.glb.scene.children[0]);
        this.obj3d.traverse((obj) => {
            if (obj.isMesh) {
                obj.material = obj.material.clone();
                if (Color.NAMES[this.color])
                    obj.material.color.set(this.color);
                else
                    obj.material.color.set(parseInt(this.color, 16));
                obj.material.color.offsetHSL(0, 0, 0.1);
            }
        });
        this.p = this.obj3d.position;
        this.r = this.obj3d.rotation;
        this.r.x = -Math.PI / 2;
        this.r.y = 0;
        this.r.order = 'YXZ';
        this.mixer = new AnimationMixer(this.obj3d);
        var idleAction = this.mixer.clipAction(soldierSingleton.glb.animations[0]);
        var runAction = this.mixer.clipAction(soldierSingleton.glb.animations[1]);
        this.actions = [idleAction, runAction];
        this.actions.forEach((action) => {
            action.setEffectiveTimeScale(1);
            action.setEffectiveWeight(0);
            action.play();
        });
        runAction.setEffectiveWeight(1);
    }
}

var packetCounter = 0;
webSocket.packet = function(msg) {
    if (!soldierSingleton.ready) return;
    var playerWithMostFrags;
    if (msg.this_player_id && msg.players && msg.players.length && msg.players.length < 128) {
        this_player_id = msg.this_player_id;
        for (var player of msg.players) {
            if (!playerWithMostFrags || playerWithMostFrags.frags <= player.frags)
                playerWithMostFrags = player;
            if (player.id !== this_player_id) {
                if (!enemies[player.id]) {
                    console.log("new enemy:", player.id, player.name);
                    var e = new Enemy(player.id, player.name, player.color);
                    enemies[player.id] = e;
                    scene.add(e.obj3d);
                }
                var e = enemies[player.id];
                player.y -= 0.35;
                e.actions[0].setEffectiveWeight(player.run ? 0 : 1);
                e.actions[1].setEffectiveWeight(player.run ? 1 : 0);
                e.p.copy(player);
                e.r.z = player.ry;
                e.frags = player.frags;
            }
        }
        packetCounter++;
        if (packetCounter % 60 == 0) {
            hud.updateTopFragsCounter(playerWithMostFrags);
            packetCounter = MathUtils.randInt(2, 7);
        }
    }
};

webSocket.rail = function(msg) {
    if (enemies[msg.id]) enemies[msg.id].obj3d.visible = true;
    addRailToScene(scene, msg.start, msg.end, msg.color);
    audioHolder.play("railgun_enemy");
};

webSocket.disconnect = function(msg) {
    var e = enemies[msg.id];
    if (!e) return;
    e.mixer.stopAllAction();
    scene.remove(e.obj3d);
    delete enemies[msg.id];
};

webSocket.respawn = function(msg) {
    if (msg.id !== this_player_id) {
        if (enemies[msg.id]) enemies[msg.id].obj3d.visible = true;
    }
};

webSocket.hit = function(msg) {
    if (msg.id == this_player_id) {
        var killerName = enemies[msg.source_id] ? enemies[msg.source_id].name : "someone";
        hud.updateInfoText("Fragged by " + killerName);
        game.player.dead = true;
        game.player.timeOfDeath = scene.elapsed;
        hud.hideGunAndCrosshairs();
        audioHolder.play("gib");
    } else {
        if (enemies[msg.id]) enemies[msg.id].obj3d.visible = false;
        audioHolder.play("gib", 0.1);
    }
    scene.add(explosion(scene, msg.pos, scene.elapsed));
};

function sendCommand(command) {
    if (typeof command === 'string')
        webSocket.send({ cmd: command });
    else
        webSocket.send(command);
}

function sendPlayerPositionToServer() {
    if (webSocket.connection && webSocket.connection.readyState == 1) {
        webSocket.send({
            cmd: "pos",
            pos: game.player.getPos(),
            rot: game.player.getRotation(),
            run: game.player.playerOnFloor && (game.player.wishdir.lengthSq() > 0)
        });
    }
}

export {enemies, Enemy, sendCommand, sendPlayerPositionToServer};
