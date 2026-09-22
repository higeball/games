/**
 * InventoryModal - どうぐインベントリ・足元メニュー管理
 * トルネコ風の道具コマンド（使う、食べる、読む、振る、装備、はずす、投げる、置く）
 */

import { soundManager } from '../audio/SoundManager.js';

export class InventoryModal {
  constructor(options = {}) {
    this.modalEl = document.getElementById('inventory-modal');
    this.listEl = document.getElementById('inventory-list');
    this.detailEl = document.getElementById('inventory-detail');
    this.actionsEl = document.getElementById('inventory-actions');
    this.closeBtn = document.getElementById('inventory-close-btn');

    this.onAction = options.onAction || (() => {});
    this.isOpen = false;
    this.selectedItem = null;

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
  }

  open(player, groundItem = null, isStairs = false) {
    this.isOpen = true;
    this.player = player;
    this.groundItem = groundItem;
    this.isStairs = isStairs;
    this.selectedItem = null;

    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
    }

    this.renderList();
  }

  close() {
    this.isOpen = false;
    this.selectedItem = null;
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  renderList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    // 足元にあるアイテムまたは階段の特設行
    if (this.groundItem) {
      const groundRow = document.createElement('div');
      groundRow.className = 'item-row ground-row';
      groundRow.innerHTML = `
        <img class="item-icon-img" src="${this.groundItem.sprite}" alt="${this.groundItem.name}" />
        <span class="item-name">足元: ${this.groundItem.getDisplayName()}</span>
      `;
      groundRow.onclick = () => this.selectItem(this.groundItem, true);
      this.listEl.appendChild(groundRow);
    } else if (this.isStairs) {
      const stairsRow = document.createElement('div');
      stairsRow.className = 'item-row ground-row';
      stairsRow.innerHTML = `
        <img class="item-icon-img" src="./assets/props/stairs.png" alt="降り階段" />
        <span class="item-name">足元: 降り階段</span>
      `;
      stairsRow.onclick = () => this.selectStairs();
      this.listEl.appendChild(stairsRow);
    }

    // インベントリ一覧
    if (this.player.inventory.length === 0 && !this.groundItem && !this.isStairs) {
      this.listEl.innerHTML += '<div class="empty-msg">道具を持っていません。</div>';
      this.showDetail('持ち物はありません。');
      this.renderActions(null);
      return;
    }

    this.player.inventory.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = `item-row ${this.selectedItem === item ? 'selected' : ''}`;
      row.innerHTML = `
        <img class="item-icon-img" src="${item.sprite}" alt="${item.name}" />
        <span class="item-name">${item.getDisplayName()}</span>
      `;
      row.onclick = () => this.selectItem(item, false);
      this.listEl.appendChild(row);
    });

    // デフォルト選択（足元優先、無ければ先頭アイテム）
    if (!this.selectedItem) {
      if (this.groundItem) {
        this.selectItem(this.groundItem, true);
      } else if (this.isStairs) {
        this.selectStairs();
      } else if (this.player.inventory.length > 0) {
        this.selectItem(this.player.inventory[0], false);
      }
    }
  }

  selectItem(item, isGround = false) {
    this.selectedItem = item;
    this.isGroundSelection = isGround;

    // リストの選択ハイライト更新
    const rows = this.listEl.querySelectorAll('.item-row');
    rows.forEach(r => r.classList.remove('selected'));
    // 行をクリック時のハイライト

    let desc = item.desc;
    if (item.type === 'weapon') desc = `攻撃力 +${item.getEffectiveAtk()}。${desc}`;
    if (item.type === 'shield') desc = `防御力 +${item.getEffectiveDef()}。${desc}`;
    this.showDetail(desc || item.name);

    this.renderActions(item, isGround);
  }

  selectStairs() {
    this.selectedItem = null;
    this.showDetail('次の階層へ降りる階段です。');
    if (!this.actionsEl) return;
    this.actionsEl.innerHTML = `
      <button class="action-btn primary" id="btn-descend">降りる</button>
    `;
    const btn = document.getElementById('btn-descend');
    if (btn) {
      btn.onclick = () => {
        this.close();
        this.onAction('descend_stairs');
      };
    }
  }

  showDetail(text) {
    if (this.detailEl) {
      this.detailEl.textContent = text;
    }
  }

  renderActions(item, isGround = false) {
    if (!this.actionsEl || !item) {
      if (this.actionsEl) this.actionsEl.innerHTML = '';
      return;
    }

    this.actionsEl.innerHTML = '';

    if (isGround) {
      // 足元のアイテムに対するコマンド
      const pickBtn = document.createElement('button');
      pickBtn.className = 'action-btn primary';
      pickBtn.textContent = '拾う';
      pickBtn.onclick = () => {
        this.close();
        this.onAction('pickup_ground', item);
      };
      this.actionsEl.appendChild(pickBtn);

      // その場で使う
      if (['herb', 'bread', 'scroll', 'staff'].includes(item.type)) {
        const useBtn = document.createElement('button');
        useBtn.className = 'action-btn';
        useBtn.textContent = this._getVerbForType(item.type);
        useBtn.onclick = () => {
          this.close();
          this.onAction('use_ground', item);
        };
        this.actionsEl.appendChild(useBtn);
      }
      return;
    }

    // 手持ちアイテムコマンド
    // 1. 使う / 食べる / 飲む / 読む / 振る / 装備
    if (item.type === 'weapon' || item.type === 'shield' || item.type === 'arrow') {
      const equipBtn = document.createElement('button');
      equipBtn.className = 'action-btn primary';
      equipBtn.textContent = item.equipped ? 'はずす' : '装備する';
      equipBtn.onclick = () => {
        this.close();
        this.onAction(item.equipped ? 'unequip' : 'equip', item);
      };
      this.actionsEl.appendChild(equipBtn);
    } else {
      const useBtn = document.createElement('button');
      useBtn.className = 'action-btn primary';
      useBtn.textContent = this._getVerbForType(item.type);
      useBtn.onclick = () => {
        this.close();
        this.onAction('use', item);
      };
      this.actionsEl.appendChild(useBtn);
    }

    // 2. 投げる
    const throwBtn = document.createElement('button');
    throwBtn.className = 'action-btn';
    throwBtn.textContent = item.type === 'arrow' ? '射つ' : '投げる';
    throwBtn.onclick = () => {
      this.close();
      this.onAction('throw', item);
    };
    this.actionsEl.appendChild(throwBtn);

    // 3. 置く
    const dropBtn = document.createElement('button');
    dropBtn.className = 'action-btn danger';
    dropBtn.textContent = '足元に置く';
    dropBtn.onclick = () => {
      this.close();
      this.onAction('drop', item);
    };
    this.actionsEl.appendChild(dropBtn);
  }

  _getVerbForType(type) {
    switch (type) {
      case 'herb': return '飲む';
      case 'bread': return '食べる';
      case 'scroll': return '読む';
      case 'staff': return '振る';
      default: return '使う';
    }
  }
}
