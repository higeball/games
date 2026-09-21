/**
 * main.js - トルネコの大冒険 クローン メインゲームループ
 * ターン制同期、マップ・モンスター・プレイヤー・アイテム制御
 */

import { CONFIG } from './config.js';
import { DungeonGenerator } from './dungeon/DungeonGenerator.js';
import { Player } from './entities/Player.js';
import { Monster } from './entities/Monster.js';
import { Item } from './items/Item.js';
import { ItemManager } from './items/ItemManager.js';
import { DungeonRenderer } from './render/DungeonRenderer.js';
import { soundManager } from './audio/SoundManager.js';
import { MessageLog } from './ui/MessageLog.js';
import { InventoryModal } from './ui/InventoryModal.js';
import { TouchControls } from './ui/TouchControls.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new DungeonRenderer(this.canvas);
    this.generator = new DungeonGenerator();
    this.log = new MessageLog('message-window');

    this.floorNumber = 1;
    this.player = null;
    this.dungeon = null;
    this.monsters = [];

    this.isBusy = false;
    this.isGameOver = false;
    this.isGameClear = false;

    window.game = this;

    this.initUI();
    this.startNewGame();
    this.setupGameLoop();
  }

  initUI() {
    // インベントリモーダル初期化
    this.inventoryModal = new InventoryModal({
      onAction: (action, item) => this.handleInventoryAction(action, item)
    });

    // タッチ＆キーボード操作初期化
    this.controls = new TouchControls({
      onMove: (dx, dy) => this.handlePlayerMove(dx, dy),
      onAttack: () => this.handlePlayerAttack(),
      onWait: () => this.handlePlayerWait(),
      onInventory: () => this.openInventory(),
      onShootArrow: () => this.handleShootArrow(),
      onToggleMap: () => {
        this.renderer.showMinimap = !this.renderer.showMinimap;
      },
      onChangeDirection: (dx, dy) => {
        if (this.player) {
          this.player.setDirection(dx, dy);
        }
      }
    });

    // リスタートボタン
    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        document.getElementById('end-modal').classList.add('hidden');
        this.startNewGame();
      });
    }

    // 初回タップでオーディオ有効化
    const unlockAudio = () => {
      soundManager.init();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize();
  }

  // 新規ゲーム開始
  startNewGame() {
    this.floorNumber = 1;
    this.isGameOver = false;
    this.isGameClear = false;
    this.log.clear();

    // プレイヤー生成
    this.player = new Player(0, 0);

    // 初期装備・道具の付与
    const starterSword = Item.fromCatalog(CONFIG.ITEMS.WEAPONS[0]); // こんぼう
    const starterShield = Item.fromCatalog(CONFIG.ITEMS.SHIELDS[0]); // 皮の盾
    const starterBread = Item.fromCatalog(CONFIG.ITEMS.BREADS[1]); // 大きいパン
    const starterHerb = Item.fromCatalog(CONFIG.ITEMS.HERBS[0]); // 薬草

    this.player.addItem(starterSword);
    this.player.addItem(starterShield);
    this.player.addItem(starterBread);
    this.player.addItem(starterHerb);

    this.player.equipItem(starterSword);
    this.player.equipItem(starterShield);

    // 1階層目の生成
    this.loadFloor(1);

    this.log.addMessage('もじさんの不思議のダンジョンへ ようこそ！');
    this.log.addMessage('最深部10Fにある「奇跡の箱」を目指そう！');
  }

  // フロア読み込み＆生成
  loadFloor(floorNum) {
    this.floorNumber = floorNum;
    this.dungeon = this.generator.generate(this.floorNumber);

    // プレイヤー配置
    this.player.x = this.dungeon.playerSpawn.x;
    this.player.y = this.dungeon.playerSpawn.y;
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    this.player.animProgress = 1.0;

    // モンスターインスタンス化
    this.monsters = this.dungeon.monsterSpawns.map(sp => new Monster(sp.type.id, sp.x, sp.y));

    // 視界計算
    this.updateVisibility();
    this.updateHUD();

    if (floorNum > 1) {
      this.log.addMessage(`地下 ${floorNum} 階 へ降りてきた。`);
      soundManager.playStairs();
    }
  }

  // 視界（FOV）とマップ記憶の更新
  updateVisibility() {
    const dungeon = this.dungeon;
    const player = this.player;

    // 視界をリセット
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        dungeon.visible[y][x] = false;
      }
    }

    if (dungeon.allRevealed) {
      for (let y = 0; y < dungeon.height; y++) {
        for (let x = 0; x < dungeon.width; x++) {
          dungeon.visible[y][x] = true;
          dungeon.explored[y][x] = true;
        }
      }
      return;
    }

    const currentRoomId = dungeon.roomMap[player.y][player.x];

    if (currentRoomId !== -1) {
      // 部屋の中にいる場合：部屋全体＋周囲1マスの扉や通路が視界内
      const room = dungeon.rooms[currentRoomId];
      if (room) {
        for (let y = Math.max(0, room.y - 1); y <= Math.min(dungeon.height - 1, room.y + room.h); y++) {
          for (let x = Math.max(0, room.x - 1); x <= Math.min(dungeon.width - 1, room.x + room.w); x++) {
            dungeon.visible[y][x] = true;
            dungeon.explored[y][x] = true;
          }
        }
      }
    } else {
      // 通路にいる場合：周囲1マスの視界
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = player.x + dx;
          const ny = player.y + dy;
          if (nx >= 0 && nx < dungeon.width && ny >= 0 && ny < dungeon.height) {
            dungeon.visible[ny][nx] = true;
            dungeon.explored[ny][nx] = true;
          }
        }
      }
    }
  }

  // プレイヤー移動処理（8方向）
  handlePlayerMove(dx, dy) {
    if (this.isBusy || this.isGameOver || this.isGameClear || !this.player) return;

    // 睡眠中は行動不可
    if (this.player.sleepTurns > 0) {
      this.log.addMessage('もじさんは眠っていて動けない！');
      this.executeTurn(false);
      return;
    }

    // 混乱時はランダム方向へ移動
    if (this.player.confusedTurns > 0) {
      const dirs = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
      ];
      const rand = dirs[Math.floor(Math.random() * dirs.length)];
      dx = rand.dx;
      dy = rand.dy;
    }

    this.player.setDirection(dx, dy);

    const targetX = this.player.x + dx;
    const targetY = this.player.y + dy;

    // 壁・範囲外判定
    if (targetX < 0 || targetX >= this.dungeon.width || targetY < 0 || targetY >= this.dungeon.height) return;
    if (this.dungeon.tiles[targetY][targetX] === CONFIG.TILE.WALL) {
      // 壁に向かって進もうとした場合は向き変更のみ
      return;
    }

    // 斜め移動時の壁角抜け防止
    if (dx !== 0 && dy !== 0) {
      if (this.dungeon.tiles[this.player.y][targetX] === CONFIG.TILE.WALL ||
          this.dungeon.tiles[targetY][this.player.x] === CONFIG.TILE.WALL) {
        return;
      }
    }

    // 進行方向にモンスターがいるか確認
    const monster = this.monsters.find(m => m.hp > 0 && m.x === targetX && m.y === targetY);
    if (monster) {
      // モンスターへの直接攻撃！
      this.attackMonster(monster);
      this.executeTurn(false);
      return;
    }

    // 移動実行
    this.player.startMove(targetX, targetY);
    soundManager.playStep();

    // 足元のアイテムチェック（奇跡の箱／ゴールド／自動拾い）
    this.checkGroundAfterMove();

    // 足元のワナチェック
    this.checkTrapAfterMove();

    // ターン実行（歩行ターン）
    this.executeTurn(true);
  }

  // プレイヤー攻撃（前方のマスへ）
  handlePlayerAttack() {
    if (this.isBusy || this.isGameOver || this.isGameClear || !this.player) return;

    if (this.player.sleepTurns > 0) {
      this.log.addMessage('もじさんは眠っていて動けない！');
      this.executeTurn(false);
      return;
    }

    const tx = this.player.x + this.player.dir.dx;
    const ty = this.player.y + this.player.dir.dy;

    const monster = this.monsters.find(m => m.hp > 0 && m.x === tx && m.y === ty);
    if (monster) {
      this.attackMonster(monster);
    } else {
      // 素振り（空振り）
      soundManager.playAttack();
      this.renderer.addSlashEffect(tx, ty);
    }

    this.executeTurn(false);
  }

  // モンスター攻撃処理
  attackMonster(monster) {
    soundManager.playAttack();
    this.renderer.addSlashEffect(monster.x, monster.y);

    const dmg = this.player.calcDamageAgainst(monster);
    monster.hp -= dmg;
    monster.wakeUp();

    this.renderer.addFloatingText(`${dmg}`, monster.x, monster.y, '#ffffff');
    soundManager.playHit();
    this.log.addMessage(`もじさんの攻撃！ ${monster.name} に ${dmg} のダメージ！`);

    if (monster.hp <= 0) {
      soundManager.playDefeat();
      this.log.addMessage(`${monster.name} をたおした！`);
      const expMsgs = this.player.gainExp(monster.exp);
      expMsgs.forEach(m => this.log.addMessage(m));

      // 確率でドロップ（20%でアイテムまたはゴールド）
      if (Math.random() < 0.25) {
        const dropped = this.generator._generateFloorItem(this.floorNumber, monster.x, monster.y);
        if (dropped) {
          this.dungeon.items.push(dropped);
          this.log.addMessage(`${monster.name} は ${dropped.name} を落とした！`);
        }
      }
    }
  }

  // 足踏み（待機）
  handlePlayerWait() {
    if (this.isBusy || this.isGameOver || this.isGameClear || !this.player) return;
    this.executeTurn(false);
  }

  // 矢を射る
  handleShootArrow() {
    if (this.isBusy || this.isGameOver || this.isGameClear || !this.player) return;

    // 矢の検索
    const arrow = this.player.equippedArrow || this.player.inventory.find(i => i.type === 'arrow');
    if (!arrow) {
      this.log.addMessage('矢を持っていません！');
      return;
    }

    ItemManager.throwItem(arrow, this.player, this.dungeon, this.monsters, msg => this.log.addMessage(msg));
    this.executeTurn(false);
  }

  // 移動直後の足元判定
  checkGroundAfterMove() {
    const px = this.player.x;
    const py = this.player.y;

    // 奇跡の箱（クリアアイテム）
    const boxIdx = this.dungeon.items.findIndex(i => i.id === 'miracle_box' && i.x === px && i.y === py);
    if (boxIdx !== -1) {
      this.triggerGameClear();
      return;
    }

    // 通常アイテム
    const itemIdx = this.dungeon.items.findIndex(i => i.x === px && i.y === py);
    if (itemIdx !== -1) {
      const item = this.dungeon.items[itemIdx];

      if (item.type === 'gold') {
        this.player.gold += item.goldAmount;
        this.dungeon.items.splice(itemIdx, 1);
        soundManager.playPickup();
        this.log.addMessage(`${item.goldAmount} ゴールド を拾った！`);
      } else {
        // インベントリに空きがあれば自動拾い
        const res = this.player.addItem(item);
        if (res.success) {
          this.dungeon.items.splice(itemIdx, 1);
          soundManager.playPickup();
          this.log.addMessage(`もじさんは ${item.name} を拾った！`);
        } else {
          this.log.addMessage(`足元に ${item.name} がある。（持ち物がいっぱい）`);
        }
      }
    }

    // 階段
    if (this.dungeon.stairs && this.dungeon.stairs.x === px && this.dungeon.stairs.y === py) {
      this.log.addMessage('降り階段がある。[道具]メニューから降りることができます。');
    }
  }

  // ワナ判定
  checkTrapAfterMove() {
    const px = this.player.x;
    const py = this.player.y;

    const trap = this.dungeon.traps.find(t => t.x === px && t.y === py);
    if (trap) {
      trap.revealed = true;
      this.log.addMessage(`${trap.name} を踏んでしまった！`);
      soundManager.playPlayerHurt();

      switch (trap.id) {
        case 'arrow':
          this.player.str = Math.max(1, this.player.str - 1);
          this.log.addMessage(trap.desc);
          break;
        case 'mine':
          const bombDmg = Math.max(1, Math.floor(this.player.hp / 2));
          this.player.hp = Math.max(1, this.player.hp - bombDmg);
          this.renderer.addFloatingText(`-${bombDmg}`, px, py, '#ef4444');
          this.log.addMessage(trap.desc);
          break;
        case 'sleep':
          this.player.sleepTurns = 4;
          this.log.addMessage(trap.desc);
          break;
        case 'trip':
          if (this.player.inventory.length > 0) {
            const dropIdx = Math.floor(Math.random() * this.player.inventory.length);
            const dropItem = this.player.inventory[dropIdx];
            this.player.removeItem(dropItem);
            dropItem.x = px;
            dropItem.y = py;
            this.dungeon.items.push(dropItem);
            this.log.addMessage(`転んで ${dropItem.name} を落とした！`);
          }
          break;
        case 'warp':
          ItemManager.teleportEntity(this.player, this.dungeon, this.monsters);
          this.log.addMessage(trap.desc);
          break;
      }
    }
  }

  // 1ターンの解決（プレイヤー行動後、モンスター行動処理）
  executeTurn(isMove = true) {
    if (this.isGameOver || this.isGameClear) return;

    // 1. プレイヤーターン処理（満腹度消費、自然回復、状態異常）
    const pMessages = this.player.onTurnPassed(isMove);
    pMessages.forEach(m => this.log.addMessage(m));

    // 飢えで死亡チェック
    if (this.player.hp <= 0) {
      this.triggerGameOver('お腹が空いて力尽きてしまった...');
      return;
    }

    // 2. モンスターの行動
    this.monsters.forEach(m => {
      if (m.hp <= 0) return;

      const decision = m.decideAction(this.player, this.dungeon, this.monsters);

      if (decision.action === 'move') {
        m.startMove(decision.targetX, decision.targetY);
      } else if (decision.action === 'attack') {
        // プレイヤーへの直接攻撃
        this.processMonsterAttack(m);
      } else if (decision.action === 'skill') {
        // 特殊スキル
        this.processMonsterSkill(m, decision);
      }
    });

    // 3. 視界・HUD更新
    this.updateVisibility();
    this.updateHUD();

    // プレイヤー死亡チェック
    if (this.player.hp <= 0) {
      this.triggerGameOver('モンスターに倒されてしまった...');
    }
  }

  // モンスターの通常攻撃
  processMonsterAttack(monster) {
    // 足元が聖域の巻物なら攻撃を受けない
    const onSanctuary = this.dungeon.items.some(i => i.id === 'sanctuary' && i.x === this.player.x && i.y === this.player.y);
    if (onSanctuary) {
      this.log.addMessage(`聖域の力により、${monster.name} の攻撃を受け付けない！`);
      return;
    }

    const dmg = this.player.takeDamage(monster.atk);
    soundManager.playPlayerHurt();
    this.renderer.addFloatingText(`-${dmg}`, this.player.x, this.player.y, '#ef4444');
    this.log.addMessage(`${monster.name} のこうげき！ もじさんは ${dmg} のダメージを受けた！`);

    // 特殊効果（おばけキノコの毒、くさった死体の腐敗）
    if (monster.id === 'mushroom' && Math.random() < 0.3) {
      if (this.player.equippedShield && this.player.equippedShield.antiPoison) {
        this.log.addMessage('うろこの盾が毒の胞子を弾いた！');
      } else {
        this.player.str = Math.max(1, this.player.str - 1);
        this.log.addMessage('毒の胞子を吸い込んでちからが 1 下がった！');
      }
    } else if (monster.id === 'zombie' && Math.random() < 0.25) {
      const breads = this.player.inventory.filter(i => i.type === 'bread' && i.id !== 'rotten_bread');
      if (breads.length > 0) {
        const b = breads[0];
        b.id = 'rotten_bread';
        b.name = 'くさったパン';
        b.icon = '🥖';
        b.desc = 'お腹を30%回復するが、腹痛で睡眠や毒などの異常が起こる。';
        this.log.addMessage(`大事なパンを腐らされてしまった！`);
      }
    }
  }

  // モンスターの特殊スキル処理
  processMonsterSkill(monster, decision) {
    this.log.addMessage(decision.skillMsg);

    if (decision.skillType === 'dragon_breath') {
      soundManager.playCastMagic();
      let dmg = 15;
      if (this.player.equippedShield && this.player.equippedShield.antiFire) {
        dmg = 7;
        this.log.addMessage('ドラゴンシールドが炎を軽減した！');
      }
      this.player.hp = Math.max(0, this.player.hp - dmg);
      soundManager.playPlayerHurt();
      this.renderer.addFloatingText(`-${dmg}`, this.player.x, this.player.y, '#ff5722');
      this.log.addMessage(`もじさんは 炎に包まれ ${dmg} のダメージを受けた！`);
    } else if (decision.skillType === 'sleep_spell') {
      soundManager.playCastMagic();
      this.player.sleepTurns = 4;
      this.log.addMessage('もじさんは 眠ってしまった！');
    }
  }

  // インベントリを開く
  openInventory() {
    if (this.isGameOver || this.isGameClear || !this.player) return;

    // 足元のアイテム判定
    const px = this.player.x;
    const py = this.player.y;
    const groundItem = this.dungeon.items.find(i => i.x === px && i.y === py) || null;
    const isStairs = (this.dungeon.stairs && this.dungeon.stairs.x === px && this.dungeon.stairs.y === py);

    this.inventoryModal.open(this.player, groundItem, isStairs);
  }

  // インベントリアクションハンドラ
  handleInventoryAction(action, item) {
    if (this.isGameOver || this.isGameClear || !this.player) return;

    switch (action) {
      case 'equip':
        const equipMsg = this.player.equipItem(item);
        if (equipMsg) this.log.addMessage(equipMsg);
        this.executeTurn(false);
        break;

      case 'unequip':
        const unequipMsg = this.player.unequipItem(item);
        if (unequipMsg) this.log.addMessage(unequipMsg);
        this.executeTurn(false);
        break;

      case 'use':
        ItemManager.useItem(item, this.player, this.dungeon, this.monsters, msg => this.log.addMessage(msg));
        this.executeTurn(false);
        break;

      case 'throw':
        ItemManager.throwItem(item, this.player, this.dungeon, this.monsters, msg => this.log.addMessage(msg));
        this.executeTurn(false);
        break;

      case 'drop':
        this.player.removeItem(item);
        item.x = this.player.x;
        item.y = this.player.y;
        this.dungeon.items.push(item);
        this.log.addMessage(`もじさんは ${item.name} を足元に置いた。`);
        this.executeTurn(false);
        break;

      case 'pickup_ground':
        if (item) {
          const res = this.player.addItem(item);
          if (res.success) {
            const idx = this.dungeon.items.indexOf(item);
            if (idx !== -1) this.dungeon.items.splice(idx, 1);
            soundManager.playPickup();
            this.log.addMessage(`もじさんは ${item.name} を拾った！`);
          } else {
            this.log.addMessage(res.reason);
          }
          this.executeTurn(false);
        }
        break;

      case 'use_ground':
        if (item) {
          const idx = this.dungeon.items.indexOf(item);
          if (idx !== -1) this.dungeon.items.splice(idx, 1);
          ItemManager.useItem(item, this.player, this.dungeon, this.monsters, msg => this.log.addMessage(msg));
          this.executeTurn(false);
        }
        break;

      case 'descend_stairs':
        this.descendStairs();
        break;
    }

    this.updateHUD();
  }

  // 階段を降りる
  descendStairs() {
    if (this.floorNumber >= CONFIG.DUNGEON.MAX_FLOORS) {
      this.triggerGameClear();
      return;
    }
    this.loadFloor(this.floorNumber + 1);
  }

  // ゲームオーバー
  triggerGameOver(reason) {
    this.isGameOver = true;
    soundManager.playGameOver();
    this.log.addMessage(`もじさんは 力尽きた...`);

    const modal = document.getElementById('end-modal');
    const title = document.getElementById('end-title');
    const desc = document.getElementById('end-desc');
    title.className = 'end-title game-over';
    title.textContent = 'GAME OVER';
    desc.textContent = reason;

    document.getElementById('end-floor').textContent = `B${this.floorNumber}F`;
    document.getElementById('end-level').textContent = `${this.player.level}`;
    document.getElementById('end-gold').textContent = `${this.player.gold}G`;

    modal.classList.remove('hidden');
  }

  // ゲームクリア
  triggerGameClear() {
    this.isGameClear = true;
    soundManager.playVictory();
    this.log.addMessage('奇跡の箱を手に入れた！ 冒険クリア！');

    const modal = document.getElementById('end-modal');
    const title = document.getElementById('end-title');
    const desc = document.getElementById('end-desc');
    title.className = 'end-title game-clear';
    title.textContent = '★ ダンジョン制覇 ★';
    desc.textContent = '見事にダンジョンの奥底から「奇跡の箱」を持ち帰った！伝説の商人として語り継がれるだろう！';

    document.getElementById('end-floor').textContent = `B10F クリア！`;
    document.getElementById('end-level').textContent = `${this.player.level}`;
    document.getElementById('end-gold').textContent = `${this.player.gold}G`;

    modal.classList.remove('hidden');
  }

  // HUD更新
  updateHUD() {
    if (!this.player) return;

    document.getElementById('hud-floor').textContent = `B${this.floorNumber}F`;
    document.getElementById('hud-level').textContent = this.player.level;
    document.getElementById('hud-hp').textContent = this.player.hp;
    document.getElementById('hud-maxhp').textContent = this.player.maxHp;

    const hpPercent = Math.max(0, Math.min(100, (this.player.hp / this.player.maxHp) * 100));
    document.getElementById('hud-hp-bar').style.width = `${hpPercent}%`;

    document.getElementById('hud-satiety').textContent = `${Math.floor(this.player.satiety)}%`;
    document.getElementById('hud-gold').textContent = this.player.gold;
    document.getElementById('inv-count').textContent = this.player.inventory.length;
  }

  // メインループ（60fps レンダリング＆補間）
  setupGameLoop() {
    const loop = () => {
      // プレイヤーのスムーズ補間
      if (this.player && this.player.animProgress < 1.0) {
        this.player.animProgress = Math.min(1.0, this.player.animProgress + 0.18);
      }

      // モンスターのスムーズ補間
      this.monsters.forEach(m => {
        if (m.animProgress < 1.0) {
          m.animProgress = Math.min(1.0, m.animProgress + 0.18);
        }
      });

      if (this.dungeon && this.player) {
        this.renderer.updateCamera(this.player);
        this.renderer.render(this.dungeon, this.player, this.monsters);
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// ゲーム起動
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
