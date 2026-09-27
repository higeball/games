import type { Player, WorldState } from "./model";

const surnames =
  "佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 林 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本 斉藤 福田 太田 西村 藤井 金子 岡本 藤原 三浦 中野 中川 原田 小野 田村 竹内 松田 和田 石田 上田 森田 原 柴田 酒井 工藤 横山 宮崎 宮本 内田 高木 安藤 谷口 大野 丸山 今井 河野 藤本 小島 武田 村田 上野 杉山 増田 小山 平野 菅原 久保 松井 千葉 岩崎 桜井 木下 野口 松尾 菊地 野村 新井 渡部 佐野 杉本 大西 古川 浜田 市川 水野 小松 島田 高田 広瀬 藤沢 大塚 中田 平田 吉川 川口 福岡 秋山 坂井 安田 永田 浅野 片山 西田 白石 黒田 矢野 小池 大森 吉岡 川崎 高山 新田 堀内 北村 南 谷 野田 東 馬場 関 本田 内藤 中西 福島 星野 西川 深田 平井 稲葉 岩田 荒木 大久保 飯田 松下 植田 根本 大橋 栗原 奥田 久保田 川村 小沢 成田 大石 岩本 五十嵐 中尾 土屋 石原 杉浦 岡崎 宮田 早川 吉村 松原 飯島 望月 古賀 塚本 松岡 北川 服部 横田 沢田 鎌田 大谷 牧野 田辺 神田 川島 小田 小泉 三宅 石橋 小倉 白井 伊東 大島 武内 山内 片岡 安井 桑原 本間 高野 荻野 角田 豊田 山根 杉田 大竹 長田 岩井 永井 玉井 藤川 岸本 井口 柳沢 向井 江口 西山 松永 奥村 坂口 竹田 浅井 榎本 小西 福井 山川 坪井 青山 稲垣 野上 江藤 上原 杉原 笠原 黒木 松村 徳永 宮川 大沢 吉野 北野 長尾 堀田 中原 竹中 篠原 川上 中井 安部 鶴田 西尾 岸 小原 市原 大原 寺田 関口 宮野 中沢 庄司 岩下 池上 平山 大場 矢島 桐山 河村 長野 梅田 沼田 浅田 磯田 岡野 水谷 小坂 北原 田島 小嶋 森本 安達 平尾 岡部 小森 新谷 谷本 安西 石塚 古田 富田 田口 尾崎 小宮 岩瀬 谷川 戸田 長浜 山岸 瀬戸 稲田 鳥居 山城 川西 熊谷 田代 須藤 福永 竹本 土田 松浦 南部 岩村 藤木 畠山 島津 小柳 細川 大庭 酒巻 泉 桑田 黒沢 岩谷 松山 中谷 梶原 平岡 滝沢 福山 横井 松崎 村井 小野寺 矢口 広田 高井 堀井 滝田 亀田 宮原 森山 岡島 井田 橋口 堀川 寺島 島崎 勝田 新城 松野 野崎 西岡 藤村 桜田 竹下 川田 白川 吉松 羽田 秋田 坂田 徳田 大川 上村 江原 柳田 戸塚 小早川 宇野 萩原 三木 牧田 長瀬 斎藤 藤崎".split(
    " ",
  );
const cats =
  "ミケ クロ シロ タマ ムギ モフ トラ ハチ フク コハク チャチャ ギン レオ ソラ ユズ リン ルナ マロン チビ モモ サクラ アズキ キナコ ダイズ アンズ クルミ マメ ナツ メイ ポチ ミント シオン コテツ ヒメ タロ チャコ ラテ モカ チョコ ビスケ プリン ウニ コロ ナナ ミミ ベル ノア ネロ ルル リリ ロロ ニコ ツナ サバ ワサビ ゴマ スズ カリン スモモ ボタン ポン サスケ ハル ユキ フワ リク カイ ツキ ヒナ ミカン レン カナメ トト ソックス ジジ キキ コメ モチ マル テン シャム マヌル ベンガル ロシアン ペルシャ アメショー スコティ ノル ラグ ソマリ サイベリアン アビシニアン バーマン ボンベイ コラット バリニーズ ピクシー セルカーク スフィンクス マンチカン トンキニーズ バーミーズ オシキャット エジプシャン ブリティッシュ ターキッシュ".split(
    " ",
  );
const dogs =
  "シバ アキタ コロ ポチ ゴン ラブ ハク ビス シェル チロ ポン ボル シオン ダル サム コーギー ハスキー プードル ビーグル ダックス テリア コリー レトリバー バセット シュナウザー サモエド マルチーズ パグ ペキ チワワ スピッツ セッター ドーベル グレート トビー バディ ロッキー マックス チャーリー クーパー テディ ベンジー デューク ジャック オスカー フィン ミロ アーチー ルーク レックス シーザー ブルーノ オリバー ベントレー チェスター ベイリー ボビー レオ ナッシュ オーク ブルー クッキー ミルク ココ ムク ワタ ロイ ラッキー リリー メイジー デイジー ロージー ハニー スノー サニー ベル ノア トト ムギ キナコ コハク チャチャ ゴマ マロン モカ ラテ プリン ウニ マル テン フク ソラ カイ レン リク ユズ ミント フワ マメ ボタン".split(
    " ",
  );
const roots =
  "山 川 森 松 竹 石 岩 谷 野 原 杉 藤 林 橋 島 沢 田 岡 福 中 大 小 北 南 西 東 上 下 高 白 黒 青 赤 金 平 長 三 八 吉 宮".split(
    " ",
  );
const ends =
  "田 川 山 野 原 本 村 谷 島 岡 沢 森 林 橋 井 崎 浜 内 浦 木".split(" ");
const reserveFamilies = [
  ...new Set(roots.flatMap((a) => ends.map((b) => a + b))),
].filter((s) => !surnames.includes(s));

/** Names never use a numeric suffix. Resolve collisions against all careers. */
export function playerName(
  species: Player["species"],
  serial: number,
  used: Set<string>,
) {
  const animals = species === "cat" ? cats : dogs;
  // Common surnames first; a large kanji-combination reserve supports long saves.
  for (const family of [surnames, reserveFamilies]) {
    const size = family.length * animals.length;
    for (let offset = 0; offset < size; offset++) {
      const n = (serial + offset) % size;
      const name = `${family[n % family.length]} ${animals[Math.floor(n / family.length)]}`;
      if (!used.has(name)) return name;
    }
  }
  throw Error("選手名の候補が足りません。新しい名前の辞書が必要です。");
}

/** Cosmetic upgrade only: player IDs, skills, finances and records stay intact. */
export function normalizePlayerNames(w: WorldState): boolean {
  const used = new Set<string>();
  let changed = false;
  const replacements = new Map<string, string>();
  for (const p of w.players) {
    if (
      !p.name ||
      /[0-9０-９]/.test(p.name) ||
      used.has(p.name) ||
      !p.name.includes(" ")
    ) {
      const old = p.name;
      changed = true;
      p.name = playerName(
        p.species,
        Number(p.id.replace(/\D/g, "")) || used.size,
        used,
      );
      if (old) replacements.set(old, p.name);
    }
    used.add(p.name);
  }
  if (replacements.size) {
    const replace = (text: string) => {
      for (const [before, after] of [...replacements].sort(
        (a, b) => b[0].length - a[0].length,
      ))
        text = text.replaceAll(before, after);
      return text;
    };
    w.news.forEach((n) => {
      n.title = replace(n.title);
      n.body = replace(n.body);
    });
  }
  return changed;
}
