import {enemies} from './networking.js';

const playerHeight = 2.13;
const playerRadius = 0.55;
const cameraHeight = 1.85;

function checkPlayerPlayerCollisions(player) {
    for (var enemy_id in enemies) {
        const enemy = enemies[enemy_id];
        if (!enemy.obj3d.visible) continue;

        const bottom = player.playerCollider.start.y - playerRadius;
        const top = player.playerCollider.end.y + playerRadius;

        if (bottom < enemy.p.y + playerHeight && top > enemy.p.y - playerRadius) {
            if (player.playerCollider.start.y > enemy.p.y + cameraHeight - playerRadius) {
                enemy.p.y += cameraHeight - playerRadius;
                var dt = player.playerCollider.start.distanceTo(enemy.p);
                if (dt < playerRadius * 2) {
                    player.playerVelocity.addScaledVector(player.tempVector, -player.tempVector.dot(player.playerVelocity));
                    player.playerCollider.translate(player.tempVector.multiplyScalar(playerRadius * 2 - dt));
                }
                enemy.p.y -= cameraHeight - playerRadius;
            } else if (player.playerCollider.end.y < enemy.p.y) {
                var dt = player.playerCollider.end.distanceTo(enemy.p);
                if (dt < playerRadius * 2) {
                    player.playerVelocity.addScaledVector(player.tempVector, -player.tempVector.dot(player.playerVelocity));
                    player.playerCollider.translate(player.tempVector.multiplyScalar(playerRadius * 2 - dt));
                }
            } else {
                var temp = enemy.p.y;
                enemy.p.y = player.playerCollider.start.y;
                var dt = player.playerCollider.start.distanceTo(enemy.p);
                if (dt < playerRadius * 2) {
                    player.tempVector.copy(player.playerCollider.start).sub(enemy.p).normalize();
                    player.playerVelocity.addScaledVector(player.tempVector, -player.tempVector.dot(player.playerVelocity));
                    player.playerCollider.translate(player.tempVector.multiplyScalar(playerRadius * 2 - dt));
                }
                enemy.p.y = temp;
            }
        }
    }
}

function checkWorld(player) {
    const result = player.worldOctree.capsuleIntersect(player.playerCollider);
    player.playerOnFloor = false;
    if (result) {
        player.playerOnFloor = result.normal.y > 0;
        if (!player.playerOnFloor) {
            player.playerVelocity.addScaledVector(result.normal, -result.normal.dot(player.playerVelocity));
        }
        player.playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }
}

export {checkWorld, checkPlayerPlayerCollisions};
