import {PerspectiveCamera} from './three/build/three.module.js';

var camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.rotation.order = 'YXZ';
camera.rotationy = 0;

export default camera;
