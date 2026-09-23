/**
 * MessageWindowUI - トルネコの大冒険風 2行メッセージウィンドウ描画UI
 * タイプライター描画、点滅インジケータ(▼)、ページ切替／スクロール更新に対応
 */

export class MessageWindowUI {
  /**
   * @param {string} containerId コンテナの要素ID
   * @param {Object} [options]
   * @param {string} [options.updateMode='scroll'] 'scroll' (下からせり上げ) または 'page' (2行ごとクリア)
   * @param {number} [options.typewriterSpeed=16] 1文字あたりの描画ミリ秒
   * @param {number} [options.autoAdvanceDelay=700] メッセージ完了後の自動送り待機ミリ秒（0で自動送り無効）
   * @param {Function} [options.onAdvanceRequest] クリックやタップ時に次へ進む要求を送るコールバック
   */
  constructor(containerId = 'message-window', options = {}) {
    this.container = document.getElementById(containerId);
    this.updateMode = options.updateMode || 'scroll'; // 'scroll' | 'page'
    this.typewriterSpeed = options.typewriterSpeed !== undefined ? options.typewriterSpeed : 16;
    this.autoAdvanceDelay = options.autoAdvanceDelay !== undefined ? options.autoAdvanceDelay : 700;
    this.onAdvanceRequest = options.onAdvanceRequest || (() => {});

    this.isTyping = false;
    this.isWaitingInput = false;

    this._timer = null;
    this._autoTimer = null;
    this._skipCallback = null;

    this.line1Text = '';
    this.line2Text = '';

    this._setupDOM();
  }

  _setupDOM() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="msg-window-inner">
        <div class="msg-row msg-row-1"><span class="msg-text" id="msg-line-1"></span></div>
        <div class="msg-row msg-row-2">
          <span class="msg-text" id="msg-line-2"></span>
          <span class="msg-indicator blinking hidden" id="msg-indicator">▼</span>
        </div>
      </div>
    `;

    this.line1El = document.getElementById('msg-line-1');
    this.line2El = document.getElementById('msg-line-2');
    this.indicatorEl = document.getElementById('msg-indicator');

    // ウィンドウ自体をタップまたはクリックした際に進行を促す
    this.container.style.cursor = 'pointer';
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onAdvanceRequest();
    });
    this.container.addEventListener('touchstart', (e) => {
      // パッシブイベント対応
    }, { passive: true });
  }

  /**
   * 現在の表示とタイマーをクリア
   */
  clear() {
    this.stopTyping();
    this.clearAutoAdvance();
    this.showIndicator(false);
    this.line1Text = '';
    this.line2Text = '';
    if (this.line1El) this.line1El.textContent = '';
    if (this.line2El) this.line2El.textContent = '';
  }

  /**
   * タイプライタータイマーを停止
   */
  stopTyping() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.isTyping = false;
    this._skipCallback = null;
  }

  /**
   * 自動送りタイマーを解除
   */
  clearAutoAdvance() {
    if (this._autoTimer) {
      clearTimeout(this._autoTimer);
      this._autoTimer = null;
    }
  }

  /**
   * 送り待ちインジケータ（▼）の表示切替
   * @param {boolean} show
   */
  showIndicator(show) {
    this.isWaitingInput = show;
    if (this.indicatorEl) {
      if (show) {
        this.indicatorEl.classList.remove('hidden');
      } else {
        this.indicatorEl.classList.add('hidden');
      }
    }
  }

  /**
   * タイプライター進行中の場合、即座に全文を表示してスキップする
   * @returns {boolean} スキップが実行されたかどうか
   */
  skip() {
    if (this.isTyping && this._skipCallback) {
      const cb = this._skipCallback;
      this.stopTyping();
      cb();
      return true;
    }
    return false;
  }

  /**
   * 指定した要素にテキストをタイプライター効果で1文字ずつ描画
   * @param {HTMLElement} element 
   * @param {string} fullText 
   * @param {Function} onDone 
   */
  typewrite(element, fullText, onDone) {
    if (!element) {
      onDone?.();
      return;
    }

    this.stopTyping();

    // 速度が 0 の場合は即時表示
    if (this.typewriterSpeed <= 0) {
      element.textContent = fullText;
      onDone?.();
      return;
    }

    this.isTyping = true;
    let charIndex = 0;
    element.textContent = '';

    // スキップされた場合の処理を登録
    this._skipCallback = () => {
      element.textContent = fullText;
      onDone?.();
    };

    this._timer = setInterval(() => {
      if (charIndex < fullText.length) {
        element.textContent += fullText.charAt(charIndex);
        charIndex++;
      } else {
        this.stopTyping();
        onDone?.();
      }
    }, this.typewriterSpeed);
  }

  /**
   * ページ単位方式（2行表示）でメッセージをレンダリング
   * @param {string[]} lines 表示する行（最大2行）
   * @param {boolean} hasMore 次のメッセージが存在するか（▼表示の判断用）
   * @param {Function} onComplete 完了コールバック
   */
  renderPage(lines, hasMore, onComplete) {
    this.stopTyping();
    this.clearAutoAdvance();
    this.showIndicator(false);

    const line1 = lines[0] || '';
    const line2 = lines[1] || '';

    this.line1Text = line1;
    this.line2Text = line2;
    if (this.line1El) this.line1El.textContent = '';
    if (this.line2El) this.line2El.textContent = '';

    // 行1をタイプ
    this.typewrite(this.line1El, line1, () => {
      if (line2) {
        // 行2をタイプ
        this.typewrite(this.line2El, line2, () => {
          this._finalizeMessage(hasMore, onComplete);
        });
      } else {
        this._finalizeMessage(hasMore, onComplete);
      }
    });
  }

  /**
   * スクロール方式で新しい1行を追加・描画
   * - 1行目が空なら1行目に描画
   * - 1行目があり2行目が空なら2行目に描画
   * - 2行とも埋まっているなら、2行目を1行目に押し上げ、新しい行を2行目にタイプ描画
   * @param {string} newLineText 
   * @param {boolean} hasMore 
   * @param {Function} onComplete 
   */
  renderScrollLine(newLineText, hasMore, onComplete) {
    this.stopTyping();
    this.clearAutoAdvance();
    this.showIndicator(false);

    // 1行目が空の場合
    if (!this.line1Text) {
      this.line1Text = newLineText;
      this.typewrite(this.line1El, newLineText, () => {
        // 1行目描画後は、後続があっても▼を出さず即座に2行目へ進める
        if (hasMore) {
          onComplete?.();
        } else {
          this._finalizeMessage(false, onComplete);
        }
      });
      return;
    }

    // 1行目があって2行目が空の場合
    if (!this.line2Text) {
      this.line2Text = newLineText;
      this.typewrite(this.line2El, newLineText, () => {
        // 2行目が埋まったので、後続があれば▼を表示して待機
        this._finalizeMessage(hasMore, onComplete);
      });
      return;
    }

    // 両方埋まっている場合：1行目を2行目の内容に更新し、2行目をクリアして新行を描画
    this.line1Text = this.line2Text;
    if (this.line1El) this.line1El.textContent = this.line1Text;

    this.line2Text = newLineText;
    if (this.line2El) this.line2El.textContent = '';

    this.typewrite(this.line2El, newLineText, () => {
      // 2行目が埋まった状態なので、後続があれば▼を表示して待機
      this._finalizeMessage(hasMore, onComplete);
    });
  }

  /**
   * 行描画完了時の後処理（▼インジケータ表示、自動送りタイマー開始など）
   */
  _finalizeMessage(hasMore, onComplete) {
    if (hasMore) {
      this.showIndicator(true);
    } else {
      this.showIndicator(false);
    }

    // 自動送りタイマーが設定されている場合
    if (this.autoAdvanceDelay > 0 && hasMore) {
      this._autoTimer = setTimeout(() => {
        onComplete?.();
      }, this.autoAdvanceDelay);
    } else {
      onComplete?.();
    }
  }
}
