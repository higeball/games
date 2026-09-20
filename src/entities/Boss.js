import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Boss {
  constructor(scene, options) {
    this.scene = scene;
    this.z = options.z || CONFIG.FINISH_Z;
    this.name = options.name || "アイアン・ガーディアン";
    this.maxHp = options.hp || 800;
    this.hp = this.maxHp;
    this.color = options.color || 0xd500f9;
    this.stageId = options.stageId || 1;

    this.alive = true;
    this.defeated = false;
    this.animTime = 0;
    this.attackTimer = 0;
    this.attackInterval = 2.4;

    this.group = new THREE.Group();
    this.group.position.set(0, 0, this.z);

    this.buildBossModel();
    this.buildBossHpBar();
    this.scene.add(this.group);
  }

  buildBossModel() {
    this.bossMesh = new THREE.Group();
    this.bossMesh.position.y = 3.0;

    // 中央巨大コア
    const coreGeo = (this.stageId === 5 ? new THREE.DodecahedronGeometry(2.6) : (this.stageId === 2 ? new THREE.IcosahedronGeometry(2.3) : new THREE.OctahedronGeometry(2.2, 1)));
    const coreMat = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.6
    });
    this.core = new THREE.Mesh(coreGeo, coreMat);
    this.core.castShadow = true;
    this.bossMesh.add(this.core);

    // 外装アーマー
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x212121,
      roughness: 0.3,
      metalness: 0.85
    });

    this.arms = [];
    const armCount = (this.stageId === 5 ? 6 : (this.stageId === 2 ? 6 : 4));
    for (let i = 0; i < armCount; i++) {
      const arm = new THREE.Group();
      const plateGeo = new THREE.BoxGeometry(0.8, 2.8, 0.45);
      const plate = new THREE.Mesh(plateGeo, armorMat);
      plate.position.y = 1.3;
      plate.castShadow = true;
      arm.add(plate);

      // 角/トゲ
      const spikeGeo = new THREE.ConeGeometry(0.22, 0.9, 5);
      const spikeMat = new THREE.MeshStandardMaterial({ color: this.color });
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(0, 2.8, 0);
      arm.add(spike);

      const angle = (i / armCount) * Math.PI * 2;
      arm.position.set(Math.cos(angle) * 3.0, 0, Math.sin(angle) * 3.0);
      arm.rotation.y = angle;
      this.bossMesh.add(arm);
      this.arms.push(arm);
    }

    // 邪悪な目（正面）
    const eyeGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 0.5, 2.0);
    this.bossMesh.add(eye);

    // オーラリング
    const ringGeo = new THREE.RingGeometry(2.8, 3.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
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
    this.hpCanvas.height = 72;
    this.hpCtx = this.hpCanvas.getContext('2d');
    this.hpTexture = new THREE.CanvasTexture(this.hpCanvas);

    const spriteMat = new THREE.SpriteMaterial({ map: this.hpTexture });
    this.hpSprite = new THREE.Sprite(spriteMat);
    this.hpSprite.position.set(0, 6.6, 0);
    this.hpSprite.scale.set(7.5, 1.05, 1);
    this.group.add(this.hpSprite);

    this.updateHpBar();
  }

  updateHpBar() {
    const ctx = this.hpCtx;
    ctx.clearRect(0, 0, 512, 72);

    // 外枠と背景
    ctx.fillStyle = 'rgba(10, 15, 30, 0.9)';
    ctx.roundRect(4, 4, 504, 64, 18);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ff1744';
    ctx.roundRect(4, 4, 504, 64, 18);
    ctx.stroke();

    // HPバー
    const ratio = Math.max(0, this.hp / this.maxHp);
    const grad = ctx.createLinearGradient(12, 0, 500, 0);
    grad.addColorStop(0, '#ff1744');
    grad.addColorStop(1, '#ff9100');
    ctx.fillStyle = grad;
    ctx.roundRect(10, 10, 492 * ratio, 52, 14);
    ctx.fill();

    // ボス名とHP数値
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(`${this.name}: ${this.hp} / ${this.maxHp}`, 256, 36);

    this.hpTexture.needsUpdate = true;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();

    // 被弾フラッシュ
    this.core.scale.set(1.15, 1.15, 1.15);

    if (this.hp <= 0) {
      this.alive = false;
      this.defeated = true;
      return true;
    }
    return false;
  }

  update(delta, onAttackCallback) {
    if (!this.alive) {
      if (this.defeated && this.bossMesh) {
        this.bossMesh.position.y -= delta * 3.5;
        this.bossMesh.scale.multiplyScalar(0.94);
        if (this.hpSprite) this.hpSprite.visible = false;
      }
      return;
    }

    this.animTime += delta;
    this.attackTimer += delta;

    // 定期的な攻撃弾発射
    if (this.attackTimer >= this.attackInterval) {
      this.attackTimer = 0;
      if (onAttackCallback) {
        // ボス正面から放射状に3発の攻撃弾を発射
        const centerPos = this.group.position.clone();
        centerPos.y += 2.0;
        onAttackCallback(centerPos);
      }
    }

    // コアの浮遊と回転
    this.core.rotation.y += delta * 1.8;
    this.core.rotation.x += delta * 0.9;
    this.bossMesh.position.y = 3.0 + Math.sin(this.animTime * 3) * 0.4;

    // アームの羽ばたき
    this.arms.forEach((arm, i) => {
      arm.rotation.z = Math.sin(this.animTime * 2.8 + i) * 0.25;
    });

    // オーラリングの回転
    this.auraRing.rotation.z += delta * 2.5;

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
