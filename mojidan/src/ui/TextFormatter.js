/**
 * TextFormatter - ローグライク向けテキスト整形・改行・テンプレート置換ユーティリティ
 * トルネコの大冒険風の自然なスペース区切り・文節折り返し・禁則処理に対応
 */

export class TextFormatter {
  /**
   * テンプレート文字列内の {key} を params[key] で置換する
   * @param {string} template テンプレート文字列（例: "{actor}は {item}を ひろった！"）
   * @param {Object} [params] 置換パラメータ
   * @returns {string} 置換後文字列
   */
  static format(template, params) {
    if (!template || typeof template !== 'string') return '';
    if (!params || typeof params !== 'object') return template;

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * 文字列の視覚的な幅（全角=1.0, 半角=0.5）を算出
   * @param {string} str 
   * @returns {number}
   */
  static getVisualWidth(str) {
    if (!str) return 0;
    let width = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // 半角英数記号・半角スペース (0x00 - 0x7E) および 半角カタカナ (0xFF61 - 0xFF9F)
      if ((code >= 0x0000 && code <= 0x007e) || (code >= 0xff61 && code <= 0xff9f)) {
        width += 0.5;
      } else {
        width += 1.0;
      }
    }
    return width;
  }

  /**
   * 日本語文を、助詞・スペース・句読点などの自然な文節境界でトークン分割する
   * @param {string} text 
   * @returns {string[]}
   */
  static tokenize(text) {
    if (!text) return [];

    // スペース、句読点、閉じ括弧、助詞の直後を境界として分割
    // 例: "午後の始業までに 40Fのトイレへ 辿り着け！"
    // 境界正規表現: 助詞（は|が|を|に|へ|で|と|の|から|まで|より）や句読点、スペースの後
    const regex = /(?:[\s]+|[、。！？!?…]+|[」』）\]]+|(?:から|まで|より|など|[はがきをにへでとの])(?=[^はがきをにへでとの\s、。！？!?…」』）\]]))/g;

    const tokens = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchEnd = match.index + match[0].length;
      const part = text.slice(lastIndex, matchEnd);
      if (part.length > 0) {
        tokens.push(part);
      }
      lastIndex = matchEnd;
    }

    if (lastIndex < text.length) {
      tokens.push(text.slice(lastIndex));
    }

    return tokens.length > 0 ? tokens : [text];
  }

  /**
   * 単語・文節境界や禁則処理を考慮して、1行最大文字幅 (maxVisualWidth) 以内にテキストを行分割する
   * 読みにくい途中切れや1文字だけの溢れを防止
   * @param {string} text 入力文字列
   * @param {number} [maxVisualWidth=19] 1行あたりの最大視覚幅（全角文字数換算。デフォルト19）
   * @returns {string[]} 行の配列
   */
  static splitIntoLines(text, maxVisualWidth = 19) {
    if (!text) return [];

    // 明示的な改行コードを優先処理
    const rawParagraphs = text.split(/\r?\n/);
    const resultLines = [];

    // 行頭禁則文字（行頭に来てはならない文字）
    const lineHeadProhibited = /^[、。！？!?…」』）\]ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]/;

    for (const paragraph of rawParagraphs) {
      if (paragraph.trim() === '') continue;

      const tokens = TextFormatter.tokenize(paragraph);
      let currentLine = '';
      let currentWidth = 0;

      for (let t = 0; t < tokens.length; t++) {
        let token = tokens[t];
        let tokenWidth = TextFormatter.getVisualWidth(token);

        // トークンが単独で最大幅を超える場合（非常に長い単語など）
        if (tokenWidth > maxVisualWidth) {
          if (currentLine.length > 0) {
            resultLines.push(currentLine.trimEnd());
            currentLine = '';
            currentWidth = 0;
          }

          for (let i = 0; i < token.length; i++) {
            const char = token[i];
            const charWidth = TextFormatter.getVisualWidth(char);
            if (currentWidth + charWidth > maxVisualWidth) {
              resultLines.push(currentLine.trimEnd());
              currentLine = char;
              currentWidth = charWidth;
            } else {
              currentLine += char;
              currentWidth += charWidth;
            }
          }
          continue;
        }

        // 現在行に追加した場合のチェック
        if (currentWidth + tokenWidth <= maxVisualWidth) {
          currentLine += token;
          currentWidth += tokenWidth;
        } else {
          // 行頭禁則処理: 次のトークンの先頭が句読点などの場合、現在行にぶら下げるか、現在行末を巻き込んで改行
          if (lineHeadProhibited.test(token) && currentWidth + tokenWidth <= maxVisualWidth + 1.0) {
            // 許容幅わずかオーバーなら現在行にぶら下げ
            currentLine += token;
            currentWidth += tokenWidth;
          } else {
            resultLines.push(currentLine.trimEnd());
            currentLine = token;
            currentWidth = tokenWidth;
          }
        }
      }

      if (currentLine.trim().length > 0) {
        resultLines.push(currentLine.trimEnd());
      }

      // 孤立行（ウィドウ）防止：最後の行が極端に短く（全角5.5文字以下など）、
      // かつ1つ前の行が複数トークンで構成されていれば、直前トークンを次行へ送ってバランスを取る
      // （例: 「スライムは　薬草を」 / 「落とした！」 → 「スライムは」 / 「薬草を　落とした！」）
      if (resultLines.length >= 2) {
        const lastIdx = resultLines.length - 1;
        const prevIdx = lastIdx - 1;
        const lastLine = resultLines[lastIdx];
        const prevLine = resultLines[prevIdx];
        if (TextFormatter.getVisualWidth(lastLine) <= 5.5) {
          const prevTokens = TextFormatter.tokenize(prevLine);
          if (prevTokens.length >= 2) {
            const popped = prevTokens.pop();
            const newPrev = prevTokens.join('').trimEnd();
            const newLast = (popped + ' ' + lastLine).replace(/\s+/g, ' ').trim();
            if (TextFormatter.getVisualWidth(newLast) <= maxVisualWidth && newPrev.length > 0) {
              resultLines[prevIdx] = newPrev;
              resultLines[lastIdx] = newLast;
            }
          }
        }
      }
    }

    return resultLines.length > 0 ? resultLines : [''];
  }

  /**
   * 複数行を 1 ページあたり linesPerPage 行（デフォルト2行）のページ配列にまとめる
   * @param {string[]} lines 行の配列
   * @param {number} [linesPerPage=2] 1ページあたりの行数
   * @returns {string[][]} ページの配列
   */
  static paginate(lines, linesPerPage = 2) {
    if (!Array.isArray(lines) || lines.length === 0) return [[]];
    const pages = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
      pages.push(lines.slice(i, i + linesPerPage));
    }
    return pages;
  }
}
