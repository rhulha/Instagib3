import {sRGBEncoding, ACESFilmicToneMapping, WebGLRenderer, Box3, Vector3} from './three/build/three.module.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';
import Stats from './three/examples/jsm/libs/stats.module.js';
import { Player } from './Player.js';
import { CustomOctree } from './lib/CustomOctree.js';
import camera from './camera.js';
import scene from './scene.js';
import {initializeAudio} from './audio.js';
import {initTriggers} from './trigger.js';
import {initItems} from './items.js';

function setupResizeListener(camera, renderer) {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
}

function setupRenderer(container) {
    var renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = sRGBEncoding;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    container.appendChild(renderer.domElement);
    return renderer;
}

class Game {
    constructor() {
        this.container = document.getElementById('container');
        this.stats = new Stats();
        this.stats.domElement.style.cssText = 'position:fixed;top:0;right:0;cursor:pointer;opacity:0.8;z-index:10000';
        this.stats.domElement.id = "stats";
        this.container.appendChild(this.stats.domElement);

        this.renderer = setupRenderer(this.container);
        setupResizeListener(camera, this.renderer);

        this.worldOctree = new CustomOctree();
        this.spawnPoint = new Vector3(0, 50, 0);
        this.player = new Player(this);
        initializeAudio();
    }

    loadMap(mapName, callback) {
        var loader = new GLTFLoader();
        document.getElementById("info").innerText = "Loading " + mapName + "...";
        loader.load('maps/' + mapName + '.glb', async (gltf) => {
            var oldLevel = scene.getObjectByName("level");
            if (oldLevel) scene.remove(oldLevel);

            this.worldOctree = new CustomOctree();
            this.player.worldOctree = this.worldOctree;

            var levelGroup = gltf.scene;
            levelGroup.name = "level";
            scene.add(levelGroup);
            scene.updateMatrixWorld();

            this.worldOctree.fromGraphNode(levelGroup, true);

            var bbox = new Box3().setFromObject(levelGroup);
            var center = new Vector3();
            bbox.getCenter(center);
            center.y = bbox.max.y + 5;
            this.spawnPoint = center;
            this.player.respawn();

            await initTriggers(mapName);
            await initItems(mapName);
            document.getElementById("info").innerText = "";
            callback();
        }, undefined, (err) => {
            console.error("Map load error:", err);
            document.getElementById("info").innerText = "Error loading map!";
        });
    }

    render() {
        this.renderer.render(scene, camera);
        this.stats.update();
    }
}

const game = new Game();

export default game;
