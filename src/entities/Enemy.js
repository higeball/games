import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Enemy {
  constructor(scene, options) {
    this.scene = scene;
    this.type = options.type || 'bug'; // 'bug', 'barrel', 'spike'
    this.x = options.x || 0;
    this.z = options.z || -60;
    this.maxHp = options.hp || 30;
    this.hp = this.maxHp;
    this.speed = options.speed || 3.0; // プレイヤーに向かって前進する速度

    this.alive = true;
    this.group = new THREE.Group();
    this.group.position.set(this.x, 0.8, this.z);

    this.buildMesh();
    this.buildHpBar();
    this.scene.add(this.group);
  }

  buildMesh() {
    if (this.type === 'barrel') {
      // 爆発ドラム缶
      const geo = new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xd32f2f,
        roughness: 0.4,
        metalness: 0.3
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.castShadow = true;
      this.group.add(this.mesh);
    } else {
      // サイバーバグ / トゲモンスター（紫〜赤の怪獣）
      this.mesh = new THREE.Group();

      const bodyGeo = new THREE.DodecahedronGeometry(0.65);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x8e24aa,
        emissive: 0x4a148c,
        emissiveIntensity: 0.4,
        roughness: 0.3
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      this.mesh.add(body);

      // 赤いトゲトゲ
      const spikeGeo = new THREE.ConeGeometry(0.18, 0.5, 5);
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0xff1744 });
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.5, 0.2, Math.sin(angle) * 0.5);
        spike.rotation.z = -Math.PI / 2 + angle;
        this.mesh.add(spike);
      }

      this.group.add(this.mesh);
    }
  }

  buildHpBar() {
    // 頭上のHPバー（スプライト）
    this.hpCanvas = document.createElement('canvas');
    this.hpCanvas.width = 128;
    this.hpCanvas.height = 24;
    this.hpCtx = this.hpCanvas.getContext('2d');
    this.hpTexture = new THREE.CanvasTexture(this.hpCanvas);

    const spriteMat = new THREE.SpriteMaterial({ map: this.hpTexture });
    this.hpSprite = new THREE.Sprite(spriteMat);
    this.hpSprite.position.set(0, 1.3, 0);
    this.hpSprite.scale.set(1.4, 0.25, 1);
    this.group.add(this.hpSprite);

    this.updateHpBar();
  }

  updateHpBar() {
    const ctx = this.hpCtx;
    ctx.clearRect(0, 0, 128, 24);

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 128, 24);

    // HP量
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = ratio > 0.4 ? '#ff5252' : '#d50000';
    ctx.fillRect(3, 3, (128 - 6) * ratio, 18);

    // 数値テキスト
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.hp}`, 64, 12);

    this.hpTexture.needsUpdate = true;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.updateHpBar();

    // 被弾フラッシュ
    if (this.mesh) {
      this.mesh.position.y += 0.05;
      setTimeout(() => { if (this.mesh) this.mesh.position.y -= 0.05; }, 50);
    }

    if (this.hp <= 0) {
      this.alive = false;
      return true; // 撃破
    }
    return false;
  }

  update(delta) {
    if (!this.alive) return;

    // 手前（+Z方向、プレイヤーへ向かって進行）
    this.group.position.z += this.speed * delta;

    if (this.type !== 'barrel' && this.mesh) {
      this.mesh.rotation.y += delta * 3.0;
      this.mesh.rotation.x += delta * 1.5;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.hpTexture) this.hpTexture.dispose();
  }
}
