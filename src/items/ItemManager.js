/**
 * ItemManager - アイテム使用・投擲・効果処理
 * 草・巻物・パン・杖・矢・装備の本格的効果ロジック
 */

import { CONFIG } from '../config.js';
import { soundManager } from '../audio/SoundManager.js';
import { Item } from './Item.js';

export class ItemManager {
  // アイテム使用（飲む、読む、食べる、振る）
  static useItem(item, player, dungeon, allMonsters, onAddLog) {
    if (!item) return false;

    // 草を飲む
    if (item.type === 'herb') {
      return this._useHerb(item, player, dungeon, allMonsters, onAddLog);
    }
    // パンを食べる
    if (item.type === 'bread') {
      return this._useBread(item, player, onAddLog);
    }
    // 巻物を読む
    if (item.type === 'scroll') {
      return this._readScroll(item, player, dungeon, allMonsters, onAddLog);
    }
    // 杖を振る
    if (item.type === 'staff') {
      return this._waveStaff(item, player, dungeon, allMonsters, onAddLog);
    }

    return false;
  }

  // 草効果
  static _useHerb(item, player, dungeon, allMonsters, onAddLog) {
    onAddLog(`もじさんは　${item.name}を　飲んだ。`);
    soundManager.playUseHerb();
    player.removeItem(item);

    switch (item.id) {
      case 'herb': // 薬草
        if (player.hp >= player.maxHp) {
          player.maxHp += 1;
          player.hp = player.maxHp;
          onAddLog('最大HPが　1上がった！');
        } else {
          const heal = Math.min(25, player.maxHp - player.hp);
          player.hp += heal;
          onAddLog(`HPが　${heal}回復した！`);
        }
        break;

      case 'otogiri': // 弟切草
        if (player.hp >= player.maxHp) {
          player.maxHp += 2;
          player.hp = player.maxHp;
          onAddLog('最大HPが　2上がった！');
        } else {
          const heal = Math.min(100, player.maxHp - player.hp);
          player.hp += heal;
          onAddLog(`HPが　${heal}回復した！`);
        }
        break;

      case 'antidote': // 毒けし草
        player.str = player.maxStr;
        onAddLog('ちからが　完全に回復した！');
        break;

      case 'seed_str': // ちからの種
        player.maxStr += 1;
        player.str += 1;
        onAddLog('ちからが　1上がった！');
        break;

      case 'seed_stomach': // 胃拡張の種
        player.maxSatiety += 20;
        player.satiety = Math.min(player.maxSatiety, player.satiety + 20);
        onAddLog('胃袋が大きくなった！');
        onAddLog('最大満腹度が　20%上がった！');
        break;

      case 'warp_herb': // ルーラ草
        this.teleportEntity(player, dungeon, allMonsters);
        onAddLog('もじさんは　別の部屋へワープした！');
        break;

      case 'fire_herb': // 火炎草（飲むと前方3マスに炎）
        onAddLog('もじさんの口から　炎が噴き出した！');
        for (let step = 1; step <= 3; step++) {
          const tx = player.x + player.dir.dx * step;
          const ty = player.y + player.dir.dy * step;
          if (dungeon.tiles[ty][tx] === CONFIG.TILE.WALL) break;
          const target = allMonsters.find(m => m.hp > 0 && m.x === tx && m.y === ty);
          if (target) {
            target.hp -= 30;
            onAddLog(`炎が　${target.name}に命中！`);
            onAddLog('30の　ダメージ！');
            soundManager.playHit();
            if (target.hp <= 0) {
              onAddLog(`${target.name}を　たおした！`);
              const expMsgs = player.gainExp(target.exp);
              expMsgs.forEach(m => onAddLog(m));
            }
          }
        }
        break;

      case 'sleep_herb': // 睡眠草
        player.sleepTurns = 4;
        onAddLog('もじさんは　深い眠りに落ちてしまった！');
        break;

      case 'eyedrop': // 目薬草
        player.eyedropTurns = 60;
        // フロアのワナをすべて可視化
        dungeon.traps.forEach(t => t.revealed = true);
        onAddLog('視界が冴えわたった！');
        onAddLog('ワナが　見えるようになった！');
        break;
    }
    return true;
  }

  // パン効果
  static _useBread(item, player, onAddLog) {
    onAddLog(`もじさんは　${item.name}を　食べた。`);
    soundManager.playEatBread();
    player.removeItem(item);

    if (item.id === 'big_bread' && player.satiety >= player.maxSatiety) {
      player.maxSatiety += 5;
      player.satiety = player.maxSatiety;
      onAddLog('お腹いっぱいだ！');
      onAddLog('最大満腹度が　5%上がった！');
    } else {
      player.satiety = Math.min(player.maxSatiety, player.satiety + item.satiety);
      onAddLog(`満腹度が　${item.satiety}%回復した！`);
    }

    if (item.id === 'rotten_bread') {
      if (Math.random() < 0.5) {
        player.str = Math.max(1, player.str - 1);
        onAddLog('お腹をこわして　ちからが 1 下がった！');
      } else {
        player.sleepTurns = 3;
        onAddLog('腐った匂いで　気を失ってしまった！');
      }
    }
    return true;
  }

  // 巻物効果
  static _readScroll(item, player, dungeon, allMonsters, onAddLog) {
    onAddLog(`もじさんは　${item.name}を　読んだ。`);
    soundManager.playCastMagic();
    player.removeItem(item);

    switch (item.id) {
      case 'light': // あかりの巻物
        // フロア全体を探索済みに
        for (let y = 0; y < dungeon.height; y++) {
          for (let x = 0; x < dungeon.width; x++) {
            dungeon.explored[y][x] = true;
          }
        }
        dungeon.allRevealed = true;
        onAddLog('ダンジョン全体が　明るく照らされた！');
        break;

      case 'upgrade': // 強化の巻物
        if (player.equippedWeapon) {
          player.equippedWeapon.refine += 1;
          onAddLog(`${player.equippedWeapon.name}は`);
          onAddLog(`+${player.equippedWeapon.refine}に　強化された！`);
        } else if (player.equippedShield) {
          player.equippedShield.refine += 1;
          onAddLog(`${player.equippedShield.name}は`);
          onAddLog(`+${player.equippedShield.refine}に　強化された！`);
        } else {
          onAddLog('しかし　強化する装備品を');
          onAddLog('身につけていなかった！');
        }
        break;

      case 'sleep_scroll': // バクスイの巻物
        {
          let count = 0;
          const pRoom = dungeon.roomMap[player.y][player.x];
          allMonsters.forEach(m => {
            if (m.hp > 0) {
              const mRoom = dungeon.roomMap[m.y][m.x];
              if (pRoom !== -1 && pRoom === mRoom) {
                m.statusSleep = 6;
                count++;
              }
            }
          });
          onAddLog(count > 0 ? '部屋のモンスターたちは　眠りに落ちた！' : 'しかし　誰も眠らなかった。');
        }
        break;

      case 'confuse': // 混乱の巻物
        {
          let count = 0;
          const pRoom = dungeon.roomMap[player.y][player.x];
          allMonsters.forEach(m => {
            if (m.hp > 0) {
              const mRoom = dungeon.roomMap[m.y][m.x];
              if (pRoom !== -1 && pRoom === mRoom) {
                m.statusConfused = 8;
                count++;
              }
            }
          });
          onAddLog(count > 0 ? '部屋のモンスターたちは　混乱した！' : 'しかし　誰も混乱しなかった。');
        }
        break;

      case 'bread_scroll': // パンの巻物
        // 所持品から最初の武器・盾以外のアイテムを大きいパンに変換
        {
          const target = player.inventory.find(i => i.type !== 'weapon' && i.type !== 'shield' && i.id !== 'big_bread');
          if (target) {
            const idx = player.inventory.indexOf(target);
            const bigBread = Item.fromCatalog(CONFIG.ITEMS.BREADS[1]);
            player.inventory[idx] = bigBread;
            onAddLog(`${target.name}は　大きいパンに変わった！`);
          } else {
            onAddLog('パンに変化させられる道具がなかった。');
          }
        }
        break;

      case 'sanctuary': // 聖域の巻物
        // 足元に配置
        dungeon.items.push(new Item({
          ...item,
          x: player.x,
          y: player.y
        }));
        onAddLog('せいいきの巻物が　足元に敷かれた！');
        onAddLog('モンスターの攻撃を　防ぐ！');
        break;
    }
    return true;
  }

  // 杖を振る
  static _waveStaff(item, player, dungeon, allMonsters, onAddLog) {
    if (item.uses <= 0) {
      onAddLog(`${item.name}は`);
      onAddLog('魔法の力が　切れている！');
      return false;
    }

    item.uses--;
    soundManager.playCastMagic();
    onAddLog(`もじさんは　${item.name}を　振った！`);

    // 前方に光線を射出
    let hitMonster = null;
    let hitX = player.x;
    let hitY = player.y;

    for (let i = 1; i <= 10; i++) {
      const tx = player.x + player.dir.dx * i;
      const ty = player.y + player.dir.dy * i;
      if (tx < 0 || tx >= dungeon.width || ty < 0 || ty >= dungeon.height) break;
      if (dungeon.tiles[ty][tx] === CONFIG.TILE.WALL) {
        hitX = tx;
        hitY = ty;
        break;
      }
      const target = allMonsters.find(m => m.hp > 0 && m.x === tx && m.y === ty);
      if (target) {
        hitMonster = target;
        hitX = tx;
        hitY = ty;
        break;
      }
    }

    if (!hitMonster) {
      onAddLog('光線は　むなしく壁に消えた。');
      return true;
    }

    switch (item.id) {
      case 'staff_knockback': // 吹き飛ばしの杖
        {
          onAddLog(`光線が　${hitMonster.name}に命中！`);
          onAddLog('吹き飛んだ！');
          hitMonster.hp -= 5;
          for (let step = 1; step <= 5; step++) {
            const nx = hitMonster.x + player.dir.dx;
            const ny = hitMonster.y + player.dir.dy;
            if (dungeon.tiles[ny][nx] === CONFIG.TILE.WALL || allMonsters.some(m => m !== hitMonster && m.hp > 0 && m.x === nx && m.y === ny)) {
              hitMonster.hp -= 5;
              onAddLog(`${hitMonster.name}は　壁に激突した！`);
              onAddLog('5の　追加ダメージ！');
              break;
            }
            hitMonster.x = nx;
            hitMonster.y = ny;
          }
          if (hitMonster.hp <= 0) {
            onAddLog(`${hitMonster.name}を　たおした！`);
            player.gainExp(hitMonster.exp).forEach(m => onAddLog(m));
          }
        }
        break;

      case 'staff_swap': // 場所替えの杖
        {
          const tempX = player.x;
          const tempY = player.y;
          player.x = hitMonster.x;
          player.y = hitMonster.y;
          hitMonster.x = tempX;
          hitMonster.y = tempY;
          onAddLog(`${hitMonster.name}と`);
          onAddLog('位置が　入れ替わった！');
        }
        break;

      case 'staff_paralyze': // かなしばりの杖
        hitMonster.statusParalyzed = true;
        onAddLog(`${hitMonster.name}は`);
        onAddLog('金縛りにあって　もう動けない！');
        break;

      case 'staff_silence': // 封印の杖
        hitMonster.statusSealed = true;
        onAddLog(`${hitMonster.name}の`);
        onAddLog('特殊能力を　封じ込めた！');
        break;

      case 'staff_polymorph': // へんげの杖
        {
          const keys = Object.keys(CONFIG.MONSTERS);
          const newType = keys[Math.floor(Math.random() * keys.length)];
          const oldName = hitMonster.name;
          const newMData = CONFIG.MONSTERS[newType];
          hitMonster.id = newMData.id;
          hitMonster.name = newMData.name;
          hitMonster.color = newMData.color;
          hitMonster.hp = newMData.hp;
          hitMonster.maxHp = newMData.hp;
          hitMonster.atk = newMData.atk;
          hitMonster.def = newMData.def;
          hitMonster.exp = newMData.exp;
          onAddLog(`${oldName}は`);
          onAddLog(`${hitMonster.name}に　変身した！`);
        }
        break;
    }

    return true;
  }

  // アイテム投擲（矢やアイテムを投げる）
  static throwItem(item, player, dungeon, allMonsters, onAddLog) {
    if (!item) return false;

    // 矢の場合は本数を減らす、通常の道具ならインベントリから削除
    if (item.type === 'arrow') {
      item.count--;
      if (item.count <= 0) {
        player.removeItem(item);
      }
      onAddLog(`もじさんは　${item.name}を　射ち放った！`);
    } else {
      player.removeItem(item);
      onAddLog(`もじさんは　${item.name}を　投げた！`);
    }

    let landX = player.x;
    let landY = player.y;
    let hitMonster = null;

    // 8マス直進
    for (let step = 1; step <= 8; step++) {
      const nx = player.x + player.dir.dx * step;
      const ny = player.y + player.dir.dy * step;
      if (nx < 0 || nx >= dungeon.width || ny < 0 || ny >= dungeon.height) break;
      if (dungeon.tiles[ny][nx] === CONFIG.TILE.WALL) {
        break;
      }
      landX = nx;
      landY = ny;

      const target = allMonsters.find(m => m.hp > 0 && m.x === nx && m.y === ny);
      if (target) {
        hitMonster = target;
        break;
      }
    }

    if (hitMonster) {
      soundManager.playHit();
      let dmg = 2;

      if (item.type === 'arrow') {
        dmg = item.id === 'iron_arrow' ? 12 : 6;
        hitMonster.hp -= dmg;
        onAddLog(`矢が　${hitMonster.name}に命中！`);
        onAddLog(`${dmg}の　ダメージ！`);
      } else if (item.type === 'weapon') {
        dmg = Math.max(3, item.getEffectiveAtk());
        hitMonster.hp -= dmg;
        onAddLog(`${item.name}が　${hitMonster.name}に命中！`);
        onAddLog(`${dmg}の　ダメージ！`);
      } else if (item.type === 'herb') {
        // 草を当てた場合
        if (item.id === 'sleep_herb') {
          hitMonster.statusSleep = 5;
          onAddLog(`草が当たった　${hitMonster.name}は`);
          onAddLog('ぐっすり眠ってしまった！');
        } else if (item.id === 'fire_herb') {
          dmg = 50;
          hitMonster.hp -= dmg;
          onAddLog('火炎草が　炸裂！');
          onAddLog(`${hitMonster.name}に　50のダメージ！`);
        } else if (item.id === 'warp_herb') {
          this.teleportEntity(hitMonster, dungeon, allMonsters);
          onAddLog(`${hitMonster.name}は`);
          onAddLog('どこかへ吹き飛んでいった！');
        } else if (hitMonster.id === 'ghost' || hitMonster.id === 'zombie') {
          // 不死系モンスターに回復草は致命傷！
          dmg = item.id === 'otogiri' ? 100 : 25;
          hitMonster.hp -= dmg;
          onAddLog('聖なる草の光！');
          onAddLog(`${hitMonster.name}に　${dmg}の大ダメージ！`);
        } else {
          onAddLog(`${item.name}が当たったが`);
          onAddLog('跳ね返った。');
        }
      } else {
        hitMonster.hp -= dmg;
        onAddLog(`${item.name}が　当たった！`);
        onAddLog(`${dmg}の　ダメージ！`);
      }

      if (hitMonster.hp <= 0) {
        soundManager.playDefeat();
        onAddLog(`${hitMonster.name}を　たおした！`);
        player.gainExp(hitMonster.exp).forEach(m => onAddLog(m));
      }
    } else {
      // 当たらなかった場合、地面に落ちる（草・巻物・矢以外は落ちる、矢は一定確率で拾える）
      if (item.type !== 'arrow' || Math.random() < 0.5) {
        const dropItem = item.type === 'arrow' ? Item.fromCatalog(item, { count: 1, x: landX, y: landY }) : item;
        dropItem.x = landX;
        dropItem.y = landY;
        dungeon.items.push(dropItem);
        onAddLog(`${dropItem.name}が　地面に落ちた。`);
      }
    }

    return true;
  }

  // ワープ処理
  static teleportEntity(entity, dungeon, allMonsters) {
    const randomRoom = dungeon.rooms[Math.floor(Math.random() * dungeon.rooms.length)];
    const freeTiles = [];
    for (let y = randomRoom.y + 1; y < randomRoom.y + randomRoom.h - 1; y++) {
      for (let x = randomRoom.x + 1; x < randomRoom.x + randomRoom.w - 1; x++) {
        if (!allMonsters.some(m => m.hp > 0 && m.x === x && m.y === y)) {
          freeTiles.push({ x, y });
        }
      }
    }
    if (freeTiles.length > 0) {
      const pt = freeTiles[Math.floor(Math.random() * freeTiles.length)];
      entity.x = pt.x;
      entity.y = pt.y;
    }
  }
}
