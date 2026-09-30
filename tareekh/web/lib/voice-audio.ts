// Audio for voice mode: record one spoken question as 16 kHz WAV, and play the answer while it streams in.
// Both expose a 0-1 level so the orb can react to whoever is speaking.

const TAP = `class Tap extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor("tareekh-tap", Tap);`;

const STT_RATE = 16000; // plenty for speech, and a third of the upload

function rms(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/** Speech level 0-1 from RMS, on a rough log scale so quiet speech still moves the orb. */
const toLevel = (r: number) => Math.max(0, Math.min(1, (20 * Math.log10(r + 1e-8) + 55) / 40));

function wav(chunks: Float32Array[], fromRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const ratio = fromRate / STT_RATE;
  const outLen = Math.floor(total / ratio);
  const pcm = new Int16Array(outLen);
  // Average each output sample's source window: a cheap low-pass, so downsampling doesn't alias.
  let ci = 0, off = 0, pos = 0;
  for (let i = 0; i < outLen; i++) {
    const end = (i + 1) * ratio;
    let sum = 0, n = 0;
    while (pos < end && ci < chunks.length) {
      sum += chunks[ci][off];
      n++;
      pos++;
      if (++off >= chunks[ci].length) { ci++; off = 0; }
    }
    const v = n ? sum / n : 0;
    pcm[i] = Math.max(-1, Math.min(1, v)) * 0x7fff;
  }
  const head = new DataView(new ArrayBuffer(44));
  const str = (o: number, s: string) => [...s].forEach((ch, i) => head.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); head.setUint32(4, 36 + pcm.byteLength, true); str(8, "WAVE");
  str(12, "fmt "); head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 1, true);
  head.setUint32(24, STT_RATE, true); head.setUint32(28, STT_RATE * 2, true); head.setUint16(32, 2, true); head.setUint16(34, 16, true);
  str(36, "data"); head.setUint32(40, pcm.byteLength, true);
  return new Blob([head.buffer, pcm.buffer], { type: "audio/wav" });
}

export class VoiceAudio {
  readonly ctx: AudioContext;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private tap: AudioWorkletNode | null = null;
  private micAnalyser: AnalyserNode;
  private outAnalyser: AnalyserNode;
  private micBuf: Float32Array<ArrayBuffer>;
  private outBuf: Float32Array<ArrayBuffer>;
  private chunks: Float32Array[] = [];
  private recording = false;
  private sources = new Set<AudioBufferSourceNode>();
  private playAbort: AbortController | null = null;
  private ready: Promise<void>;

  constructor() {
    this.ctx = new AudioContext();
    this.micAnalyser = this.ctx.createAnalyser();
    this.micAnalyser.fftSize = 1024;
    this.outAnalyser = this.ctx.createAnalyser();
    this.outAnalyser.fftSize = 1024;
    this.outAnalyser.connect(this.ctx.destination);
    this.micBuf = new Float32Array(this.micAnalyser.fftSize);
    this.outBuf = new Float32Array(this.outAnalyser.fftSize);
    const url = URL.createObjectURL(new Blob([TAP], { type: "text/javascript" }));
    this.ready = this.ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
  }

  /** Ask for the microphone once and keep it for the session (echo cancellation keeps her voice out of it). */
  async openMic() {
    await this.ctx.resume();
    await this.ready;
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.micAnalyser);
    this.tap = new AudioWorkletNode(this.ctx, "tareekh-tap");
    this.tap.port.onmessage = (e) => {
      if (this.recording) this.chunks.push(e.data as Float32Array);
    };
    const mute = this.ctx.createGain();
    mute.gain.value = 0; // the tap must be pulled by the graph, but nobody should hear the mic
    this.source.connect(this.tap).connect(mute).connect(this.ctx.destination);
  }

  startRecording() {
    this.chunks = [];
    this.recording = true;
  }

  stopRecording(): Blob | null {
    this.recording = false;
    const chunks = this.chunks;
    this.chunks = [];
    const samples = chunks.reduce((n, c) => n + c.length, 0);
    return samples > this.ctx.sampleRate * 0.3 ? wav(chunks, this.ctx.sampleRate) : null;
  }

  /** Raw mic RMS, for silence detection. */
  micRms = () => (this.stream ? rms(this.micAnalyser, this.micBuf) : 0);
  micLevel = () => (this.recording ? toLevel(this.micRms()) : 0);
  outLevel = () => toLevel(rms(this.outAnalyser, this.outBuf));

  /**
   * Play 16-bit mono PCM as it streams in, scheduled back to back. Resolves when the last sample has played,
   * or when stop() is called.
   */
  async play(res: Response, rate: number, signal?: AbortSignal): Promise<void> {
    await this.ctx.resume();
    this.stopPlayback();
    const abort = new AbortController();
    this.playAbort = abort;
    signal?.addEventListener("abort", () => abort.abort());
    const reader = res.body!.getReader();
    let at = this.ctx.currentTime + 0.25; // a short head start absorbs network jitter
    let carry: Uint8Array | null = null;
    let lastEnd = Promise.resolve();

    const schedule = (bytes: Uint8Array) => {
      const n = bytes.length >> 1;
      if (!n) return;
      const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
      const buf = this.ctx.createBuffer(1, n, rate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 0x8000;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.outAnalyser);
      at = Math.max(at, this.ctx.currentTime + 0.03);
      src.start(at);
      at += buf.duration;
      this.sources.add(src);
      lastEnd = new Promise<void>((ok) => {
        src.onended = () => {
          this.sources.delete(src);
          ok();
        };
      });
    };

    try {
      for (;;) {
        if (abort.signal.aborted) break;
        const { value, done } = await reader.read();
        if (done) break;
        let bytes = value;
        if (carry) {
          const joined = new Uint8Array(carry.length + value.length);
          joined.set(carry);
          joined.set(value, carry.length);
          bytes = joined;
          carry = null;
        }
        if (bytes.length % 2) {
          carry = bytes.slice(-1);
          bytes = bytes.subarray(0, bytes.length - 1);
        }
        schedule(bytes);
      }
    } finally {
      reader.cancel().catch(() => {});
    }
    if (abort.signal.aborted) return;
    await Promise.race([lastEnd, new Promise<void>((ok) => abort.signal.addEventListener("abort", () => ok()))]);
  }

  stopPlayback() {
    this.playAbort?.abort();
    this.playAbort = null;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
  }

  close() {
    this.recording = false;
    this.stopPlayback();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx.close().catch(() => {});
  }
}
