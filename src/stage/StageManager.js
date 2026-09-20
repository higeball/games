import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Gate } from '../entities/Gate.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';

export class StageManager {
  constructor(scene) {
    this.scene = scene;
    this.currentLevel = 1;
    this.gates = [];
    this.enemies = [];
    this.boss = null;
    this.bonusZones = [];
    this.isBonusPhase = false;
    this.bonusMultiplier = 1.0;
  }

  loadLevel(levelIndex = 1) {
    this.cleanup();
    this.currentLevel = levelIndex;
    this.isBonusPhase = false;
    this.bonusMultiplier = 1.0;

    const levelData = CONFIG.LEVELS[(levelIndex - 1) % CONFIG.LEVELS.length];
    const finishZ = CONFIG.FINISH_Z;

    // 1. ゲートのペア配置（左右に並べてプレイヤーに選択させる）
    const gatePairs = [
      { z: -35, left: { type: 'add', val: 5 }, right: { type: 'multiply', val: 2 } },
      { z: -75, left: { type: 'buff', val: 1 }, right: { type: 'add', val: 8 } },
      { z: -115, left: { type: 'multiply', val: 2 }, right: { type: 'subtract', val: 5 } },
      { z: -155, left: { type: 'add', val: 15 }, right: { type: 'multiply', val: 3 } },
      { z: -195, left: { type: 'buff', val: 1 }, right: { type: 'add', val: 20 } },
      { z: -235, left: { type: 'multiply', val: 2 }, right: { type: 'divide', val: 2 } },
      { z: -275, left: { type: 'add', val: 25 }, right: { type: 'multiply', val: 3 } }
    ];

    gatePairs.forEach(pair => {
      const leftGate = new Gate(this.scene, {
        type: pair.left.type,
        value: pair.left.val,
        x: -2.1,
        z: pair.z,
        width: 3.8
      });
      const rightGate = new Gate(this.scene, {
        type: pair.right.type,
        value: pair.right.val,
        x: 2.1,
        z: pair.z,
        width: 3.8
      });
      this.gates.push(leftGate, rightGate);
    });

    // 2. 敵ウェーブの配置
    const enemySpawns = [
      // Wave 1: 最初の遭遇
      { z: -55, x: -1.5, type: 'bug', hp: 20 },
      { z: -55, x: 1.5, type: 'bug', hp: 20 },
      // Wave 2: バリケード
      { z: -95, x: 0, type: 'barrel', hp: 45 },
      { z: -95, x: -2.4, type: 'bug', hp: 30 },
      { z: -95, x: 2.4, type: 'bug', hp: 30 },
      // Wave 3: 密集隊
      { z: -135, x: -1.8, type: 'bug', hp: 35 },
      { z: -135, x: 0, type: 'bug', hp: 40 },
      { z: -135, x: 1.8, type: 'bug', hp: 35 },
      // Wave 4: 障害物＋敵
      { z: -175, x: -1.5, type: 'barrel', hp: 60 },
      { z: -175, x: 1.5, type: 'barrel', hp: 60 },
      // Wave 5: 決戦前の大群
      { z: -215, x: -2.2, type: 'bug', hp: 45 },
      { z: -215, x: -0.7, type: 'bug', hp: 45 },
      { z: -215, x: 0.7, type: 'bug', hp: 45 },
      { z: -215, x: 2.2, type: 'bug', hp: 45 },
      // Wave 6: 親衛隊
      { z: -255, x: -1.2, type: 'bug', hp: 60 },
      { z: -255, x: 1.2, type: 'bug', hp: 60 }
    ];

    enemySpawns.forEach(spawn => {
      const enemy = new Enemy(this.scene, {
        type: spawn.type,
        x: spawn.x,
        z: spawn.z,
        hp: Math.round(spawn.hp * (1 + (levelIndex - 1) * 0.35))
      });
      this.enemies.push(enemy);
    });

    // 3. ボス配置
    this.boss = new Boss(this.scene, {
      z: finishZ,
      hp: Math.round(levelData.bossHp * (1 + (levelIndex - 1) * 0.4))
    });

    // 4. ボス撃破後のボーナスゾーン（倍率バナー）
    this.setupBonusRoad(finishZ - 15);
  }

  setupBonusRoad(startZ) {
    const multipliers = [1.5, 2.0, 3.0, 5.0, 8.0, 10.0];
    multipliers.forEach((mult, idx) => {
      const z = startZ - (idx + 1) * 15;
      const geo = new THREE.PlaneGeometry(CONFIG.TRACK_WIDTH, 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.05, z);
      this.scene.add(mesh);

      this.bonusZones.push({
        z,
        multiplier: mult,
        passed: false,
        mesh
      });
    });
  }

  update(delta) {
    // ゲート更新
    for (const g of this.gates) {
      g.update(delta);
    }
    // 敵更新
    for (const e of this.enemies) {
      e.update(delta);
    }
    // ボス更新
    if (this.boss) {
      this.boss.update(delta);
    }
  }

  cleanup() {
    for (const g of this.gates) g.dispose();
    this.gates = [];

    for (const e of this.enemies) e.dispose();
    this.enemies = [];

    if (this.boss) {
      this.boss.dispose();
      this.boss = null;
    }

    for (const bz of this.bonusZones) {
      this.scene.remove(bz.mesh);
      bz.mesh.geometry.dispose();
      bz.mesh.material.dispose();
    }
    this.bonusZones = [];
  }
}
