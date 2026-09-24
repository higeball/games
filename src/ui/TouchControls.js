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
    this.onTurnModeChange = options.onTurnModeChange || (() => {});
    this.getCurrentDirection = options.getCurrentDirection || (() => ({ dx: 0, dy: 1 }));
    this.onAdvanceMessage = options.onAdvanceMessage || null;

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
    const dpadBtns = document.querySelectorAll('.dpad-btn[data-dx]');
    dpadBtns.forEach(btn => {
      const dx = parseInt(btn.dataset.dx, 10);
      const dy = parseInt(btn.dataset.dy, 10);

      const handlePress = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stopRepeat();
        this._activeBtn = btn;

        // メッセージがタイプ中または送り待ち中なら、メッセージ進行を優先
        if (this.onAdvanceMessage && this.onAdvanceMessage()) {
          return;
        }

        if (dx === 0 && dy === 0) {
          this.onWait();
          return;
        }

        if (this.turnOnlyMode) {
          this.onChangeDirection(dx, dy);
          this.updateDpadFacing({ dx, dy });
          return;
        }

        // 初回移動を即座に実行
        this.onMove(dx, dy);

        // 長押しでスムーズに連続移動（待機時間を通常の移動間隔と同じ110msにし、一歩目で止まることなくスムーズに走る）
        this._repeatTimer = setTimeout(() => {
          this._repeatInterval = setInterval(() => {
            this.onMove(dx, dy);
          }, 110);
        }, 110);
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

    // アクションボタン
    const bindBtn = (id, handler) => {
      const el = document.getElementById(id);
      if (el) {
        const cb = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.onAdvanceMessage && this.onAdvanceMessage()) {
            return;
          }
          handler();
        };
        el.addEventListener('touchstart', cb, { passive: false });
        el.addEventListener('click', cb);
      }
    };

    bindBtn('btn-attack', () => {
      this.setTurnOnlyMode(false);
      this.onAttack();
    });
    bindBtn('btn-inventory', () => {
      this.setTurnOnlyMode(false);
      this.onInventory();
    });
    bindBtn('btn-shoot', () => {
      this.setTurnOnlyMode(false);
      this.onShootArrow();
    });
    bindBtn('btn-map', () => this.onToggleMap());

    // 足踏みボタン（長押し連続足踏み対応）
    const waitBtn = document.getElementById('btn-wait');
    if (waitBtn) {
      const handleWaitPress = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stopRepeat();
        this._activeBtn = waitBtn;

        if (this.onAdvanceMessage && this.onAdvanceMessage()) {
          return;
        }

        this.setTurnOnlyMode(false);
        this.onWait();

        this._repeatTimer = setTimeout(() => {
          this._repeatInterval = setInterval(() => {
            this.onWait();
          }, 110);
        }, 110);
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

    // 移動キー中央の向きボタン
    const turnBtn = document.getElementById('btn-turn');
    if (turnBtn) {
      const toggleTurn = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextMode = !this.turnOnlyMode;
        const curDir = this.getCurrentDirection();
        this.setTurnOnlyMode(nextMode, curDir);
      };
      turnBtn.addEventListener('touchstart', toggleTurn, { passive: false });
      turnBtn.addEventListener('click', toggleTurn);
    }
  }

  setTurnOnlyMode(val, currentDir = null) {
    this.turnOnlyMode = val;
    const turnBtn = document.getElementById('btn-turn');
    const dpadContainer = document.getElementById('dpad-container');
    if (turnBtn) {
      if (this.turnOnlyMode) {
        turnBtn.classList.add('active');
      } else {
        turnBtn.classList.remove('active');
      }
    }
    if (dpadContainer) {
      if (this.turnOnlyMode) {
        dpadContainer.classList.add('turn-mode');
      } else {
        dpadContainer.classList.remove('turn-mode');
      }
    }
    if (this.turnOnlyMode) {
      const dir = currentDir || this.getCurrentDirection();
      this.updateDpadFacing(dir);
    } else {
      this.clearDpadFacing();
    }
    this.onTurnModeChange(this.turnOnlyMode);
  }

  updateDpadFacing(dir) {
    if (!dir) return;
    this.clearDpadFacing();
    const dpadBtns = document.querySelectorAll('.dpad-btn[data-dx]');
    dpadBtns.forEach(btn => {
      const bdx = parseInt(btn.dataset.dx, 10);
      const bdy = parseInt(btn.dataset.dy, 10);
      if (bdx === dir.dx && bdy === dir.dy) {
        btn.classList.add('current-facing');
      }
    });
  }

  clearDpadFacing() {
    const dpadBtns = document.querySelectorAll('.dpad-btn');
    dpadBtns.forEach(btn => btn.classList.remove('current-facing'));
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // モーダルが開いている時はESCで閉じる
      if (e.key === 'Escape') {
        this.onInventory('close');
        return;
      }

      // メッセージがタイプ中または送り待ち中なら、メッセージ進行を最優先して入力を消費
      if (this.onAdvanceMessage && this.onAdvanceMessage()) {
        e.preventDefault();
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
          this.updateDpadFacing({ dx, dy });
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
