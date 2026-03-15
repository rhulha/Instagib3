import {Scene, AmbientLight, Vector3} from './three/build/three.module.js';
import { Sky } from './three/examples/jsm/objects/Sky.js';

var scene = new Scene();

scene.add( new AmbientLight( 0xffffff, 1 ) );

var sky = new Sky();
sky.scale.setScalar( 450000 );
scene.add( sky );

const effectController = {
    turbidity: 0,
    rayleigh: 0.035,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    inclination: 0.3555,
    azimuth: 0.25,
};

var sun = new Vector3();
const uniforms = sky.material.uniforms;
uniforms[ "turbidity" ].value = effectController.turbidity;
uniforms[ "rayleigh" ].value = effectController.rayleigh;
uniforms[ "mieCoefficient" ].value = effectController.mieCoefficient;
uniforms[ "mieDirectionalG" ].value = effectController.mieDirectionalG;

const theta = Math.PI * ( effectController.inclination - 0.5 );
const phi = 2 * Math.PI * ( effectController.azimuth - 0.5 );
sun.x = Math.cos( phi );
sun.y = Math.sin( phi ) * Math.sin( theta );
sun.z = Math.sin( phi ) * Math.cos( theta );
uniforms[ "sunPosition" ].value.copy( sun );

export default scene;
