/** Bipes de Morse com WebAudio. */
export class Beeper {
  private ctx?: AudioContext;
  private osc?: OscillatorNode;
  private gain?: GainNode;
  /** Tons agendados por playMorse (para poder interromper). */
  private scheduled: OscillatorNode[] = [];

  constructor(public enabled = true, private freq = 600) {}

  private ensure(): AudioContext | undefined {
    if (!this.enabled) return undefined;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return undefined;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Começa um tom contínuo (modo espaço). */
  start() {
    const ctx = this.ensure();
    if (!ctx || this.osc) return;
    const t = ctx.currentTime;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0, t);
    this.gain.gain.linearRampToValueAtTime(0.15, t + 0.005);
    this.gain.connect(ctx.destination);
    this.osc = ctx.createOscillator();
    this.osc.frequency.value = this.freq;
    this.osc.connect(this.gain);
    this.osc.start(t);
  }

  stop() {
    if (!this.ctx || !this.osc || !this.gain) return;
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0, t + 0.01);
    this.osc.stop(t + 0.02);
    this.osc = undefined;
    this.gain = undefined;
  }

  /** Tom com envelope curto para não estalar. */
  private tone(ctx: AudioContext, t: number, dur: number): OscillatorNode {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.005);
    gain.gain.setValueAtTime(0.15, t + dur - 0.008);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.frequency.value = this.freq;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    return osc;
  }

  /** Bipe curto (ponto) ou longo (traço). */
  beep(kind: 'dot' | 'dash') {
    const ctx = this.ensure();
    if (!ctx) return;
    this.tone(ctx, ctx.currentTime, kind === 'dot' ? 0.07 : 0.21);
  }

  /**
   * Toca letras em Morse (ex.: ['...', '---', '...']) no ritmo padrão:
   * ponto = 1 unidade, traço = 3, entre sinais = 1, entre letras = 3.
   * Retorna a duração total em ms.
   */
  playMorse(codes: string[], unitMs: number): number {
    const ctx = this.ensure();
    if (!ctx) return 0;
    this.stopMorse();
    const u = unitMs / 1000;
    const start = ctx.currentTime + 0.08;
    let t = start;
    codes.forEach((code, i) => {
      for (const s of code) {
        const d = s === '.' ? u : 3 * u;
        this.scheduled.push(this.tone(ctx, t, d));
        t += d + u;
      }
      if (i < codes.length - 1) t += 2 * u;
    });
    return (t - ctx.currentTime) * 1000;
  }

  stopMorse() {
    for (const o of this.scheduled) {
      try {
        o.stop();
      } catch {
        /* já parou */
      }
    }
    this.scheduled = [];
  }

  /** Som curto de erro. */
  error() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.12);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 160;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.13);
  }
}
