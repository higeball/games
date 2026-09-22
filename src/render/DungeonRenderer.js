/**
 * DungeonRenderer - キャンバス描画エンジン
 * 本家ドラゴンクエスト／トルネコ風のピクセルアート描画
 * 絵文字を一切使用せず、オリジナルグラフィック・スプライトを描画
 */

import { CONFIG } from '../config.js';

export class DungeonRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = CONFIG.DUNGEON.TILE_SIZE; // 48px

    this.camera = { x: 0, y: 0 };
    this.floatingTexts = []; // { text, x, y, color, life, maxLife }
    this.effects = [];       // { type, x, y, life, maxLife, ... }

    this.showMinimap = true;

    // スプライト画像キャッシュ
    this.images = new Map();
    this._preloadAssets();
  }

  _preloadAssets() {
    const assets = [
      // モンスター
      './assets/monsters/slime.png',
      './assets/monsters/dracky.png',
      './assets/monsters/ghost.png',
      './assets/monsters/mushroom.png',
      './assets/monsters/mage.png',
      './assets/monsters/zombie.png',
      './assets/monsters/metal_slime.png',
      './assets/monsters/golem.png',
      './assets/monsters/dragon.png',
      // アイテム
      './assets/items/club.png',
      './assets/items/bronze_sword.png',
      './assets/items/iron_axe.png',
      './assets/items/dragon_killer.png',
      './assets/items/leather_shield.png',
      './assets/items/bronze_shield.png',
      './assets/items/dragon_shield.png',
      './assets/items/bread.png',
      './assets/items/big_bread.png',
      './assets/items/rotten_bread.png',
      './assets/items/herb.png',
      './assets/items/otogiri.png',
      './assets/items/scroll.png',
      './assets/items/staff.png',
      './assets/items/arrow.png',
      './assets/items/miracle_box.png',
      // プロップ
      './assets/props/stairs.png',
      './assets/props/gold.png',
      './assets/props/trap.png',
    ];

    assets.forEach(src => this.getImage(src));
  }

  getImage(src) {
    if (!src) return null;
    let img = this.images.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      this.images.set(src, img);
    }
    return (img.complete && img.naturalWidth > 0) ? img : null;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false; // レトロなピクセル描画
  }

  // カメラをプレイヤーに追従
  updateCamera(player) {
    const px = (player.prevX + (player.x - player.prevX) * player.animProgress) * this.tileSize + this.tileSize / 2;
    const py = (player.prevY + (player.y - player.prevY) * player.animProgress) * this.tileSize + this.tileSize / 2;

    this.camera.x = px - this.width / 2;
    this.camera.y = py - this.height / 2;
  }

  // 浮遊テキスト追加（ダメージ数、EXP等）
  addFloatingText(text, tileX, tileY, color = '#ffeb3b') {
    this.floatingTexts.push({
      text,
      x: tileX * this.tileSize + this.tileSize / 2,
      y: tileY * this.tileSize,
      color,
      life: 45,
      maxLife: 45
    });
  }

  // 斬撃エフェクト追加
  addSlashEffect(tileX, tileY) {
    this.effects.push({
      type: 'slash',
      x: tileX * this.tileSize + this.tileSize / 2,
      y: tileY * this.tileSize + this.tileSize / 2,
      life: 12,
      maxLife: 12
    });
  }

  // 全体描画
  render(dungeon, player, monsters) {
    const ctx = this.ctx;
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

    // 1. ダンジョンタイル描画
    this._renderTiles(dungeon, player);

    // 2. 地面のアイテム描画
    this._renderItems(dungeon, player);

    // 3. モンスター描画
    this._renderMonsters(monsters, dungeon, player);

    // 4. プレイヤー（もじさん）描画
    this._renderPlayer(player);

    // 5. エフェクト・斬撃描画
    this._renderEffects();

    // 6. ダメージポップアップ描画
    this._renderFloatingTexts();

    ctx.restore();

    // 7. ミニマップ描画
    if (this.showMinimap) {
      this._renderMinimap(dungeon, player, monsters);
    }
  }

  // ダンジョンタイル描画
  _renderTiles(dungeon, player) {
    const ctx = this.ctx;
    const startCol = Math.max(0, Math.floor(this.camera.x / this.tileSize) - 1);
    const endCol = Math.min(dungeon.width - 1, Math.ceil((this.camera.x + this.width) / this.tileSize) + 1);
    const startRow = Math.max(0, Math.floor(this.camera.y / this.tileSize) - 1);
    const endRow = Math.min(dungeon.height - 1, Math.ceil((this.camera.y + this.height) / this.tileSize) + 1);

    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const isExplored = dungeon.explored[y][x];
        const isVisible = dungeon.visible[y][x];

        if (!isExplored) continue; // 未探索は暗闇

        const px = x * this.tileSize;
        const py = y * this.tileSize;
        const tile = dungeon.tiles[y][x];

        // 視界外（探索済み）は青暗くトーンダウン
        const alpha = isVisible ? 1.0 : 0.35;
        ctx.globalAlpha = alpha;

        switch (tile) {
          case CONFIG.TILE.WALL:
            this._drawWallTile(ctx, px, py, dungeon, x, y);
            break;

          case CONFIG.TILE.FLOOR:
            this._drawFloorTile(ctx, px, py);
            break;

          case CONFIG.TILE.CORRIDOR:
            this._drawCorridorTile(ctx, px, py);
            break;

          case CONFIG.TILE.DOOR:
            this._drawDoorTile(ctx, px, py);
            break;

          case CONFIG.TILE.STAIRS:
            this._drawStairsTile(ctx, px, py);
            break;
        }

        // ワナ（発見済みまたは目薬状態）- オリジナル石板トラップスプライト
        const trap = dungeon.traps.find(t => t.x === x && t.y === y);
        if (trap && (trap.revealed || player.eyedropTurns > 0) && isVisible) {
          const trapImg = this.getImage('./assets/props/trap.png');
          if (trapImg) {
            ctx.drawImage(trapImg, px + 6, py + 6, this.tileSize - 12, this.tileSize - 12);
          } else {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 8, py + 8, this.tileSize - 16, this.tileSize - 16);
          }
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // 床タイル（本家トルネコ風・温かみのある敷石・石畳）
  _drawFloorTile(ctx, px, py) {
    // 敷石ベースカラー
    ctx.fillStyle = '#635342';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 4つの石畳ブロックの割り付け（トルネコSFC風）
    const mid = this.tileSize / 2;

    // 石ブロック1 (左上)
    ctx.fillStyle = '#6d5c4a';
    ctx.fillRect(px + 1, py + 1, mid - 2, mid - 2);
    ctx.fillStyle = '#84715d'; // 上左ハイライト
    ctx.fillRect(px + 1, py + 1, mid - 2, 2);
    ctx.fillRect(px + 1, py + 1, 2, mid - 2);
    ctx.fillStyle = '#4c3e30'; // 右下シャドウ
    ctx.fillRect(px + 1, py + mid - 3, mid - 2, 2);
    ctx.fillRect(px + mid - 3, py + 1, 2, mid - 2);

    // 石ブロック2 (右上)
    ctx.fillStyle = '#5e4e3d';
    ctx.fillRect(px + mid + 1, py + 1, mid - 2, mid - 2);
    ctx.fillStyle = '#756350';
    ctx.fillRect(px + mid + 1, py + 1, mid - 2, 2);
    ctx.fillRect(px + mid + 1, py + 1, 2, mid - 2);
    ctx.fillStyle = '#443628';
    ctx.fillRect(px + mid + 1, py + mid - 3, mid - 2, 2);
    ctx.fillRect(px + this.tileSize - 2, py + 1, 2, mid - 2);

    // 石ブロック3 (左下)
    ctx.fillStyle = '#594a3a';
    ctx.fillRect(px + 1, py + mid + 1, mid - 2, mid - 2);
    ctx.fillStyle = '#705e4c';
    ctx.fillRect(px + 1, py + mid + 1, mid - 2, 2);
    ctx.fillRect(px + 1, py + mid + 1, 2, mid - 2);
    ctx.fillStyle = '#3e3124';
    ctx.fillRect(px + 1, py + this.tileSize - 2, mid - 2, 2);
    ctx.fillRect(px + mid - 3, py + mid + 1, 2, mid - 2);

    // 石ブロック4 (右下)
    ctx.fillStyle = '#685746';
    ctx.fillRect(px + mid + 1, py + mid + 1, mid - 2, mid - 2);
    ctx.fillStyle = '#7e6b57';
    ctx.fillRect(px + mid + 1, py + mid + 1, mid - 2, 2);
    ctx.fillRect(px + mid + 1, py + mid + 1, 2, mid - 2);
    ctx.fillStyle = '#483a2d';
    ctx.fillRect(px + mid + 1, py + this.tileSize - 2, mid - 2, 2);
    ctx.fillRect(px + this.tileSize - 2, py + mid + 1, 2, mid - 2);

    // 目地（黒褐色）
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);
    ctx.beginPath();
    ctx.moveTo(px, py + mid);
    ctx.lineTo(px + this.tileSize, py + mid);
    ctx.moveTo(px + mid, py);
    ctx.lineTo(px + mid, py + this.tileSize);
    ctx.stroke();
  }

  // 通路タイル（本家トルネコ風・狭い土と砂利の通路）
  _drawCorridorTile(ctx, px, py) {
    // 通路土ベース
    ctx.fillStyle = '#3a2e22';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 通路両脇の深い岩陰
    ctx.fillStyle = '#221911';
    ctx.fillRect(px, py, 4, this.tileSize);
    ctx.fillRect(px + this.tileSize - 4, py, 4, this.tileSize);
    ctx.fillRect(px, py, this.tileSize, 4);
    ctx.fillRect(px, py + this.tileSize - 4, this.tileSize, 4);

    // 踏み固められた砂利テクスチャ
    ctx.fillStyle = '#4e3e30';
    ctx.fillRect(px + 10, py + 12, 6, 4);
    ctx.fillRect(px + 28, py + 22, 5, 4);
    ctx.fillRect(px + 16, py + 34, 7, 3);
    ctx.fillStyle = '#2a2016';
    ctx.fillRect(px + 12, py + 18, 4, 3);
    ctx.fillRect(px + 24, py + 30, 4, 3);
  }

  // 壁タイル（本家トルネコ風・3段の石積み正面壁 ＆ 天井岩石）
  _drawWallTile(ctx, px, py, dungeon, x, y) {
    const southIsFloor = (y + 1 < dungeon.height && dungeon.tiles[y + 1][x] !== CONFIG.TILE.WALL);

    if (southIsFloor) {
      // 部屋の北側に面する「正面石壁」（トルネコ名物の立体レンガ壁）
      // 天井ヘリ（上部天板）
      ctx.fillStyle = '#524333';
      ctx.fillRect(px, py, this.tileSize, 6);
      ctx.fillStyle = '#7a6652'; // ヘリの上面ハイライト
      ctx.fillRect(px, py, this.tileSize, 2);

      // 石積みレンガ3段
      const brickH = 12;
      // 1段目
      ctx.fillStyle = '#453729';
      ctx.fillRect(px, py + 6, this.tileSize, brickH);
      ctx.fillStyle = '#614f3c';
      ctx.fillRect(px, py + 6, this.tileSize, 2);
      ctx.fillStyle = '#281e15';
      ctx.fillRect(px + 22, py + 6, 2, brickH);

      // 2段目
      ctx.fillStyle = '#3a2d20';
      ctx.fillRect(px, py + 18, this.tileSize, brickH);
      ctx.fillStyle = '#544332';
      ctx.fillRect(px, py + 18, this.tileSize, 2);
      ctx.fillStyle = '#221911';
      ctx.fillRect(px + 10, py + 18, 2, brickH);
      ctx.fillRect(px + 34, py + 18, 2, brickH);

      // 3段目
      ctx.fillStyle = '#2e2217';
      ctx.fillRect(px, py + 30, this.tileSize, brickH + 6);
      ctx.fillStyle = '#463626';
      ctx.fillRect(px, py + 30, this.tileSize, 2);
      ctx.fillStyle = '#1a120c';
      ctx.fillRect(px + 20, py + 30, 2, brickH + 6);

      // 床へ落ちる深い黒影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(px, py + this.tileSize - 4, this.tileSize, 4);
    } else {
      // 内部の壁・天井岩盤
      ctx.fillStyle = '#211912';
      ctx.fillRect(px, py, this.tileSize, this.tileSize);

      // 暗い石の目地
      ctx.strokeStyle = '#2d2218';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);

      ctx.fillStyle = '#17110c';
      ctx.fillRect(px + 4, py + 4, this.tileSize - 8, this.tileSize - 8);
    }
  }

  // 扉タイル（本家トルネコ風・石造りのアーチ枠）
  _drawDoorTile(ctx, px, py) {
    this._drawCorridorTile(ctx, px, py);

    // 左右の石柱
    ctx.fillStyle = '#544434';
    ctx.fillRect(px, py, 6, this.tileSize);
    ctx.fillRect(px + this.tileSize - 6, py, 6, this.tileSize);

    ctx.fillStyle = '#7a6652';
    ctx.fillRect(px, py, 6, 2);
    ctx.fillRect(px + this.tileSize - 6, py, 6, 2);

    // 中央の木製敷居
    ctx.fillStyle = '#7d5328';
    ctx.fillRect(px + 6, py + this.tileSize / 2 - 4, this.tileSize - 12, 8);
    ctx.fillStyle = '#a8753e';
    ctx.fillRect(px + 6, py + this.tileSize / 2 - 4, this.tileSize - 12, 2);
  }

  // 階段タイル（本家トルネコ風・深淵へ続く石の降り階段）
  _drawStairsTile(ctx, px, py) {
    this._drawFloorTile(ctx, px, py);

    // 階段の掘り込み枠
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(px + 4, py + 4, this.tileSize - 8, this.tileSize - 8);

    // 4段の石段（奥へ行くほど暗いブルーブラックの闇へ）
    const steps = [
      { y: 6, h: 8, bg: '#3a5068', hi: '#6e91b5' },
      { y: 14, h: 8, bg: '#28394d', hi: '#4b698a' },
      { y: 22, h: 8, bg: '#182433', hi: '#304761' },
      { y: 30, h: 12, bg: '#0b131e', hi: '#1a293b' },
    ];

    steps.forEach(s => {
      ctx.fillStyle = s.bg;
      ctx.fillRect(px + 6, py + s.y, this.tileSize - 12, s.h);
      ctx.fillStyle = s.hi; // 階段フチのハイライト
      ctx.fillRect(px + 6, py + s.y, this.tileSize - 12, 2);
    });

    // 階段のフチ取り石枠
    ctx.strokeStyle = '#7c6854';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 5, py + 5, this.tileSize - 10, this.tileSize - 10);
  }

  // アイテム描画（オリジナルドット絵スプライト）
  _renderItems(dungeon, player) {
    const ctx = this.ctx;
    const now = Date.now();

    for (const item of dungeon.items) {
      if (!dungeon.visible[item.y][item.x]) continue;

      const px = item.x * this.tileSize;
      const py = item.y * this.tileSize;
      const cx = px + this.tileSize / 2;
      const cy = py + this.tileSize / 2;
      const bob = Math.sin(now / 240 + (item.instanceId || 0)) * 2.5;

      // 地面の丸い影
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, 13, 4.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // アイテム背面のやわらかな光
      ctx.beginPath();
      ctx.arc(cx, cy + bob, 15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 235, 59, 0.18)';
      ctx.fill();

      // オリジナルスプライト描画
      const img = this.getImage(item.sprite);
      if (img) {
        const maxDim = 28; // タイル内に収まるレトロRPG適正サイズ
        const scale = Math.min(maxDim / img.width, maxDim / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, cx - sw / 2, cy - sh / 2 + bob, sw, sh);
      } else {
        // ロード中フォールバック
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(cx - 8, cy - 8 + bob, 16, 16);
      }

      // プレイヤー直下のアイテム名プレート
      if (player.x === item.x && player.y === item.y) {
        ctx.font = 'bold 11px sans-serif';
        const textW = ctx.measureText(item.name).width;
        ctx.fillStyle = 'rgba(4, 10, 24, 0.9)';
        ctx.fillRect(cx - textW / 2 - 6, py - 20, textW + 12, 16);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - textW / 2 - 6, py - 20, textW + 12, 16);
        ctx.fillStyle = '#ffeb3b';
        ctx.textAlign = 'center';
        ctx.fillText(item.name, cx, py - 8);
      }
    }
  }

  // モンスター描画（オリジナルDQモンスタードット絵スプライト）
  _renderMonsters(monsters, dungeon, player) {
    const ctx = this.ctx;
    const now = Date.now();

    for (const m of monsters) {
      if (m.hp <= 0) continue;
      if (!dungeon.visible[m.y][m.x]) continue;

      const px = (m.prevX + (m.x - m.prevX) * m.animProgress) * this.tileSize;
      const py = (m.prevY + (m.y - m.prevY) * m.animProgress) * this.tileSize;
      const cx = px + this.tileSize / 2;
      const cy = py + this.tileSize / 2;
      const wobble = Math.sin(now / 220 + m.instanceId * 1.5) * 1.5;

      // モンスター足元の影（楕円）
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, 14, 4.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // モンスターのオリジナルスプライト描画（もじさんと同スケールで中央配置）
      const img = this.getImage(m.sprite);
      if (img) {
        // ドラゴンとゴーレムは少し大きめ(42px)、他は36px前後でもじさん(40px)と統一
        const maxDim = (m.id === 'dragon' || m.id === 'golem') ? 44 : 38;
        const scale = Math.min(maxDim / img.width, maxDim / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, cx - sw / 2, cy - sh / 2 - 1 + wobble, sw, sh);
      } else {
        // ロード中フォールバック
        ctx.fillStyle = m.color;
        ctx.fillRect(px + 10, py + 10, this.tileSize - 20, this.tileSize - 20);
      }

      // HPゲージ（ダメージ時）
      if (m.hp < m.maxHp) {
        const barW = this.tileSize - 12;
        const barH = 5;
        const barX = px + 6;
        const barY = py + this.tileSize - 3;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        const hpRatio = Math.max(0, m.hp / m.maxHp);
        ctx.fillStyle = hpRatio > 0.5 ? '#00e676' : (hpRatio > 0.25 ? '#ffeb3b' : '#ff1744');
        ctx.fillRect(barX, barY, Math.round(barW * hpRatio), barH);
      }

      // 状態異常（絵文字不使用、DQ風グラフィックシンボル）
      if (m.state === 'sleep' || m.statusSleep > 0) {
        this._drawSleepBalloon(ctx, cx + 12, cy - 14);
      } else if (m.statusConfused > 0) {
        this._drawConfuseStars(ctx, cx, cy - 18, now);
      } else if (m.statusParalyzed) {
        this._drawParalyzeSparks(ctx, cx, cy, now);
      }
    }
  }

  // 睡眠フキダシ（レトロDQ風 "Zzz"）
  _drawSleepBalloon(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#041026';
    ctx.strokeStyle = '#64b5f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 10, 26, 15, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#64b5f6';
    ctx.textAlign = 'center';
    ctx.fillText('Zzz', x + 9, y + 2);
    ctx.restore();
  }

  // 混乱星（レトロDQ風の回転星）
  _drawConfuseStars(ctx, cx, cy, now) {
    ctx.save();
    const rot = (now / 300) % (Math.PI * 2);
    for (let i = 0; i < 3; i++) {
      const angle = rot + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(angle) * 12;
      const sy = cy + Math.sin(angle) * 5;

      ctx.fillStyle = '#e040fb';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 金縛り電撃（黄色のスパーク）
  _drawParalyzeSparks(ctx, cx, cy, now) {
    ctx.save();
    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 2;
    const step = Math.floor(now / 100) % 2;
    ctx.beginPath();
    if (step === 0) {
      ctx.moveTo(cx - 8, cy - 10);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.lineTo(cx - 3, cy + 2);
      ctx.lineTo(cx + 7, cy + 10);
    } else {
      ctx.moveTo(cx + 8, cy - 10);
      ctx.lineTo(cx - 2, cy - 2);
      ctx.lineTo(cx + 3, cy + 2);
      ctx.lineTo(cx - 7, cy + 10);
    }
    ctx.stroke();
    ctx.restore();
  }

  // プレイヤー（もじさん）描画
  _renderPlayer(player) {
    const ctx = this.ctx;
    const px = (player.prevX + (player.x - player.prevX) * player.animProgress) * this.tileSize;
    const py = (player.prevY + (player.y - player.prevY) * player.animProgress) * this.tileSize;

    // 足元の向きガイド（矢印インジケーター）
    const cx = px + this.tileSize / 2;
    const cy = py + this.tileSize / 2;
    const dirDist = this.tileSize * 0.45;
    const ax = cx + player.dir.dx * dirDist;
    const ay = cy + player.dir.dy * dirDist;

    ctx.beginPath();
    ctx.arc(ax, ay, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffeb3b';
    ctx.fill();

    // スプライト描画
    const frames = player.sprites[player.facingName];
    const frameIdx = (player.walkFrame - 1) % 3;
    const img = frames && frames[frameIdx];

    if (img && img.complete && img.naturalWidth > 0) {
      // 64x64 スプライトをタイルの中心に合わせて描画
      const spriteW = 56;
      const spriteH = 56;
      ctx.drawImage(img, cx - spriteW / 2, cy - spriteH / 2 - 4, spriteW, spriteH);
    } else {
      // ロード中フォールバック
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#ff5722';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('も', cx, cy);
    }

    // プレイヤー睡眠時の "Zzz"
    if (player.sleepTurns > 0) {
      this._drawSleepBalloon(ctx, cx + 14, cy - 20);
    }
  }

  // エフェクト描画
  _renderEffects() {
    const ctx = this.ctx;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life--;
      if (fx.life <= 0) {
        this.effects.splice(i, 1);
        continue;
      }

      const progress = 1 - (fx.life / fx.maxLife);
      if (fx.type === 'slash') {
        ctx.save();
        ctx.translate(fx.x, fx.y);
        ctx.beginPath();
        ctx.arc(0, 0, 24 * (0.8 + progress * 0.4), -Math.PI * 0.75, Math.PI * 0.25);
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ダメージ数値ポップアップ描画
  _renderFloatingTexts() {
    const ctx = this.ctx;
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life--;
      ft.y -= 0.8; // 上昇
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      const alpha = Math.min(1.0, ft.life / 15);
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = alpha;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1.0;
    }
  }

  // レトロ風ミニマップ描画（右上に半透明オーバーレイ）
  _renderMinimap(dungeon, player, monsters) {
    const ctx = this.ctx;
    const mapScale = 3.5;
    const mapW = dungeon.width * mapScale;
    const mapH = dungeon.height * mapScale;
    const mapX = this.width - mapW - 14;
    const mapY = 56;

    // 背景枠
    ctx.fillStyle = 'rgba(8, 12, 20, 0.75)';
    ctx.fillRect(mapX - 4, mapY - 4, mapW + 8, mapH + 8);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX - 4, mapY - 4, mapW + 8, mapH + 8);

    // 探索済みタイル描画
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        if (!dungeon.explored[y][x]) continue;

        const tile = dungeon.tiles[y][x];
        const tx = mapX + x * mapScale;
        const ty = mapY + y * mapScale;

        if (tile === CONFIG.TILE.FLOOR) {
          ctx.fillStyle = 'rgba(100, 149, 237, 0.4)';
          ctx.fillRect(tx, ty, mapScale, mapScale);
        } else if (tile === CONFIG.TILE.CORRIDOR || tile === CONFIG.TILE.DOOR) {
          ctx.fillStyle = 'rgba(120, 120, 120, 0.45)';
          ctx.fillRect(tx, ty, mapScale, mapScale);
        } else if (tile === CONFIG.TILE.STAIRS) {
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(tx - 1, ty - 1, mapScale + 2, mapScale + 2);
        }
      }
    }

    // 地面のアイテム（緑の点）
    for (const item of dungeon.items) {
      if (dungeon.explored[item.y][item.x]) {
        ctx.fillStyle = '#76ff03';
        ctx.fillRect(mapX + item.x * mapScale, mapY + item.y * mapScale, mapScale, mapScale);
      }
    }

    // 視界内のモンスター（赤の点）
    for (const m of monsters) {
      if (m.hp > 0 && dungeon.visible[m.y][m.x]) {
        ctx.fillStyle = '#ff1744';
        ctx.fillRect(mapX + m.x * mapScale - 0.5, mapY + m.y * mapScale - 0.5, mapScale + 1, mapScale + 1);
      }
    }

    // プレイヤー位置（点滅する黄色）
    const blink = Math.sin(Date.now() / 150) > 0;
    ctx.fillStyle = blink ? '#ffeb3b' : '#ff9800';
    ctx.fillRect(mapX + player.x * mapScale - 1, mapY + player.y * mapScale - 1, mapScale + 2, mapScale + 2);
  }
}
