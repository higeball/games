import * as THREE from 'three';
import confetti from 'canvas-confetti';

export class FXManager {
  constructor(scene) {
    this.scene = scene;
    this.maxParticles = 300;
    this.particles = [];
    this.rings = [];

    // コイン吸引エフェクト用プール
    this.maxCoins = 50;
    this.coins = [];

    this.initParticlePool();
    this.initCoinPool();
  }

  initParticlePool() {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);

    for (let i = 0; i < this.maxParticles; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        active: false,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.6
      });
    }
  }

  initCoinPool() {
    const coinGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 12);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffa000,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2
    });

    for (let i = 0; i < this.maxCoins; i++) {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.coins.push({
        mesh,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        homingDelay: 0.2, // 少し飛び散ってから吸引開始
        life: 0
      });
    }
  }

  spawnBurst(pos, color = 0x76ff03, count = 18) {
    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.material.color.setHex(color);
        p.mesh.position.copy(pos);

        p.velocity.set(
          (Math.random() - 0.5) * 14,
          Math.random() * 10 + 4,
          (Math.random() - 0.5) * 14
        );
        p.life = p.maxLife;
        p.mesh.scale.set(1, 1, 1);
        spawned++;
      }
    }
  }

  spawnCoins(pos, count = 4) {
    let spawned = 0;
    for (let i = 0; i < this.maxCoins && spawned < count; i++) {
      const c = this.coins[i];
      if (!c.active) {
        c.active = true;
        c.mesh.visible = true;
        c.pos.copy(pos);
        c.mesh.position.copy(c.pos);

        // 放射状にポンと飛び散る
        c.vel.set(
          (Math.random() - 0.5) * 8,
          Math.random() * 6 + 3,
          (Math.random() - 0.5) * 8
        );
        c.homingDelay = 0.25;
        c.life = 1.8;
        spawned++;
      }
    }
  }

  spawnGateRing(pos, color = 0x00e5ff) {
    const ringGeo = new THREE.RingGeometry(0.4, 0.7, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(pos);
    this.scene.add(ringMesh);

    this.rings.push({
      mesh: ringMesh,
      scale: 1.0,
      opacity: 1.0
    });
  }

  triggerVictoryConfetti() {
    confetti({ particleCount: 140, spread: 85, origin: { y: 0.6 } });
    setTimeout(() => {
      confetti({ particleCount: 90, angle: 60, spread: 60, origin: { x: 0 } });
      confetti({ particleCount: 90, angle: 120, spread: 60, origin: { x: 1 } });
    }, 280);
  }

  update(delta, playerPos, onCoinCollectCallback) {
    // 通常パーティクルの更新
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= delta;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.velocity.y -= 26.0 * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);

      const scale = p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);
    }

    // コインの吸引更新（プレイヤーに向かって急加速で吸い寄せられる）
    for (let i = 0; i < this.maxCoins; i++) {
      const c = this.coins[i];
      if (!c.active) continue;

      c.life -= delta;
      c.homingDelay -= delta;

      if (c.homingDelay > 0) {
        // 初期飛散
        c.vel.y -= 18.0 * delta;
        c.pos.addScaledVector(c.vel, delta);
      } else {
        // プレイヤーへホーミング吸引
        const dir = playerPos.clone().sub(c.pos);
        const dist = dir.length();

        if (dist < 1.2 || c.life <= 0) {
          // コイン回収！
          c.active = false;
          c.mesh.visible = false;
          if (onCoinCollectCallback) onCoinCollectCallback();
          continue;
        }

        dir.normalize();
        const speed = Math.min(35.0, 10.0 + (1.8 - c.life) * 20.0);
        c.pos.addScaledVector(dir, speed * delta);
      }

      c.mesh.position.copy(c.pos);
      c.mesh.rotation.y += delta * 10.0;
    }

    // リングエフェクトの更新
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.scale += delta * 12.0;
      r.opacity -= delta * 2.5;

      r.mesh.scale.set(r.scale, r.scale, 1);
      r.mesh.material.opacity = Math.max(0, r.opacity);

      if (r.opacity <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  reset() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
      this.particles[i].mesh.visible = false;
    }
    for (let i = 0; i < this.maxCoins; i++) {
      this.coins[i].active = false;
      this.coins[i].mesh.visible = false;
    }
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    this.rings = [];
  }
}
