/**
 * TitleScreen - タイトル画面＆オープニングストーリー進行管理
 * 「はじめから」「つづきから」の選択、オフィストイレ脱出ストーリーの進行
 */

import { SaveManager } from '../storage/SaveManager.js';
import { soundManager } from '../audio/SoundManager.js';

export class TitleScreen {
  constructor(game) {
    this.game = game;
    this.titleEl = document.getElementById('title-screen');
    this.storyModal = document.getElementById('story-modal');
    this.storyTextEl = document.getElementById('story-body-text');
    this.storyPageEl = document.getElementById('story-page-indicator');
    this.btnNext = document.getElementById('btn-story-next');
    this.btnSkip = document.getElementById('btn-story-skip');

    this.btnNew = document.getElementById('btn-title-new');
    this.btnContinue = document.getElementById('btn-title-continue');
    this.saveInfoEl = document.getElementById('save-info-text');

    // 難易度モーダル関連
    this.diffModal = document.getElementById('difficulty-modal');
    this.diffChoiceNormal = document.getElementById('diff-choice-normal');
    this.diffChoiceHard = document.getElementById('diff-choice-hard');
    this.btnDiffCancel = document.getElementById('btn-diff-cancel');
    this.selectedDifficulty = 'normal';

    this.currentStoryPage = 0;
    this.storyPages = [
      {
        title: '【緊急事態発生】',
        time: '🕒 12:40 PM',
        image: './character/opening/01-stomach-emergency.png',
        lines: [
          '大手IT企業「株式会社もじ」が入居する 地上50階建てのオフィスタワー。',
          '社員食堂で 激辛大盛りカレーを堪能した 会社員・もじさん。',
          '食後の至福のひとときを 過ごしていたその時……！',
          '――ドクンッ！！',
          '突如、下腹部に激しい雷鳴が轟いた！！'
        ]
      },
      {
        title: '【絶望のカウントダウン】',
        time: '🕒 12:42 PM',
        image: './character/opening/02-restroom-closed.png',
        lines: [
          'もじさん「う、うぐぐっ……！？ なんだこの激痛は……！？」',
          '「ヤバい……！ 今すぐトイレに行かないと 社会人生命が終わる……！！」',
          '脂汗を流しながら 50F レストラン街のトイレへ 駆け込むも、',
          '扉には無慈悲な張り紙が……！',
          '『【配管破裂のため 全面使用禁止】』'
        ]
      },
      {
        title: '【閉ざされたエレベーター】',
        time: '🕒 12:45 PM',
        image: './character/opening/03-elevators-stopped.png',
        lines: [
          'もじさん「そ、そんなバカな……ッ！？」',
          '急いでエレベーターホールへ走るも、そこにも無情な警告灯！',
          '『【法定定期点検中：全機停止（12:00〜13:30）】』',
          '重厚なステンレスの扉は ピクリとも動かない……！',
          '絶望的な状況の中、フロアに館内アナウンスが響き渡る――'
        ]
      },
      {
        title: '【奇跡の案内】',
        time: '🕒 12:47 PM',
        image: './character/opening/04-fortieth-floor-announcement.png',
        lines: [
          '『ピンポンパンポーン――』',
          '『現在、館内で使用可能な最寄りのトイレは…… 【40階】となります。』',
          'もじさん「よ、40階……！？ ここから非常階段で 10フロアも降りるのか……！？」',
          '午後の始業時間は【13:00】。 残された時間はあとわずか13分……！！'
        ]
      },
      {
        title: '【非常階段へ突入せよ！】',
        time: '🕒 12:48 PM',
        image: './character/opening/05-emergency-stairs.png',
        lines: [
          'もじさん「非常階段を駆け降りるしかない……！」',
          '「頼む、俺の腹……！ 40Fまで持ちこたえてくれ……ッ！！」',
          '装備も荷物もすべて投げ捨て、身一つで非常扉を蹴破ったもじさん。',
          'オフィスを彷徨う残業モンスターや 数々の障害を突破し、',
          '40Fの【奇跡のトイレ個室】へ辿り着け！！'
        ]
      }
    ];

    this.initEvents();
  }

  initEvents() {
    // はじめから（難易度選択モーダルを開く）
    this.btnNew?.addEventListener('click', () => {
      soundManager.playConfirm();
      this.openDifficultySelect();
    });

    // 難易度カード選択
    this.diffChoiceNormal?.addEventListener('click', () => {
      soundManager.playConfirm();
      this.selectedDifficulty = 'normal';
      this.closeDifficultySelect();
      this.startOpeningStory();
    });

    this.diffChoiceHard?.addEventListener('click', () => {
      soundManager.playConfirm();
      this.selectedDifficulty = 'hard';
      this.closeDifficultySelect();
      this.startOpeningStory();
    });

    this.btnDiffCancel?.addEventListener('click', () => {
      soundManager.playCursor?.();
      this.closeDifficultySelect();
    });

    // つづきから
    this.btnContinue?.addEventListener('click', () => {
      if (!SaveManager.hasSaveData()) return;
      soundManager.playConfirm();
      this.continueGame();
    });

    // ストーリー「次へ」
    this.btnNext?.addEventListener('click', () => {
      soundManager.playStep();
      this.nextStoryPage();
    });

    // ストーリー「スキップ」
    this.btnSkip?.addEventListener('click', () => {
      soundManager.playConfirm();
      this.finishStoryAndStart();
    });

    // キーボード操作対応
    window.addEventListener('keydown', (e) => {
      // 難易度選択中のキーボード操作
      if (this.diffModal && !this.diffModal.classList.contains('hidden')) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          soundManager.playCursor?.();
          const isNormal = this.diffChoiceNormal?.classList.contains('selected');
          if (isNormal) {
            this.diffChoiceNormal?.classList.remove('selected');
            this.diffChoiceHard?.classList.add('selected');
          } else {
            this.diffChoiceHard?.classList.remove('selected');
            this.diffChoiceNormal?.classList.add('selected');
          }
        } else if (e.key === 'Enter') {
          soundManager.playConfirm();
          const isHard = this.diffChoiceHard?.classList.contains('selected');
          this.selectedDifficulty = isHard ? 'hard' : 'normal';
          this.closeDifficultySelect();
          this.startOpeningStory();
        } else if (e.key === 'Escape') {
          soundManager.playCursor?.();
          this.closeDifficultySelect();
        }
        return;
      }

      if (!this.titleEl || this.titleEl.classList.contains('hidden')) {
        if (this.storyModal && !this.storyModal.classList.contains('hidden')) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
            this.nextStoryPage();
          } else if (e.key === 'Escape') {
            this.finishStoryAndStart();
          }
        }
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // カーソル切り替え
        this._toggleMenuCursor();
      } else if (e.key === 'Enter') {
        const isContinueSelected = this.btnContinue?.classList.contains('selected');
        if (isContinueSelected && SaveManager.hasSaveData()) {
          soundManager.playConfirm();
          this.continueGame();
        } else {
          soundManager.playConfirm();
          this.openDifficultySelect();
        }
      }
    });
  }

  openDifficultySelect() {
    this.diffModal?.classList.remove('hidden');
    this.diffChoiceNormal?.classList.add('selected');
    this.diffChoiceHard?.classList.remove('selected');
  }

  closeDifficultySelect() {
    this.diffModal?.classList.add('hidden');
  }

  /**
   * タイトル画面を表示
   */
  show() {
    this.titleEl?.classList.remove('hidden');
    this.storyModal?.classList.add('hidden');

    // セーブデータ確認
    if (SaveManager.hasSaveData()) {
      this.btnContinue?.classList.remove('disabled');
      const summary = SaveManager.getSaveSummary();
      if (summary && this.saveInfoEl) {
        const diffTag = summary.difficulty === 'hard' ? ' (Hard)' : '';
        this.saveInfoEl.textContent = `[${summary.floorDisplay} Lv${summary.level}${diffTag}]`;
      }
    } else {
      this.btnContinue?.classList.add('disabled');
      if (this.saveInfoEl) {
        this.saveInfoEl.textContent = '（データなし）';
      }
    }

    this.btnNew?.classList.add('selected');
    this.btnContinue?.classList.remove('selected');
  }

  hide() {
    this.titleEl?.classList.add('hidden');
    this.diffModal?.classList.add('hidden');
    this.storyModal?.classList.add('hidden');
  }

  startOpeningStory() {
    this.titleEl?.classList.add('hidden');
    this.diffModal?.classList.add('hidden');
    this.storyModal?.classList.remove('hidden');
    this.currentStoryPage = 0;
    this.renderStoryPage();
  }

  nextStoryPage() {
    this.currentStoryPage++;
    if (this.currentStoryPage >= this.storyPages.length) {
      this.finishStoryAndStart();
    } else {
      this.renderStoryPage();
    }
  }

  renderStoryPage() {
    const page = this.storyPages[this.currentStoryPage];
    if (!page) return;

    const titleEl = document.getElementById('story-header-title');
    const timeEl = document.getElementById('story-header-time');
    const imgEl = document.getElementById('story-image');
    if (titleEl) titleEl.textContent = page.title;
    if (timeEl) timeEl.textContent = page.time;
    if (imgEl && page.image) {
      imgEl.src = page.image;
    }

    if (this.storyPageEl) {
      this.storyPageEl.textContent = `${this.currentStoryPage + 1} / ${this.storyPages.length}`;
    }

    if (this.storyTextEl) {
      this.storyTextEl.innerHTML = page.lines
        .map(line => `<div class="story-line">${line}</div>`)
        .join('');
    }

    if (this.btnNext) {
      this.btnNext.textContent = (this.currentStoryPage === this.storyPages.length - 1)
        ? '50Fへ突入！ ▶'
        : '次へ ▶';
    }
  }

  finishStoryAndStart() {
    this.hide();
    this.game.startNewGame(this.selectedDifficulty);
  }

  continueGame() {
    const success = SaveManager.loadGame(this.game);
    if (success) {
      this.hide();
    } else {
      alert('セーブデータの読み込みに失敗しました。');
      this.show();
    }
  }

  _toggleMenuCursor() {
    if (!SaveManager.hasSaveData()) return;
    const isNew = this.btnNew?.classList.contains('selected');
    if (isNew) {
      this.btnNew?.classList.remove('selected');
      this.btnContinue?.classList.add('selected');
      soundManager.playCursor?.();
    } else {
      this.btnContinue?.classList.remove('selected');
      this.btnNew?.classList.add('selected');
      soundManager.playCursor?.();
    }
  }
}
