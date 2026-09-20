import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class BulletManager {
  constructor(scene) {
    this.scene = scene;
    this.maxBullets = 200;
    this.bullets = [];

    this.initPool();
  }

  initPool() {
    // もじさん用レーザーメッシュ
    const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9
    });

    // ゲイリー用スライム弾メッシュ（大きくぷるぷる光るスライムボール）
    const slimeGeo = new THREE.SphereGeometry(0.28, 12, 10);
    slimeGeo.scale(1.1, 0.9, 1.2);
    const slimeMat = new THREE.MeshBasicMaterial({
      color: 0x64ff24,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < this.maxBullets; i++) {
      const isLaser = (i % 4 === 0);
      const mesh = new THREE.Mesh(isLaser ? laserGeo : slimeGeo, isLaser ? laserMat : slimeMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.bullets.push({
        mesh,
        active: false,
        isLaser,
        damage: isLaser ? CONFIG.MOJI.BULLET_DAMAGE : CONFIG.GARY.BULLET_DAMAGE,
        speed: isLaser ? CONFIG.MOJI.BULLET_SPEED : CONFIG.GARY.BULLET_SPEED,
        pos: new THREE.Vector3(),
        life: 0
      });
    }
  }

  spawnBullet(originPos, isLaser = false) {
    const bullet = this.bullets.find(b => !b.active && b.isLaser === isLaser);
    if (!bullet) return;

    bullet.active = true;
    bullet.mesh.visible = true;
    bullet.pos.copy(originPos);
    bullet.mesh.position.copy(bullet.pos);
    bullet.life = 1.2; // 射程寿命
  }

  update(delta) {
    for (let i = 0; i < this.maxBullets; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;

      // 前方（-Z）へ飛行
      b.pos.z -= b.speed * delta;
      b.mesh.position.copy(b.pos);
      b.life -= delta;

      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  getActiveBullets() {
    return this.bullets.filter(b => b.active);
  }

  reset() {
    for (let i = 0; i < this.maxBullets; i++) {
      this.bullets[i].active = false;
      this.bullets[i].mesh.visible = false;
    }
  }
}
