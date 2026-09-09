import { Sprite, SpriteMaterial, CanvasTexture, Group, Vector3, sRGBEncoding } from './three/build/three.module.js';
import { loadEntities } from './entities.js';
import { audioHolder } from './audio.js';
import scene from './scene.js';

const SCALE = 0.038;

// Quake 3 cg_simpleItems draws the item icon as a sprite of radius 14, 16 units above the origin.
const ICON_RADIUS = 14;
const ICON_OFFSET = 16;

// Quake 3 item bounding box is 15 units around the origin.
const ITEM_HALF = 15 * SCALE;

// classname: [label, color, respawn seconds]
const items = {
    weapon_gauntlet:        ['GT',   '#c0c0c0', 5],
    weapon_machinegun:      ['MG',   '#b0b0b0', 5],
    weapon_shotgun:         ['SG',   '#d8a038', 5],
    weapon_grenadelauncher: ['GL',   '#40b040', 5],
    weapon_rocketlauncher:  ['RL',   '#d04030', 5],
    weapon_lightning:       ['LG',   '#40a0e0', 5],
    weapon_railgun:         ['RG',   '#40c060', 5],
    weapon_plasmagun:       ['PG',   '#c060d0', 5],
    weapon_bfg:             ['BFG',  '#e0d040', 5],
    weapon_grapplinghook:   ['GH',   '#a08050', 5],

    ammo_shells:            ['SHL',  '#a8823a', 40],
    ammo_bullets:           ['BUL',  '#8a8a8a', 40],
    ammo_grenades:          ['GRN',  '#309030', 40],
    ammo_rockets:           ['RKT',  '#a03828', 40],
    ammo_lightning:         ['LTG',  '#3080b0', 40],
    ammo_slugs:             ['SLG',  '#309048', 40],
    ammo_cells:             ['CEL',  '#9848a8', 40],
    ammo_bfg:               ['BFA',  '#b0a030', 40],

    item_health_small:      ['H5',   '#60d060', 35],
    item_health:            ['H25',  '#e8d840', 35],
    item_health_large:      ['H50',  '#e88030', 35],
    item_health_mega:       ['MEGA', '#40b0e0', 35],

    item_armor_shard:       ['A5',   '#c0e060', 25],
    item_armor_combat:      ['A50',  '#e8c040', 25],
    item_armor_body:        ['A100', '#e04040', 25],

    item_quad:              ['QUAD', '#4060e8', 120],
};

function makeIcon(label, color) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold ' + (label.length > 3 ? 34 : label.length > 2 ? 42 : 56) + 'px Monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 66);

    const texture = new CanvasTexture(canvas);
    texture.encoding = sRGBEncoding;
    return texture;
}

const materials = {};

function getMaterial(classname) {
    if (!materials[classname]) {
        const [label, color] = items[classname];
        materials[classname] = new SpriteMaterial({
            map: makeIcon(label, color),
            transparent: true,
            toneMapped: false,
        });
    }
    return materials[classname];
}

async function initItems(mapName) {
    const old = scene.getObjectByName('items');
    if (old) scene.remove(old);

    const entities = await loadEntities(mapName);
    const group = new Group();
    group.name = 'items';

    for (const classname in items) {
        for (const entity of (entities[classname] || [])) {
            if (!entity.origin) continue;
            const [qx, qy, qz] = entity.origin.split(' ').map(Number);
            const sprite = new Sprite(getMaterial(classname));
            sprite.position.set(qx * SCALE, (qz + ICON_OFFSET) * SCALE, -qy * SCALE);
            sprite.scale.setScalar(ICON_RADIUS * 2 * SCALE);
            sprite.classname = classname;
            sprite.itemOrigin = new Vector3(qx * SCALE, qz * SCALE, -qy * SCALE);
            sprite.respawnTime = items[classname][2];
            sprite.respawnAt = 0;
            group.add(sprite);
        }
    }

    scene.add(group);
}

function playPickupSound() {
    if (!audioHolder.pickup) return;
    if (!audioHolder.pickup.paused) audioHolder.pickup.currentTime = 0;
    audioHolder.play("pickup");
}

function checkItems(player) {
    const group = scene.getObjectByName('items');
    if (!group) return;

    const collider = player.playerCollider;
    const feet = collider.start.y - collider.radius;
    const head = collider.end.y + collider.radius;
    const reach = ITEM_HALF + collider.radius;

    for (const sprite of group.children) {
        if (!sprite.visible) {
            if (scene.elapsed >= sprite.respawnAt) sprite.visible = true;
            continue;
        }
        const o = sprite.itemOrigin;
        if (Math.abs(collider.start.x - o.x) > reach) continue;
        if (Math.abs(collider.start.z - o.z) > reach) continue;
        if (o.y + ITEM_HALF < feet || o.y - ITEM_HALF > head) continue;

        sprite.visible = false;
        sprite.respawnAt = scene.elapsed + sprite.respawnTime;
        playPickupSound();
    }
}

export { initItems, checkItems };
