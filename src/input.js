import { MathUtils } from './three/build/three.module.js';
import camera from './camera.js';
import {audioHolder} from './audio.js';

var gameActive = false;

var keyStates = {};
keyStates['KeyW'] = keyStates['KeyA'] = keyStates['KeyS'] = keyStates['KeyD'] = false;

var mouseStates = {};
mouseStates.sensitivity = 500;

window.sensitivity = (val) => {
    if (val > 0 || val < 0)
        mouseStates.sensitivity = val;
    return "done";
}

window.volume = (val) => {
    if (val > 0 || val < 0)
        audioHolder.volume = val;
    return "done";
}

window.fov = (val) => {
    if (val > 0 || val < 0) {
        camera.fov = val;
        camera.updateProjectionMatrix();
    }
    return "done";
}

document.body.addEventListener( 'mousemove', ( event ) => {
    if ( document.pointerLockElement === document.body ) {
        camera.rotation.y -= event.movementX / Math.abs(mouseStates.sensitivity);
        camera.rotationy -= event.movementX / Math.abs(mouseStates.sensitivity);
        camera.rotation.x -= event.movementY / mouseStates.sensitivity;
        camera.rotation.x = MathUtils.clamp(camera.rotation.x, -Math.PI/2, Math.PI/2);
    }
}, false );

window.addEventListener("mapSelected", () => { gameActive = true; });

document.addEventListener( 'mousedown', (e) => {
    if (!gameActive) return;
    if ( document.pointerLockElement !== document.body ) {
        document.body.requestPointerLock();
        return;
    }
    mouseStates[e.button] = true;
    if (e.button == 2) {
        camera.zoom = 4;
        mouseStates.sensitivity *= 3;
        camera.updateProjectionMatrix();
    }
});

document.addEventListener( 'mouseup', (e) => {
    mouseStates[e.button] = false;
    if (e.button == 2) {
        camera.zoom = 1;
        mouseStates.sensitivity /= 3;
        camera.updateProjectionMatrix();
    }
});

document.addEventListener( 'keydown', ( event ) => {
    if (event.repeat)
        return;
    keyStates[ event.code ] = true;
}, false );

document.addEventListener( 'keyup', ( event ) => {
    keyStates[ event.code ] = false;
}, false );

var touchStates = {};
touchStates.pageXStart = 0;
touchStates.pageYStart = 0;
touchStates.pageX = 0;
touchStates.pageY = 0;
touchStates.rotate = false;

document.body.addEventListener( 'touchstart', (e) => {
    if (e.touches.length > 1) {
        // will be handled in Player.js via mouseStates
    }
    touchStates.pageXStart = e.touches[0].pageX;
    touchStates.pageYStart = e.touches[0].pageY;
    touchStates.rotate = true;
}, false);

document.body.addEventListener('touchmove', (e) => {
    touchStates.pageX = e.touches[0].pageX;
    if (e.touches[0].pageY - touchStates.pageYStart > 30) {
        keyStates['KeyW'] = false;
        keyStates['KeyS'] = true;
    } else if (e.touches[0].pageY - touchStates.pageYStart < -30) {
        keyStates['KeyW'] = true;
        keyStates['KeyS'] = false;
    } else {
        keyStates['KeyW'] = false;
        keyStates['KeyS'] = false;
    }
}, false);

document.body.addEventListener('touchend', (e) => {
    keyStates['KeyW'] = false;
    keyStates['KeyS'] = false;
    touchStates.rotate = false;
}, false);

export {keyStates, mouseStates, touchStates};
