/**
 * SaveManager - もじダンのセーブ／ロード管理
 * localStorage を使用してゲーム状態の永続化と中断再開を実現
 */

import { Item } from '../items/Item.js';
import { Monster } from '../entities/Monster.js';
import { CONFIG } from '../config.js';

const SAVE_KEY = 'mojidan_save_data_v1';

export class SaveManager {
  /**
   * 有効なセーブデータが存在するか確認
   */
  static hasSaveData() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return !!(data && data.player && data.dungeon && data.floorNumber);
    } catch (e) {
      console.warn('Failed to check save data:', e);
      return false;
    }
  }

  /**
   * セーブデータの要約情報（タイトル画面表示用）を取得
   */
  static getSaveSummary() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.player) return null;

      const floorDisplay = `${51 - data.floorNumber}F`;
      return {
        floorDisplay,
        level: data.player.level || 1,
        hp: data.player.hp || 15,
        maxHp: data.player.maxHp || 15,
        gold: data.player.gold || 0,
        timestamp: data.timestamp || Date.now()
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * 現在のゲーム状態をセーブ
   */
  static saveGame(game) {
    if (!game || !game.player || !game.dungeon) return false;

    try {
      const p = game.player;
      const d = game.dungeon;

      // 装備インデックス検索
      const weaponIdx = p.equippedWeapon ? p.inventory.indexOf(p.equippedWeapon) : -1;
      const shieldIdx = p.equippedShield ? p.inventory.indexOf(p.equippedShield) : -1;
      const arrowIdx = p.equippedArrow ? p.inventory.indexOf(p.equippedArrow) : -1;

      const saveData = {
        version: 1,
        timestamp: Date.now(),
        floorNumber: game.floorNumber,

        // プレイヤーステータス
        player: {
          x: p.x,
          y: p.y,
          dir: p.dir,
          facingName: p.facingName,
          name: p.name,
          level: p.level,
          exp: p.exp,
          hp: p.hp,
          maxHp: p.maxHp,
          str: p.str,
          maxStr: p.maxStr,
          satiety: p.satiety,
          maxSatiety: p.maxSatiety,
          gold: p.gold,
          sleepTurns: p.sleepTurns || 0,
          confusedTurns: p.confusedTurns || 0,
          eyedropTurns: p.eyedropTurns || 0,
          hungerStepCount: p.hungerStepCount || 0,
          healStepCount: p.healStepCount || 0,
          inventory: p.inventory.map(item => this._serializeItem(item)),
          equippedWeaponIdx: weaponIdx,
          equippedShieldIdx: shieldIdx,
          equippedArrowIdx: arrowIdx
        },

        // ダンジョンフロア状態
        dungeon: {
          width: d.width,
          height: d.height,
          tiles: d.tiles,
          visible: d.visible,
          explored: d.explored,
          roomMap: d.roomMap,
          rooms: d.rooms,
          playerSpawn: d.playerSpawn,
          items: d.items.map(item => this._serializeItem(item)),
          traps: d.traps
        },

        // モンスター状態
        monsters: game.monsters.map(m => ({
          id: m.id,
          name: m.name,
          x: m.x,
          y: m.y,
          prevX: m.prevX,
          prevY: m.prevY,
          hp: m.hp,
          maxHp: m.maxHp,
          atk: m.atk,
          def: m.def,
          exp: m.exp,
          dir: m.dir,
          facingName: m.facingName,
          state: m.state,
          statusSleep: m.statusSleep || 0,
          statusParalyzed: !!m.statusParalyzed,
          statusConfused: m.statusConfused || 0,
          statusSealed: !!m.statusSealed
        }))
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      return true;
    } catch (e) {
      console.error('Failed to save game:', e);
      return false;
    }
  }

  /**
   * セーブデータをロードしてゲームインスタンスに復元
   */
  static loadGame(game) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.player || !data.dungeon) return false;

      game.floorNumber = data.floorNumber;
      game.isGameOver = false;
      game.isGameClear = false;
      game.log.clear();

      // 1. ダンジョン復元
      const dData = data.dungeon;
      game.dungeon = {
        width: dData.width,
        height: dData.height,
        floorNumber: data.floorNumber,
        tiles: dData.tiles,
        visible: dData.visible,
        explored: dData.explored,
        roomMap: dData.roomMap,
        rooms: dData.rooms,
        playerSpawn: dData.playerSpawn,
        items: dData.items.map(i => this._deserializeItem(i)),
        traps: dData.traps
      };

      // 2. プレイヤー復元
      const pData = data.player;
      const p = game.player;
      p.x = pData.x;
      p.y = pData.y;
      p.prevX = pData.x;
      p.prevY = pData.y;
      p.animProgress = 1.0;
      p.dir = pData.dir || { dx: 0, dy: 1 };
      p.facingName = pData.facingName || 'down';

      p.level = pData.level;
      p.exp = pData.exp;
      p.hp = pData.hp;
      p.maxHp = pData.maxHp;
      p.str = pData.str;
      p.maxStr = pData.maxStr;
      p.satiety = pData.satiety;
      p.maxSatiety = pData.maxSatiety;
      p.gold = pData.gold;
      p.sleepTurns = pData.sleepTurns || 0;
      p.confusedTurns = pData.confusedTurns || 0;
      p.eyedropTurns = pData.eyedropTurns || 0;
      p.hungerStepCount = pData.hungerStepCount || 0;
      p.healStepCount = pData.healStepCount || 0;

      // 所持品復元
      p.inventory = pData.inventory.map(i => this._deserializeItem(i));

      // 装備復元
      p.equippedWeapon = pData.equippedWeaponIdx >= 0 ? p.inventory[pData.equippedWeaponIdx] : null;
      p.equippedShield = pData.equippedShieldIdx >= 0 ? p.inventory[pData.equippedShieldIdx] : null;
      p.equippedArrow = pData.equippedArrowIdx >= 0 ? p.inventory[pData.equippedArrowIdx] : null;

      if (p.equippedWeapon) p.equippedWeapon.equipped = true;
      if (p.equippedShield) p.equippedShield.equipped = true;
      if (p.equippedArrow) p.equippedArrow.equipped = true;

      // 3. モンスター復元
      game.monsters = data.monsters.map(mData => {
        const m = new Monster(mData.id, mData.x, mData.y);
        m.hp = mData.hp;
        m.maxHp = mData.maxHp;
        m.dir = mData.dir || { dx: 0, dy: 1 };
        m.facingName = mData.facingName || 'down';
        m.state = mData.state || 'wander';
        m.statusSleep = mData.statusSleep || 0;
        m.statusParalyzed = !!mData.statusParalyzed;
        m.statusConfused = mData.statusConfused || 0;
        m.statusSealed = !!mData.statusSealed;
        m.prevX = mData.prevX !== undefined ? mData.prevX : mData.x;
        m.prevY = mData.prevY !== undefined ? mData.prevY : mData.y;
        m.animProgress = 1.0;
        return m;
      });

      // 4. 表示＆カメラ更新
      game.updateVisibility();
      game.updateHUD();
      game.renderer.updateCamera(p);

      const floorDisplay = `${51 - game.floorNumber}F`;
      game.log.addMessage(`【再開】${floorDisplay} から冒険を再開しました！`);
      game.log.addMessage(`目指す40Fのトイレまで あと ${Math.max(0, 11 - game.floorNumber)} フロア！`);

      return true;
    } catch (e) {
      console.error('Failed to load game:', e);
      return false;
    }
  }

  /**
   * セーブデータを削除（ゲームオーバー／クリア時など）
   */
  static clearSaveData() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      console.warn('Failed to clear save data:', e);
    }
  }

  // アイテムのシリアライズ
  static _serializeItem(item) {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      sprite: item.sprite,
      desc: item.desc,
      price: item.price,
      atk: item.atk || 0,
      def: item.def || 0,
      refine: item.refine || 0,
      equipped: !!item.equipped,
      slowHunger: !!item.slowHunger,
      antiPoison: !!item.antiPoison,
      antiFire: !!item.antiFire,
      vsDragon: !!item.vsDragon,
      satiety: item.satiety,
      uses: item.uses,
      count: item.count,
      goldAmount: item.goldAmount,
      x: item.x,
      y: item.y
    };
  }

  // アイテムのデシリアライズ
  static _deserializeItem(data) {
    return new Item(data);
  }
}
