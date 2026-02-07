import { useState, useRef, useCallback } from "react";

interface SoundParams {
  // Noise layer
  noiseEnabled: boolean;
  noiseDuration: number;
  noiseFreq: number;
  noiseQ: number;
  noiseGain: number;
  // Oscillator layer
  oscEnabled: boolean;
  oscFreqStart: number;
  oscFreqEnd: number;
  oscDuration: number;
  oscGain: number;
  oscType: OscillatorType;
  // Click layer
  clickEnabled: boolean;
  clickFreq: number;
  clickDuration: number;
  clickGain: number;
}

const DEFAULTS: SoundParams = {
  noiseEnabled: true,
  noiseDuration: 15,
  noiseFreq: 800,
  noiseQ: 1.2,
  noiseGain: 0.12,
  oscEnabled: true,
  oscFreqStart: 300,
  oscFreqEnd: 80,
  oscDuration: 30,
  oscGain: 0.15,
  oscType: "sine",
  clickEnabled: false,
  clickFreq: 1800,
  clickDuration: 8,
  clickGain: 0.1,
};

function playSound(p: SoundParams) {
  const ctx = new AudioContext();
  const t = ctx.currentTime;

  if (p.noiseEnabled) {
    const len = Math.floor(ctx.sampleRate * (p.noiseDuration / 1000));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = p.noiseFreq;
    filt.Q.value = p.noiseQ;
    const g = ctx.createGain();
    g.gain.setValueAtTime(p.noiseGain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.noiseDuration / 1000);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + p.noiseDuration / 1000);
  }

  if (p.oscEnabled) {
    const osc = ctx.createOscillator();
    osc.type = p.oscType;
    osc.frequency.setValueAtTime(p.oscFreqStart, t);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(p.oscFreqEnd, 1),
      t + p.oscDuration / 1000,
    );
    const g = ctx.createGain();
    g.gain.setValueAtTime(p.oscGain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.oscDuration / 1000);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + p.oscDuration / 1000);
  }

  if (p.clickEnabled) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(p.clickFreq, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + p.clickDuration / 1000);
    const g = ctx.createGain();
    g.gain.setValueAtTime(p.clickGain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.clickDuration / 1000);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + p.clickDuration / 1000);
  }
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  return (
    <div style={styles.row}>
      <label style={styles.label}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={styles.slider}
      />
      <span style={styles.value}>
        {value}
        {unit ?? ""}
      </span>
    </div>
  );
}

export default function SoundLab({ onClose }: { onClose: () => void }) {
  const [params, setParams] = useState<SoundParams>({ ...DEFAULTS });
  const rapidRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const set = useCallback(
    <K extends keyof SoundParams>(key: K, val: SoundParams[K]) => {
      setParams((p) => ({ ...p, [key]: val }));
    },
    [],
  );

  const play = useCallback(() => playSound(params), [params]);

  const rapidFire = useCallback(() => {
    if (rapidRef.current) return;
    playSound(params);
    rapidRef.current = setInterval(() => playSound(params), 120);
  }, [params]);

  const stopRapid = useCallback(() => {
    if (rapidRef.current) {
      clearInterval(rapidRef.current);
      rapidRef.current = null;
    }
  }, []);

  const exportCode = useCallback(() => {
    const code = `export function playTick() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
${
  params.noiseEnabled
    ? `
  const bufferSize = Math.floor(ctx.sampleRate * ${(params.noiseDuration / 1000).toFixed(4)});
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = ${params.noiseFreq};
  filter.Q.value = ${params.noiseQ};
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(${params.noiseGain}, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + ${(params.noiseDuration / 1000).toFixed(4)});
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + ${(params.noiseDuration / 1000).toFixed(4)});`
    : ""
}
${
  params.oscEnabled
    ? `
  const osc = ctx.createOscillator();
  osc.type = "${params.oscType}";
  osc.frequency.setValueAtTime(${params.oscFreqStart}, t);
  osc.frequency.exponentialRampToValueAtTime(${Math.max(params.oscFreqEnd, 1)}, t + ${(params.oscDuration / 1000).toFixed(4)});
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(${params.oscGain}, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + ${(params.oscDuration / 1000).toFixed(4)});
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ${(params.oscDuration / 1000).toFixed(4)});`
    : ""
}
${
  params.clickEnabled
    ? `
  const click = ctx.createOscillator();
  click.type = "square";
  click.frequency.setValueAtTime(${params.clickFreq}, t);
  click.frequency.exponentialRampToValueAtTime(200, t + ${(params.clickDuration / 1000).toFixed(4)});
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(${params.clickGain}, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + ${(params.clickDuration / 1000).toFixed(4)});
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(t);
  click.stop(t + ${(params.clickDuration / 1000).toFixed(4)});`
    : ""
}
}`;
    navigator.clipboard.writeText(code);
  }, [params]);

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>Sound Lab</span>
          <button style={styles.closeBtn} onClick={onClose}>
            ESC
          </button>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={params.noiseEnabled}
                onChange={(e) => set("noiseEnabled", e.target.checked)}
              />
              Noise Burst
            </label>
          </div>
          {params.noiseEnabled && (
            <>
              <Slider label="Duration" value={params.noiseDuration} onChange={(v) => set("noiseDuration", v)} min={2} max={60} step={1} unit="ms" />
              <Slider label="Freq" value={params.noiseFreq} onChange={(v) => set("noiseFreq", v)} min={100} max={4000} step={50} unit="Hz" />
              <Slider label="Q" value={params.noiseQ} onChange={(v) => set("noiseQ", v)} min={0.1} max={10} step={0.1} />
              <Slider label="Gain" value={params.noiseGain} onChange={(v) => set("noiseGain", v)} min={0.01} max={0.5} step={0.01} />
            </>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={params.oscEnabled}
                onChange={(e) => set("oscEnabled", e.target.checked)}
              />
              Oscillator Thump
            </label>
          </div>
          {params.oscEnabled && (
            <>
              <Slider label="Start Hz" value={params.oscFreqStart} onChange={(v) => set("oscFreqStart", v)} min={40} max={2000} step={10} unit="Hz" />
              <Slider label="End Hz" value={params.oscFreqEnd} onChange={(v) => set("oscFreqEnd", v)} min={20} max={1000} step={10} unit="Hz" />
              <Slider label="Duration" value={params.oscDuration} onChange={(v) => set("oscDuration", v)} min={5} max={100} step={1} unit="ms" />
              <Slider label="Gain" value={params.oscGain} onChange={(v) => set("oscGain", v)} min={0.01} max={0.5} step={0.01} />
              <div style={styles.row}>
                <label style={styles.label}>Wave</label>
                <select
                  value={params.oscType}
                  onChange={(e) => set("oscType", e.target.value as OscillatorType)}
                  style={styles.select}
                >
                  <option value="sine">sine</option>
                  <option value="triangle">triangle</option>
                  <option value="square">square</option>
                  <option value="sawtooth">sawtooth</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={params.clickEnabled}
                onChange={(e) => set("clickEnabled", e.target.checked)}
              />
              Click Layer
            </label>
          </div>
          {params.clickEnabled && (
            <>
              <Slider label="Freq" value={params.clickFreq} onChange={(v) => set("clickFreq", v)} min={200} max={6000} step={50} unit="Hz" />
              <Slider label="Duration" value={params.clickDuration} onChange={(v) => set("clickDuration", v)} min={2} max={40} step={1} unit="ms" />
              <Slider label="Gain" value={params.clickGain} onChange={(v) => set("clickGain", v)} min={0.01} max={0.5} step={0.01} />
            </>
          )}
        </div>

        <div style={styles.buttons}>
          <button style={styles.playBtn} onClick={play}>
            Play
          </button>
          <button
            style={styles.rapidBtn}
            onMouseDown={rapidFire}
            onMouseUp={stopRapid}
            onMouseLeave={stopRapid}
          >
            Rapid Fire (hold)
          </button>
          <button style={styles.exportBtn} onClick={exportCode}>
            Copy Code
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "#00000080",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  panel: {
    background: "#1e1e1e",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "20px",
    width: "420px",
    maxHeight: "90vh",
    overflowY: "auto",
    color: "#ccc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "12px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#ddd",
  },
  closeBtn: {
    background: "#333",
    border: "1px solid #444",
    color: "#888",
    padding: "2px 10px",
    borderRadius: "3px",
    cursor: "pointer",
    fontSize: "11px",
  },
  section: {
    marginBottom: "12px",
    padding: "10px",
    background: "#252525",
    borderRadius: "5px",
  },
  sectionHeader: {
    marginBottom: "8px",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "12px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  },
  label: {
    width: "60px",
    flexShrink: 0,
    color: "#888",
    fontSize: "11px",
  },
  slider: {
    flex: 1,
    height: "3px",
    accentColor: "#666",
  },
  value: {
    width: "55px",
    textAlign: "right",
    fontSize: "11px",
    color: "#999",
    flexShrink: 0,
  },
  select: {
    background: "#333",
    border: "1px solid #444",
    color: "#ccc",
    borderRadius: "3px",
    padding: "2px 6px",
    fontSize: "11px",
  },
  buttons: {
    display: "flex",
    gap: "8px",
    marginTop: "16px",
  },
  playBtn: {
    flex: 1,
    padding: "8px",
    background: "#2d5a3d",
    border: "1px solid #3a7a50",
    color: "#ccc",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
  rapidBtn: {
    flex: 1,
    padding: "8px",
    background: "#4a3a2a",
    border: "1px solid #6a5a3a",
    color: "#ccc",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
  exportBtn: {
    flex: 1,
    padding: "8px",
    background: "#2a3a5a",
    border: "1px solid #3a5a7a",
    color: "#ccc",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
};
