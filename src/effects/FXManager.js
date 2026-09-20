import * as THREE from 'three';
import confetti from 'canvas-confetti';

export class FXManager {
  constructor(scene) {
    this.scene = scene;
    this.maxParticles = 300;
    this.particles = [];
    this.rings = [];

    this.initParticlePool();
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

  spawnBurst(pos, color = 0x76ff03, count = 18) {
    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.material.color.setHex(color);
        p.mesh.position.copy(pos);

        // 四方八方に飛散するランダム速度
        p.velocity.set(
          (Math.random() - 0.5) * 12,
          Math.random() * 9 + 3,
          (Math.random() - 0.5) * 12
        );
        p.life = p.maxLife;
        p.mesh.scale.set(1, 1, 1);
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
    ringMesh.rotation.y = 0;
    this.scene.add(ringMesh);

    this.rings.push({
      mesh: ringMesh,
      scale: 1.0,
      opacity: 1.0
    });
  }

  triggerVictoryConfetti() {
    // 勝利時のゴージャスな紙吹雪
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });

    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }

  update(delta) {
    // パーティクルの更新
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= delta;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // 重力と速度
      p.velocity.y -= 25.0 * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);

      // フェード縮小
      const scale = p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);
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
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    this.rings = [];
  }
}
