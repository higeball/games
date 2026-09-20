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
    const finishZ = -levelData.distance;

    // 背景色の切り替え（ステージごとの雰囲気演出）
    if (this.scene && levelData.skyColor) {
      this.scene.background = new THREE.Color(levelData.skyColor);
      this.scene.fog = new THREE.FogExp2(levelData.skyColor, 0.015);
    }

    // ステージに応じたゲート構成
    this.generateGates(levelIndex, finishZ);

    // ステージに応じた敵＆障害物配置
    this.generateEnemies(levelIndex, finishZ);

    // ボス配置
    this.boss = new Boss(this.scene, {
      z: finishZ,
      hp: Math.round(levelData.bossHp * (1 + (Math.floor((levelIndex - 1) / 5)) * 0.5)),
      name: levelData.bossName,
      color: levelData.bossColor,
      stageId: levelData.id
    });

    // ボス撃破後のボーナスロード
    this.setupBonusRoad(finishZ - 15);
  }

  generateGates(stageId, finishZ) {
    const totalDist = Math.abs(finishZ);
    const gateCount = Math.floor(totalDist / 45);

    for (let i = 0; i < gateCount; i++) {
      const z = -35 - (i * 42);
      if (z <= finishZ + 25) break;

      let leftType = 'add';
      let leftVal = 5 + (i * 2);
      let rightType = 'multiply';
      let rightVal = 2;
      let isMoving = false;

      if (stageId === 1) {
        // Stage 1: 基礎的な加算・乗算
        if (i === 1) { leftType = 'speed'; rightType = 'add'; rightVal = 10; }
        if (i === 3) { leftType = 'multiply'; leftVal = 2; rightType = 'add'; rightVal = 15; }
        if (i === 5) { leftType = 'add'; leftVal = 20; rightType = 'multiply'; rightVal = 3; }
      } else if (stageId === 2) {
        // Stage 2: 動くゲート導入、マイナストラップ
        isMoving = (i % 2 === 1);
        if (i === 0) { leftType = 'add'; leftVal = 8; rightType = 'multiply'; rightVal = 2; }
        if (i === 1) { leftType = 'subtract'; leftVal = 5; rightType = 'multiply'; rightVal = 2; }
        if (i === 2) { leftType = 'add'; leftVal = 15; rightType = 'speed'; }
        if (i === 4) { leftType = 'divide'; leftVal = 2; rightType = 'multiply'; rightVal = 3; }
      } else if (stageId === 3) {
        // Stage 3: 拡散ショット、高倍率
        isMoving = true;
        if (i === 0) { leftType = 'spread'; rightType = 'add'; rightVal = 12; }
        if (i === 2) { leftType = 'multiply'; leftVal = 2; rightType = 'add'; rightVal = 20; }
        if (i === 4) { leftType = 'speed'; rightType = 'multiply'; rightVal = 3; }
        if (i === 6) { leftType = 'add'; leftVal = 30; rightType = 'multiply'; rightVal = 3; }
      } else if (stageId === 4) {
        // Stage 4: メガビーム、高速動くゲート
        isMoving = true;
        if (i === 0) { leftType = 'power'; rightType = 'multiply'; rightVal = 2; }
        if (i === 2) { leftType = 'subtract'; leftVal = 10; rightType = 'multiply'; rightVal = 3; }
        if (i === 3) { leftType = 'spread'; rightType = 'speed'; }
        if (i === 5) { leftType = 'add'; leftVal = 40; rightType = 'multiply'; rightVal = 4; }
      } else {
        // Stage 5: 超増殖、全バフ
        isMoving = (i % 2 === 0);
        if (i === 0) { leftType = 'multiply'; leftVal = 3; rightType = 'spread'; }
        if (i === 1) { leftType = 'power'; rightType = 'speed'; }
        if (i === 3) { leftType = 'multiply'; leftVal = 4; rightType = 'add'; rightVal = 50; }
        if (i === 5) { leftType = 'multiply'; leftVal = 5; rightType = 'add'; rightVal = 60; }
      }

      const leftGate = new Gate(this.scene, {
        type: leftType,
        value: leftVal,
        x: -2.1,
        z,
        width: 3.8,
        isMoving,
        moveSpeed: 2.0 + stageId * 0.3,
        moveRange: 1.6
      });
      const rightGate = new Gate(this.scene, {
        type: rightType,
        value: rightVal,
        x: 2.1,
        z,
        width: 3.8,
        isMoving,
        moveSpeed: 2.0 + stageId * 0.3,
        moveRange: 1.6
      });

      this.gates.push(leftGate, rightGate);
    }
  }

  generateEnemies(stageId, finishZ) {
    const totalDist = Math.abs(finishZ);
    const waveCount = Math.floor(totalDist / 25);

    for (let i = 1; i < waveCount; i++) {
      const z = -20 - (i * 24);
      if (z <= finishZ + 20) break;

      // ゲートと重ならないようにオフセット
      const isNearGate = this.gates.some(g => Math.abs(g.z - z) < 8);
      if (isNearGate) continue;

      const waveType = i % 5;

      if (waveType === 0) {
        // 爆発バレル（撃つと周囲に大ダメージ！）
        this.enemies.push(new Enemy(this.scene, { type: 'barrel', x: 0, z, hp: 40 }));
        this.enemies.push(new Enemy(this.scene, { type: 'bug', x: -1.8, z, hp: 25 }));
        this.enemies.push(new Enemy(this.scene, { type: 'bug', x: 1.8, z, hp: 25 }));
      } else if (waveType === 1) {
        // 空中ドローン編隊
        const droneHp = 20 + stageId * 5;
        this.enemies.push(new Enemy(this.scene, { type: 'drone', x: -1.5, z, hp: droneHp }));
        this.enemies.push(new Enemy(this.scene, { type: 'drone', x: 1.5, z, hp: droneHp }));
      } else if (waveType === 2) {
        // カウントダウンブロック（集中砲火で破壊）
        const blockHp = 60 + stageId * 25;
        this.enemies.push(new Enemy(this.scene, { type: 'block', x: -1.4, z, hp: blockHp }));
        this.enemies.push(new Enemy(this.scene, { type: 'block', x: 1.4, z, hp: blockHp }));
      } else if (waveType === 3) {
        // 重装甲タンクモンスター
        const tankHp = 80 + stageId * 35;
        this.enemies.push(new Enemy(this.scene, { type: 'tank', x: 0, z, hp: tankHp }));
      } else {
        // スパイクバグ密集隊
        const bugHp = 25 + stageId * 8;
        this.enemies.push(new Enemy(this.scene, { type: 'bug', x: -2.2, z, hp: bugHp }));
        this.enemies.push(new Enemy(this.scene, { type: 'bug', x: -0.7, z, hp: bugHp }));
        this.enemies.push(new Enemy(this.scene, { type: 'bug', x: 0.7, z, hp: bugHp }));
        this.enemies.push(new Enemy(this.scene, { type: 'bug', x: 2.2, z, hp: bugHp }));
      }
    }
  }

  setupBonusRoad(startZ) {
    const multipliers = [1.5, 2.0, 3.0, 5.0, 8.0, 10.0, 15.0];
    multipliers.forEach((mult, idx) => {
      const z = startZ - (idx + 1) * 15;
      const geo = new THREE.PlaneGeometry(CONFIG.TRACK_WIDTH, 2.5);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.45,
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

  update(delta, onBossAttack) {
    for (const g of this.gates) g.update(delta);
    for (const e of this.enemies) e.update(delta);
    if (this.boss) this.boss.update(delta, onBossAttack);
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
