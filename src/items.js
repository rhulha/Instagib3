import { Sprite, SpriteMaterial, CanvasTexture, Group, sRGBEncoding } from './three/build/three.module.js';
import { loadEntities } from './entities.js';
import scene from './scene.js';

const SCALE = 0.038;

// Quake 3 cg_simpleItems draws the item icon as a sprite of radius 14, 16 units above the origin.
const ICON_RADIUS = 14;
const ICON_OFFSET = 16;

const weapons = {
    weapon_gauntlet:        ['GT',  '#c0c0c0'],
    weapon_machinegun:      ['MG',  '#b0b0b0'],
    weapon_shotgun:         ['SG',  '#d8a038'],
    weapon_grenadelauncher: ['GL',  '#40b040'],
    weapon_rocketlauncher:  ['RL',  '#d04030'],
    weapon_lightning:       ['LG',  '#40a0e0'],
    weapon_railgun:         ['RG',  '#40c060'],
    weapon_plasmagun:       ['PG',  '#c060d0'],
    weapon_bfg:             ['BFG', '#e0d040'],
    weapon_grapplinghook:   ['GH',  '#a08050'],
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
    ctx.font = 'bold ' + (label.length > 2 ? 42 : 56) + 'px Monospace';
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
        const [label, color] = weapons[classname];
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

    for (const classname in weapons) {
        for (const entity of (entities[classname] || [])) {
            if (!entity.origin) continue;
            const [qx, qy, qz] = entity.origin.split(' ').map(Number);
            const sprite = new Sprite(getMaterial(classname));
            sprite.position.set(qx * SCALE, (qz + ICON_OFFSET) * SCALE, -qy * SCALE);
            sprite.scale.setScalar(ICON_RADIUS * 2 * SCALE);
            group.add(sprite);
        }
    }

    scene.add(group);
}

export { initItems };
