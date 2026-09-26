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
import { TitleScreen } from './ui/TitleScreen.js';
import { SaveManager } from './storage/SaveManager.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new DungeonRenderer(this.canvas);
    this.generator = new DungeonGenerator();
    this.log = new MessageLog('message-window', {
      updateMode: 'scroll',
      typewriterSpeed: 8,
      autoAdvanceDelay: 500,
      maxVisualWidth: 19
    });

    this.floorNumber = 1;
    this.difficulty = 'normal';
    this.player = null;
    this.dungeon = null;
    this.monsters = [];

    this.isBusy = false;
    this.isGameOver = false;
    this.isGameClear = false;

    window.game = this;

    this.initUI();
    this.titleScreen = new TitleScreen(this);
    this.setupGameLoop();

    // デバッグ・テスト用シーン直接起動 または ポータル判定
    const urlParams = new URLSearchParams(window.location.search);
    const scene = urlParams.get('scene');
    const shouldDirectMojidan = (window.location.hash === '#mojidan' || urlParams.get('game') === 'mojidan' || !!scene);

    if (shouldDirectMojidan) {
      this.titleScreen.show();
    } else {
      this.titleScreen.showPortal();
    }
    if (scene === 'diff') {
      this.titleScreen.openDifficultySelect();
    } else if (scene === 'story') {
      this.titleScreen.startOpeningStory();
      const page = parseInt(urlParams.get('page') || '0', 10);
      if (page > 0) {
        this.titleScreen.currentStoryPage = page;
        this.titleScreen.renderStoryPage();
      }
    } else if (scene === 'game') {
      this.titleScreen.finishStoryAndStart();
      if (urlParams.get('equip') === 'true') {
        this.player.equippedWeapon = { name: 'どうのつるぎ', sprite: './assets/items/bronze_sword.png', attack: 3 };
        this.player.equippedShield = { name: '皮の盾', sprite: './assets/items/leather_shield.png', defense: 2 };
        if (urlParams.get('facing') === 'left') {
          this.player.setDirection(-1, 0);
        } else if (urlParams.get('facing') === 'right') {
          this.player.setDirection(1, 0);
        }
      }
      if (urlParams.get('hp3') === 'true') {
        this.player.maxHp = 145;
        this.player.hp = 145;
        this.player.str = 14;
        this.player.maxStr = 14;
        this.player.level = 12;
        this.player.gold = 12450;
        this.updateHUD();
      }
      if (urlParams.get('test_inv') === 'true') {
        this.player.inventory = [
          new Item({ id: 'bronze_sword', name: '銅の剣', type: 'weapon', atk: 3, refine: 1, identified: false, sprite: './assets/items/bronze_sword.png' }),
          new Item({ id: 'scale_shield', name: 'うろこの盾', type: 'shield', def: 4, identified: false, sprite: './assets/items/scale_shield.png' }),
          new Item({ id: 'herb', name: '薬草', type: 'herb', identified: false, sprite: './assets/items/herb.png' }),
          new Item({ id: 'identify', name: 'インパスの巻物', type: 'scroll', identified: true, sprite: './assets/items/scroll.png' }),
          new Item({ id: 'bread', name: 'パン', type: 'bread', identified: true, sprite: './assets/items/bread.png' })
        ];
        this.openInventory();
      }
      if (urlParams.get('inv') === 'true') {
        this.openInventory();
      }
      if (urlParams.get('stairs') === 'true') {
        this.showStairsModal();
      }
    }
  }

  initUI() {
    // インベントリモーダル初期化
    this.inventoryModal = new InventoryModal({
      onAction: (action, item) => this.handleInventoryAction(action, item)
    });

    // 階段確認モーダル初期化
    this.stairsModal = document.getElementById('stairs-modal');
    this.btnStairsYes = document.getElementById('btn-stairs-yes');
    this.btnStairsNo = document.getElementById('btn-stairs-no');

    if (this.btnStairsYes) {
      this.btnStairsYes.addEventListener('click', () => {
        soundManager.playConfirm();
        this.hideStairsModal();
        this.descendStairs();
      });
    }

    if (this.btnStairsNo) {
      this.btnStairsNo.addEventListener('click', () => {
        soundManager.playCursor?.();
        this.hideStairsModal();
        this.log.addMessage('もじさんは　その場にとどまった。');
      });
    }

    // 階段モーダルが開いている時のキーボード対応
    window.addEventListener('keydown', (e) => {
      if (this.stairsModal && !this.stairsModal.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          soundManager.playCursor?.();
          const isYes = this.btnStairsYes?.classList.contains('selected');
          if (isYes) {
            this.btnStairsYes?.classList.remove('selected');
            this.btnStairsNo?.classList.add('selected');
          } else {
            this.btnStairsNo?.classList.remove('selected');
            this.btnStairsYes?.classList.add('selected');
          }
        } else if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') {
          soundManager.playConfirm();
          const isYes = this.btnStairsYes?.classList.contains('selected');
          this.hideStairsModal();
          if (isYes || e.key === 'y' || e.key === 'Y') {
            this.descendStairs();
          } else {
            this.log.addMessage('もじさんは　その場にとどまった。');
          }
        } else if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') {
          soundManager.playCursor?.();
          this.hideStairsModal();
          this.log.addMessage('もじさんは　その場にとどまった。');
        }
      }
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
      },
      getCurrentDirection: () => this.player ? this.player.dir : { dx: 0, dy: 1 },
      onTurnModeChange: (isTurnMode) => {
        if (this.renderer) {
          this.renderer.isTurnMode = isTurnMode;
        }
      },
      onAdvanceMessage: () => this.log.advance()
    });

    // リスタートボタン（タイトルへ戻る）
    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        document.getElementById('end-modal').classList.add('hidden');
        this.titleScreen.show();
      });
    }

    // 中断セーブボタン
    const saveQuitBtn = document.getElementById('btn-save-quit');
    if (saveQuitBtn) {
      saveQuitBtn.addEventListener('click', () => {
        if (this.isBusy || this.isGameOver || this.isGameClear || !this.player) return;
        const saved = SaveManager.saveGame(this);
        if (saved) {
          soundManager.playConfirm();
          alert('冒険の記録をセーブしました。タイトル画面に戻ります。');
          this.titleScreen.show();
        } else {
          alert('セーブに失敗しました。');
        }
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

    // 方向キーやボタン以外の画面タップでメッセージ送り
    const handleScreenTapForMessage = (e) => {
      // モーダル表示中（タイトル、ストーリー、階段、道具、ゲーム終了、難易度）は除外
      const titleScreen = document.getElementById('title-screen');
      if (titleScreen && !titleScreen.classList.contains('hidden') && titleScreen.style.display !== 'none') return;
      const storyModal = document.getElementById('story-modal');
      if (storyModal && !storyModal.classList.contains('hidden')) return;
      const stairsModal = document.getElementById('stairs-modal');
      if (stairsModal && !stairsModal.classList.contains('hidden')) return;
      const invModal = document.getElementById('inventory-modal');
      if (invModal && !invModal.classList.contains('hidden')) return;
      const endModal = document.getElementById('end-modal');
      if (endModal && !endModal.classList.contains('hidden')) return;
      const diffModal = document.getElementById('difficulty-modal');
      if (diffModal && !diffModal.classList.contains('hidden')) return;

      // ボタンやD-Padなどの操作部をタップした場合は除外
      const target = e.target;
      if (target.closest('.dpad-btn') || target.closest('.dq-cmd-btn') || target.closest('button')) {
        return;
      }

      // メッセージの進行（タイプ中スキップ or 次行表示）
      if (this.log) {
        this.log.advance();
      }
    };
    window.addEventListener('pointerdown', handleScreenTapForMessage, { passive: true });

    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize();
  }

  // 階段確認モーダル表示
  showStairsModal() {
    if (!this.stairsModal) return;
    this.stairsModal.classList.remove('hidden');

    const nextFloorNum = this.floorNumber + 1;
    const nextFloorStr = `${51 - nextFloorNum}F`;

    const msgEl = document.getElementById('stairs-dialog-msg');
    if (msgEl) {
      if (nextFloorNum === CONFIG.DUNGEON.MAX_FLOORS) {
        msgEl.innerHTML = `非常階段がある。<br>いよいよ目的の【<span style="color:#ffd700;font-weight:bold">40F</span>】へ降りますか？<br>トイレはもう目の前だ！`;
      } else {
        msgEl.innerHTML = `非常階段がある。<br>下の階（<span style="color:#ffd700;font-weight:bold">${nextFloorStr}</span>）へ降りますか？`;
      }
    }

    if (this.btnStairsYes) this.btnStairsYes.classList.add('selected');
    if (this.btnStairsNo) this.btnStairsNo.classList.remove('selected');
  }

  hideStairsModal() {
    if (this.stairsModal) {
      this.stairsModal.classList.add('hidden');
    }
  }

  // 新規ゲーム開始（初期装備なし・身一つでスタート）
  startNewGame(difficulty = 'normal') {
    this.difficulty = difficulty;
    this.floorNumber = 1;
    this.isGameOver = false;
    this.isGameClear = false;
    this.log.clear();

    // プレイヤー生成（初期装備なし）
    this.player = new Player(0, 0);
    this.player.equippedWeapon = null;
    this.player.equippedShield = null;
    this.player.equippedArrow = null;
    this.player.inventory = [];

    // 50F（floorNumber: 1）の生成
    this.loadFloor(1);

    if (this.difficulty === 'hard') {
      this.log.addMessage('【50F】[HARD] 非常事態発生！');
    } else {
      this.log.addMessage('【50F】非常事態発生！');
    }
    this.log.addMessage('もじさんは　扉を蹴破った！');
    this.log.addMessage('午後の始業までに');
    this.log.addMessage('40Fのトイレを　目指せ！');
    SaveManager.saveGame(this);
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

    // モンスターインスタンス化（難易度補正反映）
    this.monsters = this.dungeon.monsterSpawns.map(sp => {
      const m = new Monster(sp.type.id, sp.x, sp.y);
      if (this.difficulty === 'hard') {
        m.maxHp = Math.round(m.maxHp * 1.3);
        m.hp = m.maxHp;
        m.atk = Math.round(m.atk * 1.3);
      }
      return m;
    });

    // 視界計算
    this.updateVisibility();
    this.updateHUD();

    const floorDisplay = `${51 - floorNum}F`;
    if (floorNum > 1) {
      if (floorNum === CONFIG.DUNGEON.MAX_FLOORS) {
        this.log.addMessage('【40F】ついに　目的の40Fに到達！');
        this.log.addMessage('どこかに　トイレがあるはずだ！');
      } else {
        this.log.addMessage('非常階段を駆け降り、');
        this.log.addMessage(`${floorDisplay}に　到達した！`);
      }
      soundManager.playStairs();
      SaveManager.saveGame(this);
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
      this.log.addMessage('もじさんは　眠っていて動けない！');
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
      this.log.addMessage('もじさんは　眠っていて動けない！');
      this.executeTurn(false);
      return;
    }

    this.player.isAttacking = 9;
    const dx = this.player.dir.dx;
    const dy = this.player.dir.dy;
    const tx = this.player.x + dx;
    const ty = this.player.y + dy;

    // 斜め攻撃時の角抜け防止（壁角を挟んだ敵へは攻撃が届かない）
    const isCornerObstructed = (dx !== 0 && dy !== 0) && (
      tx < 0 || tx >= this.dungeon.width || ty < 0 || ty >= this.dungeon.height ||
      this.dungeon.tiles[this.player.y][tx] === CONFIG.TILE.WALL ||
      this.dungeon.tiles[ty][this.player.x] === CONFIG.TILE.WALL
    );

    const monster = (!isCornerObstructed)
      ? this.monsters.find(m => m.hp > 0 && m.x === tx && m.y === ty)
      : null;

    if (monster) {
      this.attackMonster(monster);
    } else {
      // 素振り（空振り）
      soundManager.playAttack();
      this.renderer.addSlashEffect(tx, ty, this.player.equippedWeapon);
    }

    this.executeTurn(false);
  }

  // モンスター攻撃処理
  attackMonster(monster) {
    this.player.isAttacking = 9;
    this.player.inCombatTimer = 4;
    monster.inCombatTimer = 4;
    monster.setDirection(this.player.x - monster.x, this.player.y - monster.y);
    soundManager.playAttack();
    this.renderer.addSlashEffect(monster.x, monster.y, this.player.equippedWeapon);

    // 命中判定（SFC解析式: 7/8 = 87.5% で命中、1/8でミス）
    if (Math.random() >= 7 / 8) {
      this.log.addMessage('もじさんの　こうげき！');
      this.log.addMessage(`しかし　${monster.name}は　身をかわした！`);
      return;
    }

    const dmg = this.player.calcDamageAgainst(monster);
    monster.hp -= dmg;
    monster.hurtTimer = 6;
    monster.wakeUp();

    this.renderer.addFloatingText(`${dmg}`, monster.x, monster.y, '#ffffff');
    soundManager.playHit();
    this.log.addMessage('もじさんの　こうげき！');
    this.log.addMessage(`${monster.name}に　${dmg}の　ダメージ！`);

    if (monster.hp <= 0) {
      soundManager.playDefeat();
      this.log.addMessage(`${monster.name}を　たおした！`);
      const expMsgs = this.player.gainExp(monster.exp);
      expMsgs.forEach(m => this.log.addMessage(m));

      // 確率でドロップ（25%でアイテムまたはゴールド）
      if (Math.random() < 0.25) {
        const dropped = this.generator._generateFloorItem(this.floorNumber, monster.x, monster.y);
        if (dropped) {
          this.dungeon.items.push(dropped);
          this.log.addMessage(`${monster.name}は`);
          this.log.addMessage(`${dropped.getItemCleanName()}を　落とした！`);
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
      this.log.addMessage('矢を　持っていません！');
      return;
    }

    ItemManager.throwItem(arrow, this.player, this.dungeon, this.monsters, msg => this.log.addMessage(msg));
    this.executeTurn(false);
  }

  // 移動直後の足元判定
  checkGroundAfterMove() {
    const px = this.player.x;
    const py = this.player.y;

    // 奇跡のトイレ個室 / 奇跡の箱（クリアアイテム）
    const boxIdx = this.dungeon.items.findIndex(i => (i.id === 'miracle_box' || i.id === 'toilet') && i.x === px && i.y === py);
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
        this.log.addMessage(`${item.goldAmount}ゴールドを　拾った！`);
      } else {
        // インベントリに空きがあれば自動拾い
        const res = this.player.addItem(item);
        if (res.success) {
          this.dungeon.items.splice(itemIdx, 1);
          soundManager.playPickup();
          this.log.addMessage('もじさんは');
          this.log.addMessage(`${item.getItemCleanName()}を　拾った！`);
        } else {
          this.log.addMessage(`足元に　${item.getItemCleanName()}が`);
          this.log.addMessage('ある。（持ち物がいっぱい）');
        }
      }
    }

    // 階段（インゲーム確認ダイアログを表示）
    if (this.dungeon.stairs && this.dungeon.stairs.x === px && this.dungeon.stairs.y === py) {
      this.showStairsModal();
    }
  }

  // ワナ判定
  checkTrapAfterMove() {
    const px = this.player.x;
    const py = this.player.y;

    const trap = this.dungeon.traps.find(t => t.x === px && t.y === py);
    if (trap) {
      trap.revealed = true;
      this.log.addMessage(`${trap.name}を　踏んでしまった！`);
      soundManager.playPlayerHurt();

      switch (trap.id) {
        case 'arrow':
          this.player.str = Math.max(1, this.player.str - 1);
          this.log.addMessage('毒の矢が刺さり　ちからが 1 下がった！');
          break;
        case 'mine':
          const bombDmg = Math.max(1, Math.floor(this.player.hp / 2));
          this.player.hp = Math.max(1, this.player.hp - bombDmg);
          this.renderer.addFloatingText(`-${bombDmg}`, px, py, '#ef4444');
          this.log.addMessage('大爆発！　HPが半分になった！');
          break;
        case 'sleep':
          this.player.sleepTurns = 4;
          this.log.addMessage('もじさんは　眠ってしまった！');
          break;
        case 'trip':
          if (this.player.inventory.length > 0) {
            const dropIdx = Math.floor(Math.random() * this.player.inventory.length);
            const dropItem = this.player.inventory[dropIdx];
            this.player.removeItem(dropItem);
            dropItem.x = px;
            dropItem.y = py;
            this.dungeon.items.push(dropItem);
            this.log.addMessage('足元のケーブルに　引っ掛かった！');
            this.log.addMessage(`${dropItem.getItemCleanName()}を　落とした！`);
          }
          break;
        case 'warp':
          ItemManager.teleportEntity(this.player, this.dungeon, this.monsters);
          this.log.addMessage('別の場所へ　ワープしてしまった！');
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

    // 3. ターン経過による戦闘タイマー減少 ＆ ハードモード空腹加速
    if (this.player.inCombatTimer > 0) this.player.inCombatTimer--;
    this.monsters.forEach(m => {
      if (m.inCombatTimer > 0) m.inCombatTimer--;
    });
    if (isMove && this.difficulty === 'hard') {
      this.player.satiety = Math.max(0, this.player.satiety - 0.05); // ハード時は空腹進行1.5倍
    }

    // 4. 視界・HUD更新
    this.updateVisibility();
    this.updateHUD();

    // プレイヤー死亡チェック
    if (this.player.hp <= 0) {
      this.triggerGameOver('モンスターに倒されてしまった...');
    }
  }

  // モンスターの通常攻撃
  processMonsterAttack(monster) {
    this.player.inCombatTimer = 4;
    monster.inCombatTimer = 4;

    // 足元が聖域の巻物なら攻撃を受けない
    const onSanctuary = this.dungeon.items.some(i => i.id === 'sanctuary' && i.x === this.player.x && i.y === this.player.y);
    if (onSanctuary) {
      this.log.addMessage('せいいきの巻物の力で');
      this.log.addMessage(`${monster.name}の攻撃を　受け付けない！`);
      return;
    }

    // 命中判定（SFC解析式: 7/8 = 87.5% で命中、1/8でプレイヤーが回避）
    if (Math.random() >= 7 / 8) {
      this.log.addMessage(`${monster.name}の　こうげき！`);
      this.log.addMessage('もじさんは　身をかわした！');
      return;
    }

    const dmg = this.player.takeDamage(monster.atk);
    soundManager.playPlayerHurt();
    this.renderer.addFloatingText(`-${dmg}`, this.player.x, this.player.y, '#ef4444');
    this.log.addMessage(`${monster.name}の　こうげき！`);
    this.log.addMessage(`もじさんは　${dmg}の　ダメージを受けた！`);

    // 特殊効果（おばけキノコの毒、くさった死体の腐敗）
    if (monster.id === 'mushroom' && Math.random() < 0.3) {
      if (this.player.equippedShield && this.player.equippedShield.antiPoison) {
        this.log.addMessage('うろこの盾が　毒の胞子を弾いた！');
      } else {
        this.player.str = Math.max(1, this.player.str - 1);
        this.log.addMessage('毒の胞子を吸い込んで　ちからが 1 下がった！');
      }
    } else if (monster.id === 'zombie' && Math.random() < 0.25) {
      const breads = this.player.inventory.filter(i => i.type === 'bread' && i.id !== 'rotten_bread');
      if (breads.length > 0) {
        const b = breads[0];
        b.id = 'rotten_bread';
        b.name = 'くさったパン';
        b.icon = '🥖';
        b.desc = 'お腹を30%回復するが、腹痛で睡眠や毒などの異常が起こる。';
        this.log.addMessage('大事なパンを　腐らされてしまった！');
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
        this.log.addMessage('ドラゴンシールドが　炎を軽減した！');
      }
      this.player.hp = Math.max(0, this.player.hp - dmg);
      soundManager.playPlayerHurt();
      this.renderer.addFloatingText(`-${dmg}`, this.player.x, this.player.y, '#ff5722');
      this.log.addMessage('もじさんは　炎に包まれ');
      this.log.addMessage(`${dmg}の　ダメージを受けた！`);
    } else if (decision.skillType === 'sleep_spell') {
      soundManager.playCastMagic();
      this.player.sleepTurns = 4;
      this.log.addMessage('もじさんは　眠ってしまった！');
    }
  }

  // インベントリを開く
  openInventory() {
    this.controls?.stopRepeat();
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
        this.log.addMessage('もじさんは');
        this.log.addMessage(`${item.getItemCleanName()}を　足元に置いた。`);
        this.executeTurn(false);
        break;

      case 'pickup_ground':
        if (item) {
          const res = this.player.addItem(item);
          if (res.success) {
            const idx = this.dungeon.items.indexOf(item);
            if (idx !== -1) this.dungeon.items.splice(idx, 1);
            soundManager.playPickup();
            this.log.addMessage('もじさんは');
            this.log.addMessage(`${item.getItemCleanName()}を　拾った！`);
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
    this.controls?.stopRepeat();
    this.isGameOver = true;
    SaveManager.clearSaveData();
    soundManager.playGameOver();
    this.log.addMessage('もじさんは　力尽きた……');

    const modal = document.getElementById('end-modal');
    const title = document.getElementById('end-title');
    const desc = document.getElementById('end-desc');
    title.className = 'end-title game-over';
    title.textContent = 'GAME OVER';
    desc.textContent = reason || '無情にも13:00の始業ベルが鳴り響いてしまった…！';

    const currentFloorStr = `${51 - this.floorNumber}F`;
    const diffTag = this.difficulty === 'hard' ? ' [HARD]' : '';
    document.getElementById('end-floor').textContent = `${currentFloorStr}${diffTag}`;
    document.getElementById('end-level').textContent = `${this.player.level}`;
    document.getElementById('end-gold').textContent = `${this.player.gold}G`;

    modal.classList.remove('hidden');
  }

  // ゲームクリア
  triggerGameClear() {
    this.controls?.stopRepeat();
    this.isGameClear = true;
    SaveManager.clearSaveData();
    soundManager.playVictory();
    this.log.addMessage('【12:59】奇跡のトイレ個室に');
    this.log.addMessage('滑り込みセーフ！！');
    this.log.addMessage('極限の危機を脱し、無事に');
    this.log.addMessage('13:00の始業に間に合った！');

    const modal = document.getElementById('end-modal');
    const title = document.getElementById('end-title');
    const desc = document.getElementById('end-desc');
    title.className = 'end-title game-clear';
    title.textContent = '★ 危機一髪クリア！ ★';
    desc.textContent = '12:59 奇跡のトイレ個室へ滑り込みセーフ！ 極限のプレッシャーに打ち勝ち、無事に13:00の始業ベルと同時にデスクへ着席した！ もじさんの午後の戦いが今始まる…！';

    const diffTag = this.difficulty === 'hard' ? ' [HARDクリア！]' : ' クリア！';
    document.getElementById('end-floor').textContent = `40F 到達！${diffTag}`;
    document.getElementById('end-level').textContent = `${this.player.level}`;
    document.getElementById('end-gold').textContent = `${this.player.gold}G`;

    modal.classList.remove('hidden');
  }

  // HUD更新（ステータス常時表示＆装備品常時表示）
  updateHUD() {
    if (!this.player) return;

    // フロア・難易度・LV・HP
    const floorEl = document.getElementById('hud-floor');
    if (floorEl) floorEl.textContent = `${51 - this.floorNumber}F`;

    const diffEl = document.getElementById('hud-diff');
    if (diffEl) {
      const isHard = this.difficulty === 'hard';
      diffEl.textContent = isHard ? 'Hard' : 'Normal';
      diffEl.className = 'diff-badge ' + (isHard ? 'hard' : 'normal');
    }

    const levelEl = document.getElementById('hud-level');
    if (levelEl) levelEl.textContent = this.player.level;

    const hpEl = document.getElementById('hud-hp');
    if (hpEl) hpEl.textContent = this.player.hp;

    const maxhpEl = document.getElementById('hud-maxhp');
    if (maxhpEl) maxhpEl.textContent = this.player.maxHp;

    // ちから（Strength常時表示）
    const strEl = document.getElementById('hud-str');
    if (strEl) strEl.textContent = this.player.str;

    const maxstrEl = document.getElementById('hud-maxstr');
    if (maxstrEl) maxstrEl.textContent = this.player.maxStr;

    // 攻撃力・防御力（常時表示）
    const atkEl = document.getElementById('hud-atk');
    if (atkEl) atkEl.textContent = this.player.getAttackPower();

    const defEl = document.getElementById('hud-def');
    if (defEl) defEl.textContent = this.player.getDefensePower();

    // 満腹度・ゴールド・道具所持数
    const satietyEl = document.getElementById('hud-satiety');
    if (satietyEl) satietyEl.textContent = `${Math.floor(this.player.satiety)}%`;

    const goldEl = document.getElementById('hud-gold');
    if (goldEl) goldEl.textContent = this.player.gold;

    const invCountEl = document.getElementById('inv-count');
    if (invCountEl) invCountEl.textContent = this.player.inventory.length;

    const hudInvCountEl = document.getElementById('hud-inv-count');
    if (hudInvCountEl) hudInvCountEl.textContent = `${this.player.inventory.length}/16`;

    // 装備中の武器（常時表示）
    const weaponEl = document.getElementById('hud-weapon');
    const weaponIcon = document.getElementById('hud-weapon-icon');
    if (weaponEl) {
      if (this.player.equippedWeapon) {
        weaponEl.textContent = this.player.equippedWeapon.getItemCleanName();
        if (weaponIcon) {
          weaponIcon.src = this.player.equippedWeapon.sprite;
          weaponIcon.style.display = 'inline-block';
        }
      } else {
        weaponEl.textContent = '素手';
        if (weaponIcon) weaponIcon.style.display = 'none';
      }
    }

    // 装備中の盾（常時表示）
    const shieldEl = document.getElementById('hud-shield');
    const shieldIcon = document.getElementById('hud-shield-icon');
    if (shieldEl) {
      if (this.player.equippedShield) {
        shieldEl.textContent = this.player.equippedShield.getItemCleanName();
        if (shieldIcon) {
          shieldIcon.src = this.player.equippedShield.sprite;
          shieldIcon.style.display = 'inline-block';
        }
      } else {
        shieldEl.textContent = 'なし';
        if (shieldIcon) shieldIcon.style.display = 'none';
      }
    }

    // 装備中の矢（常時表示）
    const arrowEl = document.getElementById('hud-arrow');
    const arrowIcon = document.getElementById('hud-arrow-icon');
    if (arrowEl) {
      if (this.player.equippedArrow) {
        arrowEl.textContent = `${this.player.equippedArrow.name}(${this.player.equippedArrow.count})`;
        if (arrowIcon) {
          arrowIcon.src = this.player.equippedArrow.sprite;
          arrowIcon.style.display = 'inline-block';
        }
      } else {
        arrowEl.textContent = 'なし';
        if (arrowIcon) arrowIcon.style.display = 'none';
      }
    }
  }

  // メインループ（60fps レンダリング＆補間＆シームレス移動）
  setupGameLoop() {
    const loop = () => {
      // プレイヤーのスムーズ補間＆モーション制御
      if (this.player) {
        if (this.player.animProgress < 1.0) {
          this.player.animProgress = Math.min(1.0, this.player.animProgress + 0.18);
        }
        if (this.player.isAttacking > 0) {
          this.player.isAttacking--;
        }
        if (this.player.hurtTimer > 0) {
          this.player.hurtTimer--;
        }

        // 停止中のアイドル足踏みアクション（約0.3秒ごとに1コマ進む）
        if (this.player.animProgress >= 1.0 && this.player.isAttacking === 0 && this.player.hurtTimer === 0) {
          this.player.idleStepTimer = (this.player.idleStepTimer || 0) + 1;
          if (this.player.idleStepTimer >= 18) {
            this.player.idleStepTimer = 0;
            this.player.idleStepFrame = (this.player.idleStepFrame % 3) + 1;
          }
        } else {
          this.player.idleStepTimer = 0;
        }

        // D-Pad長押し時のシームレス連続移動（チョン押しと長押しの完全両立）
        if (this.controls && this.controls.holdingDir && !this.controls.turnOnlyMode &&
            !this.isBusy && !this.isGameOver && !this.isGameClear) {
          const holdElapsed = Date.now() - (this.controls.holdingDir.startTime || 0);
          // 初回長押しディレイ: 220ms
          // チョン押し（100〜180ms）では指が離れるため2歩目は発動せず確実に1歩で停止！
          // 長押し継続時のみ、シームレス連続移動モードに入ってアニメーション着地（>=0.82）でスムーズに走る
          if (this.controls.isContinuousMoving || holdElapsed >= 220) {
            this.controls.isContinuousMoving = true;
            if (this.player.animProgress >= 0.82) {
              this.handlePlayerMove(this.controls.holdingDir.dx, this.controls.holdingDir.dy);
            }
          }
        }

        // 足踏み長押し時のスムーズ連続足踏み
        if (this.controls && this.controls.isHoldingWait &&
            !this.isBusy && !this.isGameOver && !this.isGameClear) {
          this._holdingWaitFrame = (this._holdingWaitFrame || 0) + 1;
          if (this._holdingWaitFrame >= 7) {
            this._holdingWaitFrame = 0;
            this.handlePlayerWait();
          }
        } else {
          this._holdingWaitFrame = 0;
        }
      }

      // モンスターのスムーズ補間＆被ダメージフラッシュ
      this.monsters.forEach(m => {
        if (m.hurtTimer > 0) {
          m.hurtTimer--;
        }
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
