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

    // バディドック要素
    this.buddyDockEl = document.querySelector('.buddy-dock');
    this.garySubCountEl = document.getElementById('gary-sub-count');
    this.mojiSpeechEl = document.getElementById('moji-speech');
    this.garyDockSpeechEl = document.getElementById('gary-dock-speech');
    this.mojiSpeechTimer = null;
    this.garySpeechTimer = null;

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
    if (this.buddyDockEl) {
      this.buddyDockEl.classList.remove('hidden');
      this.showMojiSpeech("出撃準備よし！", 3.0);
      setTimeout(() => this.showGarySpeech("いつでもいけるよー！", 3.0), 1200);
    }
  }

  startGame(levelTitle) {
    this.titleScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hudEl.classList.remove('hidden');
    if (this.buddyDockEl) this.buddyDockEl.classList.remove('hidden');
    if (this.levelTitleEl) this.levelTitleEl.textContent = levelTitle;

    // 出撃時のバディ掛け合い
    this.showMojiSpeech("ゲイリー、頼んだぞ！", 2.5);
    setTimeout(() => {
      this.showGarySpeech("もじさん、まかせてー！", 2.5);
    }, 1200);
  }

  showMojiSpeech(text, duration = 2.0) {
    if (!this.mojiSpeechEl) return;
    this.mojiSpeechEl.textContent = text;
    this.mojiSpeechEl.classList.add('visible');
    if (this.mojiSpeechTimer) clearTimeout(this.mojiSpeechTimer);
    this.mojiSpeechTimer = setTimeout(() => {
      this.mojiSpeechEl.classList.remove('visible');
    }, duration * 1000);
  }

  showGarySpeech(text, duration = 2.0) {
    if (!this.garyDockSpeechEl) return;
    this.garyDockSpeechEl.textContent = text;
    this.garyDockSpeechEl.classList.add('visible');
    if (this.garySpeechTimer) clearTimeout(this.garySpeechTimer);
    this.garySpeechTimer = setTimeout(() => {
      this.garyDockSpeechEl.classList.remove('visible');
    }, duration * 1000);
  }

  showGameOver(score) {
    document.getElementById('gameover-score').textContent = score.toLocaleString();
    this.gameoverScreen.classList.remove('hidden');
    this.showMojiSpeech("次はリベンジだ！", 3.0);
    setTimeout(() => this.showGarySpeech("もじさん、次こそ勝とう！", 3.0), 1200);
  }

  showClear(score, garyCount, bonusMult) {
    this.clearScoreEl.textContent = score.toLocaleString();
    this.clearGaryEl.textContent = garyCount.toString();
    this.clearBonusEl.textContent = `×${bonusMult.toFixed(1)}`;
    this.clearScreen.classList.remove('hidden');
    this.showGarySpeech("大勝利ーー！！", 3.0);
    setTimeout(() => this.showMojiSpeech("よくやった、ゲイリー！", 3.0), 1200);
  }

  updateHUD(score, garyCount, hp, maxHp, progress) {
    if (this.scoreEl) this.scoreEl.textContent = score.toLocaleString();
    if (this.garyCountEl) {
      const prev = this.lastGaryCount;
      if (prev !== garyCount) {
        this.garyCountEl.textContent = `${garyCount}`;
        if (this.garySubCountEl) this.garySubCountEl.textContent = `${garyCount}`;
        this.lastGaryCount = garyCount;
        this.garyCountEl.parentElement.classList.remove('pop-bounce');
        void this.garyCountEl.parentElement.offsetWidth; // リフロー
        this.garyCountEl.parentElement.classList.add('pop-bounce');

        // ゲイリー数急増時のリアクション
        if (prev !== undefined && garyCount > prev + 5) {
          this.showGarySpeech(`+${garyCount - prev}体増殖！やったー！`, 2.0);
        }
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
