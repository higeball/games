/**
 * TitleScreen - タイトル画面＆オープニングストーリー進行管理
 * 「はじめから」「つづきから」の選択、オフィストイレ脱出ストーリーの進行
 */

import { SaveManager } from '../storage/SaveManager.js';
import { soundManager } from '../audio/SoundManager.js';

export class TitleScreen {
  constructor(game) {
    this.game = game;
    this.portalEl = document.getElementById('portal-screen');
    this.btnPortalPlayMojidan = document.getElementById('btn-portal-play-mojidan');

    this.titleEl = document.getElementById('title-screen');
    this.btnTitlePortal = document.getElementById('btn-title-portal');
    this.storyModal = document.getElementById('story-modal');
    this.storyTextEl = document.getElementById('story-body-text');
    this.storyPageEl = document.getElementById('story-page-indicator');
    this.btnNext = document.getElementById('btn-story-next');
    this.btnSkip = document.getElementById('btn-story-skip');

    this.btnNew = document.getElementById('btn-title-new');
    this.btnContinue = document.getElementById('btn-title-continue');
    this.saveInfoEl = document.getElementById('save-info-text');

    this.currentMenuIndex = 0; // 0: new, 1: continue, 2: portal

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
        image: './character/opening/01-stomach-emergency.webp',
        lines: [
          '大手IT企業「株式会社ヒゲボール」が入居する 地上50階建てのオフィスタワー。',
          '社員食堂で 激辛大盛りカレーを堪能した 会社員・もじさん。',
          '食後の至福のひとときを 過ごしていたその時……！',
          '――ドクンッ！！',
          '突如、下腹部に激しい雷鳴が轟いた！！'
        ]
      },
      {
        title: '【絶望のカウントダウン】',
        time: '🕒 12:42 PM',
        image: './character/opening/02-restroom-closed.webp',
        lines: [
          'もじさん「う、うぐぐっ……！？ なんだこの激痛は……！？」',
          '「ヤバい……！ 今すぐトイレに行かないと',
          ' 社会人生命が終わってしまう……！！」',
          '脂汗を流しながら 50Fレストラン街のトイレへ駆け込むも、',
          '扉には無慈悲な張り紙が……！',
          '『【配管破裂のため 全面使用禁止】』'
        ]
      },
      {
        title: '【閉ざされたエレベーター】',
        time: '🕒 12:45 PM',
        image: './character/opening/03-elevators-stopped.webp',
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
        image: './character/opening/04-fortieth-floor-announcement.webp',
        lines: [
          '『ピンポンパンポーン――』',
          '『現在、館内で使用可能な最寄りのトイレは……',
          ' 【40階】となります。』',
          'もじさん「よ、40階……！？ ここから非常階段で 10フロアも降りるのか……！？」',
          '午後の始業時間は【13:00】。 残された時間はあとわずか13分……！！'
        ]
      },
      {
        title: '【非常階段へ突入せよ！】',
        time: '🕒 12:48 PM',
        image: './character/opening/05-emergency-stairs.webp',
        lines: [
          'もじさん「非常階段を駆け降りるしかない……！」',
          '「頼む、俺の腹……！ 40Fまで持ちこたえてくれ……ッ！！」',
          '装備も荷物もすべて投げ捨て、身一つで非常扉を蹴破ったもじさん。',
          'オフィスを彷徨う残業モンスターや 数々の障害を突破し、',
          '40Fの【奇跡のトイレ個室】へ辿り着け！！'
        ]
      }
    ];

    this.preloadStoryImages();
    this.initEvents();
  }

  // オープニング画像の全事前読み込み（「次へ」のラグ完全解消）
  preloadStoryImages() {
    this.preloadedImages = {};
    for (const page of this.storyPages) {
      if (page.image) {
        const img = new Image();
        img.src = page.image;
        if (img.decode) {
          img.decode().catch(() => {});
        }
        this.preloadedImages[page.image] = img;
      }
    }
  }

  initEvents() {
    // ポータル画面「もじダンをプレイ」
    this.btnPortalPlayMojidan?.addEventListener('click', () => {
      soundManager.playConfirm();
      this.hidePortal();
      this.show();
      window.location.hash = '#mojidan';
    });

    // タイトル画面「ゲーム一覧へもどる」
    this.btnTitlePortal?.addEventListener('click', () => {
      soundManager.playCursor?.();
      this.hide();
      this.showPortal();
    });

    // はじめから（難易度選択モーダルを開く）
    this.btnNew?.addEventListener('click', () => {
      soundManager.playConfirm();
      this.openDifficultySelect();
    });

    // つづきから
    this.btnContinue?.addEventListener('click', () => {
      if (!SaveManager.hasSaveData()) return;
      soundManager.playConfirm();
      this.continueGame();
    });

    // タイトルメニューのマウスホバー対応
    this.btnNew?.addEventListener('mouseenter', () => this.setMenuSelection(0));
    this.btnContinue?.addEventListener('mouseenter', () => {
      if (SaveManager.hasSaveData()) this.setMenuSelection(1);
    });
    this.btnTitlePortal?.addEventListener('mouseenter', () => this.setMenuSelection(2));

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

    // ストーリー「次へ」
    this.btnNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      soundManager.playStep();
      this.nextStoryPage();
    });

    // ストーリー「スキップ」
    this.btnSkip?.addEventListener('click', (e) => {
      e.stopPropagation();
      soundManager.playConfirm();
      this.finishStoryAndStart();
    });

    // ストーリーモーダル内のボタン以外の領域タップでもページ送り
    this.storyModal?.addEventListener('click', (e) => {
      if (e.target.closest('#btn-story-skip') || e.target.closest('#btn-story-next')) return;
      soundManager.playStep();
      this.nextStoryPage();
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

      // タイトル画面表示中
      if (e.key === 'ArrowDown') {
        this._moveMenuCursor(1);
      } else if (e.key === 'ArrowUp') {
        this._moveMenuCursor(-1);
      } else if (e.key === 'Enter') {
        if (this.currentMenuIndex === 0) {
          soundManager.playConfirm();
          this.openDifficultySelect();
        } else if (this.currentMenuIndex === 1) {
          if (SaveManager.hasSaveData()) {
            soundManager.playConfirm();
            this.continueGame();
          }
        } else if (this.currentMenuIndex === 2) {
          soundManager.playCursor?.();
          this.hide();
          this.showPortal();
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
   * ポータル画面（ヒゲボールゲームズ）を表示
   */
  showPortal() {
    this.portalEl?.classList.remove('hidden');
    this.titleEl?.classList.add('hidden');
    this.diffModal?.classList.add('hidden');
    this.storyModal?.classList.add('hidden');
    if (window.location.hash === '#mojidan') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  hidePortal() {
    this.portalEl?.classList.add('hidden');
  }

  /**
   * タイトル画面を表示
   */
  show() {
    this.hidePortal();
    this.titleEl?.classList.remove('hidden');
    this.diffModal?.classList.add('hidden');
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

    this.setMenuSelection(0);
  }

  setMenuSelection(index) {
    this.currentMenuIndex = index;
    const items = [this.btnNew, this.btnContinue, this.btnTitlePortal];
    items.forEach((item, idx) => {
      if (!item) return;
      if (idx === index) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  _moveMenuCursor(delta) {
    const hasSave = SaveManager.hasSaveData();
    const validIndices = hasSave ? [0, 1, 2] : [0, 2];
    let pos = validIndices.indexOf(this.currentMenuIndex);
    if (pos === -1) pos = 0;
    pos = (pos + delta + validIndices.length) % validIndices.length;
    this.setMenuSelection(validIndices[pos]);
    soundManager.playCursor?.();
  }

  hide() {
    this.hidePortal();
    this.titleEl?.classList.add('hidden');
    this.diffModal?.classList.add('hidden');
    this.storyModal?.classList.add('hidden');
  }

  startOpeningStory() {
    this.hidePortal();
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
    if (titleEl) titleEl.textContent = page.title;
    if (timeEl) timeEl.textContent = page.time;

    // スライド画像の切り替え（全画像DOMにプリロード済みのため 0ms 即時切替）
    const slides = document.querySelectorAll('.story-slide');
    if (slides && slides.length > 0) {
      slides.forEach((slide, idx) => {
        if (idx === this.currentStoryPage) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });
    } else {
      const imgEl = document.getElementById('story-image');
      if (imgEl && page.image) {
        imgEl.src = page.image;
      }
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
}
