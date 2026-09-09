import { Vector3 } from './three/build/three.module.js';
import { Capsule } from './three/examples/jsm/math/Capsule.js';
import { shoot } from './railgun.js';
import { sendCommand } from './networking.js';
import camera from './camera.js';
import scene from './scene.js';
import {keyStates, mouseStates, touchStates} from './input.js';
import {audioHolder} from './audio.js';
import {checkWorld, checkPlayerPlayerCollisions} from './collisions.js';
import {checkTriggers} from './trigger.js';
import {checkDoors} from './doors.js';
import {checkItems} from './items.js';
import * as hud from './hud.js';

const GRAVITY = 30;
const playerHeight = 2.13;
const playerRadius = 0.55;
const cameraHeight = 1.85;

class Player {
    constructor(game) {
        this.playerCollider = new Capsule(new Vector3(0, playerRadius, 0), new Vector3(0, cameraHeight, 0), playerRadius);
        this.playerVelocity = new Vector3();
        this.deltaPosition = new Vector3();
        this.wishdir = new Vector3();
        this.wishJump = false;
        this.playerDirection = new Vector3();
        this.playerOnFloor = false;
        this.tempVector = new Vector3();
        this.game = game;
        this.name = new URLSearchParams(window.location.search).get('name') || 'Player';
        this.color = new URLSearchParams(window.location.search).get('color') || 'yellow';
        this.frags = 0;
        this.dead = false;
        this.timeOfDeath = 0;
        this.worldOctree = game.worldOctree;
        this.respawn();
    }

    getPos() {
        var s = this.playerCollider.start;
        return {x: s.x, y: s.y, z: s.z};
    }

    getRotation() {
        var r = camera.rotation;
        return {x: r.x, y: r.y};
    }

    respawn() {
        var spawnPos = this.game.spawnPoint || new Vector3(0, 50, 0);
        var feetPos = this.playerCollider.start.clone().multiplyScalar(-1).add(spawnPos);
        this.playerCollider.translate(feetPos);
        this.playerVelocity.set(0, 0, 0);
        camera.rotation.x = 0;
        camera.rotation.y = 0;
    }

    playerCollisions() {
        checkWorld(this);
        checkDoors(this);
        if (!this.dead) checkPlayerPlayerCollisions(this);
        if (!this.dead) checkTriggers(this);
        if (!this.dead) checkItems(this);
        if (this.playerCollider.end.y < -100) {
            this.frags--;
            hud.updateFragsCounter(this.frags);
            sendCommand("fragself");
            this.respawn();
        }
    }

    update(deltaTime) {
        if (this.playerOnFloor && this.playerVelocity.y <= 0) {
            if (this.wishdir.lengthSq() == 0) {
                this.playerVelocity.addScaledVector(this.playerVelocity, -0.1);
            } else {
                this.wishdir.normalize();
                this.wishdir.multiplyScalar(2 * 25 * deltaTime);
                if (this.wishdir.dot(this.playerVelocity) < 0)
                    this.wishdir.multiplyScalar(10);
                this.playerVelocity.add(this.wishdir);
                const damping = Math.exp(-3 * deltaTime) - 1;
                this.playerVelocity.addScaledVector(this.playerVelocity, damping);
            }
            if (this.wishJump) {
                this.playerVelocity.y = 9;
                this.wishJump = false;
                audioHolder.play("jump");
            }
        } else {
            this.wishdir.normalize();
            this.wishdir.multiplyScalar(10 * deltaTime);
            this.playerVelocity.add(this.wishdir);
            this.playerVelocity.y -= GRAVITY * deltaTime;
        }
        this.deltaPosition.copy(this.playerVelocity).multiplyScalar(deltaTime);
        this.playerCollider.translate(this.deltaPosition);
        this.playerCollisions();

        if (!this.dead) {
            camera.position.copy(this.playerCollider.end);
        } else {
            // slowly drop camera on death
            var t = Math.min(scene.elapsed - this.timeOfDeath, 1);
            camera.position.copy(this.playerCollider.end).lerp(this.playerCollider.start, t);
        }
    }

    getPlayerRelativeVector(side) {
        camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        if (side) this.playerDirection.cross(camera.up);
        return this.playerDirection;
    }

    controls(deltaTime) {
        this.wishdir.set(0, 0, 0);

        if (mouseStates[0]) {
            if (this.dead) {
                this.dead = false;
                sendCommand("respawn");
                audioHolder.play("teleport");
                this.respawn();
                hud.showGunAndCrosshairs();
                hud.updateFragsCounter(this.frags);
                mouseStates[0] = false;
                return;
            } else {
                shoot(scene, this);
            }
        }

        if (keyStates['ArrowLeft']) camera.rotationy -= 0.02;
        if (keyStates['ArrowRight']) camera.rotationy += 0.02;

        if (touchStates.rotate)
            camera.rotation.y -= (touchStates.pageX - touchStates.pageXStart) * 0.01 * deltaTime;

        if (this.dead) return;

        this.wishdir.add(this.getPlayerRelativeVector(false).multiplyScalar(keyStates['KeyW'] - keyStates['KeyS']));
        this.wishdir.add(this.getPlayerRelativeVector(true).multiplyScalar(keyStates['KeyD'] - keyStates['KeyA']));

        if (keyStates['Space']) {
            this.wishJump = true;
            keyStates['Space'] = false;
        }
        if (keyStates['KeyK']) {
            this.frags--;
            hud.updateFragsCounter(this.frags);
            sendCommand("fragself");
            this.respawn();
            keyStates['KeyK'] = false;
        }
    }
}

export {Player};
