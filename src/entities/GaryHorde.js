import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class GaryHorde {
  constructor(scene) {
    this.scene = scene;
    this.count = CONFIG.GARY.INITIAL_COUNT;
    this.maxCount = CONFIG.GARY.MAX_COUNT;

    this.positions = [];     // 各ゲイリーの現在位置 (Vector3)
    this.targetOffsets = []; // もじさんからの相対配置目標 (Vector3)
    this.phaseOffsets = [];  // バウンス用の位相差

    this.fireTimer = 0;
    this.bounceTime = 0;

    this.dummy = new THREE.Object3D();
    this.initInstancedMesh();
    this.rebuildFormation();
  }

  createGaryTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // 下地：半透明ライムグリーン
    ctx.fillStyle = '#76ff03';
    ctx.fillRect(0, 0, 256, 256);

    // つぶらな黒目（左右）
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(88, 120, 16, 0, Math.PI * 2);
    ctx.arc(168, 120, 16, 0, Math.PI * 2);
    ctx.fill();

    // 目のハイライト（白）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(84, 114, 6, 0, Math.PI * 2);
    ctx.arc(164, 114, 6, 0, Math.PI * 2);
    ctx.fill();

    // 笑顔のお口（逆三角〜にっこり）
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.arc(128, 150, 16, 0, Math.PI, false);
    ctx.fill();

    // ピンクのほっぺ
    ctx.fillStyle = 'rgba(255, 64, 129, 0.45)';
    ctx.beginPath();
    ctx.arc(65, 142, 14, 0, Math.PI * 2);
    ctx.arc(191, 142, 14, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  initInstancedMesh() {
    // スライムの球体ジオメトリ（上が丸く下は平たいスライム形状）
    const baseGeo = new THREE.SphereGeometry(CONFIG.GARY.BASE_RADIUS, 16, 14);
    baseGeo.scale(1.15, 0.75, 1.05); // ぷにっと扁平にする

    const faceTexture = this.createGaryTexture();
    const material = new THREE.MeshStandardMaterial({
      map: faceTexture,
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.1,
      emissive: CONFIG.GARY.COLOR_EMISSIVE,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.95
    });

    this.mesh = new THREE.InstancedMesh(baseGeo, material, this.maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    // 各インスタンスの初期化
    for (let i = 0; i < this.maxCount; i++) {
      this.positions.push(new THREE.Vector3(0, 0, 0));
      this.targetOffsets.push(new THREE.Vector3(0, 0, 0));
      this.phaseOffsets.push(Math.random() * Math.PI * 2);
    }
  }

  rebuildFormation() {
    // ひまわり種状・黄金角スパイラル（Fermat's Spiral）で、もじさんの背後〜周囲に密集
    const goldenAngle = 2.39996;
    const spacing = CONFIG.GARY.FORMATION_SPACING;

    for (let i = 0; i < this.maxCount; i++) {
      if (i < this.count) {
        const radius = spacing * Math.sqrt(i + 1);
        const theta = (i + 1) * goldenAngle;

        // もじさん(0,0,0)の左右および後方(-Zではなく+Z側がカメラ側/後方)
        // もじさんは前(-Z方向)に進むので、+Z方向が後方
        const ox = Math.cos(theta) * radius * 0.95;
        const oz = 0.5 + Math.abs(Math.sin(theta)) * radius * 0.85 + (i * 0.05);

        // トラック幅からはみ出ないよう制限
        const clampedX = Math.max(-CONFIG.TRACK_WIDTH / 2 + 0.6, Math.min(CONFIG.TRACK_WIDTH / 2 - 0.6, ox));
        this.targetOffsets[i].set(clampedX, 0, oz);
      } else {
        this.targetOffsets[i].set(0, -999, 0);
      }
    }
  }

  setCount(newCount) {
    const prevCount = this.count;
    this.count = Math.max(0, Math.min(this.maxCount, newCount));

    // 新しく増えたゲイリーはもじさんの位置から飛び出るように出現
    if (this.count > prevCount && this.positions[0]) {
      for (let i = prevCount; i < this.count; i++) {
        this.positions[i].copy(this.positions[0]);
        this.positions[i].x += (Math.random() - 0.5) * 0.5;
        this.positions[i].y += 0.8 + Math.random() * 0.5;
      }
    }

    this.rebuildFormation();
  }

  addCount(amount) {
    this.setCount(this.count + amount);
  }

  multiplyCount(multiplier) {
    this.setCount(Math.round(this.count * multiplier));
  }

  update(delta, mojiPos, isRunning) {
    this.bounceTime += delta * CONFIG.GARY.BOUNCE_SPEED;
    this.mesh.count = this.count;

    for (let i = 0; i < this.count; i++) {
      const targetPos = this.targetOffsets[i];
      const currentPos = this.positions[i];

      // もじさんへの追従物理（Lerp + 若干のディレイ）
      const desiredX = mojiPos.x + targetPos.x;
      const desiredZ = mojiPos.z + targetPos.z;

      currentPos.x += (desiredX - currentPos.x) * Math.min(1.0, delta * CONFIG.GARY.FOLLOW_LERP);
      currentPos.z += (desiredZ - currentPos.z) * Math.min(1.0, delta * (CONFIG.GARY.FOLLOW_LERP * 1.2));

      // ぷるぷるバウンス & スカッシュ（伸び縮み）
      let bounceY = 0;
      let scaleY = 1.0;
      let scaleXZ = 1.0;

      if (isRunning) {
        const phase = this.bounceTime + this.phaseOffsets[i];
        const sinVal = Math.sin(phase);
        bounceY = Math.max(0, sinVal) * CONFIG.GARY.BOUNCE_HEIGHT;

        // バウンドに合わせてペコッと潰れてビヨーンと伸びる
        if (sinVal > 0) {
          scaleY = 1.0 + sinVal * 0.35;
          scaleXZ = 1.0 - sinVal * 0.18;
        } else {
          scaleY = 1.0 - Math.abs(sinVal) * 0.25;
          scaleXZ = 1.0 + Math.abs(sinVal) * 0.2;
        }
      }

      currentPos.y = bounceY + CONFIG.GARY.BASE_RADIUS * 0.7;

      // 姿勢行列の更新
      this.dummy.position.set(currentPos.x, currentPos.y, currentPos.z);
      this.dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      this.dummy.rotation.y = Math.PI; // 正面（前進方向 -Z）を向く
      this.dummy.updateMatrix();

      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  getFrontPositions(sampleCount = 6) {
    // 弾を発射する前列のゲイリー位置をピックアップ
    const front = [];
    const countToPick = Math.min(this.count, sampleCount);
    for (let i = 0; i < countToPick; i++) {
      front.push(this.positions[i]);
    }
    return front;
  }

  reset() {
    this.count = CONFIG.GARY.INITIAL_COUNT;
    for (let i = 0; i < this.maxCount; i++) {
      this.positions[i].set(0, 0, 0);
    }
    this.rebuildFormation();
  }
}
