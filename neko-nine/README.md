# ネコナイン — ヤスオーナーの球団再建

2026年レギュラーシーズン終了後、「福岡ソフトにゃんくホークス」のオーナーに就任。セ・リーグとパ・リーグ各6球団で、70人枠・年俸予算・補強をやりくりするスマホ向け球団運営ゲームです。選手は基本的に猫、犬は外国人選手です。試合操作はなく、月送り・残りシーズンの高速進行で遊べます。

## 遊べる内容

- 秘書フーミー（茶髪のショートヘアー）が各時期の目的・必要な手続き・次の操作を案内。日程を進めると対象の操作画面が直接開きます
- 戦力外候補は「3年目までを除外」「主力を除外」が初期設定。解除すれば主力も選べます。能力・年俸・契約・直近3年成績を一覧内で比較（不足成績は自動補完、プロ入り前の年度は「記録なし」）
- 第1次・第2次の戦力外通告、拒否による退団リスクのある育成打診、支配下昇格
- 成績査定による一括提示と要面談。出来高、1〜3年契約、守備位置・打順の優先起用を交渉に使用
- シーズン中から調査度を積み上げるドラフト。1位の競合抽選表示、下位指名速報、指名漏れの若手も再生市場へ
- FAのA/B/Cランク、28人のプロテクトと人的補償。外国人補強、トライアウト、現役ドラフト、選手交換＋金銭のトレード
- 秋季・春季キャンプの開催地・追加予算・重点2スロット・OB招聘。特別指定5人までのブレイク育成、コンバート、新球種習得
- 監督・コーチ6職種の年間契約、オープン戦の状態評価、開幕一軍31人（外国人4人まで）の選抜
- 猫20種・外国人犬20種、初期12球団864選手（各66人支配下＋6人育成）。年齢、成長・衰え、故障、能力評価、年度別成績
- 各球団143試合、月間MVP、オールスター、CS、日本シリーズ、歴代優勝球団
- 入場料、広告費、スポンサー、施設投資、観客数・年俸・収支の決算。資金難時は再建融資
- 複数年の継続プレイ、自動保存、直前バックアップ、JSON書き出し・読み込み

ルール・移籍・査定はゲーム向けに簡略化した独自シミュレーションです。実在選手の能力・成績データは使用していません。選手名は日本の名字＋動物の名前で、引退選手を含めて重複を避けます。画像はコード生成のSVGポートレートに変更し、毛色・模様・目・耳・口元・ユニフォーム・襟の組み合わせを選手IDに固定しています。猫・犬それぞれ368,640パターンで、移籍や再読み込みでも外見は変わりません。

戦力外の「主力」は直近シーズンの野手60試合／180打席、投手10先発／30登板／10セーブ／10ホールドを目安とした補助判定です。候補の順序は出場機会・年齢・能力からの参考情報で、通告はオーナーの確認を経て行います。複数年契約が残る選手は一覧でも理由を表示し、操作できません。既存セーブの数字付き選手名は能力・成績・資金・選手IDを変えずに更新します。

新規ゲームでは、就任前の2024・2025年も試合シミュレーションで架空の成績を生成するため、ベテランを3年分の成績で比較できます。既存セーブ・JSON読み込みにも、直近3年の不足年度を能力と投打の役割から自動補完します。保存済みの実績（0試合を含む）・資金・能力・乱数状態は変更しません。プロ入り前の年度は対象外です。補完した成績には「補完」の印を付け、公式タイトルやリーグのランキングには含めません。シーズン途中では現在進行中の年度を補完しません。

能力は一覧・詳細・ドラフト候補ともコンパクトな「項目 ランク 数値」表示です。ランクはS（紫）・A（ピンク）・B（赤）・C（橙）・D（黄土）・E（緑）・F（青）・G（灰）の独自配色。未調査の能力は、上下限それぞれの色付きランクと数値幅を表示します。

球団名は猫風の架空名称。本拠地の配置は[NPB公式の12球団本拠地](https://npb.jp/stadium/franchise.html)を参考にしています。北海道は北広島、阪神に相当する球団は西宮です。現役ドラフトは候補を選ぶ交換方式、FA補償はA/B獲得時に人的補償を行う方式に簡略化しています。外国人の一軍上限はゲーム内ルールの4人です。

## 年間日程

10月上旬の総括・第1次戦力外 → 10月下旬ドラフト・秋季キャンプ → 11月上旬の日本シリーズ結果・FA公示・第2次戦力外 → 11月中旬トライアウト・現役ドラフト → 11月下旬〜12月契約更改・FA交渉・外国人補強・トレード → 1月自主トレ・施設・スタッフ契約 → 2月春季キャンプ → 3月オープン戦・開幕一軍登録 → 4〜9月レギュラーシーズン。

年俸予算は契約更改・1月に設定します。一括提示後の要面談、人的補償、スタッフ契約、キャンプ、一軍登録などの必須タスクが残ると日程は進みません。初期の支配下は66人なので、6人指名するには先に枠を空ける必要があります。出来高は野手100安打または15本塁打、投手8勝または15セーブで年俸の18%を追加支払い。起用確約が守られない選手は調子が低下します。

スカウト派遣はシーズン中18件、通常のオフは追加4件（初年度は準備期間がないため12件）。秋だけで調べ切るのは難しく、事前調査が指名の判断材料になります。設定画面から2026年の新規ゲームを始めることもできます。継続中のデータを残す場合は先にJSONを書き出してください。

## ローカル起動

```bash
npm install
npm run dev
```

同じWi-Fiのスマホで確認する場合は `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`。ChromebookのpenguinではChromeOSのLinuxポート転送にTCP 5173を追加・有効化し、ChromebookのWi-Fi側IPで `http://<IP>:5173/` を開きます。

本番ビルドは `npm run build`、確認は `npm run preview` です。`npm run typecheck` で型検査、`npm test` で20年継続を含む単体テスト、`npm run test:e2e` でGoogle Chromeによる年間進行・保存復帰・オフライン起動のテストを実行します。

## GitHub Pages

本番URLは `https://higeball.github.io/games/neko-nine/` です。`higeball/games` リポジトリの `neko-nine/` に本プロジェクトを反映し、リポジトリ直下の既存 GitHub Actions で他のゲームと一緒にビルド・公開します。本プロジェクト内の `.github/workflows/deploy.yml` をリポジトリ直下へ上書きしないでください。

1. GitHubへpushする
2. リポジトリの **Settings → Pages → Build and deployment** で **GitHub Actions** を選ぶ
3. `main` ブランチへのpush後、`Deploy to GitHub Pages` workflowの完了を待つ

静的ファイルだけで動き、サーバー・APIキーは不要です。出力先は `dist/`。push・公開操作はご自身で行ってください。

リポジトリ名を変更する場合は、`vite.config.ts` の本番用base・サービスワーカーbase、および `public/manifest.webmanifest` のURLを変更してください。

初回オンライン起動後はオフライン利用できます。更新時は設定画面から新しい版を適用できます。保存は端末・ブラウザ・サイトごとです。サイトデータ削除や端末変更に備えてJSONを書き出してください。

セパ版はIndexedDBの `neko-owner-v3` に保存します。旧オーナー版v2の保存がある場合は、能力・年度成績・資金を維持して自動で引き継ぎ、本拠地・リーグ・登録枠を更新します。旧データベースは残ります。v2のJSONも読み込めます。旧監督版のlocalStorageデータは削除しませんが、オーナー版へは移行しません。

## 構成

React・TypeScript・Vite。`src/owner/engine.ts` は描画から独立した試合・年間進行、`operations.ts` は契約・補強・登録の制約、`FrontOffice.tsx` はダッシュボードと編成画面。重い月次処理はWorker、保存はIndexedDBです。

`Secretary.tsx` は時期に応じた案内と進行先、`ReleasePanel.tsx` は一覧内での候補比較、`release.ts` は候補の補助判定、`identity.ts` は命名と互換更新、`AnimalPortrait.tsx` は固定IDに基づく外見生成です。

`history.ts` は不足する過去成績の決定的な補完、`AbilityBadge.tsx` は項目・ランク・数値を一行にまとめる共通表示です。

## アセット

- `public/assets/characters/yasu-pixel-sheet.png`: 提供画像を参照して生成したヤス4表情
- `public/assets/characters/cat-player-sheet.png`: 猫選手9種のピクセルアート
- 元画像: `yasu-character-v3.png`
- `public/assets/characters/dog-player-sheet.png`: 今回生成した犬9枠
- `public/assets/characters/foomy-secretary.png`: 組み込み画像生成ツールで新規生成した秘書フーミーの透過立ち絵
- `public/assets/characters/foomy-secretary-pixel.png`: ヤスのドット絵を参照し、組み込み画像生成で絵柄を統一した現在のフーミー。元画像は保持しています。
- 選手の肖像は `src/owner/PixelAnimalPortrait.tsx` の48×54ドットの整数グリッドで描画。猫・犬それぞれ36万通り以上の配色・模様・耳・目・ユニフォームの組み合わせを維持しています。

直近3年の成績は選手名鑑の一覧・戦力外候補・詳細画面に共通表示します。初期データと既存セーブの欠けた架空のプロ経歴は自動補完し、実際にプレイした年度の成績は上書きしません。プロ入り前は「プロ入り前」、登板・出場0の年は「一軍出場なし」と区別します。シーズン中の直近3年表は、進行中ではなく直前に終了した年を基準にします。

一軍出場0の年度には独立した `farmReports` に二軍参考成績（架空データ）を補完します。一軍のゼロ記録は保持し、リーグ集計やタイトルには二軍参考成績を含めません。

現在のUIでは一軍・二軍の3年成績を別表に分けます。一軍表は未出場でも常時表示し、二軍表は直近3年に出場のある場合だけ表示します。年度欄の補完注記は省き、表の下に短い注記をまとめます。

就任直後はフーミーによる年間の流れ → ポジション別の補強ポイント → 第1次戦力外通告へ、の順で案内します。資金・年俸・支配下・順位は固定ヘッダーに横一段で表示。戦力外候補はポジション別タブで絞り込め、終了ボタンはヘッダー内の「第1次戦力外通告を終了しドラフト会議へ進む」です。

ドット絵フーミーの最終プロンプト（組み込み画像生成・style-transfer）:

> Asset: transparent portrait sprite for a Japanese baseball-owner mobile game. Image 1 is the edit target: secretary Foomy. Image 2 is the style reference ONLY, Yasu's existing pixel sprites. Redraw Image 1 as genuine crisp square-pixel 16-bit JRPG character artwork at the SAME pixel density, dark pixel outlines, limited palette, stepped shading, large friendly eyes and chibi proportions as Yasu. Preserve Foomy's short chestnut-brown bob hair, adult female identity, friendly smile, navy business jacket, cream blouse and clipboard. A single front-facing upper-body portrait centered, head and shoulders fully visible with small transparent padding. True alpha transparent background. No smooth anime linework, no antialiasing, no gradients, no text, no watermark. Do not draw Yasu, no sheet, only one Foomy sprite.

フーミー画像の最終生成指示（組み込みツール使用）:

> Use case: stylized-concept. Asset type: single secretary character portrait for a Japanese cat baseball club owner mobile game. Subject: Foomy (フーミー), an adult Japanese woman with short chestnut-brown bob hair, warm brown eyes, a friendly confident smile. Wearing a tasteful navy office blazer over a light cream blouse, holding a small clipboard naturally at her waist. Style: polished Japanese anime game character illustration, clean dark outlines and soft cel shading, approachable rather than glamour, matching a wholesome baseball management game. Composition: centered waist-up portrait, entire hair and shoulders inside the frame, clear readable face at small size. Background: genuinely transparent with alpha, no scenery. Constraints: one woman only, no lettering, no logos, no watermark, no cat ears, no extra hands. This is a new project asset.

犬画像の生成指示: “Production pixel-art sprite sheet for NEKO NINE baseball club management game. Exactly NINE dog baseball player bust portraits in ONE horizontal row, nine equal-width slots on a genuinely transparent background. In order: Shiba Inu, Akita, corgi, husky, golden retriever, labrador, poodle, dachshund, beagle. Navy caps, ivory jerseys, crisp 16-bit pixel art.”
