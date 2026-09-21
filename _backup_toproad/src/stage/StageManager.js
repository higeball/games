import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Gate } from '../entities/Gate.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';

/**
 * 戦略的ゲームプレイを実現するステージマネージャー
 * 単調な左右選択ではなく、状況判断・射撃ターゲット優先度・環境利用（爆破・反転・救出）を要する
 * 各ステージ専用の綿密に設計された遭遇シナリオ（Encounters）を構築する。
 */
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

    // 背景色とフォグの演出切り替え
    if (this.scene && levelData.skyColor) {
      this.scene.background = new THREE.Color(levelData.skyColor);
      this.scene.fog = new THREE.FogExp2(levelData.skyColor, 0.015);
    }

    // 各ステージごとの戦略的シナリオを構築
    this.buildStageScenarios(levelData.id, finishZ);

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

  buildStageScenarios(stageId, finishZ) {
    if (stageId === 1) {
      this.buildStage1();
    } else if (stageId === 2) {
      this.buildStage2();
    } else if (stageId === 3) {
      this.buildStage3();
    } else if (stageId === 4) {
      this.buildStage4();
    } else {
      this.buildStage5();
    }
  }

  // ==========================================
  // STAGE 1: 基礎・ゲート育成と仲間救出の楽しさ
  // ==========================================
  buildStage1() {
    // 1. 最初のゲート選択（撃てば育つことを学ぶ）
    this.addGatePair(-32, { type: 'add', value: 5, x: -2.1 }, { type: 'add', value: 3, x: 2.1 });

    // 2. ゲイリー救出カプセル初登場（壊すと仲間が+5体！）
    this.enemies.push(new Enemy(this.scene, { type: 'cage', x: 0, z: -68, hp: 15, rescueCount: 5 }));
    this.enemies.push(new Enemy(this.scene, { type: 'bug', x: -2.0, z: -70, hp: 15 }));
    this.enemies.push(new Enemy(this.scene, { type: 'bug', x: 2.0, z: -70, hp: 15 }));

    // 3. 赤い爆発バレル初登場（撃つと周囲の敵を一網打尽！）
    this.enemies.push(new Enemy(this.scene, { type: 'barrel', x: 0, z: -115, hp: 30 }));
    this.enemies.push(new Enemy(this.scene, { type: 'bug', x: -1.6, z: -117, hp: 18 }));
    this.enemies.push(new Enemy(this.scene, { type: 'bug', x: 1.6, z: -117, hp: 18 }));

    // 4. 乗算ゲート vs 加算ゲート（火力が上がっていれば乗算が高リターン）
    this.addGatePair(-155, { type: 'multiply', value: 2, x: -2.1 }, { type: 'add', value: 12, x: 2.1 });

    // 5. 2つ目の救出カプセル ＋ 連射バフゲート（ボス戦直前の強化）
    this.enemies.push(new Enemy(this.scene, { type: 'cage', x: -1.8, z: -195, hp: 20, rescueCount: 6 }));
    this.gates.push(new Gate(this.scene, { type: 'speed', x: 1.8, z: -195, width: 3.6 }));
  }

  // ==========================================
  // STAGE 2: リスク＆リターン・爆破連鎖パズル
  // ==========================================
  buildStage2() {
    // 1. 動くゲート導入（左右にスライド）
    this.addGatePair(-35,
      { type: 'add', value: 8, x: -2.1, isMoving: true, moveSpeed: 2.0, moveRange: 1.5 },
      { type: 'multiply', value: 2, x: 2.1, isMoving: true, moveSpeed: 2.0, moveRange: 1.5 }
    );

    // 2. 高耐久壁（HP 60）の隣に赤いバレル！バレルを撃てば一撃で壁が消滅！
    this.enemies.push(new Enemy(this.scene, { type: 'block', x: -1.6, z: -80, hp: 60 }));
    this.enemies.push(new Enemy(this.scene, { type: 'barrel', x: -1.6, z: -74, hp: 35 })); // 壁の手前のドラム缶
    this.enemies.push(new Enemy(this.scene, { type: 'bug', x: 1.8, z: -80, hp: 25 }));
    // 壁を越えた先にご褒美の乗算ゲート
    this.gates.push(new Gate(this.scene, { type: 'multiply', value: 3, x: -2.1, z: -95, width: 3.6 }));
    this.gates.push(new Gate(this.scene, { type: 'add', value: 10, x: 2.1, z: -95, width: 3.6 }));

    // 3. 3WAY拡散弾ゲート ＋ 直後の空中ドローン編隊（拡散弾が大活躍！）
    this.gates.push(new Gate(this.scene, { type: 'spread', x: -2.0, z: -140, width: 3.6 }));
    this.enemies.push(new Enemy(this.scene, { type: 'cage', x: 1.8, z: -140, hp: 25, rescueCount: 8 }));
    // ドローン編隊
    this.enemies.push(new Enemy(this.scene, { type: 'drone', x: -2.2, z: -165, hp: 25 }));
    this.enemies.push(new Enemy(this.scene, { type: 'drone', x: 0, z: -168, hp: 25 }));
    this.enemies.push(new Enemy(this.scene, { type: 'drone', x: 2.2, z: -165, hp: 25 }));

    // 4. 中央バレル連鎖（2個のバレルで左右両方のカウントダウン壁を爆破）
    this.enemies.push(new Enemy(this.scene, { type: 'barrel', x: 0, z: -210, hp: 35 }));
    this.enemies.push(new Enemy(this.scene, { type: 'block', x: -2.2, z: -212, hp: 50 }));
    this.enemies.push(new Enemy(this.scene, { type: 'block', x: 2.2, z: -212, hp: 50 }));

    // 5. 動く減算ゲート vs 重装甲タンク（タンクを倒して大倍率へ）
    this.addGatePair(-255,
      { type: 'subtract', value: 6, x: -2.1, isMoving: true, moveSpeed: 2.5, moveRange: 1.6 },
      { type: 'multiply', value: 3, x: 2.1 }
    );
    this.enemies.push(new Enemy(this.scene, { type: 'tank', x: 2.1, z: -245, hp: 70 }));
  }

  // ==========================================
  // STAGE 3: 反転ゲートと電磁防衛線
  // ==========================================
  buildStage3() {
    // 1. 反転ゲート初登場！（撃ち込めば -12 が +25 に大化け！）
    this.gates.push(new Gate(this.scene, {
      type: 'transform',
      value: -12,
      flipTarget: 25,
      flipHitsNeeded: 5,
      isMultiplyOnFlip: false,
      x: -2.1,
      z: -42,
      width: 3.8
    }));
    this.gates.push(new Gate(this.scene, { type: 'add', value: 6, x: 2.1, z: -42, width: 3.8 }));

    // 2. 電磁レーザー柵 ＋ 奥に電磁シールドポッド（防護バリア獲得）
    this.enemies.push(new Enemy(this.scene, { type: 'laser_fence', x: 0, z: -90 }));
    this.gates.push(new Gate(this.scene, { type: 'shield', x: 0, z: -108, width: 3.4 }));

    // 3. 砲撃タワー ＋ 囚われゲイリー救出
    this.enemies.push(new Enemy(this.scene, { type: 'turret', x: -2.4, z: -150, hp: 50 }));
    this.enemies.push(new Enemy(this.scene, { type: 'cage', x: 0, z: -152, hp: 30, rescueCount: 8 }));
    this.enemies.push(new Enemy(this.scene, { type: 'turret', x: 2.4, z: -150, hp: 50 }));

    // 4. 動く反転乗算ゲート（-15 が ×3 に反転！）
    this.gates.push(new Gate(this.scene, {
      type: 'transform',
      value: -15,
      flipTarget: 3,
      flipHitsNeeded: 6,
      isMultiplyOnFlip: true,
      x: 2.1,
      z: -210,
      width: 3.8,
      isMoving: true,
      moveSpeed: 2.2,
      moveRange: 1.6
    }));
    this.gates.push(new Gate(this.scene, { type: 'add', value: 15, x: -2.1, z: -210, width: 3.8 }));

    // 5. 密集ブロック要塞 ＋ メガビーム砲獲得（貫通ビームで要塞粉砕！）
    this.gates.push(new Gate(this.scene, { type: 'power', x: -2.0, z: -265, width: 3.6 }));
    this.gates.push(new Gate(this.scene, { type: 'multiply', value: 2, x: 2.0, z: -265, width: 3.6 }));
    this.enemies.push(new Enemy(this.scene, { type: 'block', x: -1.2, z: -285, hp: 70 }));
    this.enemies.push(new Enemy(this.scene, { type: 'block', x: 1.2, z: -285, hp: 70 }));
    this.enemies.push(new Enemy(this.scene, { type: 'barrel', x: 0, z: -282, hp: 40 }));
  }

  // ==========================================
  // STAGE 4: シールド装甲要塞突破
  // ==========================================
  buildStage4() {
    // 1. 前方シールド装甲兵初登場（正面弾を弾く！）＋ メガビームで貫通破壊！
    this.gates.push(new Gate(this.scene, { type: 'power', x: 0, z: -35, width: 3.6 }));
    this.enemies.push(new Enemy(this.scene, { type: 'shielded', x: -1.6, z: -60, hp: 80 }));
    this.enemies.push(new Enemy(this.scene, { type: 'shielded', x: 1.6, z: -60, hp: 80 }));

    // 2. ダブル反転ゲート（左は×4の超大穴、右は手堅い+20）
    this.gates.push(new Gate(this.scene, {
      type: 'transform',
      value: -18,
      flipTarget: 4,
      flipHitsNeeded: 7,
      isMultiplyOnFlip: true,
      x: -2.1,
      z: -110,
      width: 3.8
    }));
    this.gates.push(new Gate(this.scene, { type: 'add', value: 20, x: 2.1, z: -110, width: 3.8 }));

    // 3. レーザー柵の二重防衛線 ＋ シールドポッド ＋ 救出ケージ
    this.enemies.push(new Enemy(this.scene, { type: 'laser_fence', x: 0, z: -160, laserOffset: 0 }));
    this.gates.push(new Gate(this.scene, { type: 'shield', x: -1.8, z: -175, width: 3.4 }));
    this.enemies.push(new Enemy(this.scene, { type: 'cage', x: 1.8, z: -175, hp: 35, rescueCount: 10 }));
    this.enemies.push(new Enemy(this.scene, { type: 'laser_fence', x: 0, z: -195, laserOffset: 1.3 }));

    // 4. ドラム缶連鎖による装甲兵の背後爆破
    this.enemies.push(new Enemy(this.scene, { type: 'shielded', x: -1.8, z: -245, hp: 90 }));
    this.enemies.push(new Enemy(this.scene, { type: 'barrel', x: -1.8, z: -250, hp: 40 })); // 敵のすぐ後ろのドラム缶
    this.enemies.push(new Enemy(this.scene, { type: 'shielded', x: 1.8, z: -245, hp: 90 }));
    this.enemies.push(new Enemy(this.scene, { type: 'barrel', x: 1.8, z: -250, hp: 40 }));

    // 5. 3WAY拡散弾 ＋ 高速動くゲート（ボス前の最終準備）
    this.addGatePair(-295,
      { type: 'spread', x: -2.1, isMoving: true, moveSpeed: 2.8, moveRange: 1.7 },
      { type: 'multiply', value: 3, x: 2.1, isMoving: true, moveSpeed: 2.8, moveRange: 1.7 }
    );
    this.enemies.push(new Enemy(this.scene, { type: 'turret', x: 0, z: -315, hp: 60 }));
  }

  // ==========================================
  // STAGE 5: 皇帝メガ・バグ決戦・総力戦
  // ==========================================
  buildStage5() {
    // 1. 初動バフ：3WAY弾 ＆ シールド展開で万全の出撃態勢
    this.gates.push(new Gate(this.scene, { type: 'spread', x: -2.0, z: -35, width: 3.6 }));
    this.gates.push(new Gate(this.scene, { type: 'shield', x: 2.0, z: -35, width: 3.6 }));

    // 2. 超反転ゲート（-25 を撃ちまくって ×5 の爆発増殖へ！）
    this.gates.push(new Gate(this.scene, {
      type: 'transform',
      value: -25,
      flipTarget: 5,
      flipHitsNeeded: 8,
      isMultiplyOnFlip: true,
      x: 0,
      z: -95,
      width: 4.8
    }));

    // 3. 大型救出ケージ（仲間を一気に+15体救出！）＋ 砲撃タワー二基
    this.enemies.push(new Enemy(this.scene, { type: 'turret', x: -2.6, z: -155, hp: 70 }));
    this.enemies.push(new Enemy(this.scene, { type: 'cage', x: 0, z: -160, hp: 45, rescueCount: 15 }));
    this.enemies.push(new Enemy(this.scene, { type: 'turret', x: 2.6, z: -155, hp: 70 }));

    // 4. メガビーム砲獲得 ＋ 巨大カウントダウン要塞壁（HP 150）
    this.gates.push(new Gate(this.scene, { type: 'power', x: -2.0, z: -215, width: 3.6 }));
    this.gates.push(new Gate(this.scene, { type: 'multiply', value: 3, x: 2.0, z: -215, width: 3.6 }));
    this.enemies.push(new Enemy(this.scene, { type: 'block', x: -1.5, z: -245, hp: 150 }));
    this.enemies.push(new Enemy(this.scene, { type: 'barrel', x: 0, z: -242, hp: 45 }));
    this.enemies.push(new Enemy(this.scene, { type: 'block', x: 1.5, z: -245, hp: 150 }));

    // 5. 最後の試練：レーザーフェンス ＋ 動く反転ゲート（×4）
    this.enemies.push(new Enemy(this.scene, { type: 'laser_fence', x: 0, z: -310 }));
    this.gates.push(new Gate(this.scene, {
      type: 'transform',
      value: -20,
      flipTarget: 4,
      flipHitsNeeded: 7,
      isMultiplyOnFlip: true,
      x: -2.1,
      z: -340,
      width: 3.8,
      isMoving: true,
      moveSpeed: 2.5,
      moveRange: 1.6
    }));
    this.gates.push(new Gate(this.scene, { type: 'add', value: 50, x: 2.1, z: -340, width: 3.8 }));

    // 6. ボス直前の救出ケージ
    this.enemies.push(new Enemy(this.scene, { type: 'cage', x: 0, z: -400, hp: 40, rescueCount: 12 }));
  }

  addGatePair(z, leftOpt, rightOpt) {
    const defaultW = 4.25;
    const leftGate = new Gate(this.scene, {
      ...leftOpt,
      z,
      x: leftOpt.x !== undefined ? leftOpt.x : -2.125,
      width: leftOpt.width || (leftOpt.isMoving ? 3.8 : defaultW)
    });
    const rightGate = new Gate(this.scene, {
      ...rightOpt,
      z,
      x: rightOpt.x !== undefined ? rightOpt.x : 2.125,
      width: rightOpt.width || (rightOpt.isMoving ? 3.8 : defaultW)
    });
    this.gates.push(leftGate, rightGate);
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

  update(delta, onBossAttack, onTurretAttack) {
    for (const g of this.gates) g.update(delta);
    for (const e of this.enemies) e.update(delta, onTurretAttack);
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
