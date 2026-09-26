# ネコナイン — ヤス監督の挑戦

猫選手9匹をドラフト・育成し、重要局面の采配でリーグ優勝を目指す、スマホ向け短編野球ゲームです。

## ローカル起動

```bash
npm install
npm run dev
```

本番ビルドは `npm run build`、確認は `npm run preview` です。テストは `npm test` で実行できます。

## GitHub Pages

本番URLは `https://<username>.github.io/neko-card-game/` を想定しています。

1. GitHubへpushする
2. リポジトリの **Settings → Pages → Build and deployment** で **GitHub Actions** を選ぶ
3. `main` ブランチへのpush後、`Deploy to GitHub Pages` workflowの完了を待つ

リポジトリ名を変更する場合は、`vite.config.ts` の本番用 `base` とPWAのscopeを変更してください。

## アセット

- `public/assets/characters/yasu-pixel-sheet.png`: 提供画像を参照して生成したヤス監督4表情
- `public/assets/characters/cat-player-sheet.png`: 猫選手9種のピクセルアート
- 元画像: `yasu-character-v3.png`
