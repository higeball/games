/**
 * TouchControls - スマホ向け8方向バーチャルパッド＆アクションボタン＆キーボード連携
 */

export class TouchControls {
  constructor(options = {}) {
    this.onMove = options.onMove || (() => {});
    this.onAttack = options.onAttack || (() => {});
    this.onWait = options.onWait || (() => {});
    this.onInventory = options.onInventory || (() => {});
    this.onShootArrow = options.onShootArrow || (() => {});
    this.onToggleMap = options.onToggleMap || (() => {});
    this.onChangeDirection = options.onChangeDirection || (() => {});

    this.turnOnlyMode = false; // 向き変更のみモード

    this._setupDOM();
    this._setupKeyboard();
  }

  _setupDOM() {
    // 8方向D-Padボタン
    const dpadBtns = document.querySelectorAll('.dpad-btn');
    dpadBtns.forEach(btn => {
      const dx = parseInt(btn.dataset.dx, 10);
      const dy = parseInt(btn.dataset.dy, 10);

      const trigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dx === 0 && dy === 0) {
          // 中央ボタンは足踏み
          this.onWait();
        } else {
          if (this.turnOnlyMode) {
            this.onChangeDirection(dx, dy);
            this.setTurnOnlyMode(false); // 1回向きを変えたら通常モードに戻す
          } else {
            this.onMove(dx, dy);
          }
        }
      };

      btn.addEventListener('touchstart', trigger, { passive: false });
      btn.addEventListener('mousedown', trigger);
    });

    // 右側アクションボタン
    const bindBtn = (id, handler) => {
      const el = document.getElementById(id);
      if (el) {
        const cb = (e) => {
          e.preventDefault();
          e.stopPropagation();
          handler();
        };
        el.addEventListener('touchstart', cb, { passive: false });
        el.addEventListener('click', cb);
      }
    };

    bindBtn('btn-attack', () => this.onAttack());
    bindBtn('btn-inventory', () => this.onInventory());
    bindBtn('btn-wait', () => this.onWait());
    bindBtn('btn-shoot', () => this.onShootArrow());
    bindBtn('btn-map', () => this.onToggleMap());

    const turnBtn = document.getElementById('btn-turn');
    if (turnBtn) {
      const toggleTurn = (e) => {
        e.preventDefault();
        this.setTurnOnlyMode(!this.turnOnlyMode);
      };
      turnBtn.addEventListener('touchstart', toggleTurn, { passive: false });
      turnBtn.addEventListener('click', toggleTurn);
    }
  }

  setTurnOnlyMode(val) {
    this.turnOnlyMode = val;
    const turnBtn = document.getElementById('btn-turn');
    if (turnBtn) {
      if (this.turnOnlyMode) {
        turnBtn.classList.add('active');
      } else {
        turnBtn.classList.remove('active');
      }
    }
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // モーダルが開いている時はESCで閉じる
      if (e.key === 'Escape') {
        this.onInventory('close');
        return;
      }

      let dx = 0;
      let dy = 0;
      let isDirKey = false;

      // 8方向移動キー（矢印キー、テンキー、Viキー）
      switch (e.key) {
        case 'ArrowUp':
        case 'k':
        case '8':
          dy = -1; isDirKey = true; break;
        case 'ArrowDown':
        case 'j':
        case '2':
          dy = 1; isDirKey = true; break;
        case 'ArrowLeft':
        case 'h':
        case '4':
          dx = -1; isDirKey = true; break;
        case 'ArrowRight':
        case 'l':
        case '6':
          dx = 1; isDirKey = true; break;

        // 斜め（テンキー / Vi）
        case '7':
        case 'y':
          dx = -1; dy = -1; isDirKey = true; break;
        case '9':
        case 'u':
          dx = 1; dy = -1; isDirKey = true; break;
        case '1':
        case 'b':
          dx = -1; dy = 1; isDirKey = true; break;
        case '3':
        case 'n':
          dx = 1; dy = 1; isDirKey = true; break;

        // アクション
        case ' ': // 攻撃
        case 'Enter':
          e.preventDefault();
          this.onAttack();
          return;
        case 'i': // 道具
        case 'e':
          e.preventDefault();
          this.onInventory();
          return;
        case 'x': // 足踏み
        case '.':
        case '5':
          e.preventDefault();
          this.onWait();
          return;
        case 'f': // 矢を射る
          e.preventDefault();
          this.onShootArrow();
          return;
        case 'm': // マップ切替
          e.preventDefault();
          this.onToggleMap();
          return;
        case 'Shift':
        case 'z':
          this.setTurnOnlyMode(true);
          return;
      }

      if (isDirKey) {
        e.preventDefault();
        if (e.shiftKey || this.turnOnlyMode) {
          this.onChangeDirection(dx, dy);
          this.setTurnOnlyMode(false);
        } else {
          this.onMove(dx, dy);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this.setTurnOnlyMode(false);
      }
    });
  }
}
