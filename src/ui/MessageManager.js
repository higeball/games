/**
 * MessageManager - メッセージキュー管理・進行制御・重複/連結処理
 * トルネコの大冒険風2行メッセージシステムのコアマネージャー
 */

import { TextFormatter } from './TextFormatter.js';
import { MessageWindowUI } from './MessageWindowUI.js';

export class MessageManager {
  /**
   * @param {string} [containerId='message-window'] 
   * @param {Object} [options]
   * @param {string} [options.updateMode='scroll'] 'scroll' | 'page'
   * @param {number} [options.typewriterSpeed=16] 1文字あたりの描画ミリ秒 (0で瞬時表示)
   * @param {number} [options.autoAdvanceDelay=650] メッセージ完了後の自動送り待機ミリ秒
   * @param {number} [options.maxVisualWidth=19] 1行あたりの最大視覚幅（全角文字数）
   */
  constructor(containerId = 'message-window', options = {}) {
    this.maxVisualWidth = options.maxVisualWidth || 19;
    this.updateMode = options.updateMode || 'scroll';

    this.ui = new MessageWindowUI(containerId, {
      updateMode: this.updateMode,
      typewriterSpeed: options.typewriterSpeed !== undefined ? options.typewriterSpeed : 16,
      autoAdvanceDelay: options.autoAdvanceDelay !== undefined ? options.autoAdvanceDelay : 650,
      onAdvanceRequest: () => this.advance()
    });

    this.queue = []; // 表示待ち行のキュー (string[])
    this.history = []; // 過去の全メッセージ履歴
    this.maxHistory = 100;

    this.isProcessing = false;
    this.hideDelay = options.hideDelay !== undefined ? options.hideDelay : 3000; // 更新停止後3秒で非表示
    this._hideTimer = null;
  }

  _clearHideTimer() {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
  }

  _startHideTimer() {
    this._clearHideTimer();
    if (this.hideDelay > 0) {
      this._hideTimer = setTimeout(() => {
        if (this.queue.length === 0 && !this.isProcessing && !this.ui.isTyping) {
          this.ui.showWindow(false);
        }
      }, this.hideDelay);
    }
  }

  /**
   * メッセージをキューに追加
   * テンプレート変数の置換、自動改行、重複/連結処理を行う
   * @param {string} textOrTemplate テキストまたはテンプレート（例: "{actor}は {item}を ひろった！"）
   * @param {Object} [params] テンプレート置換パラメータ
   */
  addMessage(textOrTemplate, params = null) {
    if (!textOrTemplate) return;

    // メッセージが追加されたら直ちに非表示タイマーを解除し、ウィンドウを表示
    this._clearHideTimer();
    this.ui.showWindow(true);

    // 1. テンプレート変数の置換
    const formattedText = TextFormatter.format(textOrTemplate, params);

    // 履歴に追加
    this.history.push(formattedText);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // 2. 1行最大幅と単語境界を考慮して複数行に分割
    const lines = TextFormatter.splitIntoLines(formattedText, this.maxVisualWidth);

    // 3. キューに追加
    for (const line of lines) {
      if (line.trim().length > 0) {
        this.queue.push(line);
      }
    }

    // キュー処理を開始（アイドル時）
    if (!this.isProcessing) {
      this._processNext();
    }
  }

  /**
   * 複数メッセージの一括追加
   * @param {string[]} linesArray 
   */
  addMessages(linesArray) {
    if (Array.isArray(linesArray)) {
      linesArray.forEach(line => this.addMessage(line));
    }
  }

  /**
   * キューの次のメッセージを処理
   */
  _processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.ui.showIndicator(false);
      this._startHideTimer();
      return;
    }

    this._clearHideTimer();
    this.ui.showWindow(true);
    this.isProcessing = true;

    if (this.updateMode === 'page') {
      // ページ単位更新モード（最大2行をまとめて1ページとして表示）
      const pageLines = [];
      pageLines.push(this.queue.shift());
      if (this.queue.length > 0) {
        pageLines.push(this.queue.shift());
      }

      const hasMore = this.queue.length > 0;
      this.ui.renderPage(pageLines, hasMore, () => {
        if (hasMore) {
          // 自動送りタイマー完了後またはadvance()呼び出しで次へ
          this._processNext();
        } else {
          this.isProcessing = false;
          this._startHideTimer(); // 更新が止まったら3秒後に非表示
        }
      });
    } else {
      // スクロール方式（1行ずつせり上げ）
      const line = this.queue.shift();
      const hasMore = this.queue.length > 0;

      this.ui.renderScrollLine(line, hasMore, () => {
        if (hasMore) {
          this._processNext();
        } else {
          this.isProcessing = false;
          this._startHideTimer(); // 更新が止まったら3秒後に非表示
        }
      });
    }
  }

  /**
   * ユーザー入力（決定キー/Space/タップ等）による進行制御
   * - タイプライター中なら即座にスキップ（全表示）
   * - 完了済みでキューに後続があるなら即座に次へ進む
   * @returns {boolean} メッセージ進行として処理された場合は true、何もしなかった場合は false
   */
  advance() {
    // 1. タイプ中ならスキップを実行
    if (this.ui.isTyping) {
      const skipped = this.ui.skip();
      if (skipped) return true;
    }

    // 2. 自動送りタイマーをクリアして、即座に次のメッセージへ進行
    this.ui.clearAutoAdvance();

    if (this.queue.length > 0) {
      this._processNext();
      return true;
    }

    // 待ち状態（▼表示中）だがキューがちょうど空になった場合
    if (this.ui.isWaitingInput) {
      this.ui.showIndicator(false);
      this._startHideTimer();
      return true;
    }

    this._startHideTimer();
    return false;
  }

  /**
   * 表示方式の切り替え（'scroll' | 'page'）
   * @param {string} mode 
   */
  setUpdateMode(mode) {
    if (mode === 'scroll' || mode === 'page') {
      this.updateMode = mode;
      this.ui.updateMode = mode;
    }
  }

  /**
   * タイプライタースピードの設定（ミリ秒）
   * @param {number} speed 
   */
  setTypewriterSpeed(speed) {
    this.ui.typewriterSpeed = speed;
  }

  /**
   * 自動送り待機時間の設定（ミリ秒、0で自動送りオフ）
   * @param {number} delay 
   */
  setAutoAdvanceDelay(delay) {
    this.ui.autoAdvanceDelay = delay;
  }

  /**
   * 全メッセージとキューをクリア
   */
  clear() {
    this._clearHideTimer();
    this.queue = [];
    this.isProcessing = false;
    this.ui.clear();
    this.ui.showWindow(false);
  }
}
