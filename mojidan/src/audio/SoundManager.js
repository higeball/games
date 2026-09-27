/**
 * SoundManager - 8ビット/レトロ風 Web Audio サウンドシンセサイザー
 * ドラゴンクエスト / トルネコ風の効果音
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.4;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCursor() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.04);
      gain.gain.setValueAtTime(this.volume * 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.045);
    } catch (e) {}
  }

  playConfirm() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const notes = [587.33, 880]; // D5 -> A5 レトロ決定音
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + idx * 0.05);
        gain.gain.setValueAtTime(this.volume * 0.25, t + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + (idx + 1) * 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.05);
        osc.stop(t + (idx + 1) * 0.05);
      });
    } catch (e) {}
  }

  playStep() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.04);
      gain.gain.setValueAtTime(this.volume * 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) {}
  }

  playAttack() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      // ホワイトノイズによる風切り音
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.frequency.exponentialRampToValueAtTime(300, t + 0.08);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(t);
    } catch (e) {}
  }

  playHit() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      gain.gain.setValueAtTime(this.volume * 0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } catch (e) {}
  }

  playPlayerHurt() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
      gain.gain.setValueAtTime(this.volume * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    } catch (e) {}
  }

  playDefeat() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const notes = [330, 261, 196, 130];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);
        gain.gain.setValueAtTime(this.volume * 0.3, t + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, t + (idx + 1) * 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.06);
        osc.stop(t + (idx + 1) * 0.06);
      });
    } catch (e) {}
  }

  playPickup() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const notes = [440, 660, 880];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.04);
        gain.gain.setValueAtTime(this.volume * 0.25, t + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, t + (idx + 1) * 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.04);
        osc.stop(t + (idx + 1) * 0.04);
      });
    } catch (e) {}
  }

  playUseHerb() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);
        gain.gain.setValueAtTime(this.volume * 0.3, t + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, t + (idx + 1) * 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.06);
        osc.stop(t + (idx + 1) * 0.06);
      });
    } catch (e) {}
  }

  playEatBread() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      [0, 0.08, 0.16].forEach((delay) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(260 + Math.random() * 80, t + delay);
        osc.frequency.exponentialRampToValueAtTime(140, t + delay + 0.05);
        gain.gain.setValueAtTime(this.volume * 0.25, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.06);
      });
    } catch (e) {}
  }

  playCastMagic() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
      gain.gain.setValueAtTime(this.volume * 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.23);
    } catch (e) {}
  }

  playStairs() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const freqs = [659.25, 587.33, 523.25, 392.00, 329.63];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t + i * 0.08);
        gain.gain.setValueAtTime(this.volume * 0.35, t + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, t + (i + 1) * 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + i * 0.08);
        osc.stop(t + (i + 1) * 0.08);
      });
    } catch (e) {}
  }

  playLevelUp() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      // レトロDQ風レベルアップファンファーレ
      const notes = [
        { f: 523.25, d: 0.1 },  // C5
        { f: 659.25, d: 0.1 },  // E5
        { f: 783.99, d: 0.1 },  // G5
        { f: 1046.50, d: 0.2 }, // C6
        { f: 880.00, d: 0.12 }, // A5
        { f: 1046.50, d: 0.35 } // C6
      ];
      let cur = t;
      notes.forEach((note) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(note.f, cur);
        gain.gain.setValueAtTime(this.volume * 0.35, cur);
        gain.gain.exponentialRampToValueAtTime(0.01, cur + note.d);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(cur);
        osc.stop(cur + note.d);
        cur += note.d * 1.05;
      });
    } catch (e) {}
  }

  playGameOver() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const notes = [293.66, 277.18, 261.63, 246.94, 220.00];
      let cur = t;
      notes.forEach((f) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, cur);
        gain.gain.setValueAtTime(this.volume * 0.3, cur);
        gain.gain.exponentialRampToValueAtTime(0.01, cur + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(cur);
        osc.stop(cur + 0.25);
        cur += 0.26;
      });
    } catch (e) {}
  }

  playVictory() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const fanfare = [
        { f: 523.25, d: 0.12 },
        { f: 523.25, d: 0.12 },
        { f: 523.25, d: 0.12 },
        { f: 523.25, d: 0.3 },
        { f: 415.30, d: 0.3 },
        { f: 466.16, d: 0.3 },
        { f: 523.25, d: 0.2 },
        { f: 466.16, d: 0.1 },
        { f: 523.25, d: 0.6 }
      ];
      let cur = t;
      fanfare.forEach((n) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(n.f, cur);
        gain.gain.setValueAtTime(this.volume * 0.35, cur);
        gain.gain.exponentialRampToValueAtTime(0.01, cur + n.d);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(cur);
        osc.stop(cur + n.d);
        cur += n.d * 1.05;
      });
    } catch (e) {}
  }
}

export const soundManager = new SoundManager();
