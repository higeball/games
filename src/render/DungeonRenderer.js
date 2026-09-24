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
    this.isTurnMode = false; // 向き変更モード時の全8方向矢印表示フラグ

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
      './assets/props/toilet.png',
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
    return (
      this.getImage(directionalSrc) ||
      this.getImage(m.sprite) ||
      this.getImage(`./assets/monsters/${m.id}_down.png`) ||
      this.getImage(`./assets/monsters/${m.id}.png`)
    );
  }

  getImage(src) {
    if (!src) return null;
    let resolvedSrc = src;
    try {
      resolvedSrc = new URL(src, document.baseURI).href;
    } catch (e) {
      resolvedSrc = src;
    }

    let img = this.images.get(resolvedSrc);
    if (!img) {
      img = new Image();
      img.src = resolvedSrc;
      this.images.set(resolvedSrc, img);
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

  // 床タイル（オフィスタワー風・500mm角タイルカーペット市松貼り＆OAフロア目地）
  _drawFloorTile(ctx, px, py, dungeon, x, y) {
    const hash = (((x !== undefined ? x : Math.floor(px / 48)) * 37) + ((y !== undefined ? y : Math.floor(py / 48)) * 19)) & 7;
    // 上品なチャコール＆スレートブルーのオフィスタイルカーペット色
    const baseColors = ['#2e3440', '#3b4252', '#333b48', '#2b313d', '#363e4c', '#303744', '#384050', '#2d333f'];
    ctx.fillStyle = baseColors[hash];
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    const mid = this.tileSize / 2;

    // 4つのカーペットタイルの市松貼り（タテ織り・ヨコ織りテクスチャ）
    const drawCarpetSquare = (bx, by, w, h, isVertical) => {
      // カーペット下地
      ctx.fillStyle = '#374151';
      ctx.fillRect(bx + 1, by + 1, w - 2, h - 2);

      // 織り目ライン（タテまたはヨコ）
      ctx.fillStyle = '#4b5563';
      if (isVertical) {
        for (let ox = bx + 3; ox < bx + w - 3; ox += 4) {
          ctx.fillRect(ox, by + 2, 1, h - 4);
        }
        // ハイライト繊維
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(bx + 7, by + 3, 1, h - 6);
      } else {
        for (let oy = by + 3; oy < by + h - 3; oy += 4) {
          ctx.fillRect(bx + 2, oy, w - 4, 1);
        }
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(bx + 3, by + 7, w - 6, 1);
      }

      // タイル枠の薄いベベル（OAフロア感）
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    };

    drawCarpetSquare(px, py, mid, mid, false);       // 左上: ヨコ織り
    drawCarpetSquare(px + mid, py, mid, mid, true);   // 右上: タテ織り
    drawCarpetSquare(px, py + mid, mid, mid, true);   // 左下: タテ織り
    drawCarpetSquare(px + mid, py + mid, mid, mid, false); // 右下: ヨコ織り

    // オフィス床の十字目地
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py + mid);
    ctx.lineTo(px + this.tileSize, py + mid);
    ctx.moveTo(px + mid, py);
    ctx.lineTo(px + mid, py + this.tileSize);
    ctx.stroke();

    // 壁からのリアルなオフィス照明ドロップシャドウ
    if (dungeon && y !== undefined && x !== undefined) {
      if (y > 0 && dungeon.tiles[y - 1][x] === CONFIG.TILE.WALL) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(px, py, this.tileSize, 4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(px, py + 4, this.tileSize, 3);
      }
      if (x > 0 && dungeon.tiles[y][x - 1] === CONFIG.TILE.WALL) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
        ctx.fillRect(px, py, 3, this.tileSize);
      }
    }
  }

  // 通路タイル（オフィスタワー風・清潔な光沢Pタイル＆巾木廊下）
  _drawCorridorTile(ctx, px, py) {
    // 廊下Pタイルベース（少し明るいアイボリー／ニュートラルグレー）
    ctx.fillStyle = '#64748b';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 左右・上下の幅木（ダークグレーのビニル巾木）
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px, py, 3, this.tileSize);
    ctx.fillRect(px + this.tileSize - 3, py, 3, this.tileSize);
    ctx.fillRect(px, py, this.tileSize, 3);
    ctx.fillRect(px, py + this.tileSize - 3, this.tileSize, 3);

    // 通路中央のタイル分割線
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 4, py + 4, this.tileSize - 8, this.tileSize - 8);

    // 天井LEDダウンライトの床反射（清潔なオフィスビルの艶感）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(px + 8, py + 12, this.tileSize - 16, 6);
    ctx.fillRect(px + 14, py + 26, this.tileSize - 28, 4);
  }

  // 壁タイル（オフィスタワー風・スチールパーテーション＆巾木・コンセント）
  _drawWallTile(ctx, px, py, dungeon, x, y) {
    const southIsFloor = (y + 1 < dungeon.height && dungeon.tiles[y + 1][x] !== CONFIG.TILE.WALL);

    if (southIsFloor) {
      // 部屋に面するオフィスパーテーション壁正面
      // 1. 天井アルミチャンネル（上部シルバーレール）
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(px, py, this.tileSize, 5);
      ctx.fillStyle = '#e2e8f0'; // 天井レールのハイライト
      ctx.fillRect(px, py, this.tileSize, 1);
      ctx.fillStyle = '#475569';
      ctx.fillRect(px, py + 4, this.tileSize, 1);

      // 2. パーテーション化粧パネル（クリーンホワイト／ライトオフィスグレー）
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(px, py + 5, this.tileSize, this.tileSize - 12);

      // パネル中央の縦目地（24px幅のモジュール分割）
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(px + this.tileSize / 2 - 1, py + 5, 2, this.tileSize - 12);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(px + this.tileSize / 2, py + 5, 1, this.tileSize - 12);

      // パネル左右の境界目地
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(px, py + 5, 1, this.tileSize - 12);
      ctx.fillRect(px + this.tileSize - 1, py + 5, 1, this.tileSize - 12);

      // パネル上部の淡い反射
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(px + 1, py + 6, this.tileSize / 2 - 2, 2);
      ctx.fillRect(px + this.tileSize / 2 + 1, py + 6, this.tileSize / 2 - 2, 2);

      // たまに壁面に電源コンセントプレートまたは照明スイッチが付いている（オフィスのリアル感）
      const hash = ((x * 41) + (y * 23)) & 7;
      if (hash === 2) {
        // 電源コンセント（白プレート＋2つの縦穴）
        const cx = px + 12;
        const cy = py + 22;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx, cy, 6, 9);
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(cx, cy, 6, 9);
        ctx.fillStyle = '#334155';
        ctx.fillRect(cx + 2, cy + 2, 2, 2);
        ctx.fillRect(cx + 2, cy + 5, 2, 2);
      } else if (hash === 5) {
        // 照明スイッチ（ワイドスイッチプレート）
        const sx = px + 30;
        const sy = py + 18;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(sx, sy, 7, 10);
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(sx, sy, 7, 10);
        ctx.fillStyle = '#10b981'; // ほたるスイッチの緑LED
        ctx.fillRect(sx + 2, sy + 4, 3, 2);
      }

      // 3. 黒色ビニル巾木（ベースボード・オフィス定番）
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px, py + this.tileSize - 7, this.tileSize, 7);
      ctx.fillStyle = '#334155';
      ctx.fillRect(px, py + this.tileSize - 7, this.tileSize, 1);

      // 4. 床に落ちる影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
      ctx.fillRect(px, py + this.tileSize - 3, this.tileSize, 3);
    } else {
      // 内部の壁・天井裏（空調ダクト・スプリンクラーの通るダークエリア）
      ctx.fillStyle = '#111827';
      ctx.fillRect(px, py, this.tileSize, this.tileSize);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);

      ctx.fillStyle = '#1f2937';
      ctx.fillRect(px + 6, py + 6, this.tileSize - 12, this.tileSize - 12);
    }
  }

  // 扉タイル（オフィスタワー風・アルミサッシ＆すりガラスドア）
  _drawDoorTile(ctx, px, py) {
    this._drawCorridorTile(ctx, px, py);

    // アルミサッシ枠（左右）
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px, py, 5, this.tileSize);
    ctx.fillRect(px + this.tileSize - 5, py, 5, this.tileSize);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px, py, 1, this.tileSize);
    ctx.fillRect(px + this.tileSize - 5, py, 1, this.tileSize);

    // すりガラスのドアパネル
    ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.fillRect(px + 5, py + 4, this.tileSize - 10, this.tileSize - 8);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 5, py + 4, this.tileSize - 10, this.tileSize - 8);

    // ステンレスのドアハンドルバー（縦棒）
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(px + this.tileSize - 9, py + this.tileSize / 2 - 7, 2, 14);
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + this.tileSize - 7, py + this.tileSize / 2 - 7, 1, 14);

    // 上部ルームプレート（黒地に金色ドット）
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px + this.tileSize / 2 - 8, py + 6, 16, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(px + this.tileSize / 2 - 6, py + 7, 12, 2);
  }

  // 階段タイル（オフィスタワー風・非常階段 ＆ 緑の非常口ピクトグラム誘導灯）
  _drawStairsTile(ctx, px, py) {
    this._drawFloorTile(ctx, px, py);

    // 非常階段室の開口枠（スチール防火枠）
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px + 4, py + 4, this.tileSize - 8, this.tileSize - 8);

    // 鉄骨非常階段ステップ4段（グレー鉄板＋黄色安全滑り止めノンスリップ）
    const steps = [
      { y: 6, h: 7, bg: '#475569', tread: '#facc15' },
      { y: 13, h: 7, bg: '#334155', tread: '#eab308' },
      { y: 20, h: 8, bg: '#1e293b', tread: '#ca8a04' },
      { y: 28, h: 14, bg: '#0b1320', tread: '#854d0e' },
    ];

    steps.forEach(s => {
      ctx.fillStyle = s.bg;
      ctx.fillRect(px + 6, py + s.y, this.tileSize - 12, s.h);
      // 黄色の安全滑り止めノンスリップ（オフィス階段の特徴）
      ctx.fillStyle = s.tread;
      ctx.fillRect(px + 6, py + s.y, this.tileSize - 12, 2);
    });

    // スチール手すりパイプ（左右）
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px + 6, py + 6, 2, this.tileSize - 14);
    ctx.fillRect(px + this.tileSize - 8, py + 6, 2, this.tileSize - 14);

    // 緑の非常口サイン（EMERGENCY EXIT 🏃）
    const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 250);
    ctx.save();
    ctx.fillStyle = '#15803d'; // 非常口グリーン
    ctx.fillRect(px + this.tileSize / 2 - 13, py + 6, 26, 11);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + this.tileSize / 2 - 13, py + 6, 26, 11);

    // 白いピクトグラム（走る人アイコン＆下矢印）
    ctx.fillStyle = '#ffffff';
    // 頭
    ctx.fillRect(px + this.tileSize / 2 - 3, py + 8, 2, 2);
    // 体と足
    ctx.fillRect(px + this.tileSize / 2 - 4, py + 10, 4, 4);
    // 階段マーク
    ctx.fillRect(px + this.tileSize / 2 + 2, py + 12, 3, 2);
    ctx.fillRect(px + this.tileSize / 2 + 5, py + 10, 3, 2);

    // 誘導灯のグリーンネオングロー
    ctx.fillStyle = `rgba(34, 197, 94, ${0.25 * pulse})`;
    ctx.fillRect(px + 4, py + 4, this.tileSize - 8, this.tileSize - 8);
    ctx.restore();
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

      // 40F 奇跡のトイレ個室（ゴール）専用の神々しい演出
      if (item.id === 'toilet' || item.id === 'miracle_box') {
        const pulse = 0.7 + 0.3 * Math.sin(now / 180);
        ctx.beginPath();
        ctx.arc(cx, cy + bob, 22, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${0.35 * pulse})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy + bob, 16, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 235, 59, ${0.4 * pulse})`;
        ctx.fill();

        const tImg = this.getImage('./assets/props/toilet.png') || this.getImage(item.sprite);
        if (tImg) {
          const tDim = 38;
          ctx.drawImage(tImg, cx - tDim / 2, cy - tDim / 2 + bob, tDim, tDim);
        }

        // 常時光り輝くゴール名プレート
        ctx.font = 'bold 11px sans-serif';
        const label = '★ 40F トイレ ★';
        const textW = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.fillRect(cx - textW / 2 - 5, py - 20, textW + 10, 16);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - textW / 2 - 5, py - 20, textW + 10, 16);
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, py - 8);
        continue;
      }

      // 通常アイテム背面のやわらかな光
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
        // ロード中フォールバック: 単色ベタ塗りではなくDQ風のドット絵モンスターシルエット
        this._drawMonsterFallback(ctx, m, cx, cy + wobble);
      }
      ctx.restore();

      // HPゲージ（ダメージ時または戦闘中：頭上に描画）
      if (m.hp < m.maxHp || m.inCombatTimer > 0) {
        const barW = this.tileSize - 14;
        const barH = 4;
        const barX = px + 7;
        const barY = py - 4;

        ctx.fillStyle = 'rgba(0,0,0,0.9)';
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

    // 向きガイド（通常時：現在向きのゴールド矢印／向き変更モード時：全8方向矢印リング＆現在向き強ハイライト）
    if (this.isTurnMode) {
      const allDirs = [
        { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
        { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
      ];

      const now = Date.now();
      const pulse = 1.0 + 0.15 * Math.sin(now / 130);

      // 八方位ガイドサークルリング
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, this.tileSize * 0.54, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.restore();

      allDirs.forEach(d => {
        const isCurrent = (d.dx === player.dir.dx && d.dy === player.dir.dy);
        const ang = Math.atan2(d.dy, d.dx);
        const dist = this.tileSize * (isCurrent ? 0.60 : 0.52);
        const ax = cx + Math.cos(ang) * dist;
        const ay = cy + Math.sin(ang) * dist;

        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);

        if (isCurrent) {
          ctx.scale(pulse * 1.35, pulse * 1.35);
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(-5, -5);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-5, 5);
          ctx.closePath();
          ctx.fillStyle = '#ffd700';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(-4, -4);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-4, 4);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      });
    } else {
      // 通常時：現在向きのゴールド矢印
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
    }

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

    // プレイヤーの戦闘中・ダメージ時 HPゲージ（頭上に描画）
    if (player.hp < player.maxHp || (player.inCombatTimer || 0) > 0) {
      const barW = this.tileSize - 12;
      const barH = 5;
      const barX = px + 6;
      const barY = py - 6 + walkBounce;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      const hpRatio = Math.max(0, player.hp / player.maxHp);
      ctx.fillStyle = hpRatio > 0.5 ? '#00e676' : (hpRatio > 0.25 ? '#ffeb3b' : '#ff1744');
      ctx.fillRect(barX, barY, Math.round(barW * hpRatio), barH);
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
          const wx = cx - 14 - (isAttacking ? 6 * attRatio : 0);
          const wy = baseCy + 1 + (isAttacking ? 2 * attRatio : 0);
          ctx.translate(wx, wy);
          // 横向き時も縦向きに構える (-0.22 * PI で垂直上向き)
          const swingAngle = isAttacking ? (-0.22 - 0.28 * attRatio) * Math.PI : -0.22 * Math.PI;
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
          const wx = cx + 14 + (isAttacking ? 6 * attRatio : 0);
          const wy = baseCy + 1 + (isAttacking ? 2 * attRatio : 0);
          ctx.translate(wx, wy);
          ctx.scale(-1, 1);
          // 横向き時も縦向きに構える (-0.22 * PI で垂直上向き)
          const swingAngle = isAttacking ? (-0.22 - 0.28 * attRatio) * Math.PI : -0.22 * Math.PI;
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

  // ロード中フォールバック：単色四角ではなくDQ風のドット絵モンスターシルエットを描画
  _drawMonsterFallback(ctx, m, cx, cy) {
    ctx.save();
    // モンスターの体
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 14, 0, Math.PI * 2);
    ctx.fillStyle = m.color || '#3b82f6';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 大きな目（DQ風）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 4, 3.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 黒い瞳
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx - 4.5, cy - 4, 1.8, 0, Math.PI * 2);
    ctx.arc(cx + 4.5, cy - 4, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 頭文字バッジ
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(m.name ? m.name[0] : '敵', cx, cy + 8);
    ctx.restore();
  }
}
