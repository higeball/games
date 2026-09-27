# ヒゲボールゲームズ (Higeball Games)

株式会社ヒゲボールが開発・提供する、レトロテイストなブラウザゲームの総合ポータルプラットフォームです。

🌐 **公式ポータルサイト**: [https://higeball.github.io/games/](https://higeball.github.io/games/)  
📁 **GitHubリポジトリ**: [https://github.com/higeball/games](https://github.com/higeball/games)

---

## 🎮 収録ゲーム一覧

| ゲームタイトル | ジャンル | 技術スタック | ディレクトリ |
| :--- | :--- | :--- | :--- |
| **[もじダン](./mojidan/)**<br>〜 午後の始業と消えたトイレ 〜 | 本格ローグライクRPG<br>（トルネコ風ターン制ダンジョン） | Vanilla JS, Canvas 2D, Web Audio API, Vite | [`mojidan/`](./mojidan/) |
| **[ネコナイン](./neko-nine/)**<br>〜 ヤス監督の挑戦 〜 | 本格野球シミュレーション<br>（ドラフト・育成・3D試合） | React 19, TypeScript, Three.js 3D, Vite | [`neko-nine/`](./neko-nine/) |

---

### 1. 🏃 もじダン 〜午後の始業と消えたトイレ〜
- **概要**: 昼休み残り20分！ オフィスタワー50Fで突如発生した腹痛。しかしフロアのトイレは配管破裂で全面閉鎖！ 唯一利用可能な40Fトイレを目指し、非常階段のダンジョンを駆け降りる本格ローグライクRPG。
- **特徴**:
  - 入るたびに形が変わるランダムダンジョン（50F〜40Fの全11フロア）。
  - 完全同期ターン制グリッド移動（8方向対応）。
  - 満腹度管理、多彩なアイテム（草・巻物・杖・パン・武器・盾・矢）。
  - スマートフォン＆PC両対応の快適なUI。
- 詳細は [mojidan/README.md](./mojidan/README.md) をご覧ください。

### 2. 🐱 ネコナイン 〜ヤス監督の挑戦〜
- **概要**: 個性豊かな猫選手9匹をスカウト（ドラフト）し、キャンプで鍛え上げ、ヤス監督の采配でリーグ優勝を目指す本格短編野球シミュレーション。
- **特徴**:
  - 稀（約5%）に出現する能力の高い「★スペシャル選手」。
  - 3種類の育成メニューを選択後に確定する計画的キャンプUI。
  - Three.js による臨場感あふれる3D野球スタジアム描画＆投球・打球演出。
  - iPhone 13 Pro などのスマホ縦画面1画面に収まる最適化レイアウト。
- 詳細は [neko-nine/README.md](./neko-nine/README.md) をご覧ください。

---

## 📂 ディレクトリ構成

リポジトリは各ゲームが独立したサブプロジェクトとして並列（sibling）に配置されたモノレポ構造となっています。

```text
fuga4_games/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages 自動デプロイ
├── index.html                  # ヒゲボールゲームズ ポータル画面
├── package.json                # 全体オーケストレーション＆一括ビルド
├── vite.config.js              # ポータル＆ローカル統合開発設定
├── README.md                   # ヒゲボールゲームズ総合案内（本ファイル）
│
├── mojidan/                    # ゲーム1: もじダン（Vanilla JS + Vite）
│   ├── index.html              # もじダン単体ゲーム画面
│   ├── package.json            # もじダン単体設定
│   ├── vite.config.js          # もじダン単体Vite設定
│   ├── README.md               # もじダン詳細ドキュメント
│   ├── src/                    # ゲームソースコード
│   ├── public/                 # 公開アセット（モンスター・アイテム・マップ等）
│   └── character/              # キャラクター素材
│
├── neko-nine/                  # ゲーム2: ネコナイン（React + TS + Three.js）
│   ├── index.html              # ネコナイン単体ゲーム画面
│   ├── package.json            # ネコナイン単体設定
│   ├── vite.config.ts          # ネコナイン単体Vite設定
│   ├── README.md               # ネコナイン詳細ドキュメント
│   ├── src/                    # React / Three.js ソースコード
│   └── public/                 # ネコナイン公開アセット
│
└── _backup_toproad/            # 旧トップロードのアーカイブバックアップ
```

---

## 🚀 開発・ビルド手順

### 1. リポジトリ全体の統合開発（推奨）

リポジトリルートから一括でローカル開発サーバーを起動できます。

```bash
# ルートの依存関係インストール
npm install

# 開発サーバー起動（ポート3000）
npm run dev
```

起動後、ブラウザで以下のURLにアクセスできます：
- ポータル画面: `http://localhost:3000/`
- もじダン: `http://localhost:3000/mojidan/`
- ネコナイン: `http://localhost:3000/neko-nine/`

### 2. 各ゲーム単体での開発

各ディレクトリに移動して独立して開発・テストすることも可能です。

#### もじダン
```bash
cd mojidan
npm install
npm run dev     # ポート3001
```

#### ネコナイン
```bash
cd neko-nine
npm install
npm run dev     # ポート5173
npm run test    # ユニットテスト実行
```

### 3. 本番一括ビルド（GitHub Pages用）

ルートディレクトリで以下を実行すると、ポータルおよび全ゲームがビルドされ、`dist/` ディレクトリに統合されます。

```bash
npm run build
```

生成される `dist/` 構造：
- `dist/index.html`（ポータル）
- `dist/mojidan/`（もじダン一式）
- `dist/neko-nine/`（ネコナイン一式）

---

## 🚢 デプロイ

`main` ブランチにプッシュされると、GitHub Actions（`.github/workflows/deploy.yml`）が自動的に本番ビルドを実行し、GitHub Pages へ安全にデプロイされます。

---

## 🏢 コピーライト
© 2026 株式会社ヒゲボール / ヒゲボール制作委員会
