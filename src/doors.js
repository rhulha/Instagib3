import { Vector3 } from './three/build/three.module.js';
import { loadEntities, loadModels } from './entities.js';

const SCALE = 0.038;

// Quake 3 func_door defaults (g_func.c)
const DEFAULT_SPEED = 100;
const DEFAULT_LIP = 8;
const DEFAULT_WAIT = 2;
const START_OPEN = 1;

// Q3 builds the auto-open trigger by expanding the thinnest horizontal axis of
// the door team's combined bounds by 120 units on each side.
const TRIGGER_EXPAND = 120;

const CLOSED = 0, OPENING = 1, OPEN = 2, CLOSING = 3;

var doors = [];

function num(value, fallback) {
    const n = parseFloat(value);
    return isNaN(n) ? fallback : n;
}

// Quake BSP: x=right, y=forward, z=up -> Three.js: x=right, y=up, z=-forward
function toThree(x, y, z) {
    return new Vector3(x * SCALE, z * SCALE, -y * SCALE);
}

function moveDir(angle) {
    if (angle === -1) return [0, 0, 1];
    if (angle === -2) return [0, 0, -1];
    const yaw = angle * Math.PI / 180;
    return [Math.cos(yaw), Math.sin(yaw), 0];
}

function boxFromQuake(m) {
    return {
        min: new Vector3(m.minX * SCALE, m.minZ * SCALE, -m.maxY * SCALE),
        max: new Vector3(m.maxX * SCALE, m.maxZ * SCALE, -m.minY * SCALE),
    };
}

function buildTrigger(members) {
    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const mem of members) {
        minX = Math.min(minX, mem.model.minX); maxX = Math.max(maxX, mem.model.maxX);
        minY = Math.min(minY, mem.model.minY); maxY = Math.max(maxY, mem.model.maxY);
        minZ = Math.min(minZ, mem.model.minZ); maxZ = Math.max(maxZ, mem.model.maxZ);
    }
    if (maxX - minX < maxY - minY) {
        minX -= TRIGGER_EXPAND; maxX += TRIGGER_EXPAND;
    } else {
        minY -= TRIGGER_EXPAND; maxY += TRIGGER_EXPAND;
    }
    return boxFromQuake({ minX, minY, minZ, maxX, maxY, maxZ });
}

function collectMeshes(levelGroup, modelIndex) {
    const found = [];
    levelGroup.traverse((obj) => {
        if (obj.type === 'Mesh' && obj.userData.model === modelIndex) found.push(obj);
    });
    return found;
}

async function initDoors(mapName, levelGroup) {
    doors = [];
    const [entities, modelRows] = await Promise.all([
        loadEntities(mapName),
        loadModels(mapName),
    ]);

    // Doors sharing a "team" key open together; solo doors get their own team.
    const teams = {};
    (entities.func_door || []).forEach((ent, i) => {
        const key = ent.team || ('__solo' + i);
        (teams[key] = teams[key] || []).push(ent);
    });

    for (const key in teams) {
        const members = [];
        for (const ent of teams[key]) {
            const modelIndex = parseInt(ent.model.slice(1));
            const model = modelRows[modelIndex];
            if (!model) continue;

            const meshes = collectMeshes(levelGroup, modelIndex);
            if (!meshes.length) continue;

            const dir = moveDir(num(ent.angle, 0));
            const size = [
                model.maxX - model.minX,
                model.maxY - model.minY,
                model.maxZ - model.minZ,
            ];
            const lip = num(ent.lip, DEFAULT_LIP);
            const distance = Math.abs(dir[0]) * size[0]
                           + Math.abs(dir[1]) * size[1]
                           + Math.abs(dir[2]) * size[2] - lip;

            members.push({
                model, meshes, distance,
                // Mesh vertices are stored at Quake magnitude under a scaled root
                // node, so meshes move in unscaled units while the collision box
                // lives in scaled world space.
                localStep: new Vector3(dir[0], dir[2], -dir[1]).multiplyScalar(distance),
                worldStep: new Vector3(dir[0], dir[2], -dir[1]).multiplyScalar(distance * SCALE),
                box: boxFromQuake(model),
                bounds: { min: new Vector3(), max: new Vector3() },
            });
        }
        if (!members.length) continue;

        const first = teams[key][0];
        const spawnflags = num(first.spawnflags, 0);
        const speed = num(first.speed, DEFAULT_SPEED);
        const slowest = Math.max(...members.map(m => Math.abs(m.distance)), 1);

        const door = {
            members,
            trigger: buildTrigger(members),
            // A door with a targetname waits for its trigger entity instead of
            // opening on approach. Those triggers are not implemented yet.
            proximity: !first.targetname,
            wait: num(first.wait, DEFAULT_WAIT),
            rate: speed / slowest,
            state: (spawnflags & START_OPEN) ? OPEN : CLOSED,
            frac: (spawnflags & START_OPEN) ? 1 : 0,
            openedAt: 0,
        };
        applyDoor(door);
        doors.push(door);
    }

    // Doors move, so they cannot live in the static world octree.
    for (const door of doors)
        for (const mem of door.members)
            for (const mesh of mem.meshes) mesh.userData.nonsolid = true;

    return doors.length;
}

function applyDoor(door) {
    for (const mem of door.members) {
        for (const mesh of mem.meshes) {
            mesh.position.copy(mem.localStep).multiplyScalar(door.frac);
        }
        mem.bounds.min.copy(mem.box.min).addScaledVector(mem.worldStep, door.frac);
        mem.bounds.max.copy(mem.box.max).addScaledVector(mem.worldStep, door.frac);
    }
}

function capsuleInBox(capsule, box) {
    const r = capsule.radius;
    return capsule.start.x + r > box.min.x && capsule.start.x - r < box.max.x
        && capsule.start.z + r > box.min.z && capsule.start.z - r < box.max.z
        && capsule.end.y > box.min.y && capsule.start.y < box.max.y;
}

function updateDoors(deltaTime, elapsed, player) {
    for (const door of doors) {
        const inside = door.proximity && capsuleInBox(player.playerCollider, door.trigger);

        if (inside && (door.state === CLOSED || door.state === CLOSING)) door.state = OPENING;

        if (door.state === OPENING) {
            door.frac += door.rate * deltaTime;
            if (door.frac >= 1) {
                door.frac = 1;
                door.state = OPEN;
                door.openedAt = elapsed;
            }
        } else if (door.state === OPEN) {
            if (!inside && door.wait >= 0 && elapsed - door.openedAt > door.wait) door.state = CLOSING;
        } else if (door.state === CLOSING) {
            door.frac -= door.rate * deltaTime;
            if (door.frac <= 0) {
                door.frac = 0;
                door.state = CLOSED;
            }
        } else {
            continue;
        }
        applyDoor(door);
    }
}

function pushOut(player, box) {
    const capsule = player.playerCollider;
    const r = capsule.radius;

    const overlapX = Math.min(capsule.start.x + r - box.min.x, box.max.x - (capsule.start.x - r));
    if (overlapX <= 0) return;
    const overlapZ = Math.min(capsule.start.z + r - box.min.z, box.max.z - (capsule.start.z - r));
    if (overlapZ <= 0) return;
    const overlapY = Math.min(capsule.end.y + r - box.min.y, box.max.y - (capsule.start.y - r));
    if (overlapY <= 0) return;

    const normal = new Vector3();
    var depth;
    if (overlapY <= overlapX && overlapY <= overlapZ) {
        depth = overlapY;
        normal.y = capsule.start.y < (box.min.y + box.max.y) / 2 ? -1 : 1;
        if (normal.y > 0) player.playerOnFloor = true;
    } else if (overlapX <= overlapZ) {
        depth = overlapX;
        normal.x = capsule.start.x < (box.min.x + box.max.x) / 2 ? -1 : 1;
    } else {
        depth = overlapZ;
        normal.z = capsule.start.z < (box.min.z + box.max.z) / 2 ? -1 : 1;
    }

    player.playerVelocity.addScaledVector(normal, -normal.dot(player.playerVelocity));
    capsule.translate(normal.multiplyScalar(depth));
}

function checkDoors(player) {
    for (const door of doors)
        for (const mem of door.members) pushOut(player, mem.bounds);
}

export { initDoors, updateDoors, checkDoors };
