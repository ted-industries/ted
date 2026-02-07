let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function playTick() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Noise burst — the "pop" body
  const bufferSize = Math.floor(ctx.sampleRate * 0.015);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  // Bandpass filter to shape the noise into a thud
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 1.2;

  // Noise envelope — sharp attack, fast decay
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.12, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  // Low thump — gives it weight
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.025);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.15, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  noise.start(t);
  noise.stop(t + 0.015);
  osc.start(t);
  osc.stop(t + 0.03);
}
