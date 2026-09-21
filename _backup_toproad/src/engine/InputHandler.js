import { CONFIG } from '../config.js';

/**
 * スマートフォン（Touch/Pointer）およびPC（Mouse/Keyboard）向けの超高レスポンス入力管理
 */
export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.targetX = 0;      // 目標X座標 (-TRACK_LIMIT ~ +TRACK_LIMIT)
    this.currentX = 0;     // 現在X座標 (Lerp補間用)
    this.isDragging = false;
    this.lastPointerX = 0;

    this.trackLimit = (CONFIG.TRACK_WIDTH / 2) - 0.7; // 画面外に出ないマージン
    this.sensitivity = 1.35; // スワイプ感度

    this.keys = { left: false, right: false };

    this.initEvents();
  }

  initEvents() {
    const onPointerDown = (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const deltaX = clientX - this.lastPointerX;
      this.lastPointerX = clientX;

      // 画面幅に応じた正規化移動量（どの画面サイズでも同じ感覚）
      const normalizedDelta = (deltaX / window.innerWidth) * CONFIG.TRACK_WIDTH * 1.8 * this.sensitivity;
      this.targetX = Math.max(-this.trackLimit, Math.min(this.trackLimit, this.targetX + normalizedDelta));
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    // Pointer & Touch Events
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    // Keyboard Fallback (PC/Mac用)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
    });
  }

  update(delta) {
    // キーボード操作の反映
    if (this.keys.left) {
      this.targetX = Math.max(-this.trackLimit, this.targetX - CONFIG.MOJI.SPEED_X * delta);
    }
    if (this.keys.right) {
      this.targetX = Math.min(this.trackLimit, this.targetX + CONFIG.MOJI.SPEED_X * delta);
    }

    // スムーズなLerp補間（指の動きに吸い付くように追従）
    const lerpSpeed = 22.0;
    this.currentX += (this.targetX - this.currentX) * Math.min(1.0, delta * lerpSpeed);

    return this.currentX;
  }

  reset() {
    this.targetX = 0;
    this.currentX = 0;
    this.isDragging = false;
  }
}
