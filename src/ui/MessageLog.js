/**
 * MessageLog - レトロ風メッセージウィンドウ管理
 * ドラゴンクエスト／トルネコ風のテキスト送り＆ログ保持
 */

export class MessageLog {
  constructor(containerId = 'message-window') {
    this.container = document.getElementById(containerId);
    this.messages = [];
    this.maxMessages = 100;
  }

  addMessage(text) {
    if (!text) return;
    this.messages.push(text);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
    this.render();
  }

  addMessages(lines) {
    if (Array.isArray(lines)) {
      lines.forEach(l => this.addMessage(l));
    }
  }

  render() {
    if (!this.container) return;
    // 最新の3行を表示
    const recent = this.messages.slice(-3);
    this.container.innerHTML = recent.map(msg => `<div class="msg-line">${msg}</div>`).join('');
    this.container.scrollTop = this.container.scrollHeight;
  }

  clear() {
    this.messages = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
