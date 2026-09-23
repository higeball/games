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
    const monsters = ['slime', 'dracky', 'ghost', 'mushroom', 'mage', 'zombie', 'metal_slime', 'golem', 'dragon'];
    const dirs = ['down', 'up', 'left', 'right'];
    const monsterAssets = monsters.flatMap(m => [
      ...dirs.map(d => `./assets/monsters/${m}_${d}.png`),
      `./assets/monsters/${m}.png`
    ]);

    const assets = [
      ...monsterAssets,
      // アイテム
      './assets/items/club.png',
      './assets/items/bronze_sword.png',
      './assets/items/iron_axe.png',
      './assets/items/dragon_killer.png',
      './assets/items/metal_king_sword.png',
      './assets/items/soroban.png',
      './assets/items/leather_shield.png',
      './assets/items/bronze_shield.png',
      './assets/items/scale_shield.png',
      './assets/items/steel_shield.png',
      './assets/items/dragon_shield.png',
      './assets/items/metal_king_shield.png',
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
      // UI
      './assets/ui/turn.png',
      './assets/ui/map.png',
      './assets/ui/wait.png',
    ];

    assets.forEach(src => this.getImage(src));
  }

  getMonsterSprite(m) {
    const dir = m.facingName || 'down';
    const directionalSrc = `./assets/monsters/${m.id}_${dir}.png`;
    return this.getImage(directionalSrc) || this.getImage(m.sprite) || this.getImage(`./assets/monsters/${m.id}.png`);
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

  // 斬撃エフェクト追加（装備武器に応じたエフェクト）
  addSlashEffect(tileX, tileY, weapon = null) {
    this.effects.push({
      type: 'slash',
      weaponId: weapon ? weapon.id : null,
      x: tileX * this.tileSize + this.tileSize / 2,
      y: tileY * this.tileSize + this.tileSize / 2,
      life: 14,
      maxLife: 14
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
        const alpha = isVisible ? 1.0 : 0.4;
        ctx.globalAlpha = alpha;

        switch (tile) {
          case CONFIG.TILE.WALL:
            this._drawWallTile(ctx, px, py, dungeon, x, y);
            break;

          case CONFIG.TILE.FLOOR:
            this._drawFloorTile(ctx, px, py, dungeon, x, y);
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

        // 通路内の松明の減衰（本家トルネコ風の円形トーチライト演出）
        if (isVisible && dungeon.roomMap[y][x] === -1 && tile === CONFIG.TILE.CORRIDOR) {
          const tileCx = px + this.tileSize / 2;
          const tileCy = py + this.tileSize / 2;
          const pcx = (player.prevX + (player.x - player.prevX) * player.animProgress) * this.tileSize + this.tileSize / 2;
          const pcy = (player.prevY + (player.y - player.prevY) * player.animProgress) * this.tileSize + this.tileSize / 2;
          const dist = Math.hypot(tileCx - pcx, tileCy - pcy);
          const torchRadius = this.tileSize * 2.0;
          if (dist > torchRadius) {
            const dark = Math.min(0.55, (dist - torchRadius) / (this.tileSize * 0.9));
            ctx.fillStyle = `rgba(4, 7, 16, ${dark})`;
            ctx.fillRect(px, py, this.tileSize, this.tileSize);
          }
        }

        // 探索済みだが視界外のタイルには霧がかった青暗いシャドウをオーバーレイ
        if (!isVisible) {
          ctx.fillStyle = 'rgba(6, 12, 26, 0.52)';
          ctx.fillRect(px, py, this.tileSize, this.tileSize);
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

  // 床タイル（本家トルネコSFC風・美しい敷石・石畳＋高精細斜角ベベル・アンビエントシャドウ）
  _drawFloorTile(ctx, px, py, dungeon, x, y) {
    const hash = (((x !== undefined ? x : Math.floor(px / 48)) * 37) + ((y !== undefined ? y : Math.floor(py / 48)) * 19)) & 7;
    const baseColors = ['#5e4d3a', '#5c4b38', '#61503d', '#5a4936', '#5f4e3b', '#5d4c39', '#604f3c', '#5b4a37'];
    ctx.fillStyle = baseColors[hash];
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 4つの石畳ブロックの割り付け（トルネコSFC風・高精細斜角ベベル）
    const mid = this.tileSize / 2;

    const drawStoneBlock = (bx, by, w, h, varOffset) => {
      // ブロック本体
      ctx.fillStyle = '#6a5743';
      ctx.fillRect(bx + 1, by + 1, w - 2, h - 2);

      // 上部＆左部ハイライト（明るい砂岩色）
      ctx.fillStyle = '#947e65';
      ctx.fillRect(bx + 1, by + 1, w - 2, 2);
      ctx.fillRect(bx + 1, by + 1, 2, h - 2);

      // 極上の光沢ピクセル（左上角）
      ctx.fillStyle = '#ad977d';
      ctx.fillRect(bx + 1, by + 1, 2, 2);

      // 右部＆下部シャドウ（深い影色）
      ctx.fillStyle = '#3a2d1e';
      ctx.fillRect(bx + 1, by + h - 3, w - 2, 2);
      ctx.fillRect(bx + w - 3, by + 1, 2, h - 2);

      // わずかな表面の石粒・クラックテクスチャ
      if (((hash + varOffset) & 3) === 0) {
        ctx.fillStyle = '#4c3a27';
        ctx.fillRect(bx + 5, by + 6, 2, 2);
      } else if (((hash + varOffset) & 3) === 2) {
        ctx.fillStyle = '#806c55';
        ctx.fillRect(bx + w - 7, by + 5, 2, 2);
      }
    };

    drawStoneBlock(px, py, mid, mid, 1);
    drawStoneBlock(px + mid, py, mid, mid, 2);
    drawStoneBlock(px, py + mid, mid, mid, 3);
    drawStoneBlock(px + mid, py + mid, mid, mid, 4);

    // 目地（黒褐色）
    ctx.strokeStyle = '#221910';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);
    ctx.beginPath();
    ctx.moveTo(px, py + mid);
    ctx.lineTo(px + this.tileSize, py + mid);
    ctx.moveTo(px + mid, py);
    ctx.lineTo(px + mid, py + this.tileSize);
    ctx.stroke();

    // 上部または左部が壁の場合のリアルな環境光ドロップシャドウ
    if (dungeon && y !== undefined && x !== undefined) {
      if (y > 0 && dungeon.tiles[y - 1][x] === CONFIG.TILE.WALL) {
        // 北側壁からの重厚な影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
        ctx.fillRect(px, py, this.tileSize, 4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
        ctx.fillRect(px, py + 4, this.tileSize, 4);
      }
      if (x > 0 && dungeon.tiles[y][x - 1] === CONFIG.TILE.WALL) {
        // 西側壁からの側方影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fillRect(px, py, 3, this.tileSize);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(px + 3, py, 3, this.tileSize);
      }
    }
  }

  // 通路タイル（本家トルネコ風・狭い土と砂利の通路）
  _drawCorridorTile(ctx, px, py) {
    // 通路土ベース
    ctx.fillStyle = '#34271c';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 通路両脇の深い岩陰
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(px, py, 4, this.tileSize);
    ctx.fillRect(px + this.tileSize - 4, py, 4, this.tileSize);
    ctx.fillRect(px, py, this.tileSize, 4);
    ctx.fillRect(px, py + this.tileSize - 4, this.tileSize, 4);

    // 踏み固められた砂利テクスチャ
    ctx.fillStyle = '#4a3827';
    ctx.fillRect(px + 8, py + 10, 6, 4);
    ctx.fillRect(px + 26, py + 20, 5, 4);
    ctx.fillRect(px + 14, py + 32, 7, 3);
    ctx.fillStyle = '#22180f';
    ctx.fillRect(px + 10, py + 16, 4, 3);
    ctx.fillRect(px + 22, py + 28, 4, 3);
  }

  // 壁タイル（本家トルネコSFC風・重厚な3段の石積み正面壁 ＆ 天井岩石）
  _drawWallTile(ctx, px, py, dungeon, x, y) {
    const southIsFloor = (y + 1 < dungeon.height && dungeon.tiles[y + 1][x] !== CONFIG.TILE.WALL);

    if (southIsFloor) {
      // 部屋の北側に面する「正面石壁」（トルネコ名物の立体レンガ壁）
      // 天井ヘリ・石の笠木（上部天板）
      ctx.fillStyle = '#614f3c';
      ctx.fillRect(px, py, this.tileSize, 6);
      ctx.fillStyle = '#8f775e'; // 笠木の上面ハイライト
      ctx.fillRect(px, py, this.tileSize, 2);
      ctx.fillStyle = '#1c130a'; // 笠木の下面シャドウ線
      ctx.fillRect(px, py + 5, this.tileSize, 1);

      // 石積みレンガ3段
      const brickH = 12;

      // 1段目（最も明るい）
      ctx.fillStyle = '#4c3d2e';
      ctx.fillRect(px, py + 6, this.tileSize, brickH);
      ctx.fillStyle = '#6b5742'; // 上面ハイライト
      ctx.fillRect(px, py + 6, this.tileSize, 2);
      ctx.fillStyle = '#1e140b'; // 目地
      ctx.fillRect(px + 22, py + 6, 2, brickH);

      // 2段目（中間の明るさ・目地を交互に配置）
      ctx.fillStyle = '#3f3123';
      ctx.fillRect(px, py + 18, this.tileSize, brickH);
      ctx.fillStyle = '#594633';
      ctx.fillRect(px, py + 18, this.tileSize, 2);
      ctx.fillStyle = '#170f07';
      ctx.fillRect(px + 10, py + 18, 2, brickH);
      ctx.fillRect(px + 34, py + 18, 2, brickH);

      // 3段目（最下段・深淵の陰影）
      ctx.fillStyle = '#312418';
      ctx.fillRect(px, py + 30, this.tileSize, brickH + 6);
      ctx.fillStyle = '#483726';
      ctx.fillRect(px, py + 30, this.tileSize, 2);
      ctx.fillStyle = '#120b04';
      ctx.fillRect(px + 20, py + 30, 2, brickH + 6);

      // 床へ落ちる濃密な黒影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(px, py + this.tileSize - 5, this.tileSize, 5);
    } else {
      // 内部の壁・天井岩盤（均一な黒ではなく、SFCらしい洞窟岩盤テクスチャ）
      ctx.fillStyle = '#1f1710';
      ctx.fillRect(px, py, this.tileSize, this.tileSize);

      // 岩石の裂け目・テクスチャ
      ctx.strokeStyle = '#2c2117';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);

      ctx.fillStyle = '#150f09';
      ctx.fillRect(px + 4, py + 4, this.tileSize - 8, this.tileSize - 8);

      // 岩肌の微小ハイライト
      ctx.fillStyle = '#382b1f';
      ctx.fillRect(px + 8, py + 8, 4, 2);
      ctx.fillRect(px + 28, py + 22, 5, 2);
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
    ctx.fillStyle = '#140e09';
    ctx.fillRect(px + 4, py + 4, this.tileSize - 8, this.tileSize - 8);

    // 4段の石段（奥へ行くほど深いブルーブラックの闇へ）
    const steps = [
      { y: 6, h: 8, bg: '#3e5672', hi: '#82a9d4', edge: '#293a4f' },
      { y: 14, h: 8, bg: '#2b3d52', hi: '#5c80a8', edge: '#1b2837' },
      { y: 22, h: 8, bg: '#1a2736', hi: '#3d5977', edge: '#0e1620' },
      { y: 30, h: 12, bg: '#0b121b', hi: '#213348', edge: '#05090f' },
    ];

    steps.forEach(s => {
      ctx.fillStyle = s.bg;
      ctx.fillRect(px + 6, py + s.y, this.tileSize - 12, s.h);
      ctx.fillStyle = s.hi; // 階段フチのハイライト
      ctx.fillRect(px + 6, py + s.y, this.tileSize - 12, 2);
      ctx.fillStyle = s.edge; // 階段角の影
      ctx.fillRect(px + 6, py + s.y + s.h - 1, this.tileSize - 12, 1);
    });

    // 階段のフチ取り石枠
    ctx.strokeStyle = '#947e65';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 5, py + 5, this.tileSize - 10, this.tileSize - 10);

    // 神秘的な青白い光のオーラ
    const pulse = 0.2 + 0.15 * Math.sin(Date.now() / 300);
    ctx.fillStyle = `rgba(0, 229, 255, ${pulse})`;
    ctx.fillRect(px + 8, py + 8, this.tileSize - 16, 8);
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

      // モンスターの4方向オリジナルスプライト描画
      const img = this.getMonsterSprite(m);
      ctx.save();
      if (m.hurtTimer > 0) {
        ctx.filter = 'brightness(2.5)';
      }
      if (img) {
        // ドラゴンとゴーレムは少し大きめ(44px)、他は38px前後でもじさんと統一
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
      ctx.restore();

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

    const cx = px + this.tileSize / 2;
    const cy = py + this.tileSize / 2;

    // プレイヤー足元の楕円シャドウ（地面への接地感）
    ctx.beginPath();
    ctx.ellipse(cx, cy + 15, 15, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // 向きガイド（トルネコ風ゴールド矢印）
    const angle = Math.atan2(player.dir.dy, player.dir.dx);
    const arrowDist = this.tileSize * 0.46;
    const ax = cx + Math.cos(angle) * arrowDist;
    const ay = cy + Math.sin(angle) * arrowDist;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 歩行時の軽快な上下バウンス（1px）
    const walkBounce = (player.animProgress < 1.0 && player.walkFrame % 2 === 0) ? -1.5 : 0;

    // 装備の背面レイヤー描画（上向き時の盾・武器、横向き時の盾など）
    this._renderPlayerEquipment(ctx, player, cx, cy, walkBounce, 'back');

    // スプライト描画
    const frames = player.sprites[player.facingName];
    const frameIdx = (player.walkFrame - 1) % 3;
    const img = frames && frames[frameIdx];

    if (img && img.complete && img.naturalWidth > 0) {
      // 64x64 スプライトをタイルの中心に合わせて描画
      const spriteW = 56;
      const spriteH = 56;
      ctx.drawImage(img, cx - spriteW / 2, cy - spriteH / 2 - 4 + walkBounce, spriteW, spriteH);
    } else {
      // ロード中フォールバック
      ctx.beginPath();
      ctx.arc(cx, cy + walkBounce, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#ff5722';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('も', cx, cy + walkBounce);
    }

    // 装備の前面レイヤー描画（下向き時の盾・武器、横向き時の武器など）
    this._renderPlayerEquipment(ctx, player, cx, cy, walkBounce, 'front');

    // プレイヤー睡眠時の "Zzz"
    if (player.sleepTurns > 0) {
      this._drawSleepBalloon(ctx, cx + 14, cy - 20);
    }
  }

  // プレイヤー装備品（武器・盾）の4方向描画
  _renderPlayerEquipment(ctx, player, cx, cy, walkBounce, layer) {
    const facing = player.facingName || 'down';
    const isAttacking = (player.isAttacking || 0) > 0;
    const attRatio = isAttacking ? (player.isAttacking / 8) : 0;

    const weaponImg = player.equippedWeapon ? this.getImage(player.equippedWeapon.sprite) : null;
    const shieldImg = player.equippedShield ? this.getImage(player.equippedShield.sprite) : null;

    if (!weaponImg && !shieldImg) return;

    const baseCy = cy - 4 + walkBounce;

    if (facing === 'down') {
      if (layer !== 'front') return;

      // 1. 武器（もじさんの右手 = 画面向かって左）
      if (weaponImg) {
        ctx.save();
        const wx = cx - 15;
        const wy = baseCy + 1 + (isAttacking ? 4 * attRatio : 0);
        ctx.translate(wx, wy);

        // 攻撃モーション時は前方に振り下ろす
        const swingAngle = isAttacking ? (-0.2 + 0.65 * attRatio) * Math.PI : -0.22 * Math.PI;
        ctx.rotate(swingAngle);

        const wSize = 24;
        ctx.drawImage(weaponImg, -wSize / 2, -wSize / 2, wSize, wSize);
        ctx.restore();
      }

      // 2. 盾（もじさんの左腕 = 画面向かって右）
      if (shieldImg) {
        ctx.save();
        const sx = cx + 15;
        const sy = baseCy + 3;
        ctx.translate(sx, sy);
        const sSize = 22;
        ctx.drawImage(shieldImg, -sSize / 2, -sSize / 2, sSize, sSize);
        ctx.restore();
      }
    } else if (facing === 'up') {
      if (layer !== 'back') return;

      // 1. 武器（もじさんの右手 = 画面向かって右）
      if (weaponImg) {
        ctx.save();
        const wx = cx + 15;
        const wy = baseCy - 6 - (isAttacking ? 7 * attRatio : 0);
        ctx.translate(wx, wy);
        ctx.rotate(-0.35 * Math.PI);
        const wSize = 22;
        ctx.drawImage(weaponImg, -wSize / 2, -wSize / 2, wSize, wSize);
        ctx.restore();
      }

      // 2. 盾（もじさんの左腕 = 画面向かって左）
      if (shieldImg) {
        ctx.save();
        const sx = cx - 14;
        const sy = baseCy + 1;
        ctx.translate(sx, sy);
        ctx.filter = 'brightness(0.72)'; // 盾の裏面トーン
        const sSize = 21;
        ctx.drawImage(shieldImg, -sSize / 2, -sSize / 2, sSize, sSize);
        ctx.restore();
      }
    } else if (facing === 'left') {
      if (layer === 'back') {
        if (shieldImg) {
          ctx.save();
          const sx = cx + 12;
          const sy = baseCy + 3;
          ctx.translate(sx, sy);
          ctx.scale(0.65, 0.95); // 側面のパースペクティブ
          const sSize = 22;
          ctx.drawImage(shieldImg, -sSize / 2, -sSize / 2, sSize, sSize);
          ctx.restore();
        }
      } else if (layer === 'front') {
        if (weaponImg) {
          ctx.save();
          const wx = cx - 16 - (isAttacking ? 8 * attRatio : 0);
          const wy = baseCy + 2;
          ctx.translate(wx, wy);
          const swingAngle = isAttacking ? (0.25 - 0.3 * attRatio) * Math.PI : 0.25 * Math.PI;
          ctx.rotate(swingAngle);
          const wSize = 22;
          ctx.drawImage(weaponImg, -wSize / 2, -wSize / 2, wSize, wSize);
          ctx.restore();
        }
      }
    } else if (facing === 'right') {
      if (layer === 'back') {
        if (shieldImg) {
          ctx.save();
          const sx = cx - 12;
          const sy = baseCy + 3;
          ctx.translate(sx, sy);
          ctx.scale(0.65, 0.95);
          const sSize = 22;
          ctx.drawImage(shieldImg, -sSize / 2, -sSize / 2, sSize, sSize);
          ctx.restore();
        }
      } else if (layer === 'front') {
        if (weaponImg) {
          ctx.save();
          const wx = cx + 16 + (isAttacking ? 8 * attRatio : 0);
          const wy = baseCy + 2;
          ctx.translate(wx, wy);
          ctx.scale(-1, 1);
          const swingAngle = isAttacking ? (0.25 - 0.3 * attRatio) * Math.PI : 0.25 * Math.PI;
          ctx.rotate(swingAngle);
          const wSize = 22;
          ctx.drawImage(weaponImg, -wSize / 2, -wSize / 2, wSize, wSize);
          ctx.restore();
        }
      }
    }
  }

  // エフェクト描画（武器種別に応じた斬撃エフェクト＆火花）
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

        const radius = 24 * (0.8 + progress * 0.4);
        const alpha = Math.max(0, 1 - progress);

        let mainColor = `rgba(255, 255, 255, ${alpha})`;
        let glowColor = `rgba(255, 235, 59, ${alpha * 0.6})`;
        let arcWidth = 4;

        if (fx.weaponId === 'dragon_killer') {
          mainColor = `rgba(255, 60, 0, ${alpha})`;
          glowColor = `rgba(255, 200, 0, ${alpha * 0.8})`;
          arcWidth = 5;
        } else if (fx.weaponId === 'metal_king_sword') {
          mainColor = `rgba(180, 245, 255, ${alpha})`;
          glowColor = `rgba(0, 229, 255, ${alpha * 0.9})`;
          arcWidth = 5;
        } else if (fx.weaponId === 'iron_axe') {
          mainColor = `rgba(220, 230, 242, ${alpha})`;
          glowColor = `rgba(140, 160, 190, ${alpha * 0.7})`;
          arcWidth = 6;
        } else if (fx.weaponId === 'soroban') {
          mainColor = `rgba(255, 215, 0, ${alpha})`;
          glowColor = `rgba(255, 160, 0, ${alpha * 0.8})`;
          arcWidth = 4;
        }

        // 光彩グロー
        ctx.beginPath();
        ctx.arc(0, 0, radius, -Math.PI * 0.75, Math.PI * 0.25);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = arcWidth + 3;
        ctx.stroke();

        // 鋭い刃筋
        ctx.beginPath();
        ctx.arc(0, 0, radius, -Math.PI * 0.75, Math.PI * 0.25);
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = arcWidth;
        ctx.stroke();

        // ヒット火花パーティクル
        for (let p = 0; p < 4; p++) {
          const sparkAngle = -Math.PI * 0.75 + (p / 3) * Math.PI;
          const sparkDist = radius + progress * 10;
          const sx = Math.cos(sparkAngle) * sparkDist;
          const sy = Math.sin(sparkAngle) * sparkDist;
          ctx.fillStyle = glowColor;
          ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
        }

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

  // レトロ風ミニマップ描画（右上に半透明オーバーレイ・ステータスウィンドウ下）
  _renderMinimap(dungeon, player, monsters) {
    const ctx = this.ctx;

    // ステータスウィンドウと重ならないよう下端より下に配置
    const statusEl = document.getElementById('status-window');
    let mapY = 88;
    if (statusEl) {
      const rect = statusEl.getBoundingClientRect();
      if (rect.bottom > 0) {
        mapY = Math.max(84, Math.round(rect.bottom + 8));
      }
    }

    // 画面幅に応じたスケール（最大幅150px程度、スマホ画面でも収まる）
    const maxMapWidth = Math.min(150, Math.floor(this.width * 0.40));
    const mapScale = Math.min(3.5, Math.max(2.0, maxMapWidth / dungeon.width));
    const mapW = Math.round(dungeon.width * mapScale);
    const mapH = Math.round(dungeon.height * mapScale);
    const mapX = Math.round(this.width - mapW - 12);

    ctx.save();

    // 外枠と背景（ドラクエ風・漆黒地に白枠）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(mapX - 4, mapY - 4, mapW + 8, mapH + 8);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapX - 4, mapY - 4, mapW + 8, mapH + 8);

    // 四隅の装飾ゴールドドット
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(mapX - 4, mapY - 4, 2, 2);
    ctx.fillRect(mapX + mapW + 2, mapY - 4, 2, 2);
    ctx.fillRect(mapX - 4, mapY + mapH + 2, 2, 2);
    ctx.fillRect(mapX + mapW + 2, mapY + mapH + 2, 2, 2);

    // 探索済みタイル描画
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        if (!dungeon.explored[y][x]) continue;

        const tile = dungeon.tiles[y][x];
        const tx = Math.round(mapX + x * mapScale);
        const ty = Math.round(mapY + y * mapScale);
        const tw = Math.max(1, Math.ceil(mapScale));
        const th = Math.max(1, Math.ceil(mapScale));

        if (tile === CONFIG.TILE.FLOOR) {
          ctx.fillStyle = dungeon.visible[y][x] ? 'rgba(74, 144, 226, 0.7)' : 'rgba(50, 90, 150, 0.4)';
          ctx.fillRect(tx, ty, tw, th);
        } else if (tile === CONFIG.TILE.CORRIDOR || tile === CONFIG.TILE.DOOR) {
          ctx.fillStyle = dungeon.visible[y][x] ? 'rgba(180, 180, 180, 0.65)' : 'rgba(110, 110, 110, 0.4)';
          ctx.fillRect(tx, ty, tw, th);
        } else if (tile === CONFIG.TILE.STAIRS) {
          ctx.fillStyle = '#00ffff';
          ctx.fillRect(tx - 1, ty - 1, tw + 2, th + 2);
        }
      }
    }

    // 地面のアイテム（明るいエメラルドグリーンの点）
    for (const item of dungeon.items) {
      if (dungeon.explored[item.y][item.x]) {
        const tx = Math.round(mapX + item.x * mapScale);
        const ty = Math.round(mapY + item.y * mapScale);
        ctx.fillStyle = '#00ff66';
        ctx.fillRect(tx, ty, Math.max(2, mapScale), Math.max(2, mapScale));
      }
    }

    // 視界内のモンスター（点滅する赤い点）
    const now = Date.now();
    const monsterBlink = Math.sin(now / 120) > 0;
    for (const m of monsters) {
      if (m.hp > 0 && dungeon.visible[m.y][m.x]) {
        const tx = Math.round(mapX + m.x * mapScale);
        const ty = Math.round(mapY + m.y * mapScale);
        ctx.fillStyle = monsterBlink ? '#ff1744' : '#ff5252';
        ctx.fillRect(tx - 1, ty - 1, Math.max(3, mapScale + 1), Math.max(3, mapScale + 1));
      }
    }

    // プレイヤー位置（点滅する鮮やかな黄色／白の点 ＋ 向きの突起）
    const playerBlink = Math.sin(now / 150) > 0;
    const ptx = Math.round(mapX + player.x * mapScale + mapScale / 2);
    const pty = Math.round(mapY + player.y * mapScale + mapScale / 2);

    ctx.fillStyle = playerBlink ? '#ffffff' : '#ffd700';
    ctx.fillRect(ptx - 2, pty - 2, 4, 4);

    if (player.dir) {
      ctx.fillStyle = '#ff9100';
      ctx.fillRect(ptx + player.dir.dx * 3 - 1, pty + player.dir.dy * 3 - 1, 2, 2);
    }

    ctx.restore();
  }
}
