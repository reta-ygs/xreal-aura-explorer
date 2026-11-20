import './styles.css';
import { environmentModule } from './modules/environmentModule';
import { guideModule } from './modules/guideModule';
import { opticsModule } from './modules/opticsModule';
import { spatialAudioModule } from './modules/spatialAudioModule';
import { spatialHandModule } from './modules/spatialHandModule';
import type { CapabilityReport, ExperienceModule, ModuleId } from './types';

const OLED_MODE_STORAGE_KEY = 'xreal-aura-oled-passthrough-v1';

const MODULES: ExperienceModule[] = [
  opticsModule,
  spatialHandModule,
  environmentModule,
  spatialAudioModule,
  guideModule,
];

type XrCapableNavigator = Navigator & {
  xr?: {
    isSessionSupported?: (mode: string) => Promise<boolean>;
  };
  standalone?: boolean;
};

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

async function detectCapabilities(): Promise<CapabilityReport> {
  const nav = navigator as XrCapableNavigator;
  const win = window as WindowWithWebkitAudio;

  const isSecureContext = Boolean(window.isSecureContext);
  const webXrAvailable = 'xr' in nav && Boolean(nav.xr);

  let immersiveArSupported = false;
  if (webXrAvailable && typeof nav.xr?.isSessionSupported === 'function') {
    try {
      immersiveArSupported = await nav.xr.isSessionSupported('immersive-ar');
    } catch {
      immersiveArSupported = false;
    }
  }

  const webAudioAvailable =
    typeof window.AudioContext !== 'undefined' ||
    typeof win.webkitAudioContext !== 'undefined';

  const deviceMotionAvailable = typeof window.DeviceMotionEvent !== 'undefined';

  const isStandalonePwa =
    Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
    Boolean(nav.standalone);

  return {
    isSecureContext,
    webXrAvailable,
    immersiveArSupported,
    webAudioAvailable,
    deviceMotionAvailable,
    isStandalonePwa,
    userAgent: navigator.userAgent,
  };
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration may fail on non-HTTPS or restricted contexts; fail silently.
    });
  });
}

function loadOledMode(): boolean {
  try {
    return window.localStorage.getItem(OLED_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function applyOledMode(enabled: boolean): void {
  document.body.classList.toggle('oled-passthrough', enabled);
  if (enabled) {
    document.documentElement.dataset.oledMode = 'passthrough';
  } else {
    delete document.documentElement.dataset.oledMode;
  }

  const themeMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (themeMeta) {
    themeMeta.content = enabled ? '#000000' : '#05070e';
  }

  try {
    window.localStorage.setItem(OLED_MODE_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage errors
  }
}

function getModuleFromHash(): ModuleId {
  const raw = window.location.hash.replace(/^#/, '') as ModuleId;
  const matched = MODULES.find((m) => m.id === raw);
  return matched ? matched.id : MODULES[0].id;
}

function renderCapabilityPills(cap: CapabilityReport): string {
  const pills: Array<{
    label: string;
    state: 'is-ok' | 'is-warn' | 'is-info' | 'is-off';
  }> = [
    {
      label: cap.isSecureContext ? 'HTTPS / Secure' : '非HTTPS（WebXR不可）',
      state: cap.isSecureContext ? 'is-ok' : 'is-warn',
    },
    {
      label: cap.immersiveArSupported
        ? 'WebXR immersive-ar 対応'
        : cap.webXrAvailable
          ? 'WebXR APIあり（3Dプレビュー）'
          : 'WebXR未対応（3Dプレビュー）',
      state: cap.immersiveArSupported
        ? 'is-ok'
        : cap.webXrAvailable
          ? 'is-warn'
          : 'is-off',
    },
    {
      label: cap.webAudioAvailable ? 'Web Audio OK' : 'Web Audio 非対応',
      state: cap.webAudioAvailable ? 'is-ok' : 'is-off',
    },
    {
      label: cap.deviceMotionAvailable ? 'Motion Sensor' : 'Motion なし',
      state: cap.deviceMotionAvailable ? 'is-info' : 'is-off',
    },
    {
      label: cap.isStandalonePwa ? 'PWA 起動' : 'ブラウザ起動',
      state: cap.isStandalonePwa ? 'is-ok' : 'is-info',
    },
  ];

  return pills
    .map((p) => `<span class="cap-pill ${p.state}">${p.label}</span>`)
    .join('');
}

async function bootstrap(): Promise<void> {
  const appRoot = document.getElementById('app');
  if (!appRoot) return;

  registerServiceWorker();

  let oledEnabled = loadOledMode();
  applyOledMode(oledEnabled);

  const capabilities = await detectCapabilities();
  let activeModuleId: ModuleId = getModuleFromHash();
  let currentUnmount: (() => void) | null = null;

  appRoot.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="header-top">
          <div class="brand-block">
            <div class="brand-mark" aria-hidden="true">AR</div>
            <div>
              <h1 class="brand-title">XREAL AURA Explorer</h1>
              <p class="brand-subtitle">Android XR 光学・6DoF・ハンド・環境・空間オーディオ実機体験PWA</p>
            </div>
          </div>

          <div class="header-actions">
            <button
              type="button"
              id="oled-toggle-btn"
              class="oled-toggle ${oledEnabled ? 'is-active' : ''}"
              aria-pressed="${oledEnabled ? 'true' : 'false'}"
              title="背景を純黒(#000000)にしてMicro-OLEDの光学シースルー透過を最大化します"
            >
              <span class="oled-toggle-dot" aria-hidden="true"></span>
              <span id="oled-toggle-label">OLED透過モード: ${oledEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        <div class="capability-bar" aria-label="デバイス・ブラウザ対応状況">
          ${renderCapabilityPills(capabilities)}
        </div>
      </header>

      <nav class="module-nav" aria-label="体験モジュール切替">
        ${MODULES.map(
          (mod) => `
            <button
              type="button"
              class="module-card"
              data-module-id="${mod.id}"
              aria-current="false"
            >
              <div class="module-card-top">
                <span class="module-card-badge">${mod.badge}</span>
                <span class="module-card-xr">${mod.supportsWebXr ? 'WebXR対応' : 'ガイド'}</span>
              </div>
              <span class="module-card-title">${mod.title}</span>
              <span class="module-card-subtitle">${mod.subtitle}</span>
            </button>
          `,
        ).join('')}
      </nav>

      <main class="module-stage-wrap">
        <div class="module-intro" id="module-intro"></div>
        <div class="module-stage" id="module-stage"></div>
      </main>

      <footer class="app-footer">
        <span>XREAL AURA Explorer — PWA + WebXR</span>
        <span>黒(#000000)は Micro-OLED で透明表示されます</span>
      </footer>
    </div>
  `;

  const oledToggleBtn = document.getElementById(
    'oled-toggle-btn',
  ) as HTMLButtonElement | null;
  const oledToggleLabel = document.getElementById('oled-toggle-label');
  const navButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.module-card'),
  );
  const moduleIntroEl = document.getElementById('module-intro');
  const moduleStageEl = document.getElementById('module-stage');

  const mountModule = (id: ModuleId, updateHash: boolean): void => {
    const mod = MODULES.find((m) => m.id === id) ?? MODULES[0];
    activeModuleId = mod.id;

    if (currentUnmount) {
      try {
        currentUnmount();
      } catch (err) {
        console.error('Error while unmounting module:', err);
      }
      currentUnmount = null;
    }

    if (moduleStageEl) {
      moduleStageEl.innerHTML = '';
    }

    for (const btn of navButtons) {
      const isActive = btn.dataset.moduleId === mod.id;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }

    if (moduleIntroEl) {
      moduleIntroEl.innerHTML = `
        <div>
          <h2 class="module-intro-title">${mod.title} — ${mod.subtitle}</h2>
          <p class="module-intro-summary">${mod.summary}</p>
        </div>
        <span class="badge ${mod.supportsWebXr ? 'badge-violet' : ''}">
          ${mod.supportsWebXr ? (capabilities.immersiveArSupported ? 'WebXR AR Ready' : '3D Preview / WebXR') : 'Interactive Guide'}
        </span>
      `;
    }

    if (updateHash && window.location.hash !== `#${mod.id}`) {
      window.history.replaceState(null, '', `#${mod.id}`);
    }

    if (moduleStageEl) {
      currentUnmount = mod.mount(moduleStageEl, capabilities);
    }
  };

  oledToggleBtn?.addEventListener('click', () => {
    oledEnabled = !oledEnabled;
    applyOledMode(oledEnabled);
    oledToggleBtn.classList.toggle('is-active', oledEnabled);
    oledToggleBtn.setAttribute('aria-pressed', oledEnabled ? 'true' : 'false');
    if (oledToggleLabel) {
      oledToggleLabel.textContent = `OLED透過モード: ${oledEnabled ? 'ON' : 'OFF'}`;
    }
  });

  for (const btn of navButtons) {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.moduleId as ModuleId | undefined;
      if (targetId && targetId !== activeModuleId) {
        mountModule(targetId, true);
      }
    });
  }

  window.addEventListener('hashchange', () => {
    const hashId = getModuleFromHash();
    if (hashId !== activeModuleId) {
      mountModule(hashId, false);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (currentUnmount) {
      try {
        currentUnmount();
      } catch {
        // Ignore cleanup errors on unload
      }
      currentUnmount = null;
    }
  });

  mountModule(activeModuleId, false);
}

void bootstrap();
