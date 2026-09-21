/**
 * Player - 主人公「もじさん」クラス
 * 8方向移動、足踏み、満腹度、装備、レベルアップ、アイテムインベントリ
 */

import { CONFIG } from '../config.js';
import { soundManager } from '../audio/SoundManager.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;

    // 向き (dx, dy) - デフォルトは下向き
    this.dir = { dx: 0, dy: 1 };
    this.facingName = 'down'; // 'down', 'up', 'left', 'right'

    // アニメーション制御
    this.animProgress = 1.0;
    this.walkFrame = 1; // 1, 2, 3
    this.stepCounter = 0;

    // ステータス
    this.name = 'もじさん';
    this.level = CONFIG.PLAYER.INITIAL_LEVEL;
    this.exp = 0;
    this.maxHp = CONFIG.PLAYER.INITIAL_MAX_HP;
    this.hp = this.maxHp;
    this.maxStr = CONFIG.PLAYER.INITIAL_MAX_STR;
    this.str = this.maxStr;
    this.satiety = CONFIG.PLAYER.INITIAL_SATIETY;
    this.maxSatiety = CONFIG.PLAYER.MAX_SATIETY;
    this.gold = 0;

    // 装備
    this.equippedWeapon = null;
    this.equippedShield = null;
    this.equippedArrow = null;

    // 所持品 (最大16個)
    this.inventory = [];

    // 状態異常
    this.sleepTurns = 0;
    this.confusedTurns = 0;
    this.eyedropTurns = 0; // 目薬草効果

    // 歩数カウンター（満腹度減少・自然回復用）
    this.hungerStepCount = 0;
    this.healStepCount = 0;

    // スプライト画像
    this.sprites = {};
    this._loadSprites();
  }

  _loadSprites() {
    const directions = ['down', 'up', 'left', 'right'];
    const frames = ['01', '02', '03'];

    directions.forEach(dir => {
      this.sprites[dir] = [];
      frames.forEach((f, idx) => {
        const img = new Image();
        img.src = `${CONFIG.PLAYER.SPRITE_FRAMES_DIR}${dir}-${f}.png`;
        this.sprites[dir][idx] = img;
      });
    });
  }

  // 向きの設定
  setDirection(dx, dy) {
    if (dx === 0 && dy === 0) return;
    this.dir = { dx, dy };

    // 4方向スプライトへのマッピング
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facingName = dx > 0 ? 'right' : 'left';
    } else {
      this.facingName = dy > 0 ? 'down' : 'up';
    }
  }

  // 移動開始（アニメーション用）
  startMove(newX, newY) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x = newX;
    this.y = newY;
    this.animProgress = 0.0;

    // 歩行アニメーションコマを進める
    this.stepCounter++;
    this.walkFrame = (this.walkFrame % 3) + 1;
  }

  // ターン経過（歩行または行動時）
  onTurnPassed(isMove = true) {
    const messages = [];

    // 状態異常カウント減少
    if (this.sleepTurns > 0) {
      this.sleepTurns--;
      if (this.sleepTurns === 0) {
        messages.push('もじさんは目を覚ました！');
      }
      return messages;
    }
    if (this.confusedTurns > 0) {
      this.confusedTurns--;
      if (this.confusedTurns === 0) {
        messages.push('もじさんの混乱が解けた！');
      }
    }
    if (this.eyedropTurns > 0) {
      this.eyedropTurns--;
    }

    // 満腹度の消費
    // 皮の盾を装備していると消費速度半減（20歩で1%）
    const rateStep = (this.equippedShield && this.equippedShield.slowHunger) ? 20 : 10;
    this.hungerStepCount++;
    if (this.hungerStepCount >= rateStep) {
      this.hungerStepCount = 0;
      if (this.satiety > 0) {
        this.satiety = Math.max(0, this.satiety - 1);
        if (this.satiety === 0) {
          messages.push('お腹がペコペコだ！早く何か食べないと！');
        } else if (this.satiety === 10) {
          messages.push('お腹が減ってきた...');
        }
      }
    }

    // 飢餓ダメージまたは自然回復
    if (this.satiety <= 0) {
      this.hp = Math.max(0, this.hp - 1);
      if (this.hp <= 0) {
        messages.push('もじさんは飢えのために力尽きた...');
      }
    } else {
      // 満腹度があれば一定歩数で1HP回復
      this.healStepCount++;
      if (this.healStepCount >= CONFIG.PLAYER.HEAL_TURNS) {
        this.healStepCount = 0;
        if (this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + 1);
        }
      }
    }

    return messages;
  }

  // 攻撃力計算
  getAttackPower() {
    const weaponAtk = this.equippedWeapon ? this.equippedWeapon.getEffectiveAtk() : 0;
    return Math.floor(this.str * 0.75 + weaponAtk * 1.2);
  }

  // 防御力計算
  getDefensePower() {
    const shieldDef = this.equippedShield ? this.equippedShield.getEffectiveDef() : 0;
    return shieldDef;
  }

  // ダメージ計算（対モンスター）
  calcDamageAgainst(monster) {
    const baseAtk = this.getAttackPower();
    let mult = 1.0;

    // 特効判定（例：ドラゴンキラー）
    if (this.equippedWeapon && this.equippedWeapon.vsDragon && monster.id === 'dragon') {
      mult = 2.0;
    }

    const variance = 0.85 + Math.random() * 0.3; // 85%〜115%
    const rawDmg = (baseAtk * mult - (monster.def * 0.5)) * variance;
    return Math.max(1, Math.round(rawDmg));
  }

  // 被ダメージ処理
  takeDamage(amount) {
    const shieldDef = this.getDefensePower();
    const reduced = Math.max(1, Math.round(amount - shieldDef * 0.6));
    this.hp = Math.max(0, this.hp - reduced);
    return reduced;
  }

  // 経験値獲得とレベルアップ判定
  gainExp(amount) {
    this.exp += amount;
    const messages = [];

    while (this.level < CONFIG.LEVEL_TABLE.length) {
      const nextLevelData = CONFIG.LEVEL_TABLE[this.level]; // 0-indexed: level 1 is index 0, next is index 1
      if (nextLevelData && this.exp >= nextLevelData.exp) {
        this.level = nextLevelData.level;
        const hpGain = nextLevelData.hp - this.maxHp;
        const strGain = nextLevelData.str - this.maxStr;

        this.maxHp = nextLevelData.hp;
        this.hp = Math.min(this.maxHp, this.hp + hpGain);
        this.maxStr = nextLevelData.str;
        this.str = Math.min(this.maxStr, this.str + strGain);

        messages.push(`レベルが上がった！ もじさんは レベル${this.level} になった！`);
        messages.push(`最大HPが ${hpGain} 上がった！ ちからが ${strGain} 上がった！`);
        soundManager.playLevelUp();
      } else {
        break;
      }
    }
    return messages;
  }

  // アイテム所持追加
  addItem(item) {
    if (item.type === 'gold') {
      this.gold += item.goldAmount;
      return { success: true, isGold: true };
    }
    if (this.inventory.length >= CONFIG.PLAYER.INVENTORY_CAPACITY) {
      return { success: false, reason: '持ち物がいっぱいです！' };
    }
    this.inventory.push(item);
    return { success: true, item };
  }

  // アイテム削除
  removeItem(item) {
    const idx = this.inventory.indexOf(item);
    if (idx !== -1) {
      if (item.equipped) {
        this.unequipItem(item);
      }
      this.inventory.splice(idx, 1);
      return true;
    }
    return false;
  }

  // 装備
  equipItem(item) {
    if (item.type === 'weapon') {
      if (this.equippedWeapon) {
        this.equippedWeapon.equipped = false;
      }
      this.equippedWeapon = item;
      item.equipped = true;
      return `${item.name} を装備した！ 攻撃力が上がった！`;
    } else if (item.type === 'shield') {
      if (this.equippedShield) {
        this.equippedShield.equipped = false;
      }
      this.equippedShield = item;
      item.equipped = true;
      return `${item.name} を装備した！ 防御力が上がった！`;
    } else if (item.type === 'arrow') {
      if (this.equippedArrow) {
        this.equippedArrow.equipped = false;
      }
      this.equippedArrow = item;
      item.equipped = true;
      return `${item.name} を装備した！`;
    }
    return null;
  }

  // 装備解除
  unequipItem(item) {
    if (item === this.equippedWeapon) {
      this.equippedWeapon = null;
      item.equipped = false;
      return `${item.name} をはずした。`;
    } else if (item === this.equippedShield) {
      this.equippedShield = null;
      item.equipped = false;
      return `${item.name} をはずした。`;
    } else if (item === this.equippedArrow) {
      this.equippedArrow = null;
      item.equipped = false;
      return `${item.name} をはずした。`;
    }
    return null;
  }
}
