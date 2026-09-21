/**
 * Item - アイテムクラス
 */

import { CONFIG } from '../config.js';

let nextItemId = 1;

export class Item {
  constructor(data = {}) {
    this.instanceId = nextItemId++;
    this.id = data.id || 'item';
    this.name = data.name || 'なぞの道具';
    this.type = data.type || 'herb';
    this.icon = data.icon || '📦';
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

    // 配置座標（マップ上）
    this.x = data.x !== undefined ? data.x : -1;
    this.y = data.y !== undefined ? data.y : -1;
  }

  // 表示名（+1や装備マーク、残り回数を含む）
  getDisplayName() {
    let title = this.name;
    if (this.type === 'weapon' || this.type === 'shield') {
      if (this.refine > 0) {
        title += `+${this.refine}`;
      } else if (this.refine < 0) {
        title += `${this.refine}`;
      }
      if (this.equipped) {
        title += ' [E]';
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

  // ファクトリメソッド：定義から生成
  static fromCatalog(itemData, extra = {}) {
    return new Item({
      ...itemData,
      ...extra
    });
  }

  // 奇跡の箱（10Fクリア用秘宝）
  static createMiracleBox(x, y) {
    return new Item({
      id: 'miracle_box',
      name: '奇跡の箱',
      type: 'treasure',
      icon: '🏆',
      desc: 'ダンジョンの最深部に眠る伝説の秘宝。手に入れると冒険クリア！',
      x,
      y
    });
  }
}
