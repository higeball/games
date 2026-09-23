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

    // 配置座標（マップ上）
    this.x = data.x !== undefined ? data.x : -1;
    this.y = data.y !== undefined ? data.y : -1;
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
