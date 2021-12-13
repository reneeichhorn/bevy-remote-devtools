
/* eslint-disable */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function startMeshBrowser(element: Element, positions: number[][], indices: number[]) {
  let camera, controls, scene, renderer;
  let running = true;

  init();
  animate();

  function init() {
    scene = new THREE.Scene ({alpha: false});
    scene.background = new THREE.Color (0x009AFF)
    //scene.fog = new THREE.FogExp2 (0x009AFF, 0.002)

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( element.clientWidth, element.clientHeight );
    element.appendChild( renderer.domElement );

    camera = new THREE.PerspectiveCamera (60, window.innerWidth / window.innerHeight, 1, 1000)
    camera.position.set (20, 10, 0)

    // controls
    controls = new OrbitControls (camera, renderer.domElement)

    controls.screenSpacePanning = true
    controls.minDistance = 0.1
    controls.enableKeys = false
    controls.enableZoom = true 
    controls.enablePan = true
    controls.maxDistance = 300
    controls.minPolarAngle = Math.PI/5
    controls.maxPolarAngle = Math.PI/2.2

    // world
    var axes = new THREE.AxisHelper(50);
    scene.add(axes);

    var gridXZ = new THREE.GridHelper(100, 10);
    gridXZ.setColors(new THREE.Color(0x006600), new THREE.Color(0x006600));
    scene.add(gridXZ);

    var gridXY = new THREE.GridHelper(100, 10);
    gridXY.rotation.x = Math.PI / 2;
    gridXY.setColors(new THREE.Color(0x000066), new THREE.Color(0x000066));
    scene.add(gridXY);

    var gridYZ = new THREE.GridHelper(100, 10);
    gridYZ.rotation.z = Math.PI / 2;
    gridYZ.setColors(new THREE.Color(0x660000), new THREE.Color(0x660000));
    scene.add(gridYZ);

    const light = new THREE.HemisphereLight();
    scene.add( light );

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];
    for (const vertex of positions) {
      vertices.push(...vertex.map(v => v * 10.0));
      colors.push(...[0.5, 0.0, 1.0]);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute( colors, 3 ) );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    console.warn('geo', geometry);

    const material = new THREE.MeshPhongMaterial({
        color: 0xdd00ff,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
    });
    const mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh )

    const geo = new THREE.EdgesGeometry(mesh.geometry);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const wireframe = new THREE.LineSegments(geo, mat);
    mesh.add(wireframe);
  }

  function animate() {
    if (!running) {
      return;
    }

    requestAnimationFrame( animate )
    controls.update()
    renderer.render( scene, camera )
  }

  return () => {
    running = false;
  }
}