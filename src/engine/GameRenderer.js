import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    // 背景色とフォグ（サイバーブルー〜ディープナイトのグラデーション）
    this.scene.background = new THREE.Color(0x0b132b);
    this.scene.fog = new THREE.FogExp2(0x0b132b, 0.015);

    // カメラ
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.1, 400);
    this.camera.position.set(
      CONFIG.CAMERA_OFFSET.x,
      CONFIG.CAMERA_OFFSET.y,
      CONFIG.CAMERA_OFFSET.z
    );

    // レンダラー（高DPI対応、シャドウマップ有効）
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // シェイクオフセット
    this.shakeOffset = new THREE.Vector3();

    this.setupLights();
    this.setupEnvironment();
    this.setupResize();
  }

  setupLights() {
    // 環境光
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    // 半球光（空色と地面の反射）
    const hemiLight = new THREE.HemisphereLight(0x70d6ff, 0x1d2d44, 0.6);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // メイン太陽光（シャドウキャスト）
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(15, 30, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 120;
    const d = 16;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
  }

  setupEnvironment() {
    // トラック・道路（スタイリッシュなネオンサイバーロード）
    const trackWidth = CONFIG.TRACK_WIDTH;
    const trackLength = Math.abs(CONFIG.FINISH_Z) + 120;

    // メインロード（アスファルト調ダークブルー）
    const roadGeo = new THREE.PlaneGeometry(trackWidth, trackLength, 1, 60);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x141f36,
      roughness: 0.35,
      metalness: 0.15
    });
    this.road = new THREE.Mesh(roadGeo, roadMat);
    this.road.rotation.x = -Math.PI / 2;
    this.road.position.set(0, -0.01, -trackLength / 2 + 20);
    this.road.receiveShadow = true;
    this.scene.add(this.road);

    // レーンガイド（グリッド・ストライプライン）
    const gridGeo = new THREE.PlaneGeometry(trackWidth, trackLength, 4, 80);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.set(0, 0.01, -trackLength / 2 + 20);
    this.scene.add(gridMesh);

    // サイドネオンレール（左右の光るフェンス）
    const railGeo = new THREE.BoxGeometry(0.2, 0.6, trackLength);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00c3ff,
      emissiveIntensity: 0.8
    });

    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-trackWidth / 2 - 0.1, 0.3, -trackLength / 2 + 20);
    this.scene.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(trackWidth / 2 + 0.1, 0.3, -trackLength / 2 + 20);
    this.scene.add(rightRail);

    // 遠景の浮遊ピラー・ビルディング（奥スクロールのスピード感・巨大感を演出）
    const pillarGeo = new THREE.BoxGeometry(3, 25, 3);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1c2541,
      roughness: 0.7
    });

    for (let i = 0; i < 30; i++) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      const side = (i % 2 === 0) ? -1 : 1;
      const x = side * (CONFIG.TRACK_WIDTH / 2 + 6 + Math.random() * 8);
      const z = - (i * 18);
      p.position.set(x, 10 + Math.random() * 5, z);
      this.scene.add(p);
    }
  }

  setupResize() {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;

      // スマホ縦画面（縦長）の場合、視界を少し広げてレーン全体が収まるよう調整
      if (this.camera.aspect < 1.0) {
        this.camera.fov = 68;
      } else {
        this.camera.fov = 55;
      }

      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  updateCamera(targetPos, delta) {
    // プレイヤーにスムーズに追従
    const desiredPos = new THREE.Vector3(
      targetPos.x * 0.3 + CONFIG.CAMERA_OFFSET.x,
      targetPos.y + CONFIG.CAMERA_OFFSET.y,
      targetPos.z + CONFIG.CAMERA_OFFSET.z
    ).add(this.shakeOffset);

    this.camera.position.lerp(desiredPos, delta * 12.0);

    const lookTarget = new THREE.Vector3(
      targetPos.x * 0.4 + CONFIG.CAMERA_LOOK_AT.x,
      targetPos.y + CONFIG.CAMERA_LOOK_AT.y,
      targetPos.z + CONFIG.CAMERA_LOOK_AT.z
    );
    this.camera.lookAt(lookTarget);

    // シャドウ用ディレクショナルライトもプレイヤーに追従
    this.dirLight.position.x = targetPos.x + 15;
    this.dirLight.position.z = targetPos.z + 20;
    this.dirLight.target.position.set(targetPos.x, targetPos.y, targetPos.z);
    this.dirLight.target.updateMatrixWorld();

    // シェイクの減衰
    this.shakeOffset.multiplyScalar(0.85);
  }

  addScreenShake(intensity = 0.35) {
    this.shakeOffset.set(
      (Math.random() - 0.5) * intensity,
      (Math.random() - 0.5) * intensity * 0.7,
      (Math.random() - 0.5) * intensity * 0.5
    );
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
