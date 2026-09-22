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

  // 床タイル（DQ風ダンジョン敷石）
  _drawFloorTile(ctx, px, py) {
    ctx.fillStyle = '#263042';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 敷石の目地
    ctx.strokeStyle = '#18202c';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);

    // タイル表面の微小な明暗（テクスチャ感）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize / 2 - 2);
  }

  // 通路タイル
  _drawCorridorTile(ctx, px, py) {
    ctx.fillStyle = '#171e28';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);
    ctx.strokeStyle = '#0f141b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);
  }

  // 壁タイル（立体感・陰影）
  _drawWallTile(ctx, px, py, dungeon, x, y) {
    // 壁上面
    ctx.fillStyle = '#48566a';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 上部ハイライト
    ctx.fillStyle = '#62748d';
    ctx.fillRect(px, py, this.tileSize, 3);

    // 下側が床なら深めの影
    const southIsFloor = (y + 1 < dungeon.height && dungeon.tiles[y + 1][x] !== CONFIG.TILE.WALL);
    if (southIsFloor) {
      ctx.fillStyle = '#2e3846';
      ctx.fillRect(px, py + this.tileSize - 14, this.tileSize, 14);
      ctx.fillStyle = '#151b22';
      ctx.fillRect(px, py + this.tileSize - 4, this.tileSize, 4);
    }

    // レンガ目地
    ctx.strokeStyle = '#323d4c';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
  }

  // 扉タイル
  _drawDoorTile(ctx, px, py) {
    this._drawCorridorTile(ctx, px, py);
    ctx.fillStyle = '#6d4522';
    ctx.fillRect(px + 6, py + 4, this.tileSize - 12, this.tileSize - 8);
    ctx.strokeStyle = '#d4883b';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 8, py + 6, this.tileSize - 16, this.tileSize - 12);
    // 金属取っ手
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.arc(px + this.tileSize - 12, py + this.tileSize / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 階段タイル（オリジナル階段スプライト）
  _drawStairsTile(ctx, px, py) {
    this._drawFloorTile(ctx, px, py);
    const stairsImg = this.getImage('./assets/props/stairs.png');
    if (stairsImg) {
      ctx.drawImage(stairsImg, px + 3, py + 3, this.tileSize - 6, this.tileSize - 6);
    } else {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(px + 6, py + 6, this.tileSize - 12, this.tileSize - 12);
    }
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
        const maxDim = this.tileSize * 0.72;
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
      const wobble = Math.sin(now / 220 + m.instanceId * 1.5) * 2;

      // モンスター足元の影
      ctx.beginPath();
      ctx.ellipse(cx, cy + this.tileSize / 2 - 4, 16, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();

      // モンスターのオリジナルスプライト描画
      const img = this.getImage(m.sprite);
      if (img) {
        // ドラゴンとゴーレムは迫力ある大判サイズ
        const maxDim = (m.id === 'dragon' || m.id === 'golem') ? this.tileSize * 1.05 : this.tileSize * 0.88;
        const scale = Math.min(maxDim / img.width, maxDim / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, cx - sw / 2, cy + this.tileSize / 2 - sh - 2 + wobble, sw, sh);
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
