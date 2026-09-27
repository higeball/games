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
    this.facingName = 'down'; // 'down', 'up', 'left', 'right', 'down-left', 'down-right', 'up-left', 'up-right'

    // アニメーション制御
    this.animProgress = 1.0;
    this.walkFrame = 1; // 1, 2, 3
    this.stepCounter = 0;
    this.isAttacking = 0; // 攻撃モーションタイマー（武器を振るアニメーション）
    this.hurtTimer = 0;   // 被ダメージモーションタイマー
    this.idleStepTimer = 0; // 停止中のアイドル足踏みタイマー
    this.idleStepFrame = 1; // 停止中のアイドル足踏みフレーム (1, 2, 3)

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
    this.healCounter = 0; // SFC解析式: 毎ターン最大HP加算し150でHP1回復

    // スプライト画像（walk, attack, hurt の各8方向×3フレーム）
    this.sprites = {
      walk: {},
      attack: {},
      hurt: {}
    };
    this._loadSprites();
  }

  _loadSprites() {
    const directions = [
      'down', 'up', 'left', 'right',
      'down-left', 'down-right', 'up-left', 'up-right'
    ];
    const frames = ['01', '02', '03'];
    const actions = ['walk', 'attack', 'hurt'];

    actions.forEach(act => {
      this.sprites[act] = {};
      directions.forEach(dir => {
        this.sprites[act][dir] = [];
        frames.forEach((f, idx) => {
          const img = new Image();
          // サブディレクトリから読み込み、無ければフォールバック
          img.src = `${CONFIG.PLAYER.SPRITE_FRAMES_DIR}${act}/${dir}-${f}.png`;
          this.sprites[act][dir][idx] = img;
        });
      });
    });

    // 後方互換参照
    directions.forEach(dir => {
      this.sprites[dir] = this.sprites.walk[dir];
    });
  }

  // 向きの設定（8方向完全対応）
  setDirection(dx, dy) {
    if (dx === 0 && dy === 0) return;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    this.dir = { dx: sx, dy: sy };

    if (sy > 0) {
      if (sx < 0) this.facingName = 'down-left';
      else if (sx > 0) this.facingName = 'down-right';
      else this.facingName = 'down';
    } else if (sy < 0) {
      if (sx < 0) this.facingName = 'up-left';
      else if (sx > 0) this.facingName = 'up-right';
      else this.facingName = 'up';
    } else {
      if (sx < 0) this.facingName = 'left';
      else if (sx > 0) this.facingName = 'right';
      else this.facingName = 'down';
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
        messages.push('もじさんは　目を覚ました！');
      }
      return messages;
    }
    if (this.confusedTurns > 0) {
      this.confusedTurns--;
      if (this.confusedTurns === 0) {
        messages.push('もじさんの　混乱が解けた！');
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
          messages.push('おなかが　ペコペコだ！');
          messages.push('早く　何か食べないと！');
        } else if (this.satiety === 10) {
          messages.push('おなかが　減ってきた……');
        }
      }
    }

    // 飢餓ダメージまたは自然回復（SFC解析式準拠）
    if (this.satiety <= 0) {
      this.hp = Math.max(0, this.hp - 1);
      if (this.hp <= 0) {
        messages.push('もじさんは　飢えのために力尽きた……');
      }
    } else {
      // SFC解析式: 1ターン毎に自然回復カウンタに最大HPを加算し、150到達でHPが1回復（余剰繰越）
      if (this.hp < this.maxHp) {
        this.healCounter = (this.healCounter || 0) + this.maxHp;
        while (this.healCounter >= 150) {
          this.healCounter -= 150;
          if (this.hp < this.maxHp) {
            this.hp++;
          }
        }
      }
    }

    return messages;
  }

  // 基本攻撃力取得（Lv毎の内部パラメータ）
  getBaseAtk() {
    const lvlData = CONFIG.LEVEL_TABLE.find(l => l.level === this.level) || CONFIG.LEVEL_TABLE[0];
    return lvlData.baseAtk || 5;
  }

  // 内部攻撃力計算（SFC解析式: 基本攻撃力 + (剣の強さ + ちから - 8) * 基本攻撃力 / 16）
  getAttackPower() {
    const baseAtk = this.getBaseAtk();
    const weaponAtk = this.equippedWeapon ? this.equippedWeapon.getEffectiveAtk() : 0;
    const internal = baseAtk + Math.floor((weaponAtk + this.str - 8) * baseAtk / 16);
    return Math.min(255, Math.max(1, internal));
  }

  // 防御力計算（SFC解析式: 盾の強さ合計）
  getDefensePower() {
    return this.equippedShield ? this.equippedShield.getEffectiveDef() : 0;
  }

  // ダメージ計算（対モンスター・SFC解析式準拠: 内部攻撃力 * (112 + 乱数0~31)*2/256 * (15/16)**防御力）
  calcDamageAgainst(monster) {
    const internalAtk = this.getAttackPower();
    const rand32 = Math.floor(Math.random() * 32);
    const rawDmg = Math.floor(internalAtk * (112 + rand32) * 2 / 256);
    const defFactor = Math.pow(15 / 16, monster.def);
    let finalDmg = Math.round(rawDmg * defFactor);

    // ドラゴンキラー特効（ドラゴンに対して2倍）
    if (this.equippedWeapon && this.equippedWeapon.vsDragon && monster.id === 'dragon') {
      finalDmg *= 2;
    }

    // はぐれメタル判定（1以上のダメージは1固定）
    if (monster.id === 'metal_slime') {
      if (finalDmg >= 1) finalDmg = 1;
    }

    return Math.max(1, finalDmg);
  }

  // 被ダメージ処理（SFC解析式準拠: 敵攻撃力 * (112 + 乱数0~31)*2/256 * (15/16)**盾防御力）
  takeDamage(monsterAtk) {
    const rand32 = Math.floor(Math.random() * 32);
    const rawDmg = Math.floor(monsterAtk * (112 + rand32) * 2 / 256);
    const defPower = this.getDefensePower();
    const defFactor = Math.pow(15 / 16, defPower);
    const finalDmg = Math.max(1, Math.round(rawDmg * defFactor));
    this.hp = Math.max(0, this.hp - finalDmg);
    this.hurtTimer = 10; // 被ダメージモーション用タイマー
    return finalDmg;
  }

  // 経験値獲得とレベルアップ判定
  gainExp(amount) {
    this.exp += amount;
    const messages = [];

    while (this.level < CONFIG.LEVEL_TABLE.length) {
      const nextLevelData = CONFIG.LEVEL_TABLE[this.level]; // 0-indexed: level 1 is index 0, next is index 1
      if (nextLevelData && this.exp >= nextLevelData.exp) {
        const prevLevelData = CONFIG.LEVEL_TABLE[this.level - 1];
        this.level = nextLevelData.level;

        // レベルアップによる成長量（テーブルの差分）
        const hpGain = prevLevelData ? (nextLevelData.hp - prevLevelData.hp) : 4;
        const strGain = prevLevelData ? (nextLevelData.str - prevLevelData.str) : 1;

        // ちからの種や薬草で上昇したステータスを保持したまま、成長量を加算
        this.maxHp += hpGain;
        this.hp += hpGain;
        this.maxStr += strGain;
        this.str += strGain;

        messages.push('もじさんは　レベルが上がった！');
        messages.push(`レベル${this.level}に　なった！`);
        messages.push(`最大HPが ${hpGain}上がった！ ちからが ${strGain}上がった！`);
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

  // 装備（トルネコ原作仕様：未識別装備は装備時に正体が識別される）
  equipItem(item) {
    const wasUnidentified = !item.identified;
    if (wasUnidentified) {
      item.identify();
    }

    const msgs = [];
    if (item.type === 'weapon') {
      if (this.equippedWeapon) {
        this.equippedWeapon.equipped = false;
      }
      this.equippedWeapon = item;
      item.equipped = true;

      if (wasUnidentified) {
        msgs.push(`【${item.name}】が　識別された！`);
        if (item.refine > 0) {
          msgs.push(`なんと　+${item.refine}の剣だった！`);
        } else if (item.refine < 0) {
          msgs.push(`なんと　${item.refine}の呪いがかかっていた！`);
        }
      }
      msgs.push(`${item.getItemCleanName()}を　装備した！`);
      msgs.push('攻撃力が　上がった！');
      return msgs.join('\n');
    } else if (item.type === 'shield') {
      if (this.equippedShield) {
        this.equippedShield.equipped = false;
      }
      this.equippedShield = item;
      item.equipped = true;

      if (wasUnidentified) {
        msgs.push(`【${item.name}】が　識別された！`);
        if (item.refine > 0) {
          msgs.push(`なんと　+${item.refine}の盾だった！`);
        } else if (item.refine < 0) {
          msgs.push(`なんと　${item.refine}の呪いがかかっていた！`);
        }
      }
      msgs.push(`${item.getItemCleanName()}を　装備した！`);
      msgs.push('防御力が　上がった！');
      return msgs.join('\n');
    } else if (item.type === 'arrow') {
      if (this.equippedArrow) {
        this.equippedArrow.equipped = false;
      }
      this.equippedArrow = item;
      item.equipped = true;
      return `${item.getItemCleanName()}を　装備した！`;
    }
    return null;
  }

  // 装備解除
  unequipItem(item) {
    const itemName = item.getItemCleanName ? item.getItemCleanName() : item.name;
    if (item === this.equippedWeapon) {
      this.equippedWeapon = null;
      item.equipped = false;
      return `${itemName}を　はずした。`;
    } else if (item === this.equippedShield) {
      this.equippedShield = null;
      item.equipped = false;
      return `${itemName}を　はずした。`;
    } else if (item === this.equippedArrow) {
      this.equippedArrow = null;
      item.equipped = false;
      return `${itemName}を　はずした。`;
    }
    return null;
  }
}
