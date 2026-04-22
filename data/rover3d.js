/**
 * ROVER 3D MODEL - Basado en referencia CAD
 * Construye el modelo 3D del smart robot car con Three.js
 */
function buildRoverModel(THREE) {
    const roverGroup = new THREE.Group();

    // Materiales
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.7, roughness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.85, roughness: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.6, roughness: 0.5 });
    const motorMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.4, roughness: 0.5 });
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0d6b3e, metalness: 0.3, roughness: 0.6 });
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x1a252f, metalness: 0.5, roughness: 0.5 });
    const spacerMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.9, roughness: 0.1 });

    // === PLATAFORMA INFERIOR ===
    var bp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 3.2), plateMat);
    bp.position.y = 0.45; roverGroup.add(bp);

    [[-0.9,1.2],[0.9,1.2],[-0.9,-1.2],[0.9,-1.2]].forEach(function(p){
        var h = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.12,8), holeMat);
        h.position.set(p[0],0.45,p[1]); roverGroup.add(h);
    });

    // === SEPARADORES ===
    [[-0.85,1.1],[0.85,1.1],[-0.85,-1.1],[0.85,-1.1]].forEach(function(p){
        var s = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.6,6), spacerMat);
        s.position.set(p[0],0.8,p[1]); roverGroup.add(s);
    });

    // === PLATAFORMA SUPERIOR ===
    var tp = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.08,3.0), plateMat);
    tp.position.y = 1.12; roverGroup.add(tp);

    // === RUEDAS + MOTORES DC ===
    var tGeo = new THREE.CylinderGeometry(0.42,0.42,0.3,24);
    var tMat = new THREE.MeshStandardMaterial({color:0x111111,metalness:0.2,roughness:0.95});
    var rGeo = new THREE.CylinderGeometry(0.25,0.25,0.32,12);
    var rMat = new THREE.MeshStandardMaterial({color:0xf0f0f0,metalness:0.8,roughness:0.2});
    var trGeo = new THREE.CylinderGeometry(0.43,0.43,0.04,24);
    var trMat = new THREE.MeshStandardMaterial({color:0x222222,metalness:0.3,roughness:0.8});

    var wPos = [{x:-1.35,z:1.0},{x:1.35,z:1.0},{x:-1.35,z:-1.0},{x:1.35,z:-1.0}];
    var wheels = [];
    wPos.forEach(function(pos){
        var wg = new THREE.Group();
        var tire = new THREE.Mesh(tGeo, tMat); tire.rotation.z = Math.PI/2; wg.add(tire);
        for(var t=0;t<8;t++){
            var td = new THREE.Mesh(trGeo, trMat); td.rotation.z=Math.PI/2; td.position.x=-0.13+t*0.037; wg.add(td);
        }
        var rim = new THREE.Mesh(rGeo, rMat); rim.rotation.z=Math.PI/2; wg.add(rim);
        wg.position.set(pos.x, 0.42, pos.z);
        roverGroup.add(wg); wheels.push(wg);

        // Motor DC amarillo
        var mot = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.3,0.5), motorMat);
        mot.position.set(pos.x*0.72, 0.42, pos.z); roverGroup.add(mot);
        // Eje
        var ax = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.5,8), metalMat);
        ax.rotation.z=Math.PI/2; ax.position.set(pos.x*0.9, 0.42, pos.z); roverGroup.add(ax);
    });

    // === SENSOR ULTRASÓNICO HC-SR04 ===
    var svMat = new THREE.MeshStandardMaterial({color:0x2c3e80,metalness:0.5,roughness:0.4});
    var sv = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.25,0.25), svMat);
    sv.position.set(0,1.25,1.35); roverGroup.add(sv);

    var sArm = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.35,0.06), metalMat);
    sArm.position.set(0,1.5,1.35); roverGroup.add(sArm);

    var hcB = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.35,0.1), pcbMat);
    hcB.position.set(0,1.65,1.5); roverGroup.add(hcB);

    // Ojos ultrasonido
    var eMat = new THREE.MeshStandardMaterial({color:0xc0c0c0,metalness:0.95,roughness:0.05});
    [-0.2,0.2].forEach(function(x){
        var e = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.12,16), eMat);
        e.rotation.x=Math.PI/2; e.position.set(x,1.65,1.57); roverGroup.add(e);
    });

    // === ESP32-CAM (torre vertical) ===
    var cPole = new THREE.Mesh(new THREE.BoxGeometry(0.12,1.4,0.12), metalMat);
    cPole.position.set(0.6,1.85,-0.2); roverGroup.add(cPole);

    var cBody = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.45,0.25), darkMat);
    cBody.position.set(0.6,2.75,-0.2); roverGroup.add(cBody);

    var lensMat = new THREE.MeshStandardMaterial({
        color:0x1a1a3e, metalness:0.9, roughness:0.0, emissive:0x38bdf8, emissiveIntensity:0.4
    });
    var lns = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,0.1,16), lensMat);
    lns.rotation.x=Math.PI/2; lns.position.set(0.6,2.75,-0.06); roverGroup.add(lns);

    var cLed = new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8),
        new THREE.MeshStandardMaterial({color:0xef4444,emissive:0xef4444,emissiveIntensity:1.0}));
    cLed.position.set(0.6,3.0,-0.2); roverGroup.add(cLed);

    // === PLACA ESP32 ===
    var espB = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.08,1.0), pcbMat);
    espB.position.set(-0.2,1.2,0); roverGroup.add(espB);

    var chipM = new THREE.MeshStandardMaterial({color:0x111111,metalness:0.8,roughness:0.2});
    var chp = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.06,0.25), chipM);
    chp.position.set(-0.2,1.26,0); roverGroup.add(chp);

    var pnMat = new THREE.MeshStandardMaterial({color:0xd4af37,metalness:0.95,roughness:0.1});
    for(var p=-0.4;p<=0.4;p+=0.08){
        [-0.45,0.45].forEach(function(sd){
            var pn = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.1,0.03), pnMat);
            pn.position.set(-0.2+sd*0.72,1.2,p); roverGroup.add(pn);
        });
    }

    // === CABLES ===
    var c1 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.2,1.25,0.5), new THREE.Vector3(-0.1,1.4,0.8),
            new THREE.Vector3(0,1.3,1.2), new THREE.Vector3(0,1.25,1.35)
        ]).getPoints(20)),
        new THREE.LineBasicMaterial({color:0xe74c3c})
    ); roverGroup.add(c1);

    var c2 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.2,1.25,-0.3), new THREE.Vector3(0.2,1.5,-0.25),
            new THREE.Vector3(0.5,1.6,-0.2), new THREE.Vector3(0.6,1.85,-0.2)
        ]).getPoints(20)),
        new THREE.LineBasicMaterial({color:0x3498db})
    ); roverGroup.add(c2);

    // === BATERÍA ===
    var batt = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.35,0.6),
        new THREE.MeshStandardMaterial({color:0x2d3436,metalness:0.5,roughness:0.4}));
    batt.position.set(0,1.3,-1.1); roverGroup.add(batt);

    var bLbl = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.15,0.02),
        new THREE.MeshStandardMaterial({color:0xf39c12,metalness:0.3,roughness:0.5,emissive:0xf39c12,emissiveIntensity:0.15}));
    bLbl.position.set(0,1.35,-1.41); roverGroup.add(bLbl);

    var bLed = new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8),
        new THREE.MeshStandardMaterial({color:0x2ecc71,emissive:0x2ecc71,emissiveIntensity:1.0}));
    bLed.position.set(0.35,1.5,-1.1); roverGroup.add(bLed);

    // === ANTENA ===
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.02,0.6,6),
        new THREE.MeshStandardMaterial({color:0x95a5a6,metalness:0.8,roughness:0.2}));
    ant.position.set(-0.5,1.5,0.3); roverGroup.add(ant);

    var antBallMat = new THREE.MeshStandardMaterial({color:0xef4444,emissive:0xef4444,emissiveIntensity:0.8});
    var antBall = new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8), antBallMat);
    antBall.position.set(-0.5,1.82,0.3); roverGroup.add(antBall);

    // === FLECHA DIRECCIÓN ===
    var arr = new THREE.Mesh(new THREE.ConeGeometry(0.12,0.3,4),
        new THREE.MeshStandardMaterial({color:0x10b981,emissive:0x10b981,emissiveIntensity:0.8}));
    arr.rotation.x=Math.PI/2; arr.position.set(0,1.8,1.55); roverGroup.add(arr);

    // === FAROS ===
    var hlMat = new THREE.MeshStandardMaterial({color:0x38bdf8,emissive:0x38bdf8,emissiveIntensity:1.2,transparent:true,opacity:0.9});
    [-0.3,0.3].forEach(function(x){
        var hl = new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8), hlMat);
        hl.position.set(x,1.8,1.5); roverGroup.add(hl);
    });

    // LED estado
    var ledMat = new THREE.MeshStandardMaterial({color:0x38bdf8,emissive:0x38bdf8,emissiveIntensity:1.0,transparent:true,opacity:0.9});

    return { roverGroup: roverGroup, wheels: wheels, antBallMat: antBallMat, ledMat: ledMat, headlightMat: hlMat, lensMat: lensMat };
}
