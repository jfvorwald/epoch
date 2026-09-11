import type { Preferences, SoundName } from './types';

/** Small original synth score. No audio/network activity before a user gesture. */
export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private musicTimer?: number;
  private step = 0;
  private suspended = false;
  private lastShot = 0;
  constructor(private prefs: Preferences) {}
  unlock() {
    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.context.destination);
    }
    void this.context.resume().catch(() => {});
    this.suspended = false;
    this.scheduleMusic();
  }
  preferences(prefs: Preferences) { this.prefs = prefs; this.scheduleMusic(); }
  suspend() { this.suspended = true; if (this.musicTimer) window.clearInterval(this.musicTimer); this.musicTimer = undefined; void this.context?.suspend().catch(() => {}); }
  private note(freq: number, duration: number, volume: number, shape: OscillatorType = 'sine', endFreq?: number) {
    const ctx = this.context;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = shape; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    o.connect(g); g.connect(this.master); o.start(); o.stop(ctx.currentTime + duration + .02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  private scheduleMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    if (!this.context || !this.prefs.music || this.suspended) return;
    const melody = [110, 164.81, 220, 246.94, 130.81, 196, 261.63, 196, 98, 146.83, 196, 220, 130.81, 196, 164.81, 146.83];
    this.musicTimer = window.setInterval(() => {
      const freq = melody[this.step++ % melody.length];
      this.note(freq, .7, .065, 'triangle');
      if (this.step % 4 === 0) this.note(freq / 2, 1.65, .10);
      if (this.step % 2 === 0) this.note(freq * 4, .18, .025);
    }, 360);
  }
  play(name: SoundName) {
    if (!this.prefs.sfx || this.suspended) return;
    if (name === 'shoot') {
      if (performance.now() - this.lastShot < 100) return;
      this.lastShot = performance.now(); this.note(1200, .055, .06, 'triangle', 480);
    } else if (name === 'hit') this.note(150, .2, .21, 'sawtooth', 45);
    else if (name === 'explosion') { this.note(88, .19, .18, 'sawtooth', 25); this.note(200, .09, .07, 'triangle', 40); }
    else if (name === 'pickup') { this.note(660, .18, .13); this.note(990, .35, .10); }
    else if (name === 'complete') { this.note(440, .8, .11); this.note(554.37, .9, .09); this.note(659.25, 1, .10); }
    else if (name === 'defeat') { this.note(220, 1.2, .14, 'triangle', 55); }
    else this.note(700, .07, .07, 'triangle', 900);
  }
}
