// Web Audio API Procedural Sound Effects for CUET BMES Quiz
class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.enabled = localStorage.getItem('bmes_quiz_sound') !== 'false';
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    localStorage.setItem('bmes_quiz_sound', this.enabled ? 'true' : 'false');
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.2, pitchDecay = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      if (pitchDecay) {
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.audioCtx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  playClick() {
    this.playTone(800, 'sine', 0.05, 0.1);
  }

  playTick() {
    this.playTone(1200, 'sine', 0.04, 0.08);
  }

  playUrgentTick() {
    this.playTone(1800, 'square', 0.06, 0.15);
  }

  playCorrect() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.2, 0.15);
      }, idx * 60);
    });
  }

  playWrong() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, this.audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, this.audioCtx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  playStreak() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.25, 0.2);
      }, idx * 50);
    });
  }

  playTimeUp() {
    this.playTone(220, 'sawtooth', 0.6, 0.3, true);
  }

  playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    const fanfare = [
      { f: 523.25, d: 100 }, // C5
      { f: 523.25, d: 100 }, // C5
      { f: 523.25, d: 100 }, // C5
      { f: 659.25, d: 250 }, // E5
      { f: 783.99, d: 350 }, // G5
      { f: 1046.5, d: 600 }  // C6
    ];

    let delay = 0;
    fanfare.forEach((n) => {
      setTimeout(() => {
        this.playTone(n.f, 'triangle', n.d / 1000, 0.25);
      }, delay);
      delay += n.d + 50;
    });
  }
}

window.SFX = new SoundManager();
