import { Vector3, LineBasicMaterial, MeshBasicMaterial, TubeGeometry, Curve, Mesh, Object3D, Line, BufferGeometry, Color } from './three/build/three.module.js';

const railLength = 125;

class HelixCurve extends Curve {
    constructor() { super(); }
    getPoint(t, optionalTarget) {
        var point = optionalTarget || new Vector3();
        var a = 0.2;
        var b = railLength;
        var t2 = 2 * Math.PI * t * b / 3;
        var x = Math.cos( t2 ) * a;
        var y = Math.sin( t2 ) * a;
        var z = b * t;
        return point.set( x, y, z );
    }
}

var helix = new HelixCurve();
var helixGeometry = new TubeGeometry( helix, 300, 0.1, 12, false );
const points = [];
points.push( new Vector3(0, 0, 0) );
points.push( new Vector3(0, 0, railLength) );
const lineGeometry = new BufferGeometry().setFromPoints( points );

class Rail extends Object3D {
    constructor() {
        super();
        var helixMaterial = new MeshBasicMaterial( { color: 0x0000dd, opacity: 0.5, transparent: true } );
        var helixMesh = new Mesh( helixGeometry, helixMaterial );
        helixMesh.rotation.z += Math.PI + 0.7;
        this.add(helixMesh);
        this.helixMesh = helixMesh;
        const lineMaterial = new LineBasicMaterial( { color: 0x0000ff, linewidth: 2 } );
        const line = new Line( lineGeometry, lineMaterial );
        this.add(line);
        this.line = line;
        this.update = delayedRemove;
    }
}

const railCache = [];

function delayedRemove(scene, delta, elapsed) {
    if (this.time + 1.5 < elapsed) {
        if (!scene.remove_me)
            scene.remove_me = [];
        scene.remove_me.push(this);
        railCache.push(this);
    }
}

function addRailToScene(scene, start, end, color) {
    var rail = railCache.length > 0 ? railCache.pop() : new Rail();
    rail.helixMesh.material.color.set(Color.NAMES[color] ? color : parseInt(color, 16));
    rail.line.material.color.copy(rail.helixMesh.material.color);
    var temp = rail.line.material.color.r;
    rail.line.material.color.r = rail.line.material.color.g;
    rail.line.material.color.g = rail.line.material.color.b;
    rail.line.material.color.b = temp;
    rail.position.copy(start);
    rail.lookAt(end.x, end.y, end.z);
    rail.time = scene.elapsed;
    scene.add(rail);
}

export {addRailToScene};
