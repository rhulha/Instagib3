import {Clock} from './three/build/three.module.js';
import game from './setup.js';
import scene from './scene.js';
import {enemies, sendPlayerPositionToServer} from './networking.js';
import {updateDoors} from './doors.js';

const clock = new Clock();

function animate() {
    var deltaTime = Math.min(0.1, clock.getDelta());
    scene.elapsed = clock.getElapsedTime();
    game.player.controls(deltaTime);
    updateDoors(deltaTime, scene.elapsed, game.player);
    game.player.update(deltaTime);
    Object.values(enemies).forEach(e => e.mixer.update(deltaTime));
    game.render();
    sendPlayerPositionToServer();
    requestAnimationFrame(animate);
    scene.traverse((obj) => {
        if (obj.update) obj.update.call(obj, scene, deltaTime, scene.elapsed);
    });
    let rm = scene.remove_me;
    if (rm && rm.length > 0) {
        for (var i = 0; i < rm.length; i++) {
            scene.remove(rm[i]);
            if (rm[i].geometry) rm[i].geometry.dispose();
        }
        rm.length = 0;
    }
}

var animationStarted = false;

window.addEventListener("mapSelected", (e) => {
    var mapName = e.detail;
    game.loadMap(mapName, () => {
        if (!animationStarted) {
            animationStarted = true;
            clock.start();
            animate();
        }
    });
});
