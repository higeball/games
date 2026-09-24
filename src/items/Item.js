/**
 * Item - アイテムクラス
 */

import { CONFIG } from '../config.js';

let nextItemId = 1;

export class Item {
  constructor(data = {}) {
    this.instanceId = nextItemId++;
    this.obtainedOrder = data.obtainedOrder !== undefined ? data.obtainedOrder : this.instanceId;
    this.id = data.id || 'item';
    this.name = data.name || 'なぞの道具';
    this.type = data.type || 'herb';
    this.sprite = data.sprite || this._getDefaultSprite();
    this.desc = data.desc || '';
    this.price = data.price || 50;

    // 武器・盾関連
    this.atk = data.atk || 0;
    this.def = data.def || 0;
    this.refine = data.refine || 0; // +1, +2
    this.equipped = false;

    // 特殊特性
    this.slowHunger = data.slowHunger || false; // 皮の盾 (腹減り半減)
    this.antiPoison = data.antiPoison || false; // うろこの盾 (毒無効)
    this.antiFire = data.antiFire || false;     // ドラゴンシールド (炎半減)
    this.vsDragon = data.vsDragon || false;     // ドラゴンキラー (竜特効)

    // パン・満腹度
    this.satiety = data.satiety !== undefined ? data.satiety : 50;

    // 杖・回数
    this.uses = data.uses !== undefined ? data.uses : (this.type === 'staff' ? 4 : 0);

    // 矢・束
    this.count = data.count !== undefined ? data.count : (this.type === 'arrow' ? 10 : 1);

    // ゴールド
    this.goldAmount = data.goldAmount || 0;
    if (this.type === 'gold' && !data.sprite) {
      this.sprite = './assets/props/gold.png';
    }

    // 未鑑定システム（トルネコ原作仕様）
    this.identified = data.identified !== undefined ? data.identified : true;
    this.unidentifiedName = data.unidentifiedName || this._getDefaultUnidentifiedName();

    // 配置座標（マップ上）
    this.x = data.x !== undefined ? data.x : -1;
    this.y = data.y !== undefined ? data.y : -1;
  }

  _getDefaultUnidentifiedName() {
    // 武器・盾は原作トルネコ仕様：名前はそのまま表示（修正値が伏せられ、黄色文字になる）
    if (this.type === 'weapon' || this.type === 'shield') {
      return this.name;
    }

    // 草（原作トルネコ仕様：色名）
    const herbNames = {
      herb: 'みどりの草',
      otogiri: 'あかい草',
      antidote: 'あおい草',
      seed_str: 'きいろの草',
      seed_stomach: 'ちゃいろの草',
      warp_herb: 'むらさきの草',
      fire_herb: 'オレンジの草',
      sleep_herb: 'しろい草',
      eyedrop: 'みずいろの草',
    };
    if (this.type === 'herb' && herbNames[this.id]) {
      return herbNames[this.id];
    }

    // 巻物（原作トルネコ仕様：呪文名）
    const scrollNames = {
      light: 'あーの巻物',
      upgrade: 'いーの巻物',
      sanctuary: 'うーの巻物',
      sleep_scroll: 'えーの巻物',
      confuse: 'おーの巻物',
      bread_scroll: 'かーの巻物',
      identify: 'きーの巻物',
    };
    if (this.type === 'scroll' && scrollNames[this.id]) {
      return scrollNames[this.id];
    }

    // 杖（原作トルネコ仕様：形状名）
    const staffNames = {
      staff_knockback: '細い杖',
      staff_swap: '太い杖',
      staff_paralyze: '曲がった杖',
      staff_silence: '黒い杖',
      staff_polymorph: '光る杖',
    };
    if (this.type === 'staff' && staffNames[this.id]) {
      return staffNames[this.id];
    }

    return '未識別の道具';
  }

  _getDefaultSprite() {
    switch (this.type) {
      case 'weapon': return './assets/items/bronze_sword.png';
      case 'shield': return './assets/items/bronze_shield.png';
      case 'bread': return './assets/items/bread.png';
      case 'scroll': return './assets/items/scroll.png';
      case 'staff': return './assets/items/staff.png';
      case 'arrow': return './assets/items/arrow.png';
      case 'gold': return './assets/props/gold.png';
      case 'treasure': return './assets/items/miracle_box.png';
      default: return './assets/items/herb.png';
    }
  }

  // 識別を実行する（未識別だった場合はtrueを返す）
  identify() {
    const wasUnidentified = !this.identified;
    this.identified = true;
    return wasUnidentified;
  }

  // 説明文（未識別時はヒントテキスト）
  getDesc() {
    if (!this.identified) {
      if (this.type === 'weapon') {
        return '正体不明の武器。装備するかインパスの巻物で強さが判明する。';
      } else if (this.type === 'shield') {
        return '正体不明の盾。装備するかインパスの巻物で強さが判明する。';
      } else if (this.type === 'herb') {
        return '正体不明の草。飲むか投げるか、インパスの巻物で効果が判明する。';
      } else if (this.type === 'scroll') {
        return '正体不明の巻物。読むかインパスの巻物で効果が判明する。';
      } else if (this.type === 'staff') {
        return '正体不明の杖。振るかインパスの巻物で効果が判明する。';
      }
      return '正体不明の道具。インパスの巻物で識別できる。';
    }
    return this.desc || '特別な効果はない。';
  }

  // 表示名（+1や装備マーク、残り回数を含む）
  getDisplayName() {
    let title = this.getItemCleanName();
    if ((this.type === 'weapon' || this.type === 'shield') && this.equipped) {
      title += ' [E]';
    }
    return title;
  }

  // 装備マークなしの名称（リストスロットやHUD表示用）
  getItemCleanName() {
    if (!this.identified) {
      if (this.type === 'staff') {
        return `${this.unidentifiedName} [?]`;
      }
      return this.unidentifiedName;
    }

    let title = this.name;
    if (this.type === 'weapon' || this.type === 'shield') {
      if (this.refine > 0) {
        title += `+${this.refine}`;
      } else if (this.refine < 0) {
        title += `${this.refine}`;
      }
    } else if (this.type === 'staff') {
      title += ` [${this.uses}]`;
    } else if (this.type === 'arrow') {
      title += ` (${this.count}本)`;
    } else if (this.type === 'gold') {
      title = `${this.goldAmount}ゴールド`;
    }
    return title;
  }

  // 実効攻撃力
  getEffectiveAtk() {
    if (this.type !== 'weapon') return 0;
    return Math.max(0, this.atk + this.refine);
  }

  // 実効防御力
  getEffectiveDef() {
    if (this.type !== 'shield') return 0;
    return Math.max(0, this.def + this.refine);
  }

  // 種類順ソート優先度（武器→盾→矢→パン→草→巻物→杖→その他）
  getTypeSortOrder() {
    switch (this.type) {
      case 'weapon': return 1;
      case 'shield': return 2;
      case 'arrow': return 3;
      case 'bread': return 4;
      case 'herb': return 5;
      case 'scroll': return 6;
      case 'staff': return 7;
      default: return 8;
    }
  }

  // ファクトリメソッド：定義から生成
  static fromCatalog(itemData, extra = {}) {
    return new Item({
      ...itemData,
      ...extra
    });
  }

  // 奇跡のトイレ個室（40Fクリア用ゴール）
  static createToilet(x, y) {
    return new Item({
      id: 'toilet',
      name: '奇跡のトイレ個室',
      type: 'treasure',
      sprite: './assets/props/toilet.png',
      desc: '40Fに唯一残された奇跡の洋式トイレ！ここに駆け込めば社会人の尊厳を守ってクリア！',
      x,
      y
    });
  }

  // 奇跡の箱（互換用）
  static createMiracleBox(x, y) {
    return this.createToilet(x, y);
  }
}
