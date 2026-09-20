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

    this.mojiFireTimer = 0;
    this.garyFireTimer = 0;

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

    const delta = Math.min((currentTime - this.lastTime) / 1000, 0.05); // 最大50msにクランプ
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

      // 5. ステージとエンティティの更新
      this.stage.update(delta);

      // 6. 衝突判定
      this.handleCollisions();

      // 7. エフェクト更新
      this.fx.update(delta);

      // 8. HUD更新
      const totalDist = Math.abs(CONFIG.FINISH_Z);
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
      this.fx.update(delta);
    }
  }

  handleShooting(delta) {
    if (this.state !== 'PLAYING') return;

    // もじさんのレーザー射撃
    this.mojiFireTimer += delta;
    if (this.mojiFireTimer >= CONFIG.MOJI.FIRE_INTERVAL) {
      this.mojiFireTimer = 0;
      const gunPos = this.moji.getGunWorldPos();
      this.bullets.spawnBullet(gunPos, true);
      this.moji.triggerShoot();
      this.sound.playLaser();
    }

    // ゲイリー軍団のスライム弾射撃
    this.garyFireTimer += delta;
    if (this.garyFireTimer >= CONFIG.GARY.FIRE_INTERVAL && this.gary.count > 0) {
      this.garyFireTimer = 0;
      const frontGaries = this.gary.getFrontPositions(Math.min(10, Math.ceil(this.gary.count / 3)));
      frontGaries.forEach(pos => {
        const shotPos = pos.clone();
        shotPos.y += 0.3;
        shotPos.z -= 0.3;
        this.bullets.spawnBullet(shotPos, false);
      });
      this.sound.playSlimeShot();
    }
  }

  handleCollisions() {
    const activeBullets = this.bullets.getActiveBullets();
    const mojiPos = this.moji.position;

    // A. 弾丸 vs ゲート
    for (const gate of this.stage.gates) {
      if (gate.passed) continue;
      for (const bullet of activeBullets) {
        if (!bullet.active) continue;

        // ゲートとのバウンディング衝突
        const dz = Math.abs(bullet.pos.z - gate.z);
        const dx = Math.abs(bullet.pos.x - gate.x);
        if (dz < 0.8 && dx < gate.width / 2) {
          bullet.active = false;
          bullet.mesh.visible = false;
          gate.onBulletHit();
          this.sound.playGateHit();
          this.fx.spawnBurst(bullet.pos, 0x00e5ff, 6);
          break;
        }
      }

      // プレイヤー軍団 vs ゲート通過判定
      if (!gate.passed && Math.abs(mojiPos.z - gate.z) < 1.2) {
        if (Math.abs(mojiPos.x - gate.x) < gate.width / 2) {
          const isPos = gate.applyEffect(this.gary, this.moji);
          this.sound.playGatePass(isPos);
          this.fx.spawnGateRing(gate.group.position, isPos ? 0x76ff03 : 0xff1744);
          this.renderer.addScreenShake(0.2);
        }
      }
    }

    // B. 弾丸 vs 敵モンスター
    for (const enemy of this.stage.enemies) {
      if (!enemy.alive) continue;

      for (const bullet of activeBullets) {
        if (!bullet.active) continue;

        const dist = bullet.pos.distanceTo(enemy.group.position);
        if (dist < 1.1) {
          bullet.active = false;
          bullet.mesh.visible = false;

          const killed = enemy.takeDamage(bullet.damage);
          this.sound.playEnemyHit();

          if (killed) {
            this.sound.playEnemyExplode();
            this.fx.spawnBurst(enemy.group.position, 0xff1744, 25);
            this.renderer.addScreenShake(0.3);
            this.score += 150;
          }
          break;
        }
      }

      // 敵 vs プレイヤー群集（ゲイリーまたはもじさんとの接触）
      if (enemy.alive) {
        const distToMoji = mojiPos.distanceTo(enemy.group.position);
        if (distToMoji < 1.4) {
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

    // C. 弾丸 vs ボス
    const boss = this.stage.boss;
    if (boss && boss.alive) {
      // ボス接近アラート
      if (!this.bossAlerted && Math.abs(mojiPos.z - boss.z) < 55) {
        this.bossAlerted = true;
        this.ui.showMojiSpeech("巨大ボス出現！総員突撃！", 3.0);
        setTimeout(() => this.ui.showGarySpeech("ゲイリー砲、発射ーー！", 3.0), 1200);
      }

      for (const bullet of activeBullets) {
        if (!bullet.active) continue;

        const dz = Math.abs(bullet.pos.z - boss.z);
        const dx = Math.abs(bullet.pos.x);
        if (dz < 2.5 && dx < 3.2) {
          bullet.active = false;
          bullet.mesh.visible = false;

          const defeated = boss.takeDamage(bullet.damage);
          this.sound.playEnemyHit();
          this.fx.spawnBurst(bullet.pos, 0xd500f9, 8);

          if (defeated) {
            this.handleBossDefeated();
          }
        }
      }

      // ボスに到達してしまった場合
      if (boss.alive && mojiPos.z <= boss.z + 2.0) {
        this.moji.takeDamage(100);
      }
    }

    // D. ボーナスロードの通過判定
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

      // ボーナスロード終点到達でクリア！
      const lastZoneZ = CONFIG.FINISH_Z - 110;
      if (mojiPos.z <= lastZoneZ) {
        this.handleStageClear();
      }
    }
  }

  handleBossDefeated() {
    this.sound.playBossExplosion();
    this.renderer.addScreenShake(0.8);
    const bossPos = this.stage.boss.group.position;

    // 連続大爆発
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4
        );
        this.fx.spawnBurst(bossPos.clone().add(offset), 0xffd700, 30);
      }, i * 120);
    }

    this.score += 2000;
    this.state = 'BONUS_ROAD';

    this.ui.showGarySpeech("やったーー！メガボス粉砕！", 3.0);
    setTimeout(() => this.ui.showMojiSpeech("見事だ、ゲイリー！ボーナス突入！", 3.0), 1200);
  }

  handleStageClear() {
    this.state = 'CLEAR';
    this.sound.stopBgm();
    this.fx.triggerVictoryConfetti();

    // 最終スコア算出（ゲイリー生存数 × ボーナス倍率）
    const finalScore = Math.round(this.score + this.gary.count * 100 * this.stage.bonusMultiplier);
    this.ui.showClear(finalScore, this.gary.count, this.stage.bonusMultiplier);
  }

  handleGameOver() {
    this.state = 'GAMEOVER';
    this.sound.stopBgm();
    this.renderer.addScreenShake(0.6);
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
