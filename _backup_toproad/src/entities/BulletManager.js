import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class BulletManager {
  constructor(scene) {
    this.scene = scene;
    this.maxBullets = 250;
    this.bullets = [];

    // ボスの敵弾プール
    this.maxEnemyBullets = 40;
    this.enemyBullets = [];

    this.initPool();
    this.initEnemyBulletPool();
  }

  initPool() {
    // もじさん通常レーザー
    const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });

    // ゲイリースライム弾
    const slimeGeo = new THREE.SphereGeometry(0.28, 12, 10);
    slimeGeo.scale(1.1, 0.9, 1.2);
    const slimeMat = new THREE.MeshBasicMaterial({ color: 0x64ff24, transparent: true, opacity: 0.95 });

    for (let i = 0; i < this.maxBullets; i++) {
      const isLaser = (i % 4 === 0);
      const mesh = new THREE.Mesh(isLaser ? laserGeo : slimeGeo, isLaser ? laserMat : slimeMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.bullets.push({
        mesh,
        active: false,
        isLaser,
        isMega: false,
        damage: isLaser ? CONFIG.MOJI.BULLET_DAMAGE : CONFIG.GARY.BULLET_DAMAGE,
        speed: isLaser ? CONFIG.MOJI.BULLET_SPEED : CONFIG.GARY.BULLET_SPEED,
        vx: 0,
        pos: new THREE.Vector3(),
        life: 0
      });
    }
  }

  initEnemyBulletPool() {
    const geo = new THREE.SphereGeometry(0.38, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff1744 });

    for (let i = 0; i < this.maxEnemyBullets; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.enemyBullets.push({
        mesh,
        active: false,
        pos: new THREE.Vector3(),
        vx: 0,
        speed: 18.0,
        damage: 15,
        life: 0
      });
    }
  }

  spawnBullet(originPos, isLaser = false, vx = 0, isMega = false) {
    const bullet = this.bullets.find(b => !b.active && b.isLaser === isLaser);
    if (!bullet) return;

    bullet.active = true;
    bullet.mesh.visible = true;
    bullet.isMega = isMega;
    bullet.vx = vx;
    bullet.damage = isMega ? (CONFIG.MOJI.BULLET_DAMAGE * 3) : (isLaser ? CONFIG.MOJI.BULLET_DAMAGE : CONFIG.GARY.BULLET_DAMAGE);
    bullet.speed = isLaser ? CONFIG.MOJI.BULLET_SPEED : CONFIG.GARY.BULLET_SPEED;

    bullet.pos.copy(originPos);
    bullet.mesh.position.copy(bullet.pos);

    if (isMega) {
      bullet.mesh.scale.set(2.4, 2.4, 1.8);
      bullet.mesh.material.color.setHex(0xff5722);
    } else {
      bullet.mesh.scale.set(1, 1, 1);
      bullet.mesh.material.color.setHex(isLaser ? 0x00ffff : 0x64ff24);
    }

    bullet.life = 1.3;
  }

  spawnEnemyBullet(originPos, targetX = 0) {
    const eb = this.enemyBullets.find(b => !b.active);
    if (!eb) return;

    eb.active = true;
    eb.mesh.visible = true;
    eb.pos.copy(originPos);
    eb.mesh.position.copy(eb.pos);
    eb.vx = (targetX - originPos.x) * 0.45;
    eb.life = 3.5;
  }

  update(delta) {
    // プレイヤー弾の更新
    for (let i = 0; i < this.maxBullets; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;

      b.pos.z -= b.speed * delta;
      b.pos.x += b.vx * delta;
      b.mesh.position.copy(b.pos);
      b.life -= delta;

      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
      }
    }

    // ボス敵弾の更新（手前 +Z 方向へ飛ぶ）
    for (let i = 0; i < this.maxEnemyBullets; i++) {
      const eb = this.enemyBullets[i];
      if (!eb.active) continue;

      eb.pos.z += eb.speed * delta;
      eb.pos.x += eb.vx * delta;
      eb.mesh.position.copy(eb.pos);
      eb.life -= delta;

      if (eb.life <= 0) {
        eb.active = false;
        eb.mesh.visible = false;
      }
    }
  }

  getActiveBullets() {
    return this.bullets.filter(b => b.active);
  }

  getActiveEnemyBullets() {
    return this.enemyBullets.filter(b => b.active);
  }

  reset() {
    for (let i = 0; i < this.maxBullets; i++) {
      this.bullets[i].active = false;
      this.bullets[i].mesh.visible = false;
    }
    for (let i = 0; i < this.maxEnemyBullets; i++) {
      this.enemyBullets[i].active = false;
      this.enemyBullets[i].mesh.visible = false;
    }
  }
}
