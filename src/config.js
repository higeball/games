/**
 * トルネコの大冒険 不思議のダンジョン 設定・データ定義
 */

export const CONFIG = {
  // ダンジョン基本設定
  DUNGEON: {
    WIDTH: 48,              // フロア横タイル数
    HEIGHT: 36,             // フロア縦タイル数
    START_FLOOR: 50,        // 開始階: 50F (オフィスタワー50階)
    GOAL_FLOOR: 40,         // 目的地: 40F (トイレのある階)
    TOTAL_FLOORS: 11,       // 50Fから40Fまでの全11フロア
    MAX_FLOORS: 11,         // 最終フロア（40Fで奇跡のトイレ到達クリア）
    TILE_SIZE: 48,          // レンダリング時のタイル基本サイズ（ピクセル）
  },

  // タイル種別
  TILE: {
    WALL: 0,        // 壁（進入不可、視線遮断）
    FLOOR: 1,       // 部屋の床
    CORRIDOR: 2,    // 通路（視界1マス）
    DOOR: 3,        // 部屋と通路の境界
    STAIRS: 4,      // 降り階段
    TRAP: 5,        // ワナ（未発見時は床に見える）
  },

  // ワナ種別（オフィスタワーのハザード）
  TRAPS: {
    ARROW: { id: 'arrow', name: '滑る床のワナ', desc: '濡れた床でツルッと滑って体勢を崩した！ちからが1下がった！' },
    MINE: { id: 'mine', name: '漏電コードのワナ', desc: '露出した配線でビリッと感電！HPが半分になった！' },
    SLEEP: { id: 'sleep', name: '睡魔のワナ', desc: '昼食後の猛烈な睡魔に襲われ、眠ってしまった！' },
    TRIP: { id: 'trip', name: 'LANケーブルのワナ', desc: '足元のLANケーブルに引っ掛かって転倒！道具を落とした！' },
    WARP: { id: 'warp', name: '迷走エレベーターの扉', desc: '不気味に開いた扉に吸い込まれ、別の部屋へワープした！' }
  },

  // プレイヤー初期ステータス（もじさん）
  PLAYER: {
    INITIAL_HP: 15,
    INITIAL_MAX_HP: 15,
    INITIAL_STR: 8,
    INITIAL_MAX_STR: 8,
    INITIAL_SATIETY: 100,       // 満腹度 (0 - 100%)
    MAX_SATIETY: 100,
    INITIAL_LEVEL: 1,
    HUNGER_RATE: 0.1,           // 1歩ごとに減少する満腹度（10歩で1%減少）
    HEAL_TURNS: 4,              // 満腹度が残っているときに1HP自然回復する歩数
    INVENTORY_CAPACITY: 16,     // 最大所持数
    SPRITE_FRAMES_DIR: './assets/character/frames-64/',
  },

  // レベルアップ経験値テーブル（SFCトルネコ解析データ準拠）
  LEVEL_TABLE: [
    { level: 1, exp: 0,    hp: 15, str: 8,  baseAtk: 5 },
    { level: 2, exp: 10,   hp: 19, str: 9,  baseAtk: 7 },
    { level: 3, exp: 30,   hp: 24, str: 10, baseAtk: 9 },
    { level: 4, exp: 60,   hp: 30, str: 11, baseAtk: 11 },
    { level: 5, exp: 100,  hp: 37, str: 12, baseAtk: 13 },
    { level: 6, exp: 150,  hp: 45, str: 13, baseAtk: 16 },
    { level: 7, exp: 230,  hp: 54, str: 14, baseAtk: 19 },
    { level: 8, exp: 350,  hp: 64, str: 15, baseAtk: 22 },
    { level: 9, exp: 500,  hp: 75, str: 16, baseAtk: 25 },
    { level: 10, exp: 700, hp: 87, str: 17, baseAtk: 29 },
    { level: 11, exp: 950, hp: 100, str: 18, baseAtk: 33 },
    { level: 12, exp: 1200, hp: 114, str: 19, baseAtk: 37 },
    { level: 13, exp: 1500, hp: 129, str: 20, baseAtk: 41 },
    { level: 14, exp: 1800, hp: 145, str: 21, baseAtk: 46 },
    { level: 15, exp: 2300, hp: 162, str: 22, baseAtk: 51 },
  ],

  // アイテム定義カタログ（SFCトルネコ解析データ準拠）
  ITEMS: {
    // 武器（剣の強さ）
    WEAPONS: [
      { id: 'club', name: 'こん棒', type: 'weapon', atk: 1, price: 50, sprite: './assets/items/club.png' },
      { id: 'bronze_sword', name: '銅の剣', type: 'weapon', atk: 3, price: 75, sprite: './assets/items/bronze_sword.png' },
      { id: 'iron_axe', name: '鉄の斧', type: 'weapon', atk: 4, price: 100, sprite: './assets/items/iron_axe.png' },
      { id: 'dragon_killer', name: 'ドラゴンキラー', type: 'weapon', atk: 5, price: 300, sprite: './assets/items/dragon_killer.png', vsDragon: true },
      { id: 'metal_king_sword', name: 'はぐれメタルの剣', type: 'weapon', atk: 7, price: 750, sprite: './assets/items/metal_king_sword.png' },
      { id: 'soroban', name: '正義のソロバン', type: 'weapon', atk: 10, price: 5000, sprite: './assets/items/soroban.png' }
    ],

    // 盾（盾の強さ）
    SHIELDS: [
      { id: 'leather_shield', name: '皮の盾', type: 'shield', def: 2, price: 40, sprite: './assets/items/leather_shield.png', slowHunger: true },
      { id: 'bronze_shield', name: '青銅の盾', type: 'shield', def: 3, price: 80, sprite: './assets/items/bronze_shield.png' },
      { id: 'scale_shield', name: 'うろこの盾', type: 'shield', def: 4, price: 150, sprite: './assets/items/scale_shield.png', antiPoison: true },
      { id: 'steel_shield', name: '鋼鉄の盾', type: 'shield', def: 6, price: 200, sprite: './assets/items/steel_shield.png' },
      { id: 'dragon_shield', name: 'ドラゴンシールド', type: 'shield', def: 7, price: 500, sprite: './assets/items/dragon_shield.png', antiFire: true },
      { id: 'metal_king_shield', name: 'はぐれメタルの盾', type: 'shield', def: 10, price: 1500, sprite: './assets/items/metal_king_shield.png' }
    ],

    // 食料（パン）
    BREADS: [
      { id: 'bread', name: 'パン', type: 'bread', satiety: 50, price: 50, sprite: './assets/items/bread.png', desc: 'お腹を50%回復する。' },
      { id: 'big_bread', name: '大きいパン', type: 'bread', satiety: 100, price: 100, sprite: './assets/items/big_bread.png', desc: 'お腹を100%回復する。満腹時に食べると最大満腹度が5%アップ！' },
      { id: 'rotten_bread', name: 'くさったパン', type: 'bread', satiety: 30, price: 20, sprite: './assets/items/rotten_bread.png', desc: 'お腹を30%回復するが、腹痛で睡眠や毒などの異常が起こる。' }
    ],

    // 草・薬草
    HERBS: [
      { id: 'herb', name: '薬草', type: 'herb', price: 60, sprite: './assets/items/herb.png', desc: 'HPを25回復。最大HP時なら最大HPが1アップ！' },
      { id: 'otogiri', name: '弟切草', type: 'herb', price: 200, sprite: './assets/items/otogiri.png', desc: 'HPを100回復。最大HP時なら最大HPが2アップ！' },
      { id: 'antidote', name: '毒けし草', type: 'herb', price: 100, sprite: './assets/items/herb.png', desc: '下がってしまったちからを完全回復する。' },
      { id: 'seed_str', name: 'ちからの種', type: 'herb', price: 300, sprite: './assets/items/herb.png', desc: 'ちからが永続で1アップする！' },
      { id: 'seed_stomach', name: '胃拡張の種', type: 'herb', price: 250, sprite: './assets/items/herb.png', desc: '最大満腹度が20%アップする！' },
      { id: 'warp_herb', name: 'ルーラ草', type: 'herb', price: 120, sprite: './assets/items/otogiri.png', desc: 'ダンジョン内の別の部屋へ瞬時にワープする。' },
      { id: 'fire_herb', name: '火炎草', type: 'herb', price: 180, sprite: './assets/items/otogiri.png', desc: '飲むと前方3マスに30ダメージの炎！投げると50ダメージ！' },
      { id: 'sleep_herb', name: '睡眠草', type: 'herb', price: 120, sprite: './assets/items/herb.png', desc: '飲むかぶつけると深い眠りに落ちてしまう。' },
      { id: 'eyedrop', name: '目薬草', type: 'herb', price: 150, sprite: './assets/items/herb.png', desc: 'そのフロアの隠されたワナや透明な敵が見えるようになる。' }
    ],

    // 巻物
    SCROLLS: [
      { id: 'light', name: 'あかりの巻物', type: 'scroll', price: 200, sprite: './assets/items/scroll.png', desc: 'フロア全体の地形とモンスターの位置がすべて明らかになる！' },
      { id: 'upgrade', name: '強化の巻物', type: 'scroll', price: 400, sprite: './assets/items/scroll.png', desc: '装備している武器または盾の強さを+1強化する！' },
      { id: 'sanctuary', name: '聖域の巻物', type: 'scroll', price: 800, sprite: './assets/items/scroll.png', desc: '足元に置くと、その上にいる間モンスターから直接攻撃を受けなくなる！' },
      { id: 'sleep_scroll', name: 'バクスイの巻物', type: 'scroll', price: 350, sprite: './assets/items/scroll.png', desc: '部屋にいるすべてのモンスターを深い眠りに落とす！' },
      { id: 'confuse', name: '混乱の巻物', type: 'scroll', price: 300, sprite: './assets/items/scroll.png', desc: '部屋にいるすべてのモンスターを混乱させて同士討ちさせる！' },
      { id: 'bread_scroll', name: 'パンの巻物', type: 'scroll', price: 250, sprite: './assets/items/scroll.png', desc: '選んだ道具を「大きいパン」に変えてしまう！' }
    ],

    // 杖（回数制限あり）
    STAVES: [
      { id: 'staff_knockback', name: '吹き飛ばしの杖', type: 'staff', uses: 5, price: 350, sprite: './assets/items/staff.png', desc: 'モンスターを後方へ5マス吹き飛ばし、5ダメージを与える！' },
      { id: 'staff_swap', name: '場所替えの杖', type: 'staff', uses: 5, price: 300, sprite: './assets/items/staff.png', desc: '光線が当たったモンスターと自分の位置を入れ替える！' },
      { id: 'staff_paralyze', name: 'かなしばりの杖', type: 'staff', uses: 4, price: 450, sprite: './assets/items/staff.png', desc: 'モンスターを攻撃するまで動けなくする！' },
      { id: 'staff_silence', name: '封印の杖', type: 'staff', uses: 5, price: 400, sprite: './assets/items/staff.png', desc: 'モンスターの特殊能力や呪文を封じ込める！' },
      { id: 'staff_polymorph', name: 'へんげの杖', type: 'staff', uses: 4, price: 350, sprite: './assets/items/staff.png', desc: 'モンスターを別のモンスターに変身させる！' }
    ],

    // 矢
    ARROWS: [
      { id: 'wood_arrow', name: '木の矢', type: 'arrow', atk: 4, count: 10, price: 100, sprite: './assets/items/arrow.png', desc: '正面遠くの敵へ射ち出す。（攻撃力4）' },
      { id: 'iron_arrow', name: '鉄の矢', type: 'arrow', atk: 12, count: 8, price: 200, sprite: './assets/items/arrow.png', desc: '硬い鉄の矢。（攻撃力12）' }
    ]
  },

  // モンスター図鑑（SFCトルネコ解析データ準拠: HP, ATK, DEF, EXP）
  MONSTERS: {
    slime: {
      id: 'slime', name: 'スライム', hp: 5, atk: 2, def: 1, exp: 1,
      minFloor: 1, maxFloor: 3, color: '#00b0ff', sprite: './assets/monsters/slime.png',
      desc: 'おなじみの青いスライム。最初は寝ていることが多い。'
    },
    dracky: {
      id: 'dracky', name: 'ドラキー', hp: 7, atk: 3, def: 1, exp: 2,
      minFloor: 1, maxFloor: 4, color: '#7e57c2', sprite: './assets/monsters/dracky.png',
      desc: '羽ばたくコウモリ。ふらふらと不規則に移動する。'
    },
    ghost: {
      id: 'ghost', name: 'ゴースト', hp: 5, atk: 3, def: 9, exp: 2,
      minFloor: 2, maxFloor: 5, color: '#ff7043', sprite: './assets/monsters/ghost.png',
      desc: '赤い三角帽子のオバケ。2倍速で素早く迫る。'
    },
    mushroom: {
      id: 'mushroom', name: 'おばけキノコ', hp: 17, atk: 6, def: 8, exp: 6,
      minFloor: 3, maxFloor: 6, color: '#ffb300', sprite: './assets/monsters/mushroom.png',
      desc: '胞子を撒き散らし、プレイヤーのちからを奪う！'
    },
    mage: {
      id: 'mage', name: 'まどうし', hp: 16, atk: 6, def: 11, exp: 12,
      minFloor: 4, maxFloor: 8, color: '#8e24aa', sprite: './assets/monsters/mage.png',
      desc: 'ラリホー（睡眠呪文）を唱えてプレイヤーを眠らせる厄介者。'
    },
    zombie: {
      id: 'zombie', name: 'くさった死体', hp: 30, atk: 0, def: 19, exp: 25,
      minFloor: 5, maxFloor: 9, color: '#689f38', sprite: './assets/monsters/zombie.png',
      desc: '腐った液を吐き、盾の強さをサビさせたりパンを腐らせる！'
    },
    metal_slime: {
      id: 'metal_slime', name: 'はぐれメタル', hp: 3, atk: 30, def: 49, exp: 500,
      minFloor: 4, maxFloor: 10, color: '#cfd8dc', sprite: './assets/monsters/metal_slime.png',
      desc: 'すばやく逃げ回るが、倒せば500EXPを獲得できる！ダメージは1固定。'
    },
    golem: {
      id: 'golem', name: 'ゴーレム', hp: 52, atk: 32, def: 27, exp: 180,
      minFloor: 7, maxFloor: 10, color: '#8d6e63', sprite: './assets/monsters/golem.png',
      desc: 'レンガでできた巨躯。強烈な一撃を繰り出してくる。'
    },
    dragon: {
      id: 'dragon', name: 'ドラゴン', hp: 100, atk: 68, def: 30, exp: 3000,
      minFloor: 9, maxFloor: 10, color: '#2e7d32', sprite: './assets/monsters/dragon.png',
      desc: '最下層に君臨する巨大竜。一直線に届く炎のブレスを吐く！'
    }
  }
};
