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
    this.gary.reset();
    this.bullets.reset();
    this.fx.reset();

    const levelData = CONFIG.LEVELS[(this.currentLevel - 1) % CONFIG.LEVELS.length];
    this.stage.loadLevel(this.currentLevel);

    this.ui.startGame(levelData.title);
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

      // 5. ステージとエンティティの更新（ボスの攻撃コールバック付き）
      this.stage.update(delta, (bossPos) => this.handleBossAttack(bossPos));

      // 6. 衝突判定
      this.handleCollisions();

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
      this.ui.updateHUD(this.score, this.gary.count, this.moji.hp, this.moji.maxHp, progress);

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

  handleCollisions() {
    const activeBullets = this.bullets.getActiveBullets();
    const activeEnemyBullets = this.bullets.getActiveEnemyBullets();
    const mojiPos = this.moji.position;

    // A. 弾丸 vs ゲート
    for (const gate of this.stage.gates) {
      if (gate.passed) continue;
      for (const bullet of activeBullets) {
        if (!bullet.active) continue;

        const dz = Math.abs(bullet.pos.z - gate.z);
        const dx = Math.abs(bullet.pos.x - gate.x);
        if (dz < 0.9 && dx < gate.width / 2) {
          bullet.active = false;
          bullet.mesh.visible = false;
          gate.onBulletHit();
          this.sound.playGateHit();
          this.fx.spawnBurst(bullet.pos, 0x00e5ff, 6);
          break;
        }
      }

      // プレイヤー軍団 vs ゲート通過判定
      if (!gate.passed && Math.abs(mojiPos.z - gate.z) < 1.3) {
        if (Math.abs(mojiPos.x - gate.x) < gate.width / 2) {
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

    // B. 弾丸 vs 敵モンスター＆障害物
    for (const enemy of this.stage.enemies) {
      if (!enemy.alive) continue;

      for (const bullet of activeBullets) {
        if (!bullet.active) continue;

        const dist = bullet.pos.distanceTo(enemy.group.position);
        if (dist < 1.25) {
          if (!bullet.isMega) {
            bullet.active = false;
            bullet.mesh.visible = false;
          }

          const killed = enemy.takeDamage(bullet.damage);
          this.sound.playEnemyHit();

          if (killed) {
            if (enemy.type === 'barrel') {
              // ★爆発バレルの連鎖誘爆ギミック！★
              this.sound.playBarrelExplode();
              this.fx.spawnBurst(enemy.group.position, 0xff5722, 35);
              this.renderer.addScreenShake(0.55);
              this.triggerBarrelExplosion(enemy.group.position);
            } else {
              this.sound.playEnemyExplode();
              this.fx.spawnBurst(enemy.group.position, (enemy.type === 'block' ? 0x90a4ae : 0xff1744), 25);
              this.renderer.addScreenShake(0.25);
            }

            // コインの吸引エフェクト発生！
            this.fx.spawnCoins(enemy.group.position, enemy.type === 'tank' ? 8 : 4);
            this.score += (enemy.type === 'tank' ? 350 : (enemy.type === 'block' ? 200 : 120));
          }
          break;
        }
      }

      // 敵 vs プレイヤー群集（接触判定）
      if (enemy.alive) {
        const distToMoji = mojiPos.distanceTo(enemy.group.position);
        if (distToMoji < 1.5) {
          enemy.alive = false;
          this.fx.spawnBurst(enemy.group.position, 0xff5252, 20);
          this.renderer.addScreenShake(0.4);

          if (this.gary.count > 0) {
            this.gary.addCount(-Math.min(this.gary.count, 5));
            this.ui.showGarySpeech("いたたたっ！負けないぞ！", 1.5);
          } else {
            this.moji.takeDamage(25);
            this.ui.showMojiSpeech("くっ、油断するな！", 1.8);
          }
        }
      }
    }

    // C. ボス敵弾 vs プレイヤー / プレイヤー弾
    for (const eb of activeEnemyBullets) {
      if (!eb.active) continue;

      // 敵弾 vs プレイヤー弾（弾丸の相殺！）
      for (const pb of activeBullets) {
        if (!pb.active) continue;
        if (eb.pos.distanceTo(pb.pos) < 0.8) {
          eb.active = false;
          eb.mesh.visible = false;
          pb.active = false;
          pb.mesh.visible = false;
          this.fx.spawnBurst(eb.pos, 0xffd54f, 10);
          break;
        }
      }

      // 敵弾 vs プレイヤー
      if (eb.active && eb.pos.distanceTo(mojiPos) < 1.6) {
        eb.active = false;
        eb.mesh.visible = false;
        this.fx.spawnBurst(eb.pos, 0xff1744, 18);
        this.renderer.addScreenShake(0.4);

        if (this.gary.count > 0) {
          this.gary.addCount(-Math.min(this.gary.count, 4));
          this.ui.showGarySpeech("ゲイリーが守るよ！", 1.5);
        } else {
          this.moji.takeDamage(eb.damage);
          this.ui.showMojiSpeech("被弾した！持ちこたえろ！", 1.8);
        }
      }
    }

    // D. 弾丸 vs ボス
    const boss = this.stage.boss;
    if (boss && boss.alive) {
      if (!this.bossAlerted && Math.abs(mojiPos.z - boss.z) < 55) {
        this.bossAlerted = true;
        this.ui.showMojiSpeech(`${boss.name} 出現！総員突撃！`, 3.0);
        setTimeout(() => this.ui.showGarySpeech("ゲイリー軍団、いっけーー！", 3.0), 1200);
      }

      for (const bullet of activeBullets) {
        if (!bullet.active) continue;

        const dz = Math.abs(bullet.pos.z - boss.z);
        const dx = Math.abs(bullet.pos.x);
        if (dz < 2.6 && dx < 3.4) {
          if (!bullet.isMega) {
            bullet.active = false;
            bullet.mesh.visible = false;
          }

          const defeated = boss.takeDamage(bullet.damage);
          this.sound.playEnemyHit();
          this.fx.spawnBurst(bullet.pos, boss.color, 8);

          if (defeated) {
            this.handleBossDefeated();
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
  }

  handleStageClear() {
    this.state = 'CLEAR';
    this.sound.stopBgm();
    this.fx.triggerVictoryConfetti();

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
  new GameApp();
});
