import { Vector3, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, TextureLoader, Raycaster } from './three/build/three.module.js';
import { addRailToScene } from './rail.js';
import webSocket from './lib/webSocket.js';
import camera from './camera.js';
import {audioHolder} from './audio.js';

const sprite = new TextureLoader().load( 'images/disc.png' );
const material = new PointsMaterial( { size: 1, color: "darkred", map: sprite, alphaTest: 0.5, transparent: true });
const count = 200;
const speed = 10;

function explosion(scene, pos, elapsedTime) {
    const dirs = [];
    const vertices = [];
    for (let i = 0; i < count; i++) {
        vertices.push(pos.x, pos.y, pos.z);
        dirs.push(new Vector3((Math.random() * speed)-(speed/2), (Math.random() * speed*2)-(speed/2), (Math.random() * speed)-(speed/2)));
    }
    var geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    var particles = new Points(geometry, material);
    particles.time = elapsedTime;
    particles.update = function(scene, delta, elapsed) {
        if (this.time + 1.5 < elapsed) {
            if (!scene.remove_me) scene.remove_me = [];
            scene.remove_me.push(this);
        }
        var pos = particles.geometry.attributes.position.array;
        for (let i = 0; i < count*3; i+=3) {
            pos[i] += dirs[i/3].x * delta;
            pos[i+1] += dirs[i/3].y * delta;
            pos[i+2] += dirs[i/3].z * delta;
            dirs[i/3].y -= 30 * delta;
        }
        geometry.attributes.position.needsUpdate = true;
    };
    return particles;
}

function getLinePositionsFromPlayer(player) {
    var start = new Vector3();
    var end = new Vector3();
    camera.getWorldDirection(player.playerDirection);
    start.copy(player.playerCollider.end);
    end.copy(player.playerCollider.end);
    end.addScaledVector(player.playerDirection, 100);
    return [start, end];
}

var railgunLastShotTime = -1.492;

function shoot(scene, player) {
    if (railgunLastShotTime + 1.492 >= scene.elapsed) return;
    railgunLastShotTime = scene.elapsed;
    if (audioHolder.railgun.paused)
        audioHolder.play("railgun");
    else {
        audioHolder.railgun.currentTime = 0;
        audioHolder.play("railgun");
    }
    var [start, end] = getLinePositionsFromPlayer(player);
    addRailToScene(scene, start, end, player.color);
    webSocket.send({ cmd: "rail", start: {x: start.x, y: start.y, z: start.z}, end: {x: end.x, y: end.y, z: end.z} });

    const raycaster = new Raycaster(start, player.playerDirection);
    var level = scene.getObjectByName("level");
    if (level) {
        var result = raycaster.intersectObject(level, true);
        if (result && result.length > 0 && result[0].distance < 3) {
            player.playerVelocity.y = 27.2;
        }
    }

    // Import enemies lazily to avoid circular deps at module load time
    import('./networking.js').then(({enemies}) => {
        for (var enemy_id in enemies) {
            var enemy = enemies[enemy_id];
            if (!enemy.obj3d.visible) continue;
            if (raycaster.intersectObject(enemy.obj3d, true).length > 0) {
                var hitPos = enemy.p.clone();
                hitPos.y += 1.8;
                enemy.obj3d.visible = false;
                webSocket.send({ cmd: "hit", pos: {x: hitPos.x, y: hitPos.y, z: hitPos.z}, id: enemy_id });
                scene.add(explosion(scene, hitPos, scene.elapsed));
                player.frags++;
                import('./hud.js').then(hud => hud.updateFragsCounter(player.frags));
                audioHolder.play("gib");
            }
        }
    });
}

export {shoot, explosion};
