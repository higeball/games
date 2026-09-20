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

    // 高難度ステージ（Stage 3, 4, 5）の保護シールド核（パイロン）
    this.hasPylons = (this.stageId >= 3);
    this.pylons = [];
    this.isStunned = false;
    this.stunTimer = 0;

    this.group = new THREE.Group();
    this.group.position.set(0, 0, this.z);

    this.buildBossModel();
    if (this.hasPylons) {
      this.buildPylons();
    }
    this.buildBossHpBar();
    this.scene.add(this.group);
  }

  buildBossModel() {
    this.bossMesh = new THREE.Group();
    this.bossMesh.position.y = 3.0;

    // 保護シールド球体（パイロン健在時、青く発光して本体を無敵化）
    const shieldGeo = new THREE.SphereGeometry(3.6, 24, 20);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: this.hasPylons ? 0.45 : 0,
      wireframe: true
    });
    this.bossShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.bossShieldMesh.visible = this.hasPylons;
    this.bossMesh.add(this.bossShieldMesh);

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

  buildPylons() {
    const pylonGeo = new THREE.OctahedronGeometry(0.85);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00b0ff,
      emissiveIntensity: 0.9,
      roughness: 0.15
    });

    const pylonHp = Math.round(this.maxHp * 0.18);
    const offsets = [-3.5, 3.5];
    offsets.forEach((xOffset) => {
      const mesh = new THREE.Mesh(pylonGeo, pylonMat);
      mesh.position.set(xOffset, 0.4, 0);
      mesh.castShadow = true;
      this.group.add(mesh);

      this.pylons.push({
        mesh,
        x: xOffset,
        hp: pylonHp,
        maxHp: pylonHp,
        alive: true
      });
    });
  }

  isShieldActive() {
    return this.hasPylons && this.pylons.some(p => p.alive);
  }

  takePylonDamage(idx, amount) {
    const p = this.pylons[idx];
    if (!p || !p.alive) return false;
    p.hp -= amount;
    p.mesh.scale.set(1.25, 1.25, 1.25);
    setTimeout(() => { if (p.mesh) p.mesh.scale.set(1, 1, 1); }, 60);

    if (p.hp <= 0) {
      p.alive = false;
      p.mesh.visible = false;
      if (!this.isShieldActive()) {
        if (this.bossShieldMesh) this.bossShieldMesh.visible = false;
        this.isStunned = true;
        this.stunTimer = 4.5; // スタン＆大ダメージチャンス！
      }
      return true;
    }
    return false;
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
    ctx.strokeStyle = this.isShieldActive() ? '#00e5ff' : (this.isStunned ? '#ffd700' : '#ff1744');
    ctx.roundRect(4, 4, 504, 64, 18);
    ctx.stroke();

    // HPバー
    const ratio = Math.max(0, this.hp / this.maxHp);
    const grad = ctx.createLinearGradient(12, 0, 500, 0);
    if (this.isShieldActive()) {
      grad.addColorStop(0, '#00b0ff');
      grad.addColorStop(1, '#00e5ff');
    } else if (this.isStunned) {
      grad.addColorStop(0, '#ffd700');
      grad.addColorStop(1, '#ff9100');
    } else {
      grad.addColorStop(0, '#ff1744');
      grad.addColorStop(1, '#ff9100');
    }
    ctx.fillStyle = grad;
    ctx.roundRect(10, 10, 492 * ratio, 52, 14);
    ctx.fill();

    // ボス名とHP数値
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    const statusPrefix = this.isShieldActive() ? '🛡️シールド展開中 ' : (this.isStunned ? '⚡スタン中(1.5x) ' : '');
    ctx.fillText(`${statusPrefix}${this.name}: ${this.hp} / ${this.maxHp}`, 256, 36);

    this.hpTexture.needsUpdate = true;
  }

  takeDamage(amount) {
    if (!this.alive) return false;

    // シールド核（パイロン）健在時は本体無敵！
    if (this.isShieldActive()) {
      if (this.bossShieldMesh) {
        this.bossShieldMesh.scale.set(1.1, 1.1, 1.1);
        setTimeout(() => { if (this.bossShieldMesh) this.bossShieldMesh.scale.set(1, 1, 1); }, 50);
      }
      return 'shielded';
    }

    const finalAmount = this.isStunned ? Math.round(amount * 1.5) : amount;
    this.hp = Math.max(0, this.hp - finalAmount);
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
        // ボス正面から放射状に3発の攻撃弾を発射（プレイヤーの射撃高度に合わせる）
        const centerPos = this.group.position.clone();
        centerPos.y = 1.0;
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

    // パイロン（シールド核）のアニメーション（撃ちやすい高度に保つ）
    if (this.hasPylons) {
      this.pylons.forEach((p, idx) => {
        if (p.alive) {
          p.mesh.rotation.y += delta * 3.0;
          p.mesh.rotation.z += delta * 1.5;
          p.mesh.position.y = 0.4 + Math.sin(this.animTime * 3.0 + idx * Math.PI) * 0.3;
        }
      });
    }

    // スタンタイマーの減衰
    if (this.isStunned) {
      this.stunTimer -= delta;
      if (this.stunTimer <= 0) {
        this.isStunned = false;
        this.updateHpBar();
      }
    }

    // シールド球体のアニメーション
    if (this.isShieldActive() && this.bossShieldMesh) {
      this.bossShieldMesh.rotation.y += delta * 1.8;
      this.bossShieldMesh.material.opacity = 0.38 + Math.sin(this.animTime * 4.5) * 0.15;
    }

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
