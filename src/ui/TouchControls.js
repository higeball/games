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

    this.holdingDir = null; // 長押し移動中の方向 {dx, dy, startTime}
    this.isContinuousMoving = false; // 長押し連続移動中フラグ（2歩目以降）
    this.isHoldingWait = false; // 長押し足踏み中フラグ
    this.isSlidingTurn = false; // 向きボタンスライド操作中フラグ
    this.turnSlideCenter = null; // 向きボタンスライド中心座標
    this.turnHasMoved = false; // スライド操作で移動したか

    this._setupDOM();
    this._setupKeyboard();
  }

  stopRepeat() {
    this.holdingDir = null;
    this.isContinuousMoving = false;
    this.isHoldingWait = false;
  }

  _setupDOM() {
    // 8方向D-Padボタン（長押しシームレス連続移動対応）
    const dpadBtns = document.querySelectorAll('.dpad-btn[data-dx]');
    dpadBtns.forEach(btn => {
      const dx = parseInt(btn.dataset.dx, 10);
      const dy = parseInt(btn.dataset.dy, 10);

      const handlePress = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // メッセージがタイプ中または送り待ち中なら、メッセージ進行を優先
        if (this.onAdvanceMessage && this.onAdvanceMessage()) {
          return;
        }

        if (dx === 0 && dy === 0) {
          this.isHoldingWait = true;
          this.onWait();
          return;
        }

        if (this.turnOnlyMode) {
          this.onChangeDirection(dx, dy);
          this.updateDpadFacing({ dx, dy });
          return;
        }

        // 初回移動を即座に実行し、押下開始時刻を記録（チョン押しと長押しを識別して意図しない2歩目を完全防止）
        this.holdingDir = { dx, dy, startTime: Date.now() };
        this.isContinuousMoving = false;
        this.onMove(dx, dy);
      };

      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('mousedown', handlePress);

      const handleRelease = (e) => {
        if (this.holdingDir && this.holdingDir.dx === dx && this.holdingDir.dy === dy) {
          this.holdingDir = null;
          this.isContinuousMoving = false;
        }
        if (dx === 0 && dy === 0) {
          this.isHoldingWait = false;
        }
      };

      btn.addEventListener('touchend', handleRelease);
      btn.addEventListener('touchcancel', handleRelease);
      btn.addEventListener('mouseup', handleRelease);
      btn.addEventListener('mouseleave', handleRelease);
    });

    // グローバル解放リスナー（指やマウスがボタン外に外れた時の完全解除）
    const releaseAll = () => {
      this.holdingDir = null;
      this.isContinuousMoving = false;
      this.isHoldingWait = false;
    };
    window.addEventListener('mouseup', releaseAll);
    window.addEventListener('touchend', releaseAll);
    window.addEventListener('touchcancel', releaseAll);
    window.addEventListener('blur', releaseAll);

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

        if (this.onAdvanceMessage && this.onAdvanceMessage()) {
          return;
        }

        this.setTurnOnlyMode(false);
        this.isHoldingWait = true;
        this.onWait();
      };

      waitBtn.addEventListener('touchstart', handleWaitPress, { passive: false });
      waitBtn.addEventListener('mousedown', handleWaitPress);

      const handleWaitRelease = () => {
        this.isHoldingWait = false;
      };
      waitBtn.addEventListener('touchend', handleWaitRelease);
      waitBtn.addEventListener('touchcancel', handleWaitRelease);
      waitBtn.addEventListener('mouseup', handleWaitRelease);
      waitBtn.addEventListener('mouseleave', handleWaitRelease);
    }

    // 移動キー中央の向きボタン（タップ＆スライド8方向向き変更UI）
    const turnBtn = document.getElementById('btn-turn');
    if (turnBtn) {
      const startSlideTurn = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isSlidingTurn = true;
        this.turnHasMoved = false;

        const rect = turnBtn.getBoundingClientRect();
        this.turnSlideCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };

        // 向きモード表示（8方向矢印サークル出現）
        this.setTurnOnlyMode(true);
      };

      turnBtn.addEventListener('touchstart', startSlideTurn, { passive: false });
      turnBtn.addEventListener('mousedown', startSlideTurn);

      // スライド移動検知（ウィンドウ全体でタッチ位置を追跡）
      const onMoveSlideTurn = (e) => {
        if (!this.isSlidingTurn || !this.turnSlideCenter) return;
        e.preventDefault();

        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - this.turnSlideCenter.x;
        const dy = touch.clientY - this.turnSlideCenter.y;
        const dist = Math.hypot(dx, dy);

        // 14px以上スライドしたら向き変更
        if (dist >= 14) {
          this.turnHasMoved = true;
          const angle = Math.atan2(dy, dx); // -PI to PI
          // 8方向判定（各45度 = PI/4）
          // 0:右, 1:右下, 2:下, 3:左下, 4/-4:左, -3:左上, -2:上, -1:右上
          const octant = Math.round(angle / (Math.PI / 4));
          let dirX = 0, dirY = 0;
          switch (octant) {
            case 0: dirX = 1; dirY = 0; break;
            case 1: dirX = 1; dirY = 1; break;
            case 2: dirX = 0; dirY = 1; break;
            case 3: dirX = -1; dirY = 1; break;
            case 4:
            case -4: dirX = -1; dirY = 0; break;
            case -3: dirX = -1; dirY = -1; break;
            case -2: dirX = 0; dirY = -1; break;
            case -1: dirX = 1; dirY = -1; break;
          }

          this.onChangeDirection(dirX, dirY);
          this.updateDpadFacing({ dx: dirX, dy: dirY });
        }
      };

      window.addEventListener('touchmove', onMoveSlideTurn, { passive: false });
      window.addEventListener('mousemove', onMoveSlideTurn);

      // 指を離したときの判定
      const endSlideTurn = (e) => {
        if (!this.isSlidingTurn) return;
        this.isSlidingTurn = false;

        if (this.turnHasMoved) {
          // スライドして向きを変えた場合：向き変更を確定し、即座に通常モードへ復帰
          this.setTurnOnlyMode(false);
        } else {
          // スライドせず単にタップした場合：トグル動作（向き変更モードON/OFF切り替え）
          const nextMode = !this.turnOnlyMode;
          this.setTurnOnlyMode(nextMode);
        }
      };

      window.addEventListener('touchend', endSlideTurn);
      window.addEventListener('touchcancel', endSlideTurn);
      window.addEventListener('mouseup', endSlideTurn);
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
