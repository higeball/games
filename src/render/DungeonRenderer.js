/**
 * DungeonRenderer - キャンバス描画エンジン
 * トルネコ風ピクセルアート描画、視界・暗闇、もじさんアニメーション、モンスター、ミニマップ
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
    ctx.fillStyle = '#06070a';
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

        // ワナ（発見済みまたは目薬状態）
        const trap = dungeon.traps.find(t => t.x === x && t.y === y);
        if (trap && (trap.revealed || player.eyedropTurns > 0) && isVisible) {
          ctx.font = '22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', px + this.tileSize / 2, py + this.tileSize / 2);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // 床タイル
  _drawFloorTile(ctx, px, py) {
    ctx.fillStyle = '#2c3540';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);
    ctx.strokeStyle = '#1e242d';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);
  }

  // 通路タイル
  _drawCorridorTile(ctx, px, py) {
    ctx.fillStyle = '#1c222b';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);
    ctx.strokeStyle = '#14181f';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);
  }

  // 壁タイル（立体感・陰影）
  _drawWallTile(ctx, px, py, dungeon, x, y) {
    // 表面（上面）
    ctx.fillStyle = '#475569';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 下側が床なら影をつける
    const southIsFloor = (y + 1 < dungeon.height && dungeon.tiles[y + 1][x] !== CONFIG.TILE.WALL);
    if (southIsFloor) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(px, py + this.tileSize - 12, this.tileSize, 12);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(px, py + this.tileSize - 3, this.tileSize, 3);
    }

    // レンガ風目地
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
  }

  // 扉タイル
  _drawDoorTile(ctx, px, py) {
    ctx.fillStyle = '#1c222b';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);
    ctx.fillStyle = '#8d5b2d';
    ctx.fillRect(px + 6, py + 4, this.tileSize - 12, this.tileSize - 8);
    ctx.strokeStyle = '#e6a15c';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 8, py + 6, this.tileSize - 16, this.tileSize - 12);
  }

  // 階段タイル
  _drawStairsTile(ctx, px, py) {
    ctx.fillStyle = '#2c3540';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    // 下り階段の段差
    const stepH = this.tileSize / 4;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#0284c7' : '#0369a1';
      ctx.fillRect(px + 6, py + 4 + i * stepH, this.tileSize - 12, stepH);
    }

    // 階段の輝きアイコン
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪜', px + this.tileSize / 2, py + this.tileSize / 2);
  }

  // アイテム描画
  _renderItems(dungeon, player) {
    const ctx = this.ctx;
    const bob = Math.sin(Date.now() / 250) * 3;

    for (const item of dungeon.items) {
      if (!dungeon.visible[item.y][item.x]) continue;

      const px = item.x * this.tileSize;
      const py = item.y * this.tileSize;

      // アイテム背景の光るサークル
      ctx.beginPath();
      ctx.arc(px + this.tileSize / 2, py + this.tileSize / 2 + bob, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 235, 59, 0.25)';
      ctx.fill();

      // アイコン
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, px + this.tileSize / 2, py + this.tileSize / 2 + bob);

      // アイテム名バッジ（足元直下の場合表示）
      if (player.x === item.x && player.y === item.y) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(px - 10, py - 18, this.tileSize + 20, 16);
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(item.name, px + this.tileSize / 2, py - 10);
      }
    }
  }

  // モンスター描画
  _renderMonsters(monsters, dungeon, player) {
    const ctx = this.ctx;

    for (const m of monsters) {
      if (m.hp <= 0) continue;
      // プレイヤーから視界内にあるか
      if (!dungeon.visible[m.y][m.x]) continue;

      const px = (m.prevX + (m.x - m.prevX) * m.animProgress) * this.tileSize;
      const py = (m.prevY + (m.y - m.prevY) * m.animProgress) * this.tileSize;

      this._drawMonsterSprite(ctx, m, px, py);

      // HPゲージ（ダメージを受けている場合）
      if (m.hp < m.maxHp) {
        const barW = this.tileSize - 12;
        const barH = 5;
        const barX = px + 6;
        const barY = py + this.tileSize - 4;

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        const hpRatio = Math.max(0, m.hp / m.maxHp);
        ctx.fillStyle = hpRatio > 0.5 ? '#00e676' : (hpRatio > 0.25 ? '#ffeb3b' : '#ff1744');
        ctx.fillRect(barX, barY, Math.round(barW * hpRatio), barH);
      }

      // 状態異常アイコン
      if (m.state === 'sleep' || m.statusSleep > 0) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#64b5f6';
        ctx.fillText('💤', px + this.tileSize - 8, py + 12);
      } else if (m.statusConfused > 0) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#e040fb';
        ctx.fillText('💫', px + this.tileSize - 8, py + 12);
      } else if (m.statusParalyzed) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#ffd600';
        ctx.fillText('⚡', px + this.tileSize - 8, py + 12);
      }
    }
  }

  // モンスターのグラフィック描画
  _drawMonsterSprite(ctx, m, px, py) {
    const cx = px + this.tileSize / 2;
    const cy = py + this.tileSize / 2;
    const wobble = Math.sin(Date.now() / 200 + m.instanceId) * 2;

    switch (m.spriteType) {
      case 'slime':
      case 'metal':
        // スライム・はぐれメタル
        ctx.beginPath();
        ctx.arc(cx, cy + 4 + wobble, 16, 0, Math.PI);
        ctx.quadraticCurveTo(cx - 16, cy - 8, cx, cy - 14 + wobble);
        ctx.quadraticCurveTo(cx + 16, cy - 8, cx + 16, cy + 4 + wobble);
        ctx.fillStyle = m.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 目
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 6, cy + wobble, 4, 0, Math.PI * 2);
        ctx.arc(cx + 6, cy + wobble, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx - 5, cy + wobble, 2, 0, Math.PI * 2);
        ctx.arc(cx + 5, cy + wobble, 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'dracky':
        // ドラキー（コウモリ）
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🦇', cx, cy + wobble);
        break;

      case 'ghost':
        // ゴースト
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👻', cx, cy + wobble);
        break;

      case 'mushroom':
        // おばけキノコ
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍄', cx, cy + wobble);
        break;

      case 'mage':
        // まどうし
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧙‍♂️', cx, cy + wobble);
        break;

      case 'zombie':
        // くさった死体
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧟‍♂️', cx, cy + wobble);
        break;

      case 'golem':
        // ゴーレム
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🗿', cx, cy + wobble);
        break;

      case 'dragon':
        // ドラゴン
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐉', cx, cy + wobble);
        break;

      default:
        ctx.fillStyle = m.color;
        ctx.fillRect(px + 8, py + 8, this.tileSize - 16, this.tileSize - 16);
        break;
    }
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

    // 睡眠状態の「Zzz」
    if (player.sleepTurns > 0) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#64b5f6';
      ctx.fillText('💤', cx + 14, cy - 18);
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
