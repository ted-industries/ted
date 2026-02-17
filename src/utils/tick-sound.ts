let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function playTick(volume = 50) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const volScale = volume / 100;

  // Noise pop — short filtered burst
  const len = Math.floor(ctx.sampleRate * 0.012);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.8;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.09 * volScale, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.012);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  // Thump — very short sine punch
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.02);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.1 * volScale, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  noise.start(t);
  noise.stop(t + 0.012);
  osc.start(t);
  osc.stop(t + 0.025);
}
