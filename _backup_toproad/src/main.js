import * as THREE from 'three';
import { CONFIG } from './config.js';
import { GameRenderer } from './engine/GameRenderer.js';
import { InputHandler } from './engine/InputHandler.js';
import { SoundManager } from './audio/SoundManager.js';
import { MojiSan } from './entities/MojiSan.js';
import { GaryHorde } from './entities/GaryHorde.js';
import { BulletManager } from './entities/BulletManager.js';
import { StageManager } from './stage/StageManager.js';
import { FXManager } from './effects/FXManager.js';
import { UIManager } from './ui/UIManager.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new GameRenderer(this.canvas);
    this.input = new InputHandler(this.canvas);
    this.sound = new SoundManager();
    this.fx = new FXManager(this.renderer.scene);

    this.moji = new MojiSan(this.renderer.scene);
    this.gary = new GaryHorde(this.renderer.scene);
    this.bullets = new BulletManager(this.renderer.scene);
    this.stage = new StageManager(this.renderer.scene);

    this.state = 'TITLE'; // 'TITLE' | 'PLAYING' | 'BONUS_ROAD' | 'GAMEOVER' | 'CLEAR'
    this.score = 0;
    this.currentLevel = 1;
    this.playerZ = 0;

    // 武器バフ
    this.hasSpreadShot = false;
    this.hasMegaBeam = false;

    this.mojiFireTimer = 0;
    this.garyFireTimer = 0;
    this.bossAlerted = false;

    this.lastTime = performance.now();

    this.ui = new UIManager({
      onStart: () => this.startGame(),
      onRestart: () => this.restartGame(),
      onNextStage: () => this.nextStage(),
      onToggleMute: () => this.sound.toggleMute()
    });

    this.ui.showTitle();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  startGame() {
    this.sound.init();
    this.sound.startBgm();

    this.state = 'PLAYING';
    this.playerZ = 0;
    this.bossAlerted = false;
    this.hasSpreadShot = false;
    this.hasMegaBeam = false;

    this.input.reset();
    this.moji.reset();
    this.renderer.resetCamera(this.moji.position);
    this.gary.reset();
    this.bullets.reset();
    this.fx.reset();

    const levelData = CONFIG.LEVELS[(this.currentLevel - 1) % CONFIG.LEVELS.length];
    this.stage.loadLevel(this.currentLevel);

    this.ui.startGame(levelData.title, levelData.strategyTip);
    this.gary.showSpeech("もじさん、いくよー！");
  }

  restartGame() {
    this.score = 0;
    this.startGame();
  }

  nextStage() {
    this.currentLevel++;
    this.startGame();
  }

  animate(currentTime) {
    requestAnimationFrame(this.animate);

    const delta = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    this.update(delta);
    this.render(delta);
  }

  update(delta) {
    if (this.state === 'PLAYING' || this.state === 'BONUS_ROAD') {
      // 1. 左右入力と前進移動
      const currentX = this.input.update(delta);
      const speed = (this.state === 'BONUS_ROAD') ? CONFIG.RUN_SPEED * 1.35 : CONFIG.RUN_SPEED;
      this.playerZ -= speed * delta;

      // 2. もじさんとゲイリーの位置更新
      this.moji.update(delta, currentX, this.playerZ, true);
      this.gary.update(delta, this.moji.position, true);

      // 3. 射撃システム
      this.handleShooting(delta);

      // 4. 弾丸更新
      this.bullets.update(delta);

      // 5. ステージとエンティティの更新（ボス攻撃＆タワー砲撃コールバック付き）
      this.stage.update(
        delta,
        (bossPos) => this.handleBossAttack(bossPos),
        (turretPos) => this.handleTurretAttack(turretPos)
      );

      // 6. 衝突判定
      this.handleCollisions(delta);

      // 7. エフェクト更新（コイン吸引コールバック付き）
      this.fx.update(delta, this.moji.position, () => {
        this.sound.playCoin();
        this.score += 50;
      });

      // 8. HUD更新
      const currentLevelData = CONFIG.LEVELS[(this.currentLevel - 1) % CONFIG.LEVELS.length];
      const totalDist = currentLevelData.distance;
      const curDist = Math.min(totalDist, Math.abs(this.playerZ));
      const progress = curDist / totalDist;
      this.ui.updateHUD(this.score, this.gary.count, this.moji.hp, this.moji.maxHp, progress, this.moji.hasShield);

      // ゲームオーバー判定
      if (this.moji.hp <= 0 || (this.gary.count <= 0 && this.state === 'PLAYING' && Math.abs(this.playerZ) > 30)) {
        this.handleGameOver();
      }
    } else {
      // アイドル・タイトル・クリア中
      this.moji.update(delta, 0, this.playerZ, false);
      this.gary.update(delta, this.moji.position, false);
      this.fx.update(delta, this.moji.position);
    }
  }

  handleShooting(delta) {
    if (this.state !== 'PLAYING') return;

    // もじさんのレーザー射撃
    this.mojiFireTimer += delta;
    if (this.mojiFireTimer >= CONFIG.MOJI.FIRE_INTERVAL) {
      this.mojiFireTimer = 0;
      const gunPos = this.moji.getGunWorldPos();
      this.bullets.spawnBullet(gunPos, true, 0, this.hasMegaBeam);
      this.moji.triggerShoot();
      this.sound.playLaser();
    }

    // ゲイリー軍団のスライム弾射撃
    this.garyFireTimer += delta;
    if (this.garyFireTimer >= CONFIG.GARY.FIRE_INTERVAL && this.gary.count > 0) {
      this.garyFireTimer = 0;
      const sampleCount = Math.min(10, Math.ceil(this.gary.count / 3));
      const frontGaries = this.gary.getFrontPositions(sampleCount);

      frontGaries.forEach(pos => {
        const shotPos = pos.clone();
        shotPos.y += 0.35;
        shotPos.z -= 0.35;

        // 通常正面ショット
        this.bullets.spawnBullet(shotPos, false, 0);

        // 3WAY拡散弾バフが有効なら左右斜めにも発射！
        if (this.hasSpreadShot) {
          this.bullets.spawnBullet(shotPos, false, -10);
          this.bullets.spawnBullet(shotPos, false, 10);
        }
      });
      this.sound.playSlimeShot();
    }
  }

  handleBossAttack(bossPos) {
    if (this.state !== 'PLAYING') return;
    // ボスから手前のプレイヤー周辺へ3WAYエネルギー弾発射
    const px = this.moji.position.x;
    this.bullets.spawnEnemyBullet(bossPos, px - 2.5);
    this.bullets.spawnEnemyBullet(bossPos, px);
    this.bullets.spawnEnemyBullet(bossPos, px + 2.5);
    this.sound.playEnemyHit();
  }

  handleTurretAttack(turretPos) {
    if (this.state !== 'PLAYING') return;
    // 砲撃タワーからプレイヤーのいるX座標へ向けたエネルギー砲撃
    this.bullets.spawnEnemyBullet(turretPos, this.moji.position.x);
    this.sound.playEnemyHit();
  }

  isBulletCrossing(bullet, delta, targetX, targetZ, halfWidth, halfDepth) {
    // 1. X軸判定（ターゲット幅 + 弾丸半径マージン）
    const dx = Math.abs(bullet.pos.x - targetX);
    const radiusMargin = bullet.isMega ? 1.0 : 0.45;
    if (dx > halfWidth + radiusMargin) return false;

    // 2. Y軸判定（プレイヤー弾と地上の的が自然に当たる許容範囲）
    if (bullet.pos.y < -0.5 || bullet.pos.y > 4.5) return false;

    // 3. Z軸連続衝突判定（CCD：前フレーム位置〜現フレーム位置の軌跡とターゲット深度の重なり）
    const stepZ = (bullet.speed || 48.0) * (delta || 0.016);
    const zNew = bullet.pos.z;
    const zOld = bullet.pos.z + stepZ;

    const minTargetZ = targetZ - halfDepth;
    const maxTargetZ = targetZ + halfDepth;

    return (zNew <= maxTargetZ && zOld >= minTargetZ);
  }

  handleCollisions(delta = 0.016) {
    const activeBullets = this.bullets.getActiveBullets();
    const activeEnemyBullets = this.bullets.getActiveEnemyBullets();
    const mojiPos = this.moji.position;

    // =========================================================================
    // 1. プレイヤー弾 vs ゲート、敵、ボス（弾丸主導ループで全弾同時命中を保証！）
    // =========================================================================
    for (const bullet of activeBullets) {
      if (!bullet.active) continue;

      // 1-A. 弾丸 vs ゲート
      for (const gate of this.stage.gates) {
        if (gate.passed) continue;
        const halfW = gate.width / 2 + 0.25;
        const halfD = 0.85;

        if (this.isBulletCrossing(bullet, delta, gate.x, gate.z, halfW, halfD)) {
          if (!bullet.isMega) {
            bullet.active = false;
            bullet.mesh.visible = false;
          }
          gate.onBulletHit();
          this.sound.playGateHit();
          this.fx.spawnBurst(bullet.pos, 0x00e5ff, 6);
          break; // この弾はゲートに命中
        }
      }
      if (!bullet.active) continue;

      // 1-B. 弾丸 vs 敵・障害物・救助ケージ
      for (const enemy of this.stage.enemies) {
        if (!enemy.alive) continue;

        let halfW = 0.95;
        let halfD = 0.95;
        if (enemy.type === 'cage') {
          halfW = 1.25;
          halfD = 1.2;
        } else if (enemy.type === 'block') {
          halfW = 1.15;
          halfD = 1.1;
        } else if (enemy.type === 'barrel') {
          halfW = 1.05;
          halfD = 1.0;
        } else if (enemy.type === 'shielded') {
          halfW = 1.25;
          halfD = 1.1;
        } else if (enemy.type === 'tank') {
          halfW = 1.55;
          halfD = 1.35;
        } else if (enemy.type === 'drone') {
          halfW = 1.25;
          halfD = 1.1;
        } else if (enemy.type === 'turret') {
          halfW = 1.25;
          halfD = 1.2;
        }

        const ePos = enemy.group.position;

        if (this.isBulletCrossing(bullet, delta, ePos.x, ePos.z, halfW, halfD)) {
          const hitResult = enemy.takeDamage(bullet.damage, bullet);

          if (hitResult === 'deflected') {
            if (!bullet.isMega) {
              bullet.active = false;
              bullet.mesh.visible = false;
            }
            this.sound.playGateHit();
            this.fx.spawnBurst(bullet.pos, 0x00e5ff, 8);
            break;
          }

          if (!bullet.isMega) {
            bullet.active = false;
            bullet.mesh.visible = false;
          }

          this.sound.playEnemyHit();

          if (hitResult === true) {
            if (enemy.type === 'cage') {
              const count = enemy.rescueCount || 6;
              this.gary.addCount(count);
              this.sound.playGatePass(true);
              this.fx.spawnBurst(ePos, 0x64ff24, 30);
              this.renderer.addScreenShake(0.25);
              this.ui.showGarySpeech(`仲間を${count}体救出！やったー！`, 2.0);
              this.score += 300;
            } else if (enemy.type === 'barrel') {
              this.sound.playBarrelExplode();
              this.fx.spawnBurst(ePos, 0xff5722, 35);
              this.renderer.addScreenShake(0.55);
              this.triggerBarrelExplosion(ePos);
            } else {
              this.sound.playEnemyExplode();
              this.fx.spawnBurst(ePos, (enemy.type === 'block' ? 0x90a4ae : (enemy.type === 'shielded' ? 0x00b0ff : 0xff1744)), 25);
              this.renderer.addScreenShake(0.25);
            }

            this.fx.spawnCoins(ePos, enemy.type === 'tank' ? 8 : (enemy.type === 'shielded' || enemy.type === 'turret' ? 6 : 4));
            this.score += (enemy.type === 'tank' ? 350 : (enemy.type === 'shielded' ? 280 : (enemy.type === 'block' ? 200 : 120)));
          }
          break; // この弾は敵に命中
        }
      }
      if (!bullet.active) continue;

      // 1-C. 弾丸 vs ボス & シールド核（パイロン）
      const boss = this.stage.boss;
      if (boss && boss.alive) {
        let hitBossTarget = false;
        if (boss.hasPylons) {
          boss.pylons.forEach((p, idx) => {
            if (!p.alive || hitBossTarget) return;
            const pWorld = boss.group.position.clone().add(p.mesh.position);
            if (this.isBulletCrossing(bullet, delta, pWorld.x, pWorld.z, 1.3, 1.2)) {
              hitBossTarget = true;
              if (!bullet.isMega) {
                bullet.active = false;
                bullet.mesh.visible = false;
              }
              const pKilled = boss.takePylonDamage(idx, bullet.damage);
              this.sound.playEnemyHit();
              this.fx.spawnBurst(bullet.pos, 0x00e5ff, 12);
              if (pKilled) {
                this.sound.playBossExplosion();
                this.fx.spawnBurst(pWorld, 0x00e5ff, 35);
                this.renderer.addScreenShake(0.45);
                this.ui.showGarySpeech("シールド核を破壊したぞ！", 2.2);
              }
            }
          });
        }

        if (!hitBossTarget && this.isBulletCrossing(bullet, delta, 0, boss.z, 3.2, 2.5)) {
          if (!bullet.isMega) {
            bullet.active = false;
            bullet.mesh.visible = false;
          }

          const result = boss.takeDamage(bullet.damage);
          if (result === 'shielded') {
            this.sound.playGateHit();
            this.fx.spawnBurst(bullet.pos, 0x00e5ff, 10);
            if (Math.random() < 0.08) {
              this.ui.showMojiSpeech("シールドに弾かれた！核を破壊せよ！", 2.0);
            }
          } else {
            this.sound.playEnemyHit();
            this.fx.spawnBurst(bullet.pos, boss.color, 8);

            if (result === true) {
              this.handleBossDefeated();
            }
          }
        }
      }
    }

    // =========================================================================
    // 2. プレイヤー軍団 vs ゲート通過判定
    // =========================================================================
    for (const gate of this.stage.gates) {
      if (!gate.passed && Math.abs(mojiPos.z - gate.z) < 1.6) {
        if (Math.abs(mojiPos.x - gate.x) <= gate.width / 2 + 0.35) {
          const isPos = gate.applyEffect(this.gary, this.moji, this);
          this.sound.playGatePass(isPos);
          this.fx.spawnGateRing(gate.group.position, isPos ? 0x76ff03 : 0xff1744);
          this.renderer.addScreenShake(0.25);

          if (gate.type === 'spread') {
            this.ui.showGarySpeech("3WAY弾幕発動ー！", 2.2);
          } else if (gate.type === 'power') {
            this.ui.showMojiSpeech("メガビーム砲、点火！", 2.2);
          }
        }
      }
    }

    // =========================================================================
    // 3. プレイヤー群集 vs 敵・障害物接触判定（軍団の広がり・衝突物理）
    // =========================================================================
    const armyRadiusX = Math.min(3.8, 1.0 + Math.sqrt(this.gary.count) * 0.35);
    const armyDepthZ = Math.min(3.5, 0.8 + Math.sqrt(this.gary.count) * 0.3);

    for (const enemy of this.stage.enemies) {
      if (!enemy.alive) continue;
      const ePos = enemy.group.position;

      if (enemy.type === 'laser_fence') {
        const dz = Math.abs(mojiPos.z - ePos.z);
        const dx = Math.abs(mojiPos.x - ePos.x);
        if (dz < 0.85 && dx < 2.1 && enemy.isLaserActive) {
          if (this.moji.hasShield) {
            this.moji.takeDamage(10);
            this.fx.spawnBurst(mojiPos, 0x00e5ff, 25);
            this.renderer.addScreenShake(0.3);
            this.ui.showMojiSpeech("シールドがレーザーを遮断！", 1.8);
          } else {
            this.fx.spawnBurst(mojiPos, 0xff1744, 25);
            this.renderer.addScreenShake(0.5);
            if (this.gary.count > 0) {
              this.gary.addCount(-Math.min(this.gary.count, 6));
              this.ui.showGarySpeech("レーザーが痛いよー！", 1.5);
            } else {
              this.moji.takeDamage(35);
              this.ui.showMojiSpeech("電磁レーザー被弾！", 1.8);
            }
          }
        }
      } else {
        const dxToMoji = Math.abs(mojiPos.x - ePos.x);
        const dzRelMoji = ePos.z - mojiPos.z; // 正ならもじさんより後ろ（ゲイリー群集側）、負ならもじさんより前

        // もじさん本体との直接衝突判定
        const mojiHit = (dxToMoji < 1.4 && Math.abs(dzRelMoji) < 1.4);
        // 群集全体との接触判定（もじさんの前方0.6m〜後方armyDepthZまでカバー）
        const swarmHit = (dxToMoji < armyRadiusX + 0.8 && dzRelMoji >= -0.6 && dzRelMoji <= armyDepthZ + 0.8);

        if (mojiHit || swarmHit) {
          if (enemy.type === 'cage') {
            // 救出ケージ：もじさんや群集が触れれば解放！
            enemy.alive = false;
            const count = enemy.rescueCount || 6;
            this.gary.addCount(count);
            this.sound.playGatePass(true);
            this.fx.spawnBurst(ePos, 0x64ff24, 30);
            this.ui.showGarySpeech(`仲間を${count}体救出！`, 2.0);
            this.score += 300;
          } else if (enemy.type === 'barrel') {
            // 赤バレル：接触でも大爆発
            enemy.alive = false;
            this.sound.playBarrelExplode();
            this.fx.spawnBurst(ePos, 0xff5722, 35);
            this.renderer.addScreenShake(0.55);
            this.triggerBarrelExplosion(ePos);
            if (this.moji.hasShield) {
              this.moji.takeDamage(10);
            } else if (this.gary.count > 0) {
              this.gary.addCount(-Math.min(this.gary.count, 6));
            } else {
              this.moji.takeDamage(30);
            }
          } else {
            // ブロック・敵モンスター・戦車・シールド兵との衝突：
            // 群集と敵が激突！敵のHPを削り、ゲイリーも犠牲になる
            this.renderer.addScreenShake(0.35);
            this.fx.spawnBurst(ePos, 0xff5252, 20);

            if (this.moji.hasShield) {
              this.moji.takeDamage(20);
              const killed = enemy.takeDamage(100);
              if (killed) {
                this.sound.playEnemyExplode();
                this.score += 200;
              }
              this.ui.showMojiSpeech("シールドが激突を防御！", 1.8);
            } else if (this.gary.count > 0) {
              // ゲイリー群集が敵に突撃してHPを削る！
              const damageToEnemy = Math.min(enemy.hp, this.gary.count * 15);
              const garyLoss = Math.min(this.gary.count, Math.max(2, Math.ceil(enemy.hp / 12)));
              this.gary.addCount(-garyLoss);
              const killed = enemy.takeDamage(damageToEnemy);
              if (killed) {
                this.sound.playEnemyExplode();
                this.score += 200;
                this.ui.showGarySpeech("体当たりで突破したぞ！", 1.8);
              } else {
                this.sound.playEnemyHit();
                this.ui.showGarySpeech("いたたたっ！硬いよー！", 1.5);
              }
            } else {
              // もじさん単身での被弾
              this.moji.takeDamage(25);
              const killed = enemy.takeDamage(40);
              if (killed) {
                this.sound.playEnemyExplode();
                this.score += 200;
              }
              this.ui.showMojiSpeech("くっ、油断するな！", 1.8);
            }
          }
        }
      }
    }

    // C. 敵弾 vs プレイヤー / プレイヤー弾（2.5D XZ判定）
    for (const eb of activeEnemyBullets) {
      if (!eb.active) continue;

      // 敵弾 vs プレイヤー弾（弾丸の相殺！）
      for (const pb of activeBullets) {
        if (!pb.active) continue;
        const dx = Math.abs(eb.pos.x - pb.pos.x);
        const dz = Math.abs(eb.pos.z - pb.pos.z);
        if (dx < 0.85 && dz < 1.2) {
          eb.active = false;
          eb.mesh.visible = false;
          if (!pb.isMega) {
            pb.active = false;
            pb.mesh.visible = false;
          }
          this.fx.spawnBurst(eb.pos, 0xffd54f, 10);
          this.sound.playEnemyHit();
          break;
        }
      }

      if (!eb.active) continue;

      // 敵弾 vs プレイヤー
      const dxToPlayer = Math.abs(eb.pos.x - mojiPos.x);
      const dzToPlayer = Math.abs(eb.pos.z - mojiPos.z);
      if (dxToPlayer < 1.35 && dzToPlayer < 1.35) {
        eb.active = false;
        eb.mesh.visible = false;
        this.fx.spawnBurst(eb.pos, 0xff1744, 18);
        this.renderer.addScreenShake(0.4);

        if (this.moji.hasShield) {
          this.moji.takeDamage(10); // シールドが完全防御！
          this.ui.showMojiSpeech("シールドが被弾を防御！", 1.8);
        } else if (this.gary.count > 0) {
          this.gary.addCount(-Math.min(this.gary.count, 4));
          this.ui.showGarySpeech("ゲイリーが守るよ！", 1.5);
        } else {
          this.moji.takeDamage(eb.damage);
          this.ui.showMojiSpeech("被弾した！持ちこたえろ！", 1.8);
        }
      }
    }

    // D. 弾丸 vs ボス & シールド核（パイロン）
    const boss = this.stage.boss;
    if (boss && boss.alive) {
      if (!this.bossAlerted && Math.abs(mojiPos.z - boss.z) < 55) {
        this.bossAlerted = true;
        this.ui.showMojiSpeech(`${boss.name} 出現！総員突撃！`, 3.0);
        setTimeout(() => this.ui.showGarySpeech("ゲイリー軍団、いっけーー！", 3.0), 1200);
      }

      for (const bullet of activeBullets) {
        if (!bullet.active) continue;

        // 1. パイロン（シールド核）への攻撃判定（CCD swept 判定）
        if (boss.hasPylons) {
          let hitPylon = false;
          boss.pylons.forEach((p, idx) => {
            if (!p.alive || hitPylon) return;
            const pWorld = boss.group.position.clone().add(p.mesh.position);
            if (this.isBulletCrossing(bullet, delta, pWorld.x, pWorld.z, 1.3, 1.2)) {
              hitPylon = true;
              if (!bullet.isMega) {
                bullet.active = false;
                bullet.mesh.visible = false;
              }
              const pKilled = boss.takePylonDamage(idx, bullet.damage);
              this.sound.playEnemyHit();
              this.fx.spawnBurst(bullet.pos, 0x00e5ff, 12);
              if (pKilled) {
                this.sound.playBossExplosion();
                this.fx.spawnBurst(pWorld, 0x00e5ff, 35);
                this.renderer.addScreenShake(0.45);
                this.ui.showGarySpeech("シールド核を破壊したぞ！", 2.2);
              }
            }
          });
          if (hitPylon) continue;
        }

        // 2. ボス本体への攻撃判定（CCD swept 判定）
        if (this.isBulletCrossing(bullet, delta, 0, boss.z, 3.2, 2.5)) {
          if (!bullet.isMega) {
            bullet.active = false;
            bullet.mesh.visible = false;
          }

          const result = boss.takeDamage(bullet.damage);
          if (result === 'shielded') {
            this.sound.playGateHit();
            this.fx.spawnBurst(bullet.pos, 0x00e5ff, 10);
            if (Math.random() < 0.08) {
              this.ui.showMojiSpeech("シールドに弾かれた！核を破壊せよ！", 2.0);
            }
          } else {
            this.sound.playEnemyHit();
            this.fx.spawnBurst(bullet.pos, boss.color, 8);

            if (result === true) {
              this.handleBossDefeated();
            }
          }
        }
      }

      // ボス直接接触
      if (boss.alive && mojiPos.z <= boss.z + 2.0) {
        this.moji.takeDamage(100);
      }
    }

    // E. ボーナスロードの通過判定
    if (this.state === 'BONUS_ROAD') {
      for (const zone of this.stage.bonusZones) {
        if (!zone.passed && mojiPos.z <= zone.z) {
          zone.passed = true;
          this.stage.bonusMultiplier = zone.multiplier;
          this.sound.playGatePass(true);
          this.fx.spawnGateRing(zone.mesh.position, 0xffd700);
          this.renderer.addScreenShake(0.15);
        }
      }

      const currentLevelData = CONFIG.LEVELS[(this.currentLevel - 1) % CONFIG.LEVELS.length];
      const lastZoneZ = -currentLevelData.distance - 120;
      if (mojiPos.z <= lastZoneZ) {
        this.handleStageClear();
      }
    }
  }

  triggerBarrelExplosion(barrelPos) {
    // 範囲3.8m以内の敵すべてに誘爆大ダメージ
    for (const other of this.stage.enemies) {
      if (!other.alive) continue;
      const d = other.group.position.distanceTo(barrelPos);
      if (d < 3.8) {
        const dead = other.takeDamage(150);
        if (dead) {
          this.sound.playEnemyExplode();
          this.fx.spawnBurst(other.group.position, 0xff9100, 20);
          this.fx.spawnCoins(other.group.position, 4);
          this.score += 150;
        }
      }
    }
  }

  handleBossDefeated() {
    this.sound.playBossExplosion();
    this.renderer.addScreenShake(0.85);
    const bossPos = this.stage.boss.group.position;

    // 連続大爆発＆大量コイン放出！
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 4.5,
          Math.random() * 3.5,
          (Math.random() - 0.5) * 4.5
        );
        this.fx.spawnBurst(bossPos.clone().add(offset), 0xffd700, 35);
        this.fx.spawnCoins(bossPos.clone().add(offset), 5);
      }, i * 110);
    }

    this.score += 2500;
    this.state = 'BONUS_ROAD';

    this.ui.showGarySpeech("やったーー！ボス粉砕！", 3.0);
    setTimeout(() => this.ui.showMojiSpeech("見事だ、ゲイリー！ボーナス突入！", 3.0), 1200);

    // フェイルセーフ：万一の座標ズレでも最大5.5秒後に確実にクリア画面へ
    if (this.clearSafetyTimer) clearTimeout(this.clearSafetyTimer);
    this.clearSafetyTimer = setTimeout(() => {
      if (this.state === 'BONUS_ROAD') {
        this.handleStageClear();
      }
    }, 5500);
  }

  handleStageClear() {
    if (this.state === 'CLEAR') return; // 多重呼び出しガード
    this.state = 'CLEAR';
    if (this.clearSafetyTimer) clearTimeout(this.clearSafetyTimer);

    this.sound.stopBgm();
    this.sound.playGatePass(true);
    this.fx.triggerVictoryConfetti(this.moji.position);

    // 最終スコア算出（ゲイリー生存数 × ボーナス倍率）
    const finalScore = Math.round(this.score + this.gary.count * 120 * this.stage.bonusMultiplier);
    this.ui.showClear(finalScore, this.gary.count, this.stage.bonusMultiplier, this.currentLevel);
  }

  handleGameOver() {
    this.state = 'GAMEOVER';
    this.sound.stopBgm();
    this.renderer.addScreenShake(0.65);
    this.ui.showGameOver(this.score);
  }

  render(delta) {
    this.renderer.updateCamera(this.moji.position, delta);
    this.renderer.render();
  }
}

// ゲーム起動
window.addEventListener('DOMContentLoaded', () => {
  window.__game = new GameApp();
});
