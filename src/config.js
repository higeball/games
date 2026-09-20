export const CONFIG = {
  // トラック・ワールド設定
  TRACK_WIDTH: 8.5,           // レーンの横幅（左右 -4.25 ~ +4.25）
  RUN_SPEED: 18.0,            // 前進速度 (units/sec)
  FINISH_Z: -320.0,           // ステージ終点・ボスエリアのZ座標
  CAMERA_OFFSET: { x: 0, y: 7.5, z: 9.5 },
  CAMERA_LOOK_AT: { x: 0, y: 1.2, z: -5.0 },

  // もじさん（プレイヤーリーダー）
  MOJI: {
    INIT_HP: 100,
    SPEED_X: 16.0,            // 左右追従速度
    FIRE_INTERVAL: 0.22,      // 射撃間隔（秒）
    BULLET_SPEED: 45.0,
    BULLET_DAMAGE: 15,
    COLOR_SHIRT: 0x81d4fa,    // 水色シャツ
    COLOR_PANTS: 0x1a237e,    // 紺・黒スラックス
    COLOR_SKIN: 0xd79b73,     // 肌色
    COLOR_HAIR: 0x212121,     // 黒髪
  },

  // ゲイリーくん（相棒スライム軍団）
  GARY: {
    INITIAL_COUNT: 3,         // 初期ゲイリー数
    MAX_COUNT: 250,           // 最大描画数（InstancedMesh上限）
    BASE_RADIUS: 0.38,        // スライムの基本サイズ
    FIRE_INTERVAL: 0.35,      // スライムショット間隔
    BULLET_SPEED: 40.0,
    BULLET_DAMAGE: 5,
    COLOR_BODY: 0x76ff03,     // 鮮やかなライムグリーン
    COLOR_EMISSIVE: 0x2e7d32,
    COLOR_EYE: 0x111111,
    COLOR_CHEEK: 0xff80ab,
    FORMATION_SPACING: 0.72,  // 隊列の間隔
    FOLLOW_LERP: 10.0,        // もじさんへの追従レスポンス
    BOUNCE_SPEED: 10.0,       // ぽよぽよ跳ねる周期
    BOUNCE_HEIGHT: 0.35,
  },

  // ゲート設定
  GATE: {
    WIDTH: 3.4,
    HEIGHT: 3.2,
    SHOTS_TO_UPGRADE: 3,      // 弾を当てるごとに数字が増加
    COLORS: {
      POSITIVE: { bg: 'rgba(0, 160, 255, 0.75)', border: '#00e5ff', text: '#ffffff' },
      MULTIPLY: { bg: 'rgba(255, 179, 0, 0.75)', border: '#ffd700', text: '#ffffff' },
      NEGATIVE: { bg: 'rgba(230, 30, 60, 0.75)', border: '#ff1744', text: '#ffffff' },
      BUFF:     { bg: 'rgba(156, 39, 176, 0.75)', border: '#e040fb', text: '#ffffff' }
    }
  },

  // レベル・難易度
  LEVELS: [
    {
      id: 1,
      title: "オフィス脱出！作戦開始",
      distance: 300,
      bossHp: 600,
      enemySpawnRate: 1.8,
      bgTheme: 'cyber_office'
    },
    {
      id: 2,
      title: "電脳ハイウェイ大激突",
      distance: 360,
      bossHp: 1200,
      enemySpawnRate: 1.4,
      bgTheme: 'neon_highway'
    },
    {
      id: 3,
      title: "最終防衛線：メガ・バグ討伐",
      distance: 420,
      bossHp: 2200,
      enemySpawnRate: 1.1,
      bgTheme: 'core_chamber'
    }
  ]
};
