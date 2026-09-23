/**
 * InventoryModal - どうぐインベントリ・足元メニュー管理
 * トルネコ風の道具コマンド（使う、食べる、読む、振る、装備、はずす、投げる、置く）
 * 16スロットを1画面（2列×8行）でスクロール不要で全一覧表示
 */

import { soundManager } from '../audio/SoundManager.js';

export class InventoryModal {
  constructor(options = {}) {
    this.modalEl = document.getElementById('inventory-modal');
    this.groundContainer = document.getElementById('inv-ground-container');
    this.gridEl = document.getElementById('inventory-grid');
    this.detailEl = document.getElementById('inventory-detail');
    this.actionsEl = document.getElementById('inventory-actions');
    this.closeBtn = document.getElementById('inventory-close-btn');

    this.btnSortObtained = document.getElementById('btn-sort-obtained');
    this.btnSortType = document.getElementById('btn-sort-type');
    this.sortMode = 'obtained';

    this.onAction = options.onAction || (() => {});
    this.isOpen = false;
    this.selectedItem = null;
    this.isGroundSelection = false;

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.btnSortObtained) {
      this.btnSortObtained.addEventListener('click', () => this.applySort('obtained'));
    }
    if (this.btnSortType) {
      this.btnSortType.addEventListener('click', () => this.applySort('type'));
    }
  }

  applySort(mode) {
    if (!this.player || !this.player.inventory) return;
    this.sortMode = mode;
    soundManager.playCursor?.();

    if (mode === 'obtained') {
      this.player.inventory.sort((a, b) => (a.obtainedOrder || 0) - (b.obtainedOrder || 0));
    } else if (mode === 'type') {
      this.player.inventory.sort((a, b) => {
        const orderA = a.getTypeSortOrder ? a.getTypeSortOrder() : 99;
        const orderB = b.getTypeSortOrder ? b.getTypeSortOrder() : 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'ja');
      });
    }

    this.updateSortTabs();
    this.render();
  }

  updateSortTabs() {
    if (this.btnSortObtained) {
      this.btnSortObtained.classList.toggle('active', this.sortMode === 'obtained');
    }
    if (this.btnSortType) {
      this.btnSortType.classList.toggle('active', this.sortMode === 'type');
    }
  }

  open(player, groundItem = null, isStairs = false) {
    this.isOpen = true;
    this.player = player;
    this.groundItem = groundItem;
    this.isStairs = isStairs;
    this.selectedItem = null;
    this.isGroundSelection = false;

    this.updateSortTabs();

    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
    }

    this.render();
  }

  close() {
    this.isOpen = false;
    this.selectedItem = null;
    this.isGroundSelection = false;
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  render() {
    // 足元判定の優先選択
    if (!this.selectedItem && !this.isGroundSelection) {
      if (this.groundItem) {
        this.selectedItem = this.groundItem;
        this.isGroundSelection = true;
      } else if (this.isStairs) {
        this.selectedItem = null;
        this.isGroundSelection = true;
      } else if (this.player.inventory.length > 0) {
        this.selectedItem = this.player.inventory[0];
        this.isGroundSelection = false;
      }
    }

    this.renderGround();
    this.renderGrid();

    if (this.isGroundSelection && this.isStairs) {
      this.selectStairs();
    } else if (this.selectedItem) {
      this.selectItem(this.selectedItem, this.isGroundSelection);
    } else {
      this.showDetail('持ち物はありません。');
      this.renderActions(null);
    }
  }

  renderGround() {
    if (!this.groundContainer) return;
    this.groundContainer.innerHTML = '';

    if (this.groundItem) {
      const row = document.createElement('div');
      row.className = `ground-slot ${this.isGroundSelection ? 'selected' : ''}`;
      row.innerHTML = `
        <span class="ground-tag">[足元]</span>
        <img class="inv-slot-icon" src="${this.groundItem.sprite}" alt="${this.groundItem.name}" />
        <span class="inv-slot-name">${this.groundItem.getDisplayName()}</span>
        <span class="ground-hint">▼足元</span>
      `;
      row.onclick = () => this.selectItem(this.groundItem, true);
      this.groundContainer.appendChild(row);
    } else if (this.isStairs) {
      const row = document.createElement('div');
      row.className = `ground-slot ${this.isGroundSelection ? 'selected' : ''}`;
      row.innerHTML = `
        <span class="ground-tag stairs-tag">[足元]</span>
        <img class="inv-slot-icon" src="./assets/props/stairs.png" alt="降り階段" />
        <span class="inv-slot-name">降り階段（次の階層へ降りる）</span>
        <span class="ground-hint">▼階段</span>
      `;
      row.onclick = () => this.selectStairs();
      this.groundContainer.appendChild(row);
    }
  }

  renderGrid() {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';

    const inv = this.player.inventory;
    const maxSlots = 16; // 16スロット（2列×8行）

    for (let i = 0; i < maxSlots; i++) {
      const slot = document.createElement('div');

      if (i < inv.length) {
        const item = inv[i];
        const isSelected = (!this.isGroundSelection && this.selectedItem === item);
        slot.className = `inv-slot ${isSelected ? 'selected' : ''}`;

        const marker = isSelected ? '<span class="inv-cursor">▶</span>' : '<span class="inv-cursor-space">　</span>';
        const equipBadge = item.equipped ? '<span class="inv-equip-badge">E </span>' : '';
        const cleanName = item.getItemCleanName ? item.getItemCleanName() : item.name;

        slot.innerHTML = `
          ${marker}
          <img class="inv-slot-icon" src="${item.sprite}" alt="${item.name}" />
          ${equipBadge}
          <span class="inv-slot-name">${cleanName}</span>
        `;
        slot.onclick = () => this.selectItem(item, false);
      } else {
        // 空きスロット（視認性向上のため、所持可能残枠を表示）
        slot.className = 'inv-slot empty';
        slot.innerHTML = `
          <span class="inv-cursor-space">　</span>
          <span class="empty-slot-label">・ (あき)</span>
        `;
      }

      this.gridEl.appendChild(slot);
    }
  }

  selectItem(item, isGround = false) {
    this.selectedItem = item;
    this.isGroundSelection = isGround;

    this.renderGround();
    this.renderGrid();

    let desc = item.desc;
    if (item.type === 'weapon') desc = `攻撃力 +${item.getEffectiveAtk()}。${desc}`;
    if (item.type === 'shield') desc = `防御力 +${item.getEffectiveDef()}。${desc}`;
    this.showDetail(desc || item.name);

    this.renderActions(item, isGround);
  }

  selectStairs() {
    this.selectedItem = null;
    this.isGroundSelection = true;

    this.renderGround();
    this.renderGrid();

    this.showDetail('次の階層へ降りる階段です。足元でコマンドを実行すると降ります。');
    if (!this.actionsEl) return;
    this.actionsEl.innerHTML = `
      <button class="dq-action-btn primary" id="btn-descend">降りる</button>
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
      pickBtn.className = 'dq-action-btn primary';
      pickBtn.textContent = '拾う';
      pickBtn.onclick = () => {
        this.close();
        this.onAction('pickup_ground', item);
      };
      this.actionsEl.appendChild(pickBtn);

      // その場で使う
      if (['herb', 'bread', 'scroll', 'staff'].includes(item.type)) {
        const useBtn = document.createElement('button');
        useBtn.className = 'dq-action-btn';
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
      equipBtn.className = 'dq-action-btn primary';
      equipBtn.textContent = item.equipped ? 'はずす' : '装備する';
      equipBtn.onclick = () => {
        this.close();
        this.onAction(item.equipped ? 'unequip' : 'equip', item);
      };
      this.actionsEl.appendChild(equipBtn);
    } else {
      const useBtn = document.createElement('button');
      useBtn.className = 'dq-action-btn primary';
      useBtn.textContent = this._getVerbForType(item.type);
      useBtn.onclick = () => {
        this.close();
        this.onAction('use', item);
      };
      this.actionsEl.appendChild(useBtn);
    }

    // 2. 投げる / 射つ
    const throwBtn = document.createElement('button');
    throwBtn.className = 'dq-action-btn';
    throwBtn.textContent = item.type === 'arrow' ? '射つ' : '投げる';
    throwBtn.onclick = () => {
      this.close();
      this.onAction('throw', item);
    };
    this.actionsEl.appendChild(throwBtn);

    // 3. 置く
    const dropBtn = document.createElement('button');
    dropBtn.className = 'dq-action-btn danger';
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
