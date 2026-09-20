import * as THREE from 'three';

export class FXManager {
  constructor(scene) {
    this.scene = scene;
    this.maxParticles = 300;
    this.particles = [];
    this.rings = [];

    // コイン吸引エフェクト用プール
    this.maxCoins = 50;
    this.coins = [];

    // Three.js ネイティブ紙吹雪プール（UIやタッチイベントを一切阻害しない安全な実装）
    this.maxConfetti = 120;
    this.confettiPieces = [];

    this.initParticlePool();
    this.initCoinPool();
    this.initConfettiPool();
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
        homingDelay: 0.25,
        life: 0
      });
    }
  }

  initConfettiPool() {
    const colors = [0xff1744, 0x00e5ff, 0x76ff03, 0xffd600, 0xe040fb, 0xffffff];
    const geo = new THREE.PlaneGeometry(0.24, 0.16);

    for (let i = 0; i < this.maxConfetti; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.confettiPieces.push({
        mesh,
        active: false,
        vel: new THREE.Vector3(),
        rotSpeed: new THREE.Vector3(),
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

  triggerVictoryConfetti(playerPos) {
    // プレイヤーの頭上からキラキラ舞い落ちるThree.jsネイティブ紙吹雪
    const basePos = playerPos || new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < this.maxConfetti; i++) {
      const cp = this.confettiPieces[i];
      cp.active = true;
      cp.mesh.visible = true;

      // プレイヤーの前方〜上空に配置
      cp.mesh.position.set(
        basePos.x + (Math.random() - 0.5) * 12,
        basePos.y + Math.random() * 8 + 6,
        basePos.z - Math.random() * 10 - 2
      );

      cp.vel.set(
        (Math.random() - 0.5) * 2.5,
        - (Math.random() * 3.5 + 2.5),
        (Math.random() - 0.5) * 2.5
      );

      cp.rotSpeed.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );

      cp.life = 4.5;
    }
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

    // コインの吸引更新
    for (let i = 0; i < this.maxCoins; i++) {
      const c = this.coins[i];
      if (!c.active) continue;

      c.life -= delta;
      c.homingDelay -= delta;

      if (c.homingDelay > 0) {
        c.vel.y -= 18.0 * delta;
        c.pos.addScaledVector(c.vel, delta);
      } else {
        if (playerPos) {
          const dir = playerPos.clone().sub(c.pos);
          const dist = dir.length();

          if (dist < 1.2 || c.life <= 0) {
            c.active = false;
            c.mesh.visible = false;
            if (onCoinCollectCallback) onCoinCollectCallback();
            continue;
          }

          dir.normalize();
          const speed = Math.min(35.0, 10.0 + (1.8 - c.life) * 20.0);
          c.pos.addScaledVector(dir, speed * delta);
        }
      }

      c.mesh.position.copy(c.pos);
      c.mesh.rotation.y += delta * 10.0;
    }

    // 紙吹雪の舞い落ち更新
    for (let i = 0; i < this.maxConfetti; i++) {
      const cp = this.confettiPieces[i];
      if (!cp.active) continue;

      cp.life -= delta;
      if (cp.life <= 0 || cp.mesh.position.y <= 0) {
        cp.active = false;
        cp.mesh.visible = false;
        continue;
      }

      // ひらひら舞い落ちる
      cp.mesh.position.addScaledVector(cp.vel, delta);
      cp.mesh.rotation.x += cp.rotSpeed.x * delta;
      cp.mesh.rotation.y += cp.rotSpeed.y * delta;
      cp.mesh.rotation.z += cp.rotSpeed.z * delta;
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
    for (let i = 0; i < this.maxConfetti; i++) {
      this.confettiPieces[i].active = false;
      this.confettiPieces[i].mesh.visible = false;
    }
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    this.rings = [];
  }
}
