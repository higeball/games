/**
 * トルネコの大冒険 不思議のダンジョン 設定・データ定義
 */

export const CONFIG = {
  // ダンジョン基本設定
  DUNGEON: {
    WIDTH: 48,              // フロア横タイル数
    HEIGHT: 36,             // フロア縦タイル数
    MAX_FLOORS: 10,         // 初心者向けメインダンジョン深度（10Fで「奇跡の箱」獲得クリア）
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

  // ワナ種別
  TRAPS: {
    ARROW: { id: 'arrow', name: '毒矢のワナ', desc: '毒矢が飛んできて力が1下がった！' },
    MINE: { id: 'mine', name: '地雷', desc: '地雷が爆発した！HPが半分になった！' },
    SLEEP: { id: 'sleep', name: '睡眠ガスのワナ', desc: '甘いガスを吸い込んで眠ってしまった！' },
    TRIP: { id: 'trip', name: '転び石', desc: '足を取られて転んでしまった！道具を落とした！' },
    WARP: { id: 'warp', name: 'ワープのワナ', desc: '別の部屋へと飛ばされてしまった！' }
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

  // レベルアップ経験値テーブル
  LEVEL_TABLE: [
    { level: 1, exp: 0,    hp: 15, str: 8 },
    { level: 2, exp: 10,   hp: 19, str: 9 },
    { level: 3, exp: 30,   hp: 24, str: 10 },
    { level: 4, exp: 70,   hp: 30, str: 11 },
    { level: 5, exp: 130,  hp: 37, str: 12 },
    { level: 6, exp: 210,  hp: 45, str: 13 },
    { level: 7, exp: 320,  hp: 54, str: 14 },
    { level: 8, exp: 460,  hp: 64, str: 15 },
    { level: 9, exp: 640,  hp: 75, str: 16 },
    { level: 10, exp: 860, hp: 87, str: 17 },
    { level: 11, exp: 1150, hp: 100, str: 18 },
    { level: 12, exp: 1500, hp: 114, str: 19 },
    { level: 13, exp: 1950, hp: 129, str: 20 },
    { level: 14, exp: 2500, hp: 145, str: 21 },
    { level: 15, exp: 3200, hp: 162, str: 22 },
  ],

  // アイテム定義カタログ
  ITEMS: {
    // 武器（剣）
    WEAPONS: [
      { id: 'club', name: 'こんぼう', type: 'weapon', atk: 2, price: 150, icon: '🗡️' },
      { id: 'bronze_sword', name: 'どうのつるぎ', type: 'weapon', atk: 3, price: 300, icon: '⚔️' },
      { id: 'iron_axe', name: '鉄の斧', type: 'weapon', atk: 5, price: 600, icon: '🪓' },
      { id: 'dragon_killer', name: 'ドラゴンキラー', type: 'weapon', atk: 8, price: 1500, icon: '🗡️', vsDragon: true },
      { id: 'metal_king_sword', name: 'はぐれメタルの剣', type: 'weapon', atk: 12, price: 3000, icon: '✨' }
    ],

    // 盾
    SHIELDS: [
      { id: 'leather_shield', name: '皮の盾', type: 'shield', def: 2, price: 200, icon: '🛡️', slowHunger: true },
      { id: 'bronze_shield', name: '青銅の盾', type: 'shield', def: 3, price: 400, icon: '🛡️' },
      { id: 'scale_shield', name: 'うろこの盾', type: 'shield', def: 4, price: 650, icon: '🛡️', antiPoison: true },
      { id: 'iron_shield', name: '鉄の盾', type: 'shield', def: 6, price: 1000, icon: '🛡️' },
      { id: 'dragon_shield', name: 'ドラゴンシールド', type: 'shield', def: 9, price: 2200, icon: '🛡️', antiFire: true }
    ],

    // 食料（パン）
    BREADS: [
      { id: 'bread', name: 'パン', type: 'bread', satiety: 50, price: 80, icon: '🍞', desc: 'お腹を50%回復する。' },
      { id: 'big_bread', name: '大きいパン', type: 'bread', satiety: 100, price: 150, icon: '🥐', desc: 'お腹を100%回復する。満腹時に食べると最大満腹度が5%アップ！' },
      { id: 'rotten_bread', name: 'くさったパン', type: 'bread', satiety: 30, price: 20, icon: '🥖', desc: 'お腹を30%回復するが、腹痛で睡眠や毒などの異常が起こる。' }
    ],

    // 草・薬草
    HERBS: [
      { id: 'herb', name: '薬草', type: 'herb', price: 60, icon: '🌿', desc: 'HPを25回復。最大HP時なら最大HPが1アップ！' },
      { id: 'otogiri', name: '弟切草', type: 'herb', price: 200, icon: '🌱', desc: 'HPを100回復。最大HP時なら最大HPが2アップ！' },
      { id: 'antidote', name: '毒けし草', type: 'herb', price: 100, icon: '🍃', desc: '下がってしまったちからを完全回復する。' },
      { id: 'seed_str', name: 'ちからの種', type: 'herb', price: 300, icon: '🌰', desc: 'ちからが永続で1アップする！' },
      { id: 'seed_stomach', name: '胃拡張の種', type: 'herb', price: 250, icon: '🥜', desc: '最大満腹度が20%アップする！' },
      { id: 'warp_herb', name: 'ルーラ草', type: 'herb', price: 120, icon: '✨', desc: 'ダンジョン内の別の部屋へ瞬時にワープする。' },
      { id: 'fire_herb', name: '火炎草', type: 'herb', price: 180, icon: '🔥', desc: '飲むと前方3マスに30ダメージの炎！投げると50ダメージ！' },
      { id: 'sleep_herb', name: '睡眠草', type: 'herb', price: 120, icon: '💤', desc: '飲むかぶつけると深い眠りに落ちてしまう。' },
      { id: 'eyedrop', name: '目薬草', type: 'herb', price: 150, icon: '👁️', desc: 'そのフロアの隠されたワナや透明な敵が見えるようになる。' }
    ],

    // 巻物
    SCROLLS: [
      { id: 'light', name: 'あかりの巻物', type: 'scroll', price: 200, icon: '📜', desc: 'フロア全体の地形とモンスターの位置がすべて明らかになる！' },
      { id: 'upgrade', name: '強化の巻物', type: 'scroll', price: 400, icon: '📜', desc: '装備している武器または盾の強さを+1強化する！' },
      { id: 'sanctuary', name: '聖域の巻物', type: 'scroll', price: 800, icon: '📜', desc: '足元に置くと、その上にいる間モンスターから直接攻撃を受けなくなる！' },
      { id: 'sleep_scroll', name: 'バクスイの巻物', type: 'scroll', price: 350, icon: '📜', desc: '部屋にいるすべてのモンスターを深い眠りに落とす！' },
      { id: 'confuse', name: '混乱の巻物', type: 'scroll', price: 300, icon: '📜', desc: '部屋にいるすべてのモンスターを混乱させて同士討ちさせる！' },
      { id: 'bread_scroll', name: 'パンの巻物', type: 'scroll', price: 250, icon: '📜', desc: '選んだ道具を「大きいパン」に変えてしまう！' }
    ],

    // 杖（回数制限あり）
    STAVES: [
      { id: 'staff_knockback', name: '吹き飛ばしの杖', type: 'staff', uses: 5, price: 350, icon: '🪄', desc: 'モンスターを後方へ5マス吹き飛ばし、5ダメージを与える！' },
      { id: 'staff_swap', name: '場所替えの杖', type: 'staff', uses: 5, price: 300, icon: '🪄', desc: '光線が当たったモンスターと自分の位置を入れ替える！' },
      { id: 'staff_paralyze', name: 'かなしばりの杖', type: 'staff', uses: 4, price: 450, icon: '🪄', desc: 'モンスターを攻撃するまで動けなくする！' },
      { id: 'staff_silence', name: '封印の杖', type: 'staff', uses: 5, price: 400, icon: '🪄', desc: 'モンスターの特殊能力や呪文を封じ込める！' },
      { id: 'staff_polymorph', name: 'へんげの杖', type: 'staff', uses: 4, price: 350, icon: '🪄', desc: 'モンスターを別のモンスターに変身させる！' }
    ],

    // 矢
    ARROWS: [
      { id: 'wood_arrow', name: '木の矢', type: 'arrow', count: 10, price: 100, icon: '🏹', desc: '正面遠くの敵へ射ち出す。1本で6ダメージ。' },
      { id: 'iron_arrow', name: '鉄の矢', type: 'arrow', count: 8, price: 200, icon: '🏹', desc: '硬い鉄の矢。1本で12ダメージ。' }
    ]
  },

  // モンスター図鑑（階層別出現テーブル）
  MONSTERS: {
    slime: {
      id: 'slime', name: 'スライム', hp: 6, atk: 3, def: 1, exp: 2,
      minFloor: 1, maxFloor: 3, color: '#00b0ff', spriteType: 'slime',
      desc: 'おなじみの青いスライム。最初は寝ていることが多い。'
    },
    dracky: {
      id: 'dracky', name: 'ドラキー', hp: 9, atk: 5, def: 2, exp: 4,
      minFloor: 1, maxFloor: 4, color: '#7e57c2', spriteType: 'dracky',
      desc: '羽ばたくコウモリ。ふらふらと不規則に移動する。'
    },
    ghost: {
      id: 'ghost', name: 'ゴースト', hp: 13, atk: 7, def: 3, exp: 7,
      minFloor: 2, maxFloor: 5, color: '#ff7043', spriteType: 'ghost',
      desc: '赤い三角帽子のオバケ。通路の角をすり抜けて迫る。'
    },
    mushroom: {
      id: 'mushroom', name: 'おばけキノコ', hp: 18, atk: 9, def: 4, exp: 12,
      minFloor: 3, maxFloor: 6, color: '#ffb300', spriteType: 'mushroom',
      desc: '胞子を撒き散らし、プレイヤーのちからや満腹度を奪う！'
    },
    mage: {
      id: 'mage', name: 'まどうし', hp: 22, atk: 10, def: 5, exp: 18,
      minFloor: 4, maxFloor: 8, color: '#8e24aa', spriteType: 'mage',
      desc: 'ラリホー（睡眠呪文）を唱えてプレイヤーを眠らせる厄介者。'
    },
    zombie: {
      id: 'zombie', name: 'くさった死体', hp: 32, atk: 14, def: 6, exp: 26,
      minFloor: 5, maxFloor: 9, color: '#689f38', spriteType: 'zombie',
      desc: '持っているパンを腐らせたり、装備の盾をサビさせる！'
    },
    metal_slime: {
      id: 'metal_slime', name: 'はぐれメタル', hp: 5, atk: 4, def: 99, exp: 150,
      minFloor: 4, maxFloor: 10, color: '#cfd8dc', spriteType: 'metal',
      desc: 'すばやく逃げ回るが、倒せば莫大な経験値を獲得できる！'
    },
    golem: {
      id: 'golem', name: 'ゴーレム', hp: 50, atk: 22, def: 10, exp: 45,
      minFloor: 7, maxFloor: 10, color: '#8d6e63', spriteType: 'golem',
      desc: 'レンガでできた巨躯。強烈な一撃を繰り出してくる。'
    },
    dragon: {
      id: 'dragon', name: 'ドラゴン', hp: 70, atk: 28, def: 14, exp: 90,
      minFloor: 9, maxFloor: 10, color: '#2e7d32', spriteType: 'dragon',
      desc: '最下層に君臨する巨大竜。一直線に届く炎のブレスを吐く！'
    }
  }
};
