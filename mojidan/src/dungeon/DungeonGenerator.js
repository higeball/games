/**
 * DungeonGenerator - 不思議のダンジョン風マップ生成アルゴリズム
 * 3x3グリッド分割法による部屋生成と通路接続
 */

import { CONFIG } from '../config.js';
import { Item } from '../items/Item.js';

export class DungeonGenerator {
  constructor(width = CONFIG.DUNGEON.WIDTH, height = CONFIG.DUNGEON.HEIGHT) {
    this.width = width;
    this.height = height;
  }

  generate(floorNumber = 1) {
    // 0: 壁, 1: 部屋床, 2: 通路, 3: 扉, 4: 階段, 5: ワナ
    const tiles = Array(this.height).fill(0).map(() => Array(this.width).fill(CONFIG.TILE.WALL));
    const roomMap = Array(this.height).fill(-1).map(() => Array(this.width).fill(-1));
    const explored = Array(this.height).fill(false).map(() => Array(this.width).fill(false));
    const visible = Array(this.height).fill(false).map(() => Array(this.width).fill(false));

    // 3x3分割ゾーンの準備
    const cols = 3;
    const rows = 3;
    const zoneW = Math.floor(this.width / cols);
    const zoneH = Math.floor(this.height / rows);

    const rooms = [];
    const zoneGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));

    // 各ゾーンに部屋を生成（最低5〜8個の部屋）
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 角の部屋をまれにスキップする可能性（10%）
        if ((r === 0 || r === rows - 1) && (c === 0 || c === cols - 1) && Math.random() < 0.15) {
          continue;
        }

        const minW = 5;
        const maxW = zoneW - 4;
        const minH = 4;
        const maxH = zoneH - 4;

        const rw = Math.floor(Math.random() * (maxW - minW + 1)) + minW;
        const rh = Math.floor(Math.random() * (maxH - minH + 1)) + minH;

        const rx = c * zoneW + Math.floor(Math.random() * (zoneW - rw - 2)) + 1;
        const ry = r * zoneH + Math.floor(Math.random() * (zoneH - rh - 2)) + 1;

        const room = {
          id: rooms.length,
          col: c,
          row: r,
          x: rx,
          y: ry,
          w: rw,
          h: rh,
          centerX: Math.floor(rx + rw / 2),
          centerY: Math.floor(ry + rh / 2),
        };

        rooms.push(room);
        zoneGrid[r][c] = room;

        // 床タイル敷設
        for (let y = ry; y < ry + rh; y++) {
          for (let x = rx; x < rx + rw; x++) {
            tiles[y][x] = CONFIG.TILE.FLOOR;
            roomMap[y][x] = room.id;
          }
        }
      }
    }

    // 通路の接続（隣接する部屋をつなぐ）
    const connectedPairs = new Set();
    const connectRooms = (r1, r2) => {
      const pairKey = `${Math.min(r1.id, r2.id)}-${Math.max(r1.id, r2.id)}`;
      if (connectedPairs.has(pairKey)) return;
      connectedPairs.add(pairKey);

      // r1から出る接続点（壁際）
      let startX, startY, endX, endY;

      if (r1.col < r2.col) {
        // 横方向接続 (r1 -> r2)
        startX = r1.x + r1.w;
        startY = r1.y + 1 + Math.floor(Math.random() * (r1.h - 2));
        endX = r2.x - 1;
        endY = r2.y + 1 + Math.floor(Math.random() * (r2.h - 2));

        const midX = Math.floor((startX + endX) / 2);
        this._carveHCorridor(tiles, startX, midX, startY);
        this._carveVCorridor(tiles, startY, endY, midX);
        this._carveHCorridor(tiles, midX, endX, endY);
      } else if (r1.row < r2.row) {
        // 縦方向接続 (r1 -> r2)
        startX = r1.x + 1 + Math.floor(Math.random() * (r1.w - 2));
        startY = r1.y + r1.h;
        endX = r2.x + 1 + Math.floor(Math.random() * (r2.w - 2));
        endY = r2.y - 1;

        const midY = Math.floor((startY + endY) / 2);
        this._carveVCorridor(tiles, startY, midY, startX);
        this._carveHCorridor(tiles, startX, endX, midY);
        this._carveVCorridor(tiles, midY, endY, endX);
      }
    };

    // グリッド隣接接続
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cur = zoneGrid[r][c];
        if (!cur) continue;
        // 右隣と接続
        if (c + 1 < cols && zoneGrid[r][c + 1]) {
          connectRooms(cur, zoneGrid[r][c + 1]);
        }
        // 下隣と接続
        if (r + 1 < rows && zoneGrid[r + 1][c]) {
          connectRooms(cur, zoneGrid[r + 1][c]);
        }
      }
    }

    // 孤立部屋がないかチェックし、万一あれば最寄りの部屋と接続
    for (let i = 0; i < rooms.length; i++) {
      let isConnected = false;
      for (const pair of connectedPairs) {
        if (pair.startsWith(`${rooms[i].id}-`) || pair.endsWith(`-${rooms[i].id}`)) {
          isConnected = true;
          break;
        }
      }
      if (!isConnected) {
        // 最寄りの部屋と接続
        let bestTarget = null;
        let minD = 9999;
        for (let j = 0; j < rooms.length; j++) {
          if (i === j) continue;
          const d = Math.abs(rooms[i].centerX - rooms[j].centerX) + Math.abs(rooms[i].centerY - rooms[j].centerY);
          if (d < minD) {
            minD = d;
            bestTarget = rooms[j];
          }
        }
        if (bestTarget) {
          if (rooms[i].col !== bestTarget.col) {
            const first = rooms[i].col < bestTarget.col ? rooms[i] : bestTarget;
            const second = rooms[i].col < bestTarget.col ? bestTarget : rooms[i];
            connectRooms(first, second);
          } else {
            const first = rooms[i].row < bestTarget.row ? rooms[i] : bestTarget;
            const second = rooms[i].row < bestTarget.row ? bestTarget : rooms[i];
            connectRooms(first, second);
          }
        }
      }
    }

    // 部屋と通路の境界に扉タイル（DOOR）を判定・配置
    for (const room of rooms) {
      // 部屋の周囲を走査
      for (let x = room.x; x < room.x + room.w; x++) {
        if (room.y > 0 && tiles[room.y - 1][x] === CONFIG.TILE.CORRIDOR) tiles[room.y - 1][x] = CONFIG.TILE.DOOR;
        if (room.y + room.h < this.height && tiles[room.y + room.h][x] === CONFIG.TILE.CORRIDOR) tiles[room.y + room.h][x] = CONFIG.TILE.DOOR;
      }
      for (let y = room.y; y < room.y + room.h; y++) {
        if (room.x > 0 && tiles[y][room.x - 1] === CONFIG.TILE.CORRIDOR) tiles[y][room.x - 1] = CONFIG.TILE.DOOR;
        if (room.x + room.w < this.width && tiles[y][room.x + room.w] === CONFIG.TILE.CORRIDOR) tiles[y][room.x + room.w] = CONFIG.TILE.DOOR;
      }
    }

    // プレイヤー初期部屋・階段初期部屋の選定（離れた部屋にする）
    const shuffledRooms = [...rooms].sort(() => Math.random() - 0.5);
    const playerRoom = shuffledRooms[0];
    const stairsRoom = shuffledRooms.length > 1 ? shuffledRooms[shuffledRooms.length - 1] : playerRoom;

    // プレイヤー配置座標
    const playerSpawn = {
      x: playerRoom.centerX,
      y: playerRoom.centerY
    };

    // 階段配置（最終階層40Fの場合は「奇跡のトイレ個室」を配置）
    let stairs = null;
    let miracleBox = null;
    const isFinalFloor = floorNumber >= CONFIG.DUNGEON.MAX_FLOORS;

    const stairsX = stairsRoom.x + 1 + Math.floor(Math.random() * (stairsRoom.w - 2));
    const stairsY = stairsRoom.y + 1 + Math.floor(Math.random() * (stairsRoom.h - 2));

    if (isFinalFloor) {
      miracleBox = Item.createToilet(stairsX, stairsY);
      // 最終フロアでも到達可能床として配置
      tiles[stairsY][stairsX] = CONFIG.TILE.FLOOR;
    } else {
      tiles[stairsY][stairsX] = CONFIG.TILE.STAIRS;
      stairs = { x: stairsX, y: stairsY };
    }

    // 各部屋の空きタイルリストを取得
    const getAvailableTiles = (room) => {
      const list = [];
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          if (tiles[y][x] === CONFIG.TILE.FLOOR &&
              !(x === playerSpawn.x && y === playerSpawn.y) &&
              !(stairs && x === stairs.x && y === stairs.y) &&
              !(miracleBox && x === miracleBox.x && y === miracleBox.y)) {
            list.push({ x, y });
          }
        }
      }
      return list.sort(() => Math.random() - 0.5);
    };

    // ワナの生成（フロアに2〜5個）
    const traps = [];
    if (floorNumber >= 2) {
      const trapCount = Math.floor(Math.random() * 3) + Math.min(5, Math.floor(floorNumber / 2) + 1);
      const trapKeys = Object.keys(CONFIG.TRAPS);
      let placedTraps = 0;
      for (const room of rooms) {
        if (placedTraps >= trapCount) break;
        const freeTiles = getAvailableTiles(room);
        if (freeTiles.length > 0 && Math.random() < 0.6) {
          const pt = freeTiles.pop();
          const trapKey = trapKeys[Math.floor(Math.random() * trapKeys.length)];
          traps.push({
            id: trapKey,
            ...CONFIG.TRAPS[trapKey],
            x: pt.x,
            y: pt.y,
            revealed: false // 踏むか目薬草を飲むまで不可視
          });
          placedTraps++;
        }
      }
    }

    // アイテムの生成（各フロア4〜8個）
    const items = [];
    if (miracleBox) {
      items.push(miracleBox);
    }
    const itemCount = Math.floor(Math.random() * 4) + 4;
    let placedItems = 0;

    for (const room of rooms) {
      if (placedItems >= itemCount) break;
      const freeTiles = getAvailableTiles(room);
      const numInRoom = Math.min(freeTiles.length, Math.floor(Math.random() * 2) + 1);

      for (let i = 0; i < numInRoom; i++) {
        if (freeTiles.length === 0 || placedItems >= itemCount) break;
        const pt = freeTiles.pop();
        const item = this._generateFloorItem(floorNumber, pt.x, pt.y);
        if (item) {
          items.push(item);
          placedItems++;
        }
      }
    }

    // モンスターの生成（フロア開始時4〜7体）
    const monsterSpawns = [];
    const monsterCount = Math.floor(Math.random() * 3) + 4 + Math.floor(floorNumber / 3);

    // 原作トルネコ仕様：プレイヤー初期部屋に必ず1体モンスターを配置（寝ているか徘徊）
    // 開始直後からモンスターの姿（グラフィック）が視界に入り、臨場感と世界観を担保
    const playerRoomFreeTiles = getAvailableTiles(playerRoom);
    // プレイヤー直隣（チェビシェフ距離1）は避け、距離2以上離れた空きマスから選定
    const safePlayerTiles = playerRoomFreeTiles.filter(pt =>
      Math.max(Math.abs(pt.x - playerSpawn.x), Math.abs(pt.y - playerSpawn.y)) >= 2
    );
    if (safePlayerTiles.length > 0) {
      const pIdx = Math.floor(Math.random() * safePlayerTiles.length);
      const pt = safePlayerTiles[pIdx];
      const monsterType = this._selectMonsterForFloor(floorNumber);
      if (monsterType) {
        monsterSpawns.push({
          type: monsterType,
          x: pt.x,
          y: pt.y
        });
        const idx = playerRoomFreeTiles.indexOf(pt);
        if (idx !== -1) playerRoomFreeTiles.splice(idx, 1);
      }
    }

    // 残りのモンスターを他部屋（初期部屋以外）に配置
    const otherRooms = rooms.filter(r => r.id !== playerRoom.id);
    const targetRooms = otherRooms.length > 0 ? otherRooms : rooms;

    while (monsterSpawns.length < monsterCount) {
      const room = targetRooms[monsterSpawns.length % targetRooms.length];
      const freeTiles = getAvailableTiles(room);
      if (freeTiles.length > 0) {
        const pt = freeTiles.pop();
        const monsterType = this._selectMonsterForFloor(floorNumber);
        if (monsterType) {
          monsterSpawns.push({
            type: monsterType,
            x: pt.x,
            y: pt.y
          });
        }
      } else {
        break;
      }
    }

    return {
      width: this.width,
      height: this.height,
      floorNumber,
      tiles,
      roomMap,
      rooms,
      explored,
      visible,
      playerSpawn,
      stairs,
      traps,
      items,
      monsterSpawns
    };
  }

  // 横方向の通路掘削
  _carveHCorridor(tiles, x1, x2, y) {
    const start = Math.min(x1, x2);
    const end = Math.max(x1, x2);
    for (let x = start; x <= end; x++) {
      if (tiles[y][x] === CONFIG.TILE.WALL) {
        tiles[y][x] = CONFIG.TILE.CORRIDOR;
      }
    }
  }

  // 縦方向の通路掘削
  _carveVCorridor(tiles, y1, y2, x) {
    const start = Math.min(y1, y2);
    const end = Math.max(y1, y2);
    for (let y = start; y <= end; y++) {
      if (tiles[y][x] === CONFIG.TILE.WALL) {
        tiles[y][x] = CONFIG.TILE.CORRIDOR;
      }
    }
  }

  // 階層に応じたアイテムの抽選生成
  _generateFloorItem(floor, x, y) {
    // カテゴリ比率: 草 30%, パン 25%, 巻物 18%, 武器盾 15%, 杖 8%, 矢 4%
    const roll = Math.random() * 100;
    let catalog = null;
    let category = '';

    if (roll < 25) {
      catalog = CONFIG.ITEMS.BREADS;
      category = 'bread';
    } else if (roll < 55) {
      catalog = CONFIG.ITEMS.HERBS;
      category = 'herb';
    } else if (roll < 73) {
      catalog = CONFIG.ITEMS.SCROLLS;
      category = 'scroll';
    } else if (roll < 83) {
      catalog = CONFIG.ITEMS.WEAPONS;
      category = 'weapon';
    } else if (roll < 91) {
      catalog = CONFIG.ITEMS.SHIELDS;
      category = 'shield';
    } else if (roll < 97) {
      catalog = CONFIG.ITEMS.STAVES;
      category = 'staff';
    } else {
      catalog = CONFIG.ITEMS.ARROWS;
      category = 'arrow';
    }

    if (!catalog || catalog.length === 0) return null;

    // 階層に応じて上位装備やアイテムが出やすくなるよう重み付け
    let selectedIndex = 0;
    if (category === 'weapon' || category === 'shield') {
      const maxAvailable = Math.min(catalog.length, Math.floor(floor / 2) + 2);
      selectedIndex = Math.floor(Math.random() * maxAvailable);
    } else {
      selectedIndex = Math.floor(Math.random() * catalog.length);
    }

    const template = catalog[selectedIndex];
    const item = Item.fromCatalog(template, { x, y });

    // 武器・盾の+値（たまに+1や+2が付く）
    if ((category === 'weapon' || category === 'shield') && Math.random() < 0.3) {
      item.refine = Math.random() < 0.2 ? 2 : 1;
    }

    // 原作トルネコ仕様：未鑑定アイテムの抽選生成
    if (category === 'weapon' || category === 'shield') {
      if (Math.random() < 0.6) {
        item.identified = false;
      }
    } else if (category === 'herb' || category === 'scroll' || category === 'staff') {
      if (Math.random() < 0.45) {
        item.identified = false;
      }
    }

    return item;
  }

  // 階層に応じたモンスター種の抽選
  _selectMonsterForFloor(floor) {
    const validMonsters = Object.values(CONFIG.MONSTERS).filter(m => {
      return floor >= m.minFloor && floor <= m.maxFloor;
    });

    if (validMonsters.length === 0) {
      return CONFIG.MONSTERS.slime;
    }

    // 階層上位のモンスターがより出やすくなるように重み付け
    return validMonsters[Math.floor(Math.random() * validMonsters.length)];
  }
}
