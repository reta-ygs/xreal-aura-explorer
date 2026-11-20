import * as THREE from 'three';
import type {
  CapabilityReport,
  ExperienceModule,
  XrSceneContext,
} from '../types.ts';
import { mountXrViewport } from '../xr/xrEngine.ts';

type OrbId = 'chime' | 'pulse' | 'drone';
type MotionMode = 'orbit' | 'fixed';

interface OrbConfig {
  id: OrbId;
  name: string;
  shortDesc: string;
  colorHex: string;
  colorInt: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  heightOffset: number;
  fixedOffset: THREE.Vector3;
}

interface OrbRuntime {
  config: OrbConfig;
  enabled: boolean;
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  haloMesh: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  waveMesh: THREE.Mesh;
  waveMat: THREE.MeshBasicMaterial;
  orbitRing: THREE.LineLoop;
  orbitRingMat: THREE.LineBasicMaterial;
  pulseEnergy: number;
  wavePhase: number;
  worldPos: THREE.Vector3;
  panner: PannerNode | null;
  gain: GainNode | null;
  triggerTimer: number;
  stepIndex: number;
}

const STYLE_ID = 'xreal-spatial-audio-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .sa-hud {
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: auto;
      background: rgba(6, 10, 18, 0.78);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 14px;
      padding: 12px 14px;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: 560px;
    }
    .sa-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .sa-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      color: #e2e8f0;
      border-radius: 999px;
      padding: 7px 13px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .sa-btn:hover {
      border-color: rgba(56, 189, 248, 0.65);
    }
    .sa-btn.is-primary {
      background: linear-gradient(135deg, #0284c7, #4f46e5);
      border-color: #38bdf8;
      color: #ffffff;
      box-shadow: 0 0 14px rgba(56, 189, 248, 0.35);
    }
    .sa-btn.is-active {
      background: rgba(56, 189, 248, 0.22);
      border-color: #38bdf8;
      color: #ffffff;
    }
    .sa-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 0 8px currentColor;
    }
    .sa-vol {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #cbd5e1;
      flex: 1;
      min-width: 150px;
    }
    .sa-vol input[type="range"] {
      accent-color: #38bdf8;
      flex: 1;
    }
    .sa-telemetry {
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 8px;
      font-variant-numeric: tabular-nums;
    }
  `;
  document.head.appendChild(style);
}

function setAudioParamSafe(
  param: AudioParam | undefined,
  value: number,
  time: number,
): void {
  if (!param) return;
  if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(value, time);
  } else {
    param.value = value;
  }
}

function updatePannerPosition(
  panner: PannerNode,
  pos: THREE.Vector3,
  time: number,
): void {
  if ('positionX' in panner && panner.positionX) {
    setAudioParamSafe(panner.positionX, pos.x, time);
    setAudioParamSafe(panner.positionY, pos.y, time);
    setAudioParamSafe(panner.positionZ, pos.z, time);
  } else if (typeof panner.setPosition === 'function') {
    panner.setPosition(pos.x, pos.y, pos.z);
  }
}

function updateListenerPose(
  listener: AudioListener,
  pos: THREE.Vector3,
  forward: THREE.Vector3,
  up: THREE.Vector3,
  time: number,
): void {
  if ('positionX' in listener && listener.positionX) {
    setAudioParamSafe(listener.positionX, pos.x, time);
    setAudioParamSafe(listener.positionY, pos.y, time);
    setAudioParamSafe(listener.positionZ, pos.z, time);
    setAudioParamSafe(listener.forwardX, forward.x, time);
    setAudioParamSafe(listener.forwardY, forward.y, time);
    setAudioParamSafe(listener.forwardZ, forward.z, time);
    setAudioParamSafe(listener.upX, up.x, time);
    setAudioParamSafe(listener.upY, up.y, time);
    setAudioParamSafe(listener.upZ, up.z, time);
  } else {
    if (typeof listener.setPosition === 'function') {
      listener.setPosition(pos.x, pos.y, pos.z);
    }
    if (typeof listener.setOrientation === 'function') {
      listener.setOrientation(
        forward.x,
        forward.y,
        forward.z,
        up.x,
        up.y,
        up.z,
      );
    }
  }
}

function createOrbitRingGeometry(
  radius: number,
  segments = 64,
): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pts.push(
      new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

const ORB_CONFIGS: OrbConfig[] = [
  {
    id: 'chime',
    name: 'チャイム',
    shortDesc: '空間ベル',
    colorHex: '#38bdf8',
    colorInt: 0x38bdf8,
    orbitRadius: 1.55,
    orbitSpeed: 0.45,
    orbitPhase: 0.2,
    heightOffset: 0.25,
    fixedOffset: new THREE.Vector3(-1.25, 0.2, -1.35),
  },
  {
    id: 'pulse',
    name: 'パルス',
    shortDesc: '定位ビート',
    colorHex: '#f472b6',
    colorInt: 0xf472b6,
    orbitRadius: 1.9,
    orbitSpeed: -0.62,
    orbitPhase: 2.3,
    heightOffset: -0.05,
    fixedOffset: new THREE.Vector3(1.3, 0.0, -1.2),
  },
  {
    id: 'drone',
    name: 'ドローン',
    shortDesc: '和音パッド',
    colorHex: '#fbbf24',
    colorInt: 0xfbbf24,
    orbitRadius: 2.25,
    orbitSpeed: 0.26,
    orbitPhase: 4.4,
    heightOffset: 0.4,
    fixedOffset: new THREE.Vector3(0.0, 0.35, 1.55),
  },
];

// Pentatonic frequencies (C5, D5, E5, G5, A5, C6)
const CHIME_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
// Rhythmic marimba-like pitches
const PULSE_SCALE = [
  261.63, 329.63, 392.0, 329.63, 440.0, 392.0, 329.63, 293.66,
];

export const spatialAudioModule: ExperienceModule = {
  id: 'spatial-audio',
  title: '空間オーディオ 3D オーブ',
  subtitle: 'HRTF 立体音響 / Bose チューニング音響体験',
  badge: 'WebXR + Web Audio',
  summary:
    'Web Audio API（HRTF PannerNode）とWebXRカメラ姿勢を毎フレーム同期。光る3つの音源オーブを自動周回または空間固定し、首振り・歩行で立体音像の定位を体感します。',
  supportsWebXr: true,

  mount(container: HTMLElement, capabilities: CapabilityReport): () => void {
    ensureStyles();

    let ctxRef: XrSceneContext | null = null;
    let audioCtx: AudioContext | null = null;
    let masterGain: GainNode | null = null;
    let droneOscs: OscillatorNode[] = [];
    let droneLfo: OscillatorNode | null = null;
    let droneNodes: AudioNode[] = [];

    let audioRunning = false;
    let motionMode: MotionMode = 'orbit';
    let masterVolume = 0.7;
    let disposed = false;

    const anchorCenter = new THREE.Vector3(0, 0, 0);
    let anchorInitialized = false;

    const orbs: OrbRuntime[] = [];
    const disposableGeometries: THREE.BufferGeometry[] = [];
    const disposableMaterials: THREE.Material[] = [];

    // Scratch math objects to avoid per-frame allocations
    const tmpCamPos = new THREE.Vector3();
    const tmpCamQuat = new THREE.Quaternion();
    const tmpForward = new THREE.Vector3();
    const tmpUp = new THREE.Vector3();
    const tmpToOrb = new THREE.Vector3();
    const tmpRight = new THREE.Vector3();

    // HUD element references
    let hudRoot: HTMLElement | null = null;
    let playBtn: HTMLButtonElement | null = null;
    let modeOrbitBtn: HTMLButtonElement | null = null;
    let modeFixedBtn: HTMLButtonElement | null = null;
    let telemetryEl: HTMLElement | null = null;
    const orbButtons = new Map<OrbId, HTMLButtonElement>();

    function getAudioContextCtor(): typeof AudioContext | null {
      const w = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      return w.AudioContext ?? w.webkitAudioContext ?? null;
    }

    function teardownDrone(): void {
      for (const osc of droneOscs) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore already stopped oscillators
        }
      }
      droneOscs = [];
      if (droneLfo) {
        try {
          droneLfo.stop();
          droneLfo.disconnect();
        } catch {
          // Ignore
        }
        droneLfo = null;
      }
      for (const node of droneNodes) {
        try {
          node.disconnect();
        } catch {
          // Ignore
        }
      }
      droneNodes = [];
    }

    function buildAudioGraph(): boolean {
      if (audioCtx) return true;
      const Ctor = getAudioContextCtor();
      if (!Ctor) {
        ctxRef?.setStatus('このブラウザは Web Audio API に対応していません。');
        return false;
      }

      audioCtx = new Ctor();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = masterVolume;
      masterGain.connect(audioCtx.destination);

      for (const orb of orbs) {
        const panner = audioCtx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 0.85;
        panner.maxDistance = 14;
        panner.rolloffFactor = 1.35;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 360;

        const orbGain = audioCtx.createGain();
        orbGain.gain.value = orb.enabled ? 1.0 : 0.0;

        orbGain.connect(panner);
        panner.connect(masterGain);

        orb.panner = panner;
        orb.gain = orbGain;
        updatePannerPosition(panner, orb.worldPos, audioCtx.currentTime);
      }

      // Build continuous harmonic drone synth attached to the drone orb
      const droneOrb = orbs.find((o) => o.config.id === 'drone');
      if (droneOrb?.gain) {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 460;
        filter.Q.value = 1.6;

        const droneSubGain = audioCtx.createGain();
        droneSubGain.gain.value = 0.11;

        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.22;
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        // Warm C3 + G3 + D4 open fifth/ninth voicing
        const freqs = [130.81, 196.0, 293.66];
        freqs.forEach((f, idx) => {
          if (!audioCtx) return;
          const osc = audioCtx.createOscillator();
          osc.type = idx === 1 ? 'triangle' : 'sine';
          osc.frequency.value = f;
          osc.detune.value = (idx - 1) * 4;
          osc.connect(filter);
          osc.start();
          droneOscs.push(osc);
        });

        lfo.start();
        droneLfo = lfo;

        filter.connect(droneSubGain);
        droneSubGain.connect(droneOrb.gain);
        droneNodes.push(filter, droneSubGain, lfoGain);
      }

      return true;
    }

    function triggerChimeNote(orb: OrbRuntime): void {
      if (!audioCtx || !orb.gain || !audioRunning || !orb.enabled) return;
      const now = audioCtx.currentTime;
      const freq = CHIME_SCALE[orb.stepIndex % CHIME_SCALE.length];
      orb.stepIndex += 1;

      // Fundamental + bell overtone
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const env = audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2.01, now);

      const overtoneGain = audioCtx.createGain();
      overtoneGain.gain.setValueAtTime(0.22, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.24, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

      osc1.connect(env);
      osc2.connect(overtoneGain);
      overtoneGain.connect(env);
      env.connect(orb.gain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.4);
      osc2.stop(now + 1.4);

      orb.pulseEnergy = 1.0;
    }

    function triggerPulseBeat(orb: OrbRuntime): void {
      if (!audioCtx || !orb.gain || !audioRunning || !orb.enabled) return;
      const now = audioCtx.currentTime;
      const step = orb.stepIndex % PULSE_SCALE.length;
      const freq = PULSE_SCALE[step];
      const accented = step % 4 === 0;
      orb.stepIndex += 1;

      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const env = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * (accented ? 1.0 : 0.995), now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.16);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 2.2, now);
      filter.Q.setValueAtTime(1.4, now);

      const peak = accented ? 0.34 : 0.22;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(peak, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      osc.connect(filter);
      filter.connect(env);
      env.connect(orb.gain);

      osc.start(now);
      osc.stop(now + 0.26);

      orb.pulseEnergy = accented ? 1.0 : 0.72;
    }

    async function ensureAudioStarted(): Promise<void> {
      if (disposed) return;
      if (!buildAudioGraph() || !audioCtx) return;
      try {
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        audioRunning = audioCtx.state === 'running';
        if (masterGain && audioRunning) {
          masterGain.gain.setTargetAtTime(
            masterVolume,
            audioCtx.currentTime,
            0.04,
          );
        }
        updateHudState();
        ctxRef?.setStatus(
          audioRunning
            ? 'HRTF 空間オーディオ再生中 — 頭を左右に振るか歩いて音像定位を体感してください'
            : '音声エンジンが一時停止中です。再生ボタンを押してください。',
        );
      } catch {
        ctxRef?.setStatus(
          '音声の開始がブロックされました。もう一度「空間音声を開始」をタップしてください。',
        );
      }
    }

    async function toggleAudioPlayback(): Promise<void> {
      if (!audioCtx || !audioRunning) {
        await ensureAudioStarted();
        return;
      }
      try {
        await audioCtx.suspend();
        audioRunning = false;
        updateHudState();
        ctxRef?.setStatus('空間オーディオを一時停止しました。');
      } catch {
        // Ignore suspend errors
      }
    }

    function updateHudState(): void {
      if (playBtn) {
        playBtn.textContent = audioRunning
          ? '⏸ 空間音声を一時停止'
          : '▶ 空間音声を開始 (HRTF)';
        playBtn.classList.toggle('is-primary', !audioRunning);
        playBtn.classList.toggle('is-active', audioRunning);
      }
      if (modeOrbitBtn && modeFixedBtn) {
        modeOrbitBtn.classList.toggle('is-active', motionMode === 'orbit');
        modeFixedBtn.classList.toggle('is-active', motionMode === 'fixed');
      }
      for (const orb of orbs) {
        const btn = orbButtons.get(orb.config.id);
        if (btn) {
          btn.classList.toggle('is-active', orb.enabled);
          btn.style.opacity = orb.enabled ? '1' : '0.55';
        }
      }
    }

    function recenterAroundCurrentCamera(): void {
      if (!ctxRef) return;
      if (ctxRef.isXrActive()) {
        const activeCam = ctxRef.renderer.xr.getCamera();
        activeCam.getWorldPosition(tmpCamPos);
        anchorCenter.copy(tmpCamPos);
        ctxRef.setStatus(
          '現在の頭の位置を中心に3つの音源オーブを再配置しました。',
        );
      } else {
        anchorCenter.set(0, 1.2, -0.9);
        ctxRef.setStatus('3Dプレビュー中央に3つの音源オーブを再配置しました。');
      }
      anchorInitialized = true;
    }

    function mountHud(overlayRoot: HTMLElement): void {
      const hud = document.createElement('div');
      hud.className = 'sa-hud';

      const row1 = document.createElement('div');
      row1.className = 'sa-row';

      playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'sa-btn is-primary';
      playBtn.textContent = '▶ 空間音声を開始 (HRTF)';
      playBtn.addEventListener('click', () => {
        void toggleAudioPlayback();
      });

      modeOrbitBtn = document.createElement('button');
      modeOrbitBtn.type = 'button';
      modeOrbitBtn.className = 'sa-btn is-active';
      modeOrbitBtn.textContent = '自動周回 (Orbit)';
      modeOrbitBtn.addEventListener('click', () => {
        motionMode = 'orbit';
        updateHudState();
        ctxRef?.setStatus(
          '自動周回モード: 座ったままでも360°の立体音響を体感できます。',
        );
      });

      modeFixedBtn = document.createElement('button');
      modeFixedBtn.type = 'button';
      modeFixedBtn.className = 'sa-btn';
      modeFixedBtn.textContent = '空間固定 (6DoF)';
      modeFixedBtn.addEventListener('click', () => {
        motionMode = 'fixed';
        updateHudState();
        ctxRef?.setStatus(
          '空間固定モード: 首を振ったりオーブの周りを歩いてBose音響の定位を確認できます。',
        );
      });

      const recenterBtn = document.createElement('button');
      recenterBtn.type = 'button';
      recenterBtn.className = 'sa-btn';
      recenterBtn.textContent = '位置リセット';
      recenterBtn.addEventListener('click', recenterAroundCurrentCamera);

      row1.append(playBtn, modeOrbitBtn, modeFixedBtn, recenterBtn);

      const row2 = document.createElement('div');
      row2.className = 'sa-row';

      for (const cfg of ORB_CONFIGS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sa-btn is-active';
        btn.innerHTML = `<span class="sa-dot" style="background:${cfg.colorHex};color:${cfg.colorHex};"></span>${cfg.name} (${cfg.shortDesc})`;
        btn.addEventListener('click', () => {
          const target = orbs.find((o) => o.config.id === cfg.id);
          if (!target) return;
          target.enabled = !target.enabled;
          if (target.gain && audioCtx) {
            target.gain.gain.setTargetAtTime(
              target.enabled ? 1.0 : 0.0,
              audioCtx.currentTime,
              0.05,
            );
          }
          if (target.enabled && !audioRunning) {
            void ensureAudioStarted();
          }
          updateHudState();
        });
        orbButtons.set(cfg.id, btn);
        row2.appendChild(btn);
      }

      const volWrap = document.createElement('label');
      volWrap.className = 'sa-vol';
      volWrap.innerHTML = `<span>音量</span><input type="range" min="0" max="1" step="0.02" value="${masterVolume}" />`;
      const volInput = volWrap.querySelector('input') as HTMLInputElement;
      volInput.addEventListener('input', () => {
        masterVolume = Number(volInput.value);
        if (masterGain && audioCtx) {
          masterGain.gain.setTargetAtTime(
            masterVolume,
            audioCtx.currentTime,
            0.03,
          );
        }
      });
      row2.appendChild(volWrap);

      telemetryEl = document.createElement('div');
      telemetryEl.className = 'sa-telemetry';
      telemetryEl.innerHTML = `
        <span>Web Audio: ${capabilities.webAudioAvailable ? '対応 (HRTF)' : '非対応'}</span>
        <span>再生ボタンを押すと立体音響が開始されます</span>
      `;

      hud.append(row1, row2, telemetryEl);
      hud.style.alignSelf = 'flex-start';
      const bottomBar = overlayRoot.querySelector('.xr-hud-bottom');
      if (bottomBar) {
        overlayRoot.insertBefore(hud, bottomBar);
      } else {
        overlayRoot.appendChild(hud);
      }
      hudRoot = hud;
      updateHudState();
    }

    let telemetryAccum = 0;

    return mountXrViewport(
      container,
      capabilities,
      {
        title: '空間オーディオ 3D オーブ',
        arButtonLabel: 'AR空間で立体音響を体験',
        instructions:
          '「空間音声を開始」をタップして3つの光る音源オーブを聴き比べてください。XREAL AURA のARモードでは「空間固定」にして頭を動かすと Bose チューニング空間音響の定位が際立ちます。',
        optionalFeatures: ['local-floor', 'dom-overlay'],
      },
      {
        init(ctx: XrSceneContext): void {
          ctxRef = ctx;

          // Subtle scene lighting
          const ambient = new THREE.AmbientLight(0xffffff, 0.55);
          const dirLight = new THREE.DirectionalLight(0xe0f2fe, 0.85);
          dirLight.position.set(2, 4, 2);
          ctx.scene.add(ambient, dirLight);

          // Shared geometries
          const coreGeo = new THREE.SphereGeometry(0.14, 28, 28);
          const haloGeo = new THREE.SphereGeometry(0.24, 20, 20);
          const waveGeo = new THREE.RingGeometry(0.18, 0.21, 32);
          disposableGeometries.push(coreGeo, haloGeo, waveGeo);

          for (const cfg of ORB_CONFIGS) {
            const group = new THREE.Group();

            const coreMat = new THREE.MeshStandardMaterial({
              color: cfg.colorInt,
              emissive: cfg.colorInt,
              emissiveIntensity: 0.9,
              roughness: 0.2,
              metalness: 0.1,
            });
            const coreMesh = new THREE.Mesh(coreGeo, coreMat);
            group.add(coreMesh);

            const haloMat = new THREE.MeshBasicMaterial({
              color: cfg.colorInt,
              transparent: true,
              opacity: 0.25,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const haloMesh = new THREE.Mesh(haloGeo, haloMat);
            group.add(haloMesh);

            const waveMat = new THREE.MeshBasicMaterial({
              color: cfg.colorInt,
              transparent: true,
              opacity: 0.4,
              side: THREE.DoubleSide,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const waveMesh = new THREE.Mesh(waveGeo, waveMat);
            group.add(waveMesh);

            const orbitGeo = createOrbitRingGeometry(cfg.orbitRadius);
            const orbitRingMat = new THREE.LineBasicMaterial({
              color: cfg.colorInt,
              transparent: true,
              opacity: 0.22,
            });
            const orbitRing = new THREE.LineLoop(orbitGeo, orbitRingMat);
            ctx.scene.add(orbitRing);

            disposableGeometries.push(orbitGeo);
            disposableMaterials.push(coreMat, haloMat, waveMat, orbitRingMat);
            ctx.scene.add(group);

            orbs.push({
              config: cfg,
              enabled: true,
              group,
              coreMesh,
              coreMat,
              haloMesh,
              haloMat,
              waveMesh,
              waveMat,
              orbitRing,
              orbitRingMat,
              pulseEnergy: 0,
              wavePhase: cfg.orbitPhase,
              worldPos: new THREE.Vector3(),
              panner: null,
              gain: null,
              triggerTimer: cfg.id === 'chime' ? 0.3 : 0.1,
              stepIndex: 0,
            });
          }

          mountHud(ctx.overlayRoot);
          ctx.setStatus(
            '「空間音声を開始 (HRTF)」をタップして立体音響を起動してください。',
          );
        },

        onFrame(delta: number, elapsed: number, _frame?: XRFrame): void {
          if (!ctxRef || disposed) return;
          const dt = Math.min(delta, 0.1);

          const activeCam = ctxRef.isXrActive()
            ? ctxRef.renderer.xr.getCamera()
            : ctxRef.camera;
          activeCam.getWorldPosition(tmpCamPos);
          activeCam.getWorldQuaternion(tmpCamQuat);

          if (!anchorInitialized) {
            if (ctxRef.isXrActive()) {
              anchorCenter.copy(tmpCamPos);
            } else {
              // Align with xrEngine's default 3D preview orbit target
              anchorCenter.set(0, 1.2, -0.9);
            }
            anchorInitialized = true;
          }

          tmpForward.set(0, 0, -1).applyQuaternion(tmpCamQuat).normalize();
          tmpUp.set(0, 1, 0).applyQuaternion(tmpCamQuat).normalize();
          tmpRight.crossVectors(tmpForward, tmpUp).normalize();

          const nowAudio = audioCtx ? audioCtx.currentTime : 0;
          if (audioCtx && audioRunning) {
            updateListenerPose(
              audioCtx.listener,
              tmpCamPos,
              tmpForward,
              tmpUp,
              nowAudio,
            );
          }

          let activeCount = 0;
          let nearestLabel = '-';
          let nearestDist = Infinity;

          for (const orb of orbs) {
            const cfg = orb.config;

            // Update 3D position
            if (motionMode === 'orbit') {
              const angle = elapsed * cfg.orbitSpeed + cfg.orbitPhase;
              const bob = Math.sin(elapsed * 1.4 + cfg.orbitPhase) * 0.14;
              orb.worldPos.set(
                anchorCenter.x + Math.cos(angle) * cfg.orbitRadius,
                anchorCenter.y + cfg.heightOffset + bob,
                anchorCenter.z + Math.sin(angle) * cfg.orbitRadius,
              );
              orb.orbitRing.visible = orb.enabled;
              orb.orbitRing.position.set(
                anchorCenter.x,
                anchorCenter.y + cfg.heightOffset,
                anchorCenter.z,
              );
            } else {
              const bob = Math.sin(elapsed * 1.6 + cfg.orbitPhase) * 0.06;
              orb.worldPos.set(
                anchorCenter.x + cfg.fixedOffset.x,
                anchorCenter.y + cfg.fixedOffset.y + bob,
                anchorCenter.z + cfg.fixedOffset.z,
              );
              orb.orbitRing.visible = false;
            }

            orb.group.position.copy(orb.worldPos);
            orb.waveMesh.lookAt(tmpCamPos);

            // Sync HRTF panner node
            if (orb.panner && audioCtx) {
              updatePannerPosition(orb.panner, orb.worldPos, nowAudio);
            }

            // Procedural audio triggers
            if (audioRunning && orb.enabled) {
              activeCount += 1;
              if (cfg.id === 'chime') {
                orb.triggerTimer -= dt;
                if (orb.triggerTimer <= 0) {
                  triggerChimeNote(orb);
                  orb.triggerTimer = 1.45;
                }
              } else if (cfg.id === 'pulse') {
                orb.triggerTimer -= dt;
                if (orb.triggerTimer <= 0) {
                  triggerPulseBeat(orb);
                  orb.triggerTimer = 0.545;
                }
              } else if (cfg.id === 'drone') {
                orb.pulseEnergy =
                  0.35 + 0.25 * (0.5 + 0.5 * Math.sin(elapsed * 1.38));
              }
            }

            // Animate glowing orb & ripple ring
            orb.pulseEnergy = Math.max(0, orb.pulseEnergy - dt * 2.2);
            const activeMult = orb.enabled ? 1.0 : 0.25;
            const scale =
              (1.0 + orb.pulseEnergy * 0.32) * (orb.enabled ? 1.0 : 0.72);
            orb.coreMesh.scale.setScalar(scale);
            orb.coreMat.emissiveIntensity =
              (0.55 + orb.pulseEnergy * 1.6) * activeMult;
            orb.coreMat.opacity = orb.enabled ? 1.0 : 0.35;
            orb.coreMat.transparent = !orb.enabled;

            const haloScale = 1.0 + orb.pulseEnergy * 0.65;
            orb.haloMesh.scale.setScalar(haloScale);
            orb.haloMat.opacity = (0.14 + orb.pulseEnergy * 0.34) * activeMult;

            if (orb.enabled && audioRunning) {
              orb.wavePhase =
                (orb.wavePhase + dt * (cfg.id === 'pulse' ? 1.8 : 0.9)) % 1;
              const ringScale = 1.0 + orb.wavePhase * 2.4;
              orb.waveMesh.visible = true;
              orb.waveMesh.scale.setScalar(ringScale);
              orb.waveMat.opacity = (1.0 - orb.wavePhase) * 0.45;
            } else {
              orb.waveMesh.visible = false;
            }

            if (orb.enabled) {
              const dist = tmpCamPos.distanceTo(orb.worldPos);
              if (dist < nearestDist) {
                nearestDist = dist;
                tmpToOrb.subVectors(orb.worldPos, tmpCamPos).normalize();
                const lr = tmpToOrb.dot(tmpRight);
                const fb = tmpToOrb.dot(tmpForward);
                const dirStr =
                  Math.abs(lr) > 0.38
                    ? lr > 0
                      ? '右方向'
                      : '左方向'
                    : fb >= 0
                      ? '正面方向'
                      : '背後方向';
                nearestLabel = `${cfg.name}: ${dirStr} (${dist.toFixed(1)}m)`;
              }
            }
          }

          telemetryAccum += dt;
          if (telemetryAccum >= 0.2 && telemetryEl) {
            telemetryAccum = 0;
            const yawDeg = Math.round(
              (Math.atan2(-tmpForward.x, -tmpForward.z) * 180) / Math.PI,
            );
            telemetryEl.innerHTML = `
              <span>状態: ${audioRunning ? `HRTF再生中 (${activeCount}音源)` : '停止中'} / 向き: ${yawDeg}°</span>
              <span>最近接オーブ: ${nearestLabel}</span>
            `;
          }
        },

        onSessionStart(): void {
          anchorInitialized = false;
          if (audioCtx && audioCtx.state === 'suspended' && audioRunning) {
            void audioCtx.resume();
          }
        },

        onSessionEnd(): void {
          anchorInitialized = false;
        },

        dispose(): void {
          disposed = true;
          audioRunning = false;
          teardownDrone();

          for (const orb of orbs) {
            try {
              orb.gain?.disconnect();
              orb.panner?.disconnect();
            } catch {
              // Ignore disconnect errors
            }
            orb.gain = null;
            orb.panner = null;
          }
          orbs.length = 0;

          if (masterGain) {
            try {
              masterGain.disconnect();
            } catch {
              // Ignore
            }
            masterGain = null;
          }

          if (audioCtx) {
            const ctxToClose = audioCtx;
            audioCtx = null;
            void ctxToClose.close().catch(() => {});
          }

          for (const geo of disposableGeometries) {
            geo.dispose();
          }
          disposableGeometries.length = 0;

          for (const mat of disposableMaterials) {
            mat.dispose();
          }
          disposableMaterials.length = 0;

          if (hudRoot) {
            hudRoot.remove();
            hudRoot = null;
          }
          orbButtons.clear();
          ctxRef = null;
        },
      },
    );
  },
};
