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

    this._repeatTimer = null;
    this._repeatInterval = null;
    this._activeBtn = null;

    this._setupDOM();
    this._setupKeyboard();
  }

  stopRepeat() {
    if (this._repeatTimer) {
      clearTimeout(this._repeatTimer);
      this._repeatTimer = null;
    }
    if (this._repeatInterval) {
      clearInterval(this._repeatInterval);
      this._repeatInterval = null;
    }
    this._activeBtn = null;
  }

  _setupDOM() {
    // 8方向D-Padボタン（長押し連続移動対応）
    const dpadBtns = document.querySelectorAll('.dpad-btn');
    dpadBtns.forEach(btn => {
      const dx = parseInt(btn.dataset.dx, 10);
      const dy = parseInt(btn.dataset.dy, 10);

      const handlePress = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stopRepeat();
        this._activeBtn = btn;

        if (dx === 0 && dy === 0) {
          this.onWait();
          return;
        }

        if (this.turnOnlyMode) {
          this.onChangeDirection(dx, dy);
          this.setTurnOnlyMode(false); // 1回向きを変えたら通常モードに戻す
          return;
        }

        // 初回移動を即座に実行
        this.onMove(dx, dy);

        // 長押しで連続移動（220ms後に開始、110ms間隔）
        this._repeatTimer = setTimeout(() => {
          this._repeatInterval = setInterval(() => {
            this.onMove(dx, dy);
          }, 110);
        }, 220);
      };

      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('mousedown', handlePress);

      const handleRelease = (e) => {
        if (this._activeBtn === btn) {
          this.stopRepeat();
        }
      };

      btn.addEventListener('touchend', handleRelease);
      btn.addEventListener('touchcancel', handleRelease);
      btn.addEventListener('mouseup', handleRelease);
      btn.addEventListener('mouseleave', handleRelease);
    });

    // グローバル解放リスナー（指やマウスがボタン外に外れた時の解除）
    window.addEventListener('mouseup', () => this.stopRepeat());
    window.addEventListener('touchend', () => this.stopRepeat());
    window.addEventListener('touchcancel', () => this.stopRepeat());
    window.addEventListener('blur', () => this.stopRepeat());

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
    bindBtn('btn-shoot', () => this.onShootArrow());
    bindBtn('btn-map', () => this.onToggleMap());

    // 足踏みボタン（長押し連続足踏み対応）
    const waitBtn = document.getElementById('btn-wait');
    if (waitBtn) {
      const handleWaitPress = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stopRepeat();
        this._activeBtn = waitBtn;
        this.onWait();

        this._repeatTimer = setTimeout(() => {
          this._repeatInterval = setInterval(() => {
            this.onWait();
          }, 120);
        }, 220);
      };

      waitBtn.addEventListener('touchstart', handleWaitPress, { passive: false });
      waitBtn.addEventListener('mousedown', handleWaitPress);

      const handleWaitRelease = () => {
        if (this._activeBtn === waitBtn) {
          this.stopRepeat();
        }
      };
      waitBtn.addEventListener('touchend', handleWaitRelease);
      waitBtn.addEventListener('touchcancel', handleWaitRelease);
      waitBtn.addEventListener('mouseup', handleWaitRelease);
      waitBtn.addEventListener('mouseleave', handleWaitRelease);
    }

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
