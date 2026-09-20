export const CONFIG = {
  // トラック・ワールド設定（戦略的思考と射撃エイムが楽しめる快適なペース配分）
  TRACK_WIDTH: 8.5,           // レーンの横幅（左右 -4.25 ~ +4.25）
  RUN_SPEED: 11.8,            // 前進速度 (units/sec) - 敵やゲートの状況を見て作戦を立てられるスピード！
  FINISH_Z: -320.0,           // ステージ終点・ボスエリアのZ座標
  CAMERA_OFFSET: { x: 0, y: 7.5, z: 9.5 },
  CAMERA_LOOK_AT: { x: 0, y: 1.2, z: -5.0 },

  // もじさん（プレイヤーリーダー）
  MOJI: {
    INIT_HP: 100,
    SPEED_X: 18.0,            // 左右追従速度（素早く狙いを切り替えられる高いレスポンス）
    FIRE_INTERVAL: 0.20,      // 射撃間隔（秒）
    BULLET_SPEED: 48.0,
    BULLET_DAMAGE: 16,
    COLOR_SHIRT: 0x81d4fa,    // 水色シャツ
    COLOR_PANTS: 0x1a237e,    // 紺・黒スラックス
    COLOR_SKIN: 0xd79b73,     // 肌色
    COLOR_HAIR: 0x212121,     // 黒髪
  },

  // ゲイリーくん（相棒スライム軍団）
  GARY: {
    INITIAL_COUNT: 3,         // 初期ゲイリー数
    MAX_COUNT: 300,           // 最大描画数（InstancedMesh上限）
    BASE_RADIUS: 0.62,        // スライムの基本サイズ
    MAIN_SCALE: 1.45,         // もじさんの隣にいるメインゲイリーの拡大倍率
    FIRE_INTERVAL: 0.28,      // スライムショット間隔
    BULLET_SPEED: 45.0,
    BULLET_DAMAGE: 8,
    COLOR_BODY: 0x64ff24,     // 鮮やかなネオンライムグリーン
    COLOR_EMISSIVE: 0x3cd000, // 強い自己発光
    COLOR_EYE: 0x111111,
    COLOR_CHEEK: 0xff4081,
    FORMATION_SPACING: 0.95,  // 隊列の間隔
    FOLLOW_LERP: 12.0,        // もじさんへの追従レスポンス
    BOUNCE_SPEED: 11.0,       // ぽよぽよ跳ねる周期
    BOUNCE_HEIGHT: 0.55,      // 跳ねる高さ
  },

  // ゲート＆アイテム設定
  GATE: {
    WIDTH: 3.4,
    HEIGHT: 3.2,
    SHOTS_TO_UPGRADE: 3,      // 弾を当てるごとに数字が増加
    COLORS: {
      POSITIVE:  { bg: 'rgba(0, 160, 255, 0.78)', border: '#00e5ff', text: '#ffffff' },
      MULTIPLY:  { bg: 'rgba(255, 179, 0, 0.78)', border: '#ffd700', text: '#ffffff' },
      NEGATIVE:  { bg: 'rgba(230, 30, 60, 0.78)', border: '#ff1744', text: '#ffffff' },
      BUFF_SPREAD: { bg: 'rgba(255, 64, 129, 0.82)', border: '#ff4081', text: '#ffffff' },
      BUFF_SPEED:  { bg: 'rgba(156, 39, 176, 0.82)', border: '#e040fb', text: '#ffffff' },
      BUFF_POWER:  { bg: 'rgba(255, 112, 67, 0.82)', border: '#ff5722', text: '#ffffff' },
      TRANSFORM:   { bg: 'rgba(194, 24, 91, 0.85)', border: '#ff4081', text: '#ffffff' },
      SHIELD:      { bg: 'rgba(0, 229, 255, 0.82)', border: '#18ffff', text: '#ffffff' },
      RESCUE:      { bg: 'rgba(100, 255, 36, 0.82)', border: '#76ff03', text: '#ffffff' }
    }
  },

  // 全5ステージの詳細設計（徐々に頭を使って状況を打開していく戦略的デザイン）
  LEVELS: [
    {
      id: 1,
      title: "STAGE 1: 電脳オフィス脱出",
      subtitle: "ゲートを撃って育成！囚われたゲイリーを救出せよ！",
      strategyTip: "💡 ゲートに弾を当てて育てよう！ケージを壊すと仲間が増えるぞ！",
      distance: 260,
      bossName: "アイアン・ガーディアン",
      bossHp: 550,
      bossColor: 0x00e5ff,
      skyColor: 0x0b132b
    },
    {
      id: 2,
      title: "STAGE 2: ネオンハイウェイ激突",
      subtitle: "動くゲートを見極め、赤いバレルで障壁を爆破せよ！",
      strategyTip: "💡 赤いバレルを撃つと周囲の敵やブロックを大爆発で一網打尽にできる！",
      distance: 320,
      bossName: "サイバー・スパイダー",
      bossHp: 1100,
      bossColor: 0x9c27b0,
      skyColor: 0x12002b
    },
    {
      id: 3,
      title: "STAGE 3: 電脳ネオンシティ掃討",
      subtitle: "反転ゲートに撃ち込んでプラス化！電磁レーザーを回避せよ！",
      strategyTip: "💡 マイナスゲートも撃ちまくればプラスや乗算に大逆転（FLIP）する！",
      distance: 380,
      bossName: "メカ・ドローン・マザー",
      bossHp: 1900,
      bossColor: 0xff1744,
      skyColor: 0x1a0914
    },
    {
      id: 4,
      title: "STAGE 4: データコア防衛突破",
      subtitle: "シールド装甲兵の包囲網！メガビームで硬い要塞をぶち抜け！",
      strategyTip: "💡 正面シールドの敵は横から狙うかバレルで誘爆！メガビームは壁を貫通！",
      distance: 440,
      bossName: "ダーク・ゴーレム",
      bossHp: 3000,
      bossColor: 0xff9100,
      skyColor: 0x051a1a
    },
    {
      id: 5,
      title: "STAGE 5: 皇帝メガ・バグ決戦",
      subtitle: "全戦術を駆使せよ！100体以上の最強軍団で電脳世界を救え！",
      strategyTip: "💡 ボスの周囲にあるシールド核を先に破壊してから本体へ総攻撃！",
      distance: 520,
      bossName: "皇帝メガ・バグ",
      bossHp: 4800,
      bossColor: 0xd500f9,
      skyColor: 0x1c0022
    }
  ]
};
