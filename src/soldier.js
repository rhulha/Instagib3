import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';

class Soldier {
    constructor() {
        this.ready = false;
    }
}

var soldierSingleton = new Soldier();

const loader = new GLTFLoader();
loader.load( 'models/soldier.glb', function(glb) {
    soldierSingleton.glb = glb;
    soldierSingleton.glb.scene.rotation.order = 'YXZ';
    soldierSingleton.glb.scene.traverse((obj) => {
        if (obj.type === 'Object3D') {
            soldierSingleton.obj3d = obj;
            obj.scale.set(0.017, 0.017, 0.017);
        }
    });
    soldierSingleton.ready = true;
});

export {soldierSingleton};
