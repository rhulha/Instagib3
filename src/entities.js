const cache = {};

function loadEntities(mapName) {
    if (!cache[mapName]) {
        cache[mapName] = fetch('maps/' + mapName + '/entities.json').then(r => r.json());
    }
    return cache[mapName];
}

export { loadEntities };
