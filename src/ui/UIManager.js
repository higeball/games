export class UIManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks; // onStart, onRestart, onNextStage, onToggleMute

    this.hudEl = document.getElementById('hud');
    this.garyCountEl = document.getElementById('gary-count');
    this.scoreEl = document.getElementById('score-val');
    this.progressFillEl = document.getElementById('progress-fill');
    this.hpFillEl = document.getElementById('hp-fill');

    this.titleScreen = document.getElementById('title-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.clearScreen = document.getElementById('clear-screen');

    this.muteBtn = document.getElementById('mute-btn');
    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.nextBtn = document.getElementById('next-btn');

    this.clearScoreEl = document.getElementById('clear-score');
    this.clearGaryEl = document.getElementById('clear-gary');
    this.clearBonusEl = document.getElementById('clear-bonus');
    this.levelTitleEl = document.getElementById('level-title');

    this.bindEvents();
  }

  bindEvents() {
    if (this.startBtn) {
      this.startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onStart) this.callbacks.onStart();
      });
      // モバイルでタップの反応を早くする
      this.startBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.callbacks.onStart) this.callbacks.onStart();
      });
    }

    if (this.restartBtn) {
      const handleRestart = (e) => {
        e.stopPropagation();
        if (this.callbacks.onRestart) this.callbacks.onRestart();
      };
      this.restartBtn.addEventListener('click', handleRestart);
      this.restartBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleRestart(e); });
    }

    if (this.nextBtn) {
      const handleNext = (e) => {
        e.stopPropagation();
        if (this.callbacks.onNextStage) this.callbacks.onNextStage();
      };
      this.nextBtn.addEventListener('click', handleNext);
      this.nextBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleNext(e); });
    }

    if (this.muteBtn) {
      this.muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onToggleMute) {
          const isMuted = this.callbacks.onToggleMute();
          this.muteBtn.textContent = isMuted ? '🔇' : '🔊';
        }
      });
    }
  }

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hudEl.classList.add('hidden');
  }

  startGame(levelTitle) {
    this.titleScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hudEl.classList.remove('hidden');
    if (this.levelTitleEl) this.levelTitleEl.textContent = levelTitle;
  }

  showGameOver(score) {
    document.getElementById('gameover-score').textContent = score.toLocaleString();
    this.gameoverScreen.classList.remove('hidden');
  }

  showClear(score, garyCount, bonusMult) {
    this.clearScoreEl.textContent = score.toLocaleString();
    this.clearGaryEl.textContent = garyCount.toString();
    this.clearBonusEl.textContent = `×${bonusMult.toFixed(1)}`;
    this.clearScreen.classList.remove('hidden');
  }

  updateHUD(score, garyCount, hp, maxHp, progress) {
    if (this.scoreEl) this.scoreEl.textContent = score.toLocaleString();
    if (this.garyCountEl) {
      const prev = this.lastGaryCount;
      if (prev !== garyCount) {
        this.garyCountEl.textContent = `${garyCount}`;
        this.lastGaryCount = garyCount;
        this.garyCountEl.parentElement.classList.remove('pop-bounce');
        void this.garyCountEl.parentElement.offsetWidth; // リフロー
        this.garyCountEl.parentElement.classList.add('pop-bounce');
      }
    }
    if (this.hpFillEl) {
      const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      this.hpFillEl.style.width = `${hpPct}%`;
    }
    if (this.progressFillEl) {
      const pPct = Math.max(0, Math.min(100, progress * 100));
      this.progressFillEl.style.width = `${pPct}%`;
    }
  }
}
