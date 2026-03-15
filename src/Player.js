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
import * as hud from './hud.js';

const GRAVITY = 30;
const playerHeight = 3.53;
const playerRadius = 0.7;
const cameraHeight = playerHeight - playerRadius;

// Q3-style movement constants scaled by 0.038 (map scale); Q3 originals in comments.
// Validation: Q3 gravity=800 * 0.038 = 30.4 ≈ GRAVITY=30 ✓
const MOVE_SPEED = 12.2;    // max run speed        (Q3: 320 u/s  * 0.038)
const GROUND_ACCEL = 10;    // ground acceleration  (Q3: 10  — dimensionless, no scaling)
const AIR_ACCEL = 1;        // air acceleration     (Q3: 1   — dimensionless, enables strafe jumping)
const FRICTION = 6;         // ground friction      (Q3: 6   — dimensionless, no scaling)
const STOP_SPEED = 3.8;     // minimum control speed(Q3: 100  * 0.038)
const JUMP_SPEED = 10.3;    // jump velocity        (Q3: 270 u/s  * 0.038)

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
        if (!this.dead) checkPlayerPlayerCollisions(this);
        if (!this.dead) checkTriggers(this);
        if (this.playerCollider.end.y < -100) {
            this.frags--;
            hud.updateFragsCounter(this.frags);
            sendCommand("fragself");
            this.respawn();
        }
    }

    // Q3 PM_Friction: only applied on ground, horizontal only
    _applyFriction(deltaTime) {
        const vel = this.playerVelocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        if (speed < 0.001) {
            vel.x = 0;
            vel.z = 0;
            return;
        }
        const control = speed < STOP_SPEED ? STOP_SPEED : speed;
        let newspeed = speed - control * FRICTION * deltaTime;
        if (newspeed < 0) newspeed = 0;
        const scale = newspeed / speed;
        vel.x *= scale;
        vel.z *= scale;
    }

    // Q3 PM_Accelerate: adds velocity only up to wishspeed in the wish direction.
    // The key insight: if wishdir is perpendicular to current velocity, currentspeed≈0,
    // so you keep accelerating even above MOVE_SPEED — this is strafe jumping.
    _accelerate(wishdir, wishspeed, accel, deltaTime) {
        const vel = this.playerVelocity;
        const currentspeed = vel.x * wishdir.x + vel.z * wishdir.z;
        const addspeed = wishspeed - currentspeed;
        if (addspeed <= 0) return;
        let accelspeed = accel * deltaTime * wishspeed;
        if (accelspeed > addspeed) accelspeed = addspeed;
        vel.x += accelspeed * wishdir.x;
        vel.z += accelspeed * wishdir.z;
    }

    update(deltaTime) {
        const onGround = this.playerOnFloor && this.playerVelocity.y <= 0;

        const wishlen = this.wishdir.length();
        const wishspeed = wishlen > 0 ? MOVE_SPEED : 0;
        if (wishlen > 0) this.wishdir.normalize();

        if (onGround) {
            if (this.wishJump) {
                this.playerVelocity.y = JUMP_SPEED;
                this.wishJump = false;
                audioHolder.play("jump");
            }
            this._applyFriction(deltaTime);
            this._accelerate(this.wishdir, wishspeed, GROUND_ACCEL, deltaTime);
        } else {
            this._accelerate(this.wishdir, wishspeed, AIR_ACCEL, deltaTime);
            this.playerVelocity.y -= GRAVITY * deltaTime;
        }

        this.deltaPosition.copy(this.playerVelocity).multiplyScalar(deltaTime);
        this.playerCollider.translate(this.deltaPosition);
        this.playerCollisions();

        if (!this.dead) {
            camera.position.copy(this.playerCollider.end);
        } else {
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
