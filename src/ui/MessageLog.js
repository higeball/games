/**
 * MessageLog - トルネコの大冒険風 2行メッセージウィンドウ管理
 * MessageManager / MessageWindowUI / TextFormatter の統合エントリポイント
 */

import { MessageManager } from './MessageManager.js';
import { TextFormatter } from './TextFormatter.js';
import { MessageWindowUI } from './MessageWindowUI.js';

export { MessageManager, TextFormatter, MessageWindowUI };

export class MessageLog extends MessageManager {
  constructor(containerId = 'message-window', options = {}) {
    super(containerId, options);
  }
}
