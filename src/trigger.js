import { Vector3, Triangle } from './three/build/three.module.js';
import { CustomOctree } from './lib/CustomOctree.js';

const SCALE = 0.038;
const GRAVITY = 30;

var triggerOctree = null;
var targets = {};

function addBoxToOctree(octree, minX, minY, minZ, maxX, maxY, maxZ, userData) {
    const c = [
        [minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ],
        [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ],
    ];
    const faces = [
        [0,2,1],[0,3,2], // -Z
        [4,5,6],[4,6,7], // +Z
        [0,1,5],[0,5,4], // -Y
        [3,6,2],[3,7,6], // +Y
        [0,4,7],[0,7,3], // -X
        [1,2,6],[1,6,5], // +X
    ];
    for (const [i0, i1, i2] of faces) {
        const tri = new Triangle(
            new Vector3(...c[i0]),
            new Vector3(...c[i1]),
            new Vector3(...c[i2])
        );
        tri.userData = userData;
        octree.addTriangle(tri);
    }
}

async function initTriggers(mapName) {
    const [entitiesResp, modelsResp] = await Promise.all([
        fetch('maps/' + mapName + '/entities.json'),
        fetch('maps/' + mapName + '/models.csv')
    ]);

    const entities = await entitiesResp.json();
    const modelsText = await modelsResp.text();

    // parse models.csv: min_x,min_y,min_z,max_x,max_y,max_z,... (Quake BSP space, z=up)
    const modelRows = modelsText.trim().split('\n').slice(1).map(line => {
        const p = line.split(',').map(Number);
        return { minX: p[0], minY: p[1], minZ: p[2], maxX: p[3], maxY: p[4], maxZ: p[5] };
    });

    // targets lookup: targetname → Vector3 in Three.js space
    targets = {};
    for (const tp of (entities.target_position || [])) {
        const [qx, qy, qz] = tp.origin.split(' ').map(Number);
        targets[tp.targetname] = new Vector3(qx * SCALE, qz * SCALE, -qy * SCALE);
    }

    triggerOctree = new CustomOctree();

    for (const entity of (entities.trigger_push || [])) {
        const idx = parseInt(entity.model.slice(1));
        const m = modelRows[idx];
        if (!m) continue;

        // Quake BSP: x=right, y=forward, z=up → Three.js: x=right, y=up, z=forward
        const minX = m.minX * SCALE, maxX = m.maxX * SCALE;
        const minY = m.minZ * SCALE, maxY = m.maxZ * SCALE;
        const minZ = -m.maxY * SCALE, maxZ = -m.minY * SCALE;

        addBoxToOctree(triggerOctree, minX, minY, minZ, maxX, maxY, maxZ,
            { classname: 'trigger_push', target: entity.target });
    }

    triggerOctree.build();
}

function propel(origin, target) {
    const height = target.y - origin.y;
    const time = Math.sqrt(height / (0.5 * GRAVITY));
    const vel = target.clone().sub(origin);
    vel.y = 0;
    const dist = vel.length();
    vel.normalize().multiplyScalar(dist / time);
    vel.y = time * GRAVITY;
    return vel;
}

function checkTriggers(player) {
    if (!triggerOctree) return;
    const result = triggerOctree.capsuleIntersect(player.playerCollider);
    if (!result) return;
    if (result.userData.classname === 'trigger_push') {
        const target = targets[result.userData.target];
        if (!target) return;
        player.playerVelocity.copy(propel(player.playerCollider.end, target));
        player.playerOnFloor = false;
    }
}

export { initTriggers, checkTriggers };
