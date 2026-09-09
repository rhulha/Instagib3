const cache = {};

function loadEntities(mapName) {
    if (!cache[mapName]) {
        cache[mapName] = fetch('maps/' + mapName + '/entities.json').then(r => r.json());
    }
    return cache[mapName];
}

function loadModels(mapName) {
    const key = mapName + '/models';
    if (!cache[key]) {
        cache[key] = fetch('maps/' + mapName + '/models.csv')
            .then(r => r.text())
            .then(text => text.trim().split('\n').slice(1).map(line => {
                const p = line.split(',').map(Number);
                return { minX: p[0], minY: p[1], minZ: p[2], maxX: p[3], maxY: p[4], maxZ: p[5] };
            }));
    }
    return cache[key];
}

export { loadEntities, loadModels };
