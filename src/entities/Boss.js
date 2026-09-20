import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Boss {
  constructor(scene, options) {
    this.scene = scene;
    this.z = options.z || CONFIG.FINISH_Z;
    this.maxHp = options.hp || 800;
    this.hp = this.maxHp;
    this.alive = true;
    this.defeated = false;
    this.animTime = 0;

    this.group = new THREE.Group();
    this.group.position.set(0, 0, this.z);

    this.buildBossModel();
    this.buildBossHpBar();
    this.scene.add(this.group);
  }

  buildBossModel() {
    this.bossMesh = new THREE.Group();
    this.bossMesh.position.y = 2.8;

    // 巨大な中央コア（邪悪なダーククリスタル）
    const coreGeo = new THREE.OctahedronGeometry(2.2, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x9c27b0,
      emissive: 0xd500f9,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.6
    });
    this.core = new THREE.Mesh(coreGeo, coreMat);
    this.core.castShadow = true;
    this.bossMesh.add(this.core);

    // 外装アーマープレート（メカニカルシールド）
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x263238,
      roughness: 0.4,
      metalness: 0.8
    });

    this.arms = [];
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      const plateGeo = new THREE.BoxGeometry(0.8, 2.5, 0.4);
      const plate = new THREE.Mesh(plateGeo, armorMat);
      plate.position.y = 1.2;
      plate.castShadow = true;
      arm.add(plate);

      const angle = (i / 4) * Math.PI * 2;
      arm.position.set(Math.cos(angle) * 2.6, 0, Math.sin(angle) * 2.6);
      arm.rotation.y = angle;
      this.bossMesh.add(arm);
      this.arms.push(arm);
    }

    // 邪悪な目（正面）
    const eyeGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 0.4, 1.8);
    this.bossMesh.add(eye);

    // ボスの足元の威嚇オーラリング
    const ringGeo = new THREE.RingGeometry(2.5, 3.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    this.auraRing = new THREE.Mesh(ringGeo, ringMat);
    this.auraRing.rotation.x = -Math.PI / 2;
    this.auraRing.position.y = 0.05;
    this.group.add(this.auraRing);

    this.group.add(this.bossMesh);
  }

  buildBossHpBar() {
    this.hpCanvas = document.createElement('canvas');
    this.hpCanvas.width = 512;
    this.hpCanvas.height = 64;
    this.hpCtx = this.hpCanvas.getContext('2d');
    this.hpTexture = new THREE.CanvasTexture(this.hpCanvas);

    const spriteMat = new THREE.SpriteMaterial({ map: this.hpTexture });
    this.hpSprite = new THREE.Sprite(spriteMat);
    this.hpSprite.position.set(0, 6.2, 0);
    this.hpSprite.scale.set(7.0, 0.9, 1);
    this.group.add(this.hpSprite);

    this.updateHpBar();
  }

  updateHpBar() {
    const ctx = this.hpCtx;
    ctx.clearRect(0, 0, 512, 64);

    // 外枠と背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.roundRect(4, 4, 504, 56, 16);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ff1744';
    ctx.roundRect(4, 4, 504, 56, 16);
    ctx.stroke();

    // HPバー
    const ratio = Math.max(0, this.hp / this.maxHp);
    const grad = ctx.createLinearGradient(12, 0, 500, 0);
    grad.addColorStop(0, '#ff1744');
    grad.addColorStop(1, '#ff9100');
    ctx.fillStyle = grad;
    ctx.roundRect(10, 10, 492 * ratio, 44, 12);
    ctx.fill();

    // テキスト
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(`BOSS HP: ${this.hp} / ${this.maxHp}`, 256, 32);

    this.hpTexture.needsUpdate = true;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();

    // 被弾時のフラッシュと揺れ
    this.core.scale.set(1.15, 1.15, 1.15);

    if (this.hp <= 0) {
      this.alive = false;
      this.defeated = true;
      return true;
    }
    return false;
  }

  update(delta) {
    if (!this.alive) {
      if (this.defeated && this.bossMesh) {
        // 撃破後の崩壊アニメーション
        this.bossMesh.position.y -= delta * 3.0;
        this.bossMesh.scale.multiplyScalar(0.95);
        if (this.hpSprite) this.hpSprite.visible = false;
      }
      return;
    }

    this.animTime += delta;

    // コアの浮遊と回転
    this.core.rotation.y += delta * 1.5;
    this.core.rotation.x += delta * 0.8;
    this.bossMesh.position.y = 2.8 + Math.sin(this.animTime * 3) * 0.35;

    // アームの羽ばたき/ガードモーション
    this.arms.forEach((arm, i) => {
      arm.rotation.z = Math.sin(this.animTime * 2.5 + i) * 0.2;
    });

    // オーラリングの回転
    this.auraRing.rotation.z += delta * 2.0;

    // コアスケール復帰
    if (this.core.scale.x > 1.0) {
      this.core.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 15);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.hpTexture) this.hpTexture.dispose();
  }
}
