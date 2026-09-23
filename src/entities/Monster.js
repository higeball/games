/**
 * Monster - ダンジョンモンスタークラス
 * 睡眠、徘徊、追跡AI、特殊攻撃（睡眠、ちから低下、パン腐敗、炎ブレス）
 */

import { CONFIG } from '../config.js';

let nextMonsterId = 1;

export class Monster {
  constructor(typeKey, x, y) {
    this.instanceId = nextMonsterId++;
    this.data = CONFIG.MONSTERS[typeKey] || CONFIG.MONSTERS.slime;

    this.id = this.data.id;
    this.name = this.data.name;
    this.maxHp = this.data.hp;
    this.hp = this.maxHp;
    this.atk = this.data.atk;
    this.def = this.data.def;
    this.exp = this.data.exp;
    this.color = this.data.color;
    this.sprite = this.data.sprite || `./assets/monsters/${this.id}.png`;

    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.animProgress = 1.0;

    // 向き (dx, dy) と4方向スプライト管理
    this.dir = { dx: 0, dy: 1 };
    this.facingName = 'down'; // 'down', 'up', 'left', 'right'
    this.hurtTimer = 0;       // 被ダメージ時の白光フラッシュ

    // AI状態: 'sleep', 'wander', 'chase'
    // スライムやまどうしなどは初期状態70%で寝ている
    this.state = Math.random() < 0.65 ? 'sleep' : 'wander';

    // 状態異常
    this.statusSleep = 0;
    this.statusParalyzed = false;
    this.statusConfused = 0;
    this.statusSealed = false; // 特殊能力封印
  }

  // 向きの設定
  setDirection(dx, dy) {
    if (dx === 0 && dy === 0) return;
    this.dir = { dx: Math.sign(dx), dy: Math.sign(dy) };

    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facingName = dx > 0 ? 'right' : 'left';
    } else {
      this.facingName = dy > 0 ? 'down' : 'up';
    }
  }

  // アニメーション用移動開始
  startMove(newX, newY) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.setDirection(newX - this.x, newY - this.y);
    this.x = newX;
    this.y = newY;
    this.animProgress = 0.0;
  }

  // 目覚め
  wakeUp() {
    if (this.state === 'sleep' && this.statusSleep === 0) {
      this.state = 'chase';
      return `${this.name} は目を覚ました！`;
    }
    return null;
  }

  // AI思考ルーチン：1ターンの行動決定
  // 戻り値: { action: 'move'|'attack'|'skill'|'wait', targetX, targetY, skillType, skillMsg }
  decideAction(player, dungeon, allMonsters) {
    // 状態異常チェック
    if (this.statusSleep > 0) {
      this.statusSleep--;
      return { action: 'wait' };
    }
    if (this.statusParalyzed) {
      return { action: 'wait' };
    }

    const distToPlayer = Math.max(Math.abs(this.x - player.x), Math.abs(this.y - player.y));
    const isAdjacent = distToPlayer <= 1;

    const myRoomId = dungeon.roomMap[this.y][this.x];
    const playerRoomId = dungeon.roomMap[player.y][player.x];
    const sameRoom = (myRoomId !== -1 && myRoomId === playerRoomId);

    // 部屋に入られたら目を覚ます
    if (this.state === 'sleep') {
      if (sameRoom || isAdjacent) {
        this.state = 'chase';
      } else {
        return { action: 'wait' };
      }
    }

    // はぐれメタルは逃走AI
    if (this.id === 'metal_slime') {
      if (sameRoom || distToPlayer < 5) {
        return this._decideFlee(player, dungeon, allMonsters);
      }
    }

    // ドラゴンの遠距離炎ブレス判定（同部屋で直線上に並んだ場合）
    if (!this.statusSealed && this.id === 'dragon' && sameRoom && distToPlayer <= 5 && !isAdjacent) {
      if (this.x === player.x || this.y === player.y) {
        if (Math.random() < 0.4) {
          this.setDirection(player.x - this.x, player.y - this.y);
          return {
            action: 'skill',
            skillType: 'dragon_breath',
            targetX: player.x,
            targetY: player.y,
            skillMsg: `${this.name} は 激しい炎を吐き出した！`
          };
        }
      }
    }

    // まどうしの遠距離睡眠呪文（ラリホー）判定
    if (!this.statusSealed && this.id === 'mage' && sameRoom && distToPlayer <= 3 && !isAdjacent) {
      if (Math.random() < 0.35) {
        this.setDirection(player.x - this.x, player.y - this.y);
        return {
          action: 'skill',
          skillType: 'sleep_spell',
          targetX: player.x,
          targetY: player.y,
          skillMsg: `${this.name} は ラリホーを唱えた！`
        };
      }
    }

    // 隣接している場合は攻撃
    if (isAdjacent) {
      this.setDirection(player.x - this.x, player.y - this.y);
      // 混乱時はランダム攻撃
      if (this.statusConfused > 0) {
        this.statusConfused--;
        if (Math.random() < 0.5) {
          return { action: 'attack', targetX: player.x, targetY: player.y };
        }
      } else {
        return { action: 'attack', targetX: player.x, targetY: player.y };
      }
    }

    // ドラキーのふらふら移動 (30%でランダム移動)
    if (this.id === 'dracky' && Math.random() < 0.35) {
      return this._decideRandomMove(dungeon, allMonsters);
    }

    // プレイヤーが同じ部屋にいる、または通路で視界内にいるなら追跡
    if (sameRoom || distToPlayer <= 4) {
      this.state = 'chase';
      return this._decidePathTo(player.x, player.y, dungeon, allMonsters);
    }

    // それ以外は徘徊
    return this._decideWander(dungeon, allMonsters);
  }

  // プレイヤーへの最短手（8方向移動）
  _decidePathTo(targetX, targetY, dungeon, allMonsters) {
    const dx = Math.sign(targetX - this.x);
    const dy = Math.sign(targetY - this.y);

    // 試行する方向の優先順位リスト
    const directions = [];
    if (dx !== 0 && dy !== 0) {
      // 斜め優先
      directions.push({ x: dx, y: dy });
      directions.push({ x: dx, y: 0 });
      directions.push({ x: 0, y: dy });
    } else if (dx !== 0) {
      directions.push({ x: dx, y: 0 });
      directions.push({ x: dx, y: 1 });
      directions.push({ x: dx, y: -1 });
    } else {
      directions.push({ x: 0, y: dy });
      directions.push({ x: 1, y: dy });
      directions.push({ x: -1, y: dy });
    }

    for (const dir of directions) {
      const nx = this.x + dir.x;
      const ny = this.y + dir.y;
      if (this._canMoveTo(nx, ny, dungeon, allMonsters)) {
        return { action: 'move', targetX: nx, targetY: ny };
      }
    }

    return { action: 'wait' };
  }

  // 逃走（はぐれメタル）
  _decideFlee(player, dungeon, allMonsters) {
    const dx = Math.sign(this.x - player.x);
    const dy = Math.sign(this.y - player.y);

    const preferred = [
      { x: dx, y: dy },
      { x: dx, y: 0 },
      { x: 0, y: dy },
      { x: -dy, y: dx },
      { x: dy, y: -dx }
    ];

    for (const dir of preferred) {
      const nx = this.x + dir.x;
      const ny = this.y + dir.y;
      if (this._canMoveTo(nx, ny, dungeon, allMonsters)) {
        return { action: 'move', targetX: nx, targetY: ny };
      }
    }
    return { action: 'wait' };
  }

  // ランダム徘徊
  _decideRandomMove(dungeon, allMonsters) {
    const dirs = [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
    ].sort(() => Math.random() - 0.5);

    for (const dir of dirs) {
      const nx = this.x + dir.x;
      const ny = this.y + dir.y;
      if (this._canMoveTo(nx, ny, dungeon, allMonsters)) {
        return { action: 'move', targetX: nx, targetY: ny };
      }
    }
    return { action: 'wait' };
  }

  _decideWander(dungeon, allMonsters) {
    // 50%の確率でその場で休止、50%でランダム移動
    if (Math.random() < 0.5) {
      return { action: 'wait' };
    }
    return this._decideRandomMove(dungeon, allMonsters);
  }

  // 移動可能判定
  _canMoveTo(nx, ny, dungeon, allMonsters) {
    if (nx < 0 || nx >= dungeon.width || ny < 0 || ny >= dungeon.height) return false;
    const tile = dungeon.tiles[ny][nx];
    if (tile === CONFIG.TILE.WALL) return false;

    // 斜め移動時の角抜け防止（ゴースト以外）
    if (this.id !== 'ghost') {
      const dx = nx - this.x;
      const dy = ny - this.y;
      if (dx !== 0 && dy !== 0) {
        if (dungeon.tiles[this.y][nx] === CONFIG.TILE.WALL || dungeon.tiles[ny][this.x] === CONFIG.TILE.WALL) {
          return false;
        }
      }
    }

    // 他のモンスターがいないか
    for (const other of allMonsters) {
      if (other !== this && other.hp > 0 && other.x === nx && other.y === ny) {
        return false;
      }
    }

    return true;
  }
}
