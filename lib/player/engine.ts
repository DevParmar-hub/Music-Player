// Audio output. Two "decks" (audio elements) let the next song load
// in the background, so songs change without a gap and can crossfade.
// Both feed one Web Audio graph:
//
//   deck A ─ gain ─┐
//                  ├─ master (volume) ─ low-pass ─ analyser ─ speakers
//   deck B ─ gain ─┘
//
// The low-pass filter powers the "muffled inside the case" effect of
// the Vinyl intro; the analyser feeds the visualisers.
//
// Library files are served cross-origin by Tauri's asset protocol,
// which sends CORS headers, so the elements use crossOrigin
// "anonymous". Without it Web Audio would only receive silence.

export interface EngineHandlers {
  onTimeUpdate: () => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onPlayingChange: (playing: boolean) => void;
  onLoadingChange: (loading: boolean) => void;
  onDuration: (seconds: number) => void;
}

const FULL_BANDWIDTH_HZ = 20000;
const MUFFLED_HZ = 450;

class Deck {
  readonly audio: HTMLAudioElement;
  gain: GainNode | null = null;
  url: string | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';
  }

  setSource(url: string) {
    this.url = url;
    this.audio.src = url;
    this.audio.load();
  }
}

export class AudioEngine {
  private readonly decks: [Deck, Deck] = [new Deck(), new Deck()];
  private active = 0;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private handlers: Partial<EngineHandlers> = {};
  private volume = 1;
  private muted = false;
  private fadeTimer: number | null = null;

  constructor() {
    for (const deck of this.decks) this.listen(deck);
  }

  setHandlers(handlers: Partial<EngineHandlers>) {
    this.handlers = handlers;
  }

  private get deck(): Deck {
    return this.decks[this.active];
  }

  private get spare(): Deck {
    return this.decks[1 - this.active];
  }

  // ============================================================
  // Graph
  // ============================================================

  /**
   * Build the Web Audio graph. Browsers only allow an AudioContext to
   * start after a user gesture, so this runs on the first play().
   */
  private ensureGraph() {
    if (this.context) return;

    const context = new AudioContext();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const analyser = context.createAnalyser();

    filter.type = 'lowpass';
    filter.frequency.value = FULL_BANDWIDTH_HZ;
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    for (const deck of this.decks) {
      deck.gain = context.createGain();
      context.createMediaElementSource(deck.audio).connect(deck.gain).connect(master);
    }
    this.spare.gain!.gain.value = 0;

    master.connect(filter).connect(analyser).connect(context.destination);

    this.context = context;
    this.master = master;
    this.filter = filter;
    this.analyser = analyser;
    this.applyVolume();
  }

  /** Frequency and waveform data for visualisers; null before first play. */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /** 0 = clear, 1 = heavily muffled. Ramps smoothly. */
  setMuffle(amount: number, rampSeconds = 0.4) {
    if (!this.context || !this.filter) return;
    const clamped = Math.min(1, Math.max(0, amount));
    // Interpolate on a log scale so the opening sounds even.
    const frequency = FULL_BANDWIDTH_HZ * Math.pow(MUFFLED_HZ / FULL_BANDWIDTH_HZ, clamped);
    this.filter.frequency.setTargetAtTime(frequency, this.context.currentTime, rampSeconds / 3);
  }

  // ============================================================
  // Transport
  // ============================================================

  /** Load a song into the active deck, reusing it if it was preloaded. */
  load(url: string, startAt = 0) {
    this.cancelFade();

    if (this.spare.url === url) {
      this.swapDecks();
    } else {
      this.deck.setSource(url);
    }

    // Silence and release whatever the other deck was doing.
    this.spare.audio.pause();
    if (this.spare.gain) this.spare.gain.gain.value = 0;
    if (this.deck.gain) this.deck.gain.gain.value = 1;

    this.deck.audio.currentTime = startAt;
    this.handlers.onDuration?.(this.duration);
  }

  /** Start buffering the next song on the spare deck. */
  preload(url: string | null) {
    if (!url || this.spare.url === url || this.fadeTimer !== null) return;
    this.spare.setSource(url);
  }

  async play(): Promise<void> {
    this.ensureGraph();
    if (this.context?.state === 'suspended') await this.context.resume();
    await this.deck.audio.play();
  }

  pause() {
    this.deck.audio.pause();
  }

  seek(seconds: number) {
    const duration = this.duration;
    this.deck.audio.currentTime = Math.max(0, duration ? Math.min(seconds, duration) : seconds);
  }

  /** Fade from the current song into `url` over `seconds`. */
  async crossfadeTo(url: string, seconds: number) {
    this.ensureGraph();
    const context = this.context!;
    const outgoing = this.deck;

    if (this.spare.url !== url) this.spare.setSource(url);
    this.swapDecks();
    const incoming = this.deck;

    incoming.audio.currentTime = 0;
    const now = context.currentTime;
    incoming.gain!.gain.cancelScheduledValues(now);
    incoming.gain!.gain.setValueAtTime(0, now);
    incoming.gain!.gain.linearRampToValueAtTime(1, now + seconds);
    outgoing.gain!.gain.cancelScheduledValues(now);
    outgoing.gain!.gain.setValueAtTime(outgoing.gain!.gain.value, now);
    outgoing.gain!.gain.linearRampToValueAtTime(0, now + seconds);

    this.handlers.onDuration?.(this.duration);

    this.fadeTimer = window.setTimeout(() => {
      outgoing.audio.pause();
      this.fadeTimer = null;
    }, seconds * 1000);

    await incoming.audio.play();
  }

  private cancelFade() {
    if (this.fadeTimer === null) return;
    window.clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
    const now = this.context?.currentTime ?? 0;
    for (const deck of this.decks) deck.gain?.gain.cancelScheduledValues(now);
  }

  private swapDecks() {
    this.active = 1 - this.active;
  }

  // ============================================================
  // Volume
  // ============================================================

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyVolume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.master || !this.context) return;
    // Squared so the slider feels even to the ear.
    const level = this.muted ? 0 : this.volume * this.volume;
    this.master.gain.setTargetAtTime(level, this.context.currentTime, 0.015);
  }

  // ============================================================
  // State
  // ============================================================

  get currentTime(): number {
    return this.deck.audio.currentTime || 0;
  }

  get duration(): number {
    const duration = this.deck.audio.duration;
    return Number.isFinite(duration) ? duration : 0;
  }

  get paused(): boolean {
    return this.deck.audio.paused;
  }

  // ============================================================
  // Events
  // ============================================================

  /** Forward a deck's events, but only while it is the active one. */
  private listen(deck: Deck) {
    const audio = deck.audio;
    const whenActive = (handler: () => void) => () => {
      if (deck === this.deck) handler();
    };

    audio.addEventListener('timeupdate', whenActive(() => this.handlers.onTimeUpdate?.()));
    audio.addEventListener('ended', whenActive(() => this.handlers.onEnded?.()));
    audio.addEventListener('play', whenActive(() => this.handlers.onPlayingChange?.(true)));
    audio.addEventListener('pause', whenActive(() => this.handlers.onPlayingChange?.(false)));
    audio.addEventListener('waiting', whenActive(() => this.handlers.onLoadingChange?.(true)));
    audio.addEventListener('playing', whenActive(() => this.handlers.onLoadingChange?.(false)));
    audio.addEventListener('canplay', whenActive(() => this.handlers.onLoadingChange?.(false)));
    audio.addEventListener(
      'durationchange',
      whenActive(() => this.handlers.onDuration?.(this.duration)),
    );

    audio.addEventListener('error', () => {
      if (deck === this.deck) {
        this.handlers.onError?.(describeMediaError(audio.error));
      } else {
        // A failed preload is retried as a normal load later.
        deck.url = null;
      }
    });
  }
}

function describeMediaError(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "This file's format can't be played.";
    case MediaError.MEDIA_ERR_DECODE:
      return 'The file looks damaged.';
    case MediaError.MEDIA_ERR_NETWORK:
      return "The file couldn't be read. Is its drive connected?";
    default:
      return 'Something went wrong while playing it.';
  }
}

let engine: AudioEngine | null = null;

/** The app's single engine, created on first use (browser only). */
export function getEngine(): AudioEngine {
  engine ??= new AudioEngine();
  return engine;
}
