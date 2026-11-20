import type { CapabilityReport, ExperienceModule } from '../types.ts';

type OpticsTab = 'fov' | 'ppd' | 'refresh' | 'dimming';
type ContrastPreset = 'pure-black' | 'standard' | 'medium' | 'low' | 'inverted';
type DimmingBgMode =
  | 'pure-black'
  | 'high-contrast'
  | 'vivid-gradient'
  | 'reticle';

const STYLE_ID = 'xreal-optics-lab-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .optics-lab {
      display: flex;
      flex-direction: column;
      gap: 14px;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .optics-tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    @media (max-width: 720px) {
      .optics-tabs {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .optics-tab-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
      color: #cbd5e1;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .optics-tab-btn small {
      font-size: 11px;
      font-weight: 400;
      color: #94a3b8;
    }
    .optics-tab-btn:hover {
      background: rgba(56, 189, 248, 0.12);
      border-color: rgba(56, 189, 248, 0.4);
    }
    .optics-tab-btn.is-active {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.24), rgba(99, 102, 241, 0.22));
      border-color: #38bdf8;
      color: #ffffff;
      box-shadow: 0 0 18px rgba(56, 189, 248, 0.2);
    }
    .optics-tab-btn.is-active small {
      color: #bae6fd;
    }
    .optics-panel {
      background: rgba(10, 14, 22, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .optics-panel-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .optics-panel-head h3 {
      margin: 0;
      font-size: 17px;
      color: #ffffff;
    }
    .optics-panel-head p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .optics-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .optics-chip {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: #e2e8f0;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .optics-chip:hover {
      border-color: rgba(56, 189, 248, 0.6);
    }
    .optics-chip.is-active {
      background: rgba(56, 189, 248, 0.22);
      border-color: #38bdf8;
      color: #ffffff;
    }
    .optics-canvas-wrap {
      position: relative;
      width: 100%;
      background: #000000;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 12px;
      overflow: hidden;
    }
    .optics-canvas-wrap canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .optics-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }
    .optics-stat-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .optics-stat-label {
      font-size: 11px;
      color: #94a3b8;
    }
    .optics-stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #38bdf8;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
    }
    .optics-stat-sub {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .optics-range-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #cbd5e1;
      background: rgba(255, 255, 255, 0.04);
      padding: 8px 12px;
      border-radius: 10px;
    }
    .optics-range-row input[type="range"] {
      accent-color: #38bdf8;
      flex: 1;
      min-width: 120px;
    }
    .optics-ppd-stage {
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      padding: 18px;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .optics-ppd-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }
    .optics-ppd-corners {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto auto;
      gap: 14px;
      min-height: 250px;
    }
    .optics-ppd-center {
      grid-column: 1 / -1;
      text-align: center;
      padding: 12px;
      border: 1px dashed rgba(56, 189, 248, 0.35);
      border-radius: 10px;
    }
    .optics-dimming-stage {
      position: relative;
      min-height: 290px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 18px;
      box-sizing: border-box;
    }
    .optics-dimming-levels {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }
    @media (max-width: 720px) {
      .optics-dimming-levels {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .optics-dim-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      padding: 10px;
      cursor: pointer;
      text-align: left;
      color: #e2e8f0;
      transition: all 0.15s ease;
    }
    .optics-dim-card.is-active {
      border-color: #38bdf8;
      background: rgba(56, 189, 248, 0.16);
    }
    .optics-dim-bar {
      height: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      overflow: hidden;
      margin: 6px 0;
    }
    .optics-dim-bar > span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #38bdf8, #818cf8);
    }
    .optics-callout {
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.55;
      color: #e0f2fe;
    }
    .optics-fullscreen-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: #000000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16px;
      box-sizing: border-box;
    }
    .optics-fullscreen-overlay canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .optics-fullscreen-hud {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: auto;
    }
  `;
  document.head.appendChild(style);
}

function sizeCanvasToDisplay(canvas: HTMLCanvasElement): {
  width: number;
  height: number;
  dpr: number;
} {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const targetW = Math.floor(width * dpr);
  const targetH = Math.floor(height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  return { width, height, dpr };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export const opticsModule: ExperienceModule = {
  id: 'optics',
  title: '光学 & ディスプレイラボ',
  subtitle: '70° FOV / 32 PPD / 最大120Hz / 5段階電子調光',
  badge: 'Micro-OLED',
  summary:
    'XREAL AURA の 1920×1200 Micro-OLED 光学系を実機で検証する2D/Canvasラボ。視野角比較・文字精細度・高リフレッシュレート追従・純黒シースルー調光を体験できます。',
  supportsWebXr: false,

  mount(container: HTMLElement, _capabilities: CapabilityReport): () => void {
    ensureStyles();
    container.innerHTML = '';

    let activeTab: OpticsTab = 'fov';
    let disposed = false;
    let tabCleanup: (() => void) | null = null;
    let fullscreenOverlay: HTMLElement | null = null;

    const root = document.createElement('div');
    root.className = 'optics-lab';

    const tabsNav = document.createElement('div');
    tabsNav.className = 'optics-tabs';

    const panelHost = document.createElement('div');

    const tabDefs: Array<{ id: OpticsTab; label: string; sub: string }> = [
      {
        id: 'fov',
        label: '70° FOV 体感フレーム',
        sub: '46° / 52° との視野角比較',
      },
      {
        id: 'ppd',
        label: '32 PPD 文字精細度',
        sub: '小文字・コントラスト検証',
      },
      {
        id: 'refresh',
        label: '最大120Hz 滑らかさ',
        sub: '実測FPS・UFO追従テスト',
      },
      {
        id: 'dimming',
        label: '5段階電子調光テスト',
        sub: '純黒シースルー・調光ガイド',
      },
    ];

    const tabButtons = new Map<OpticsTab, HTMLButtonElement>();
    for (const def of tabDefs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'optics-tab-btn';
      btn.innerHTML = `<span>${def.label}</span><small>${def.sub}</small>`;
      btn.addEventListener('click', () => {
        if (activeTab !== def.id) {
          activeTab = def.id;
          renderTab();
        }
      });
      tabButtons.set(def.id, btn);
      tabsNav.appendChild(btn);
    }

    root.appendChild(tabsNav);
    root.appendChild(panelHost);
    container.appendChild(root);

    function closeFullscreenOverlay(): void {
      if (fullscreenOverlay) {
        fullscreenOverlay.remove();
        fullscreenOverlay = null;
      }
    }

    function clearTab(): void {
      closeFullscreenOverlay();
      if (tabCleanup) {
        tabCleanup();
        tabCleanup = null;
      }
      panelHost.innerHTML = '';
    }

    function renderFovTab(): () => void {
      const state = {
        show46: true,
        show52: true,
        show70: true,
        showGrid: true,
        distanceM: 3.0,
      };

      const panel = document.createElement('div');
      panel.className = 'optics-panel';
      panel.innerHTML = `
        <div class="optics-panel-head">
          <div>
            <h3>70° FOV 体感フレーム比較</h3>
            <p>XREAL AURA の対角 70°（16:10 / 1920×1200）と、従来グラス（46° / 52°）の視界カバー面積を光学投影比（tan(FOV/2)）で正確に対比します。</p>
          </div>
          <div class="optics-controls">
            <button type="button" class="optics-chip is-active" data-toggle="70">70° AURA</button>
            <button type="button" class="optics-chip is-active" data-toggle="52">52° 従来上位</button>
            <button type="button" class="optics-chip is-active" data-toggle="46">46° 従来標準</button>
            <button type="button" class="optics-chip is-active" data-toggle="grid">光学グリッド</button>
            <button type="button" class="optics-chip" data-action="fullscreen">全画面エッジ確認</button>
          </div>
        </div>
      `;

      const rangeRow = document.createElement('div');
      rangeRow.className = 'optics-range-row';
      rangeRow.innerHTML = `
        <span>仮想投影距離:</span>
        <input type="range" min="1.5" max="4.5" step="0.1" value="3.0" />
        <strong data-dist-label>3.0 m</strong>
      `;
      panel.appendChild(rangeRow);

      const canvasWrap = document.createElement('div');
      canvasWrap.className = 'optics-canvas-wrap';
      canvasWrap.style.height = '340px';
      const canvas = document.createElement('canvas');
      canvasWrap.appendChild(canvas);
      panel.appendChild(canvasWrap);

      const statsGrid = document.createElement('div');
      statsGrid.className = 'optics-stats-grid';
      panel.appendChild(statsGrid);

      panelHost.appendChild(panel);

      const distInput = rangeRow.querySelector('input') as HTMLInputElement;
      const distLabel = rangeRow.querySelector(
        '[data-dist-label]',
      ) as HTMLElement;

      const calcDiagInches = (fovDeg: number, distM: number): number => {
        const diagMeters = 2 * distM * Math.tan(degToRad(fovDeg / 2));
        return diagMeters / 0.0254;
      };

      const areaRatio = (fovA: number, fovB: number): number => {
        const tA = Math.tan(degToRad(fovA / 2));
        const tB = Math.tan(degToRad(fovB / 2));
        return (tA * tA) / (tB * tB);
      };

      const updateStats = (): void => {
        const in70 = calcDiagInches(70, state.distanceM);
        const in52 = calcDiagInches(52, state.distanceM);
        const in46 = calcDiagInches(46, state.distanceM);
        const ratio46 = areaRatio(70, 46);
        const ratio52 = areaRatio(70, 52);

        statsGrid.innerHTML = `
          <div class="optics-stat-card">
            <div class="optics-stat-label">70° AURA 仮想サイズ (${state.distanceM.toFixed(1)}m先)</div>
            <div class="optics-stat-value">${Math.round(in70)} インチ</div>
            <div class="optics-stat-sub">1920×1200 (16:10) / 32 PPD</div>
          </div>
          <div class="optics-stat-card">
            <div class="optics-stat-label">46° 比の表示面積</div>
            <div class="optics-stat-value">${ratio46.toFixed(2)} 倍</div>
            <div class="optics-stat-sub">46° 相当: ${Math.round(in46)} インチ</div>
          </div>
          <div class="optics-stat-card">
            <div class="optics-stat-label">52° 比の表示面積</div>
            <div class="optics-stat-value">${ratio52.toFixed(2)} 倍</div>
            <div class="optics-stat-sub">52° 相当: ${Math.round(in52)} インチ</div>
          </div>
        `;
      };

      const drawFovCanvas = (
        targetCanvas: HTMLCanvasElement,
        fullMode: boolean,
      ): void => {
        const ctx = targetCanvas.getContext('2d');
        if (!ctx) return;
        const { width, height, dpr } = sizeCanvasToDisplay(targetCanvas);
        ctx.save();
        ctx.scale(dpr, dpr);

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;
        const padding = fullMode ? 18 : 26;
        const availW = Math.max(80, width - padding * 2);
        const availH = Math.max(80, height - padding * 2);

        // Aspect 16:10 (1.6) for XREAL AURA 1920x1200
        const aspect = 16 / 10;
        let maxW = availW;
        let maxH = maxW / aspect;
        if (maxH > availH) {
          maxH = availH;
          maxW = maxH * aspect;
        }

        const tan70 = Math.tan(degToRad(35));

        if (state.showGrid) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
          ctx.lineWidth = 1;
          const step = 32;
          for (let x = cx % step; x < width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = cy % step; y < height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }

        const drawFrame = (
          fovDeg: number,
          stroke: string,
          fill: string,
          label: string,
          dash: number[],
        ): void => {
          const scale = Math.tan(degToRad(fovDeg / 2)) / tan70;
          const w = maxW * scale;
          const h = maxH * scale;
          const x = cx - w / 2;
          const y = cy - h / 2;

          ctx.save();
          ctx.fillStyle = fill;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = stroke;
          ctx.lineWidth = fovDeg === 70 ? 2.5 : 1.75;
          ctx.setLineDash(dash);
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([]);

          // Corner ticks
          const tick = 12;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x, y + tick);
          ctx.lineTo(x, y);
          ctx.lineTo(x + tick, y);
          ctx.moveTo(x + w - tick, y);
          ctx.lineTo(x + w, y);
          ctx.lineTo(x + w, y + tick);
          ctx.moveTo(x, y + h - tick);
          ctx.lineTo(x, y + h);
          ctx.lineTo(x + tick, y + h);
          ctx.moveTo(x + w - tick, y + h);
          ctx.lineTo(x + w, y + h);
          ctx.lineTo(x + w, y + h - tick);
          ctx.stroke();

          ctx.fillStyle = stroke;
          ctx.font = '600 12px system-ui, sans-serif';
          ctx.fillText(label, x + 10, y + 18);
          ctx.restore();
        };

        if (state.show70) {
          drawFrame(
            70,
            '#38bdf8',
            'rgba(56, 189, 248, 0.08)',
            `70° XREAL AURA (${Math.round(calcDiagInches(70, state.distanceM))}")`,
            [],
          );
        }
        if (state.show52) {
          drawFrame(
            52,
            '#a78bfa',
            'rgba(167, 139, 250, 0.08)',
            `52° 従来上位 (${Math.round(calcDiagInches(52, state.distanceM))}")`,
            [6, 4],
          );
        }
        if (state.show46) {
          drawFrame(
            46,
            '#fbbf24',
            'rgba(251, 191, 36, 0.09)',
            `46° 従来標準 (${Math.round(calcDiagInches(46, state.distanceM))}")`,
            [4, 4],
          );
        }

        // Center optical reticle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.moveTo(cx - 18, cy);
        ctx.lineTo(cx + 18, cy);
        ctx.moveTo(cx, cy - 18);
        ctx.lineTo(cx, cy + 18);
        ctx.stroke();

        ctx.restore();
      };

      const redrawAll = (): void => {
        updateStats();
        drawFovCanvas(canvas, false);
        const fsCanvas = fullscreenOverlay?.querySelector('canvas');
        if (fsCanvas) drawFovCanvas(fsCanvas, true);
      };

      panel
        .querySelectorAll<HTMLButtonElement>('[data-toggle]')
        .forEach((btn) => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.toggle;
            if (key === '70') state.show70 = !state.show70;
            if (key === '52') state.show52 = !state.show52;
            if (key === '46') state.show46 = !state.show46;
            if (key === 'grid') state.showGrid = !state.showGrid;
            btn.classList.toggle('is-active');
            redrawAll();
          });
        });

      const fsBtn = panel.querySelector<HTMLButtonElement>(
        '[data-action="fullscreen"]',
      );
      fsBtn?.addEventListener('click', () => {
        closeFullscreenOverlay();
        const overlay = document.createElement('div');
        overlay.className = 'optics-fullscreen-overlay';
        const fsCanvas = document.createElement('canvas');
        const hud = document.createElement('div');
        hud.className = 'optics-fullscreen-hud';
        hud.innerHTML = `
          <span style="font-size:13px;color:#bae6fd;background:rgba(0,0,0,0.7);padding:6px 12px;border-radius:999px;border:1px solid rgba(56,189,248,0.4);">
            70° エッジ・四隅の歪み＆ケラレ確認モード（AURA実機で視界の端を確認してください）
          </span>
          <button type="button" class="optics-chip is-active">閉じる</button>
        `;
        hud
          .querySelector('button')
          ?.addEventListener('click', closeFullscreenOverlay);
        overlay.appendChild(fsCanvas);
        overlay.appendChild(hud);
        document.body.appendChild(overlay);
        fullscreenOverlay = overlay;
        requestAnimationFrame(() => drawFovCanvas(fsCanvas, true));
      });

      distInput.addEventListener('input', () => {
        state.distanceM = Number(distInput.value);
        distLabel.textContent = `${state.distanceM.toFixed(1)} m`;
        redrawAll();
      });

      const ro = new ResizeObserver(() => redrawAll());
      ro.observe(canvasWrap);
      window.addEventListener('resize', redrawAll);
      redrawAll();

      return () => {
        ro.disconnect();
        window.removeEventListener('resize', redrawAll);
        closeFullscreenOverlay();
      };
    }

    function renderPpdTab(): () => void {
      let fontSizePx = 14;
      let contrast: ContrastPreset = 'pure-black';
      let cornerMode = false;

      const contrastStyles: Record<
        ContrastPreset,
        { label: string; bg: string; fg: string; muted: string; ratio: string }
      > = {
        'pure-black': {
          label: '純黒OLED (∞:1)',
          bg: '#000000',
          fg: '#ffffff',
          muted: '#94a3b8',
          ratio: '21:1 / OLED黒=透過',
        },
        standard: {
          label: '標準ダーク (12:1)',
          bg: '#111827',
          fg: '#e2e8f0',
          muted: '#94a3b8',
          ratio: '約 12.6:1',
        },
        medium: {
          label: '中コントラスト (6:1)',
          bg: '#1e293b',
          fg: '#cbd5e1',
          muted: '#94a3b8',
          ratio: '約 6.4:1',
        },
        low: {
          label: '低コントラスト (3.2:1)',
          bg: '#262f3f',
          fg: '#8a9bb3',
          muted: '#64748b',
          ratio: '約 3.2:1',
        },
        inverted: {
          label: '白背景・黒文字',
          bg: '#f8fafc',
          fg: '#020617',
          muted: '#475569',
          ratio: '20:1（高輝度発光）',
        },
      };

      const panel = document.createElement('div');
      panel.className = 'optics-panel';
      panel.innerHTML = `
        <div class="optics-panel-head">
          <div>
            <h3>32 PPD 文字精細度チェッカー</h3>
            <p>1920×1200 Micro-OLED（約32 PPD）の極小テキスト視認性・日本語漢字の潰れ・サブピクセル滲み・四隅の解像感を確認します。</p>
          </div>
          <div class="optics-controls" data-size-controls></div>
        </div>
        <div class="optics-controls" data-contrast-controls></div>
      `;

      const sizeHost = panel.querySelector(
        '[data-size-controls]',
      ) as HTMLElement;
      const contrastHost = panel.querySelector(
        '[data-contrast-controls]',
      ) as HTMLElement;

      const stage = document.createElement('div');
      stage.className = 'optics-ppd-stage';
      panel.appendChild(stage);

      const linePairWrap = document.createElement('div');
      linePairWrap.className = 'optics-canvas-wrap';
      linePairWrap.style.height = '110px';
      const lineCanvas = document.createElement('canvas');
      linePairWrap.appendChild(lineCanvas);
      panel.appendChild(linePairWrap);

      panelHost.appendChild(panel);

      const sizes = [10, 12, 14, 16, 20, 26];
      const sizeButtons: HTMLButtonElement[] = [];
      for (const sz of sizes) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `optics-chip ${sz === fontSizePx ? 'is-active' : ''}`;
        btn.textContent = `${sz}px`;
        btn.addEventListener('click', () => {
          fontSizePx = sz;
          sizeButtons.forEach((b) => {
            b.classList.toggle('is-active', b === btn);
          });
          updateStage();
        });
        sizeButtons.push(btn);
        sizeHost.appendChild(btn);
      }

      const cornerBtn = document.createElement('button');
      cornerBtn.type = 'button';
      cornerBtn.className = 'optics-chip';
      cornerBtn.textContent = '四隅エッジ検証';
      cornerBtn.addEventListener('click', () => {
        cornerMode = !cornerMode;
        cornerBtn.classList.toggle('is-active', cornerMode);
        updateStage();
      });
      sizeHost.appendChild(cornerBtn);

      const contrastButtons = new Map<ContrastPreset, HTMLButtonElement>();
      (Object.keys(contrastStyles) as ContrastPreset[]).forEach((key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `optics-chip ${key === contrast ? 'is-active' : ''}`;
        btn.textContent = contrastStyles[key].label;
        btn.addEventListener('click', () => {
          contrast = key;
          contrastButtons.forEach((b, k) => {
            b.classList.toggle('is-active', k === key);
          });
          updateStage();
        });
        contrastButtons.set(key, btn);
        contrastHost.appendChild(btn);
      });

      const drawLinePairs = (): void => {
        const ctx = lineCanvas.getContext('2d');
        if (!ctx) return;
        const { width, height, dpr } = sizeCanvasToDisplay(lineCanvas);
        const palette = contrastStyles[contrast];
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.fillStyle = palette.bg;
        ctx.fillRect(0, 0, width, height);

        const blocks = [
          { label: '1px 縦縞 (限界解像)', pitch: 2, vertical: true },
          { label: '2px 縦縞', pitch: 4, vertical: true },
          { label: '1px 横縞', pitch: 2, vertical: false },
          { label: '2px 横縞', pitch: 4, vertical: false },
        ];
        const pad = 12;
        const gap = 12;
        const blockW = Math.max(
          40,
          (width - pad * 2 - gap * (blocks.length - 1)) / blocks.length,
        );
        const barTop = 28;
        const barH = Math.max(24, height - barTop - 12);

        blocks.forEach((b, i) => {
          const x0 = pad + i * (blockW + gap);
          ctx.fillStyle = palette.muted;
          ctx.font = '600 11px system-ui, sans-serif';
          ctx.fillText(b.label, x0, 18);

          ctx.fillStyle = palette.fg;
          if (b.vertical) {
            const stripe = b.pitch / 2;
            for (let x = 0; x < blockW; x += b.pitch) {
              ctx.fillRect(x0 + x, barTop, stripe, barH);
            }
          } else {
            const stripe = b.pitch / 2;
            for (let y = 0; y < barH; y += b.pitch) {
              ctx.fillRect(x0, barTop + y, blockW, stripe);
            }
          }
        });
        ctx.restore();
      };

      const updateStage = (): void => {
        const palette = contrastStyles[contrast];
        stage.style.backgroundColor = palette.bg;
        stage.style.color = palette.fg;

        if (cornerMode) {
          stage.innerHTML = `
            <div class="optics-ppd-corners" style="font-size:${fontSizePx}px;line-height:1.5;">
              <div><strong>左上エッジ (${fontSizePx}px)</strong><br/>光学シースルー・鬱薔薇 0O1lI</div>
              <div style="text-align:right;"><strong>右上エッジ (${fontSizePx}px)</strong><br/>空間音響 32 PPD 1920×1200</div>
              <div class="optics-ppd-center">
                <div style="font-size:12px;color:${palette.muted};margin-bottom:4px;">中央スイートスポット vs 四隅のピント・色収差を比較 (${palette.ratio})</div>
                <strong>XREAL AURA 中央基準テキスト — 細密漢字「認識・解像・透明」 / const fov = 70;</strong>
              </div>
              <div style="align-self:end;"><strong>左下エッジ (${fontSizePx}px)</strong><br/>Micro-OLED 120Hz 追従</div>
              <div style="text-align:right;align-self:end;"><strong>右下エッジ (${fontSizePx}px)</strong><br/>Android XR / WebXR 対応</div>
            </div>
          `;
        } else {
          stage.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:12px;color:${palette.muted};">
              <span>現在サイズ: <strong style="color:${palette.fg};">${fontSizePx}px</strong> / コントラスト: ${palette.ratio}</span>
              <span>実機チェック: 細画数の漢字と 0/O・1/l/I の判別</span>
            </div>
            <div class="optics-ppd-grid" style="font-size:${fontSizePx}px;line-height:1.6;">
              <div>
                <div style="font-size:11px;color:${palette.muted};margin-bottom:4px;">日本語・高画数漢字</div>
                <div>XREAL AURA の 32 PPD 光学系で、長文ドキュメントや「鬱」「薔薇」「醤油」「議事録」などの細密な漢字が滲まずに読めるか確認します。</div>
              </div>
              <div>
                <div style="font-size:11px;color:${palette.muted};margin-bottom:4px;">コード / 等幅・類似文字</div>
                <div style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">
                  const ppd = 32; // 0O1lI | {} [] =&gt;<br/>
                  if (hz &gt;= 120 &amp;&amp; fov === 70) {<br/>
                  &nbsp;&nbsp;return "Sharp Micro-OLED";<br/>
                  }
                </div>
              </div>
              <div>
                <div style="font-size:11px;color:${palette.muted};margin-bottom:4px;">サイズ段階サンプル</div>
                <div style="line-height:1.5;">
                  <div style="font-size:10px;">10px: 極小注釈テキスト 0123456789 光学解像度</div>
                  <div style="font-size:12px;">12px: UIラベル・チャット本文 0123456789</div>
                  <div style="font-size:16px;">16px: 標準本文・Web記事 0123456789</div>
                </div>
              </div>
            </div>
          `;
        }
        drawLinePairs();
      };

      const ro = new ResizeObserver(() => drawLinePairs());
      ro.observe(linePairWrap);
      updateStage();

      return () => {
        ro.disconnect();
      };
    }

    function renderRefreshTab(): () => void {
      let speedPxPerSec = 520;
      let paused = false;
      let showGrid = true;
      let rafId = 0;

      const panel = document.createElement('div');
      panel.className = 'optics-panel';
      panel.innerHTML = `
        <div class="optics-panel-head">
          <div>
            <h3>最大120Hz 滑らかさチェッカー（UFO追従テスト）</h3>
            <p>移動するターゲットを目で追い（追従視）、ネイティブ高リフレッシュレートと 60Hz / 30Hz 相当の残像・カクつきの差を体感してください。</p>
          </div>
          <div class="optics-controls">
            <button type="button" class="optics-chip" data-speed="280">遅い</button>
            <button type="button" class="optics-chip is-active" data-speed="520">標準</button>
            <button type="button" class="optics-chip" data-speed="820">高速</button>
            <button type="button" class="optics-chip" data-speed="1150">超高速</button>
            <button type="button" class="optics-chip is-active" data-action="grid">背景ガイド</button>
            <button type="button" class="optics-chip" data-action="pause">一時停止</button>
          </div>
        </div>
      `;

      const statsGrid = document.createElement('div');
      statsGrid.className = 'optics-stats-grid';
      statsGrid.innerHTML = `
        <div class="optics-stat-card">
          <div class="optics-stat-label">実測リフレッシュ / FPS</div>
          <div class="optics-stat-value" data-fps>-- FPS</div>
          <div class="optics-stat-sub" data-tier>計測中...</div>
        </div>
        <div class="optics-stat-card">
          <div class="optics-stat-label">平均フレーム時間</div>
          <div class="optics-stat-value" data-ms>-- ms</div>
          <div class="optics-stat-sub">120Hz目標: 8.33 ms / 60Hz: 16.67 ms</div>
        </div>
        <div class="optics-stat-card">
          <div class="optics-stat-label">移動速度</div>
          <div class="optics-stat-value" data-speed-val>520 px/s</div>
          <div class="optics-stat-sub">追従視で文字・輪郭の鮮明さを比較</div>
        </div>
      `;
      panel.appendChild(statsGrid);

      const canvasWrap = document.createElement('div');
      canvasWrap.className = 'optics-canvas-wrap';
      canvasWrap.style.height = '310px';
      const canvas = document.createElement('canvas');
      canvasWrap.appendChild(canvas);
      panel.appendChild(canvasWrap);

      panelHost.appendChild(panel);

      const fpsEl = statsGrid.querySelector('[data-fps]') as HTMLElement;
      const tierEl = statsGrid.querySelector('[data-tier]') as HTMLElement;
      const msEl = statsGrid.querySelector('[data-ms]') as HTMLElement;
      const speedValEl = statsGrid.querySelector(
        '[data-speed-val]',
      ) as HTMLElement;

      const speedBtns = Array.from(
        panel.querySelectorAll<HTMLButtonElement>('[data-speed]'),
      );
      speedBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          speedPxPerSec = Number(btn.dataset.speed);
          speedValEl.textContent = `${speedPxPerSec} px/s`;
          speedBtns.forEach((b) => {
            b.classList.toggle('is-active', b === btn);
          });
        });
      });

      const gridBtn = panel.querySelector<HTMLButtonElement>(
        '[data-action="grid"]',
      );
      gridBtn?.addEventListener('click', () => {
        showGrid = !showGrid;
        gridBtn.classList.toggle('is-active', showGrid);
      });

      const pauseBtn = panel.querySelector<HTMLButtonElement>(
        '[data-action="pause"]',
      );
      pauseBtn?.addEventListener('click', () => {
        paused = !paused;
        pauseBtn.textContent = paused ? '再開' : '一時停止';
        pauseBtn.classList.toggle('is-active', paused);
      });

      const frameTimestamps: number[] = [];
      const frameDeltas: number[] = [];
      let lastTime = performance.now();
      let simTimeSec = 0;
      let lastStatUpdate = 0;

      const drawUfo = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        accent: string,
        label: string,
      ): void => {
        // Motion bar behind UFO
        ctx.fillStyle = accent;
        ctx.fillRect(x - 36, y - 22, 6, 44);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 27, y - 22, 3, 44);

        // UFO dome
        ctx.beginPath();
        ctx.ellipse(x + 12, y - 4, 16, 10, 0, Math.PI, 0);
        ctx.fillStyle = '#e0f2fe';
        ctx.fill();

        // UFO saucer body
        ctx.beginPath();
        ctx.ellipse(x + 12, y + 3, 28, 9, 0, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();

        // Cockpit dots
        ctx.fillStyle = '#020617';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(x + 12 + i * 10, y + 3, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Crisp text tag on moving object for pursuit sharpness check
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 10px ui-monospace, monospace';
        ctx.fillText(label, x - 6, y + 23);
      };

      const loop = (now: number): void => {
        if (disposed) return;
        const dtMs = Math.min(100, Math.max(0.1, now - lastTime));
        lastTime = now;

        frameTimestamps.push(now);
        while (frameTimestamps.length > 0 && now - frameTimestamps[0] > 1000) {
          frameTimestamps.shift();
        }
        frameDeltas.push(dtMs);
        if (frameDeltas.length > 90) frameDeltas.shift();

        if (!paused) {
          simTimeSec += dtMs / 1000;
        }

        if (now - lastStatUpdate > 200 && frameDeltas.length > 4) {
          lastStatUpdate = now;
          const avgMs =
            frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
          const fps = Math.round(1000 / avgMs);
          fpsEl.textContent = `${fps} FPS`;
          msEl.textContent = `${avgMs.toFixed(2)} ms`;
          if (fps >= 105) {
            tierEl.textContent = '120Hz 高リフレッシュ動作を検出！';
          } else if (fps >= 78) {
            tierEl.textContent = '90Hz 動作を検出';
          } else {
            tierEl.textContent = '60Hz 動作（端末/ブラウザの上限に準拠）';
          }
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { width, height, dpr } = sizeCanvasToDisplay(canvas);
          ctx.save();
          ctx.scale(dpr, dpr);

          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          const lanes = [
            {
              title: 'フルレート (最大120Hz Native)',
              hz: 0,
              color: '#38bdf8',
              tag: 'NATIVE',
            },
            {
              title: '60Hz 相当 (ステップ再現)',
              hz: 60,
              color: '#a78bfa',
              tag: '60HZ',
            },
            {
              title: '30Hz 相当 (低レート比較)',
              hz: 30,
              color: '#fb923c',
              tag: '30HZ',
            },
          ];

          const graphH = 38;
          const laneAreaH = height - graphH;
          const laneH = laneAreaH / lanes.length;

          lanes.forEach((lane, idx) => {
            const top = idx * laneH;
            const cy = top + laneH * 0.56;

            if (showGrid) {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
              ctx.lineWidth = 1;
              for (let x = 0; x < width; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x, top + laneH);
                ctx.stroke();
              }
            }

            // Lane divider
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.beginPath();
            ctx.moveTo(0, top + laneH);
            ctx.lineTo(width, top + laneH);
            ctx.stroke();

            // Lane label
            ctx.fillStyle = lane.color;
            ctx.font = '600 12px system-ui, sans-serif';
            ctx.fillText(lane.title, 12, top + 18);

            const t =
              lane.hz === 0
                ? simTimeSec
                : Math.floor(simTimeSec * lane.hz) / lane.hz;
            const span = width + 120;
            const x = ((t * speedPxPerSec) % span) - 60;
            drawUfo(ctx, x, cy, lane.color, lane.tag);
          });

          // Mini frame-time graph at bottom
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(0, laneAreaH, width, graphH);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '500 10px ui-monospace, monospace';
          ctx.fillText('Frame Time (ms)', 10, laneAreaH + 14);

          const barW = Math.max(2, (width - 120) / 90);
          frameDeltas.forEach((d, i) => {
            const clamped = Math.min(33, d);
            const h = (clamped / 33) * (graphH - 10);
            ctx.fillStyle =
              d <= 10 ? '#38bdf8' : d <= 18 ? '#a78bfa' : '#f97316';
            ctx.fillRect(
              112 + i * barW,
              height - h - 3,
              Math.max(1, barW - 1),
              h,
            );
          });

          ctx.restore();
        }

        rafId = requestAnimationFrame(loop);
      };

      rafId = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(rafId);
      };
    }

    function renderDimmingTab(): () => void {
      let bgMode: DimmingBgMode = 'pure-black';
      let selectedLevel = 3;

      const levels = [
        {
          lv: 1,
          name: 'Lv.1 最明（透過優先）',
          pct: 20,
          desc: '移動中・周囲確認に最適。現実視界が最もクリア。',
        },
        {
          lv: 2,
          name: 'Lv.2 弱調光',
          pct: 40,
          desc: '明るい室内でHUDと現実をバランスよく重ねる。',
        },
        {
          lv: 3,
          name: 'Lv.3 標準バランス',
          pct: 60,
          desc: 'テキスト作業・日常のARアプリに標準的な見やすさ。',
        },
        {
          lv: 4,
          name: 'Lv.4 強調光',
          pct: 80,
          desc: '窓際や照明下でも映像コントラストをしっかり確保。',
        },
        {
          lv: 5,
          name: 'Lv.5 最暗（没入・映画）',
          pct: 100,
          desc: '最大遮光。Micro-OLEDの発色と黒の締まりを最大化。',
        },
      ];

      const panel = document.createElement('div');
      panel.className = 'optics-panel';
      panel.innerHTML = `
        <div class="optics-panel-head">
          <div>
            <h3>5段階電子調光 &amp; 純黒シースルーテスト</h3>
            <p>光学シースルーの Micro-OLED では<strong>「純黒 (#000000) ＝ 発光ゼロ ＝ 透明」</strong>になります。背景パターンを切り替えながら、AURA本体の調光変化を確認してください。</p>
          </div>
          <div class="optics-controls" data-bg-controls>
            <button type="button" class="optics-chip is-active" data-bg="pure-black">純黒 (#000) シースルー</button>
            <button type="button" class="optics-chip" data-bg="high-contrast">高コントラスト市松</button>
            <button type="button" class="optics-chip" data-bg="vivid-gradient">ビビッド発色</button>
            <button type="button" class="optics-chip" data-bg="reticle">透視レティクル</button>
          </div>
        </div>
        <div class="optics-callout">
          <strong>物理ボタン操作ガイド：</strong> XREAL AURA 本体の<strong>調光ボタン（物理ボタン）</strong>を1回ずつ押して、5段階の電子調光を順番に切り替えてみてください。
          「純黒 (#000)」表示中に切り替えると、現実世界の明るさだけが変化し、浮いているHUD文字のコントラストが劇的に高まる仕組みが直感的にわかります。
        </div>
      `;

      const stage = document.createElement('div');
      stage.className = 'optics-dimming-stage';
      panel.appendChild(stage);

      const levelRow = document.createElement('div');
      levelRow.className = 'optics-dimming-levels';
      panel.appendChild(levelRow);

      panelHost.appendChild(panel);

      const bgButtons = Array.from(
        panel.querySelectorAll<HTMLButtonElement>('[data-bg]'),
      );
      bgButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          bgMode = btn.dataset.bg as DimmingBgMode;
          bgButtons.forEach((b) => {
            b.classList.toggle('is-active', b === btn);
          });
          renderStage();
        });
      });

      const renderLevels = (): void => {
        levelRow.innerHTML = '';
        for (const item of levels) {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = `optics-dim-card ${item.lv === selectedLevel ? 'is-active' : ''}`;
          card.innerHTML = `
            <div style="font-size:12px;font-weight:700;color:#ffffff;">${item.name}</div>
            <div class="optics-dim-bar"><span style="width:${item.pct}%;"></span></div>
            <div style="font-size:11px;color:#94a3b8;line-height:1.4;">${item.desc}</div>
          `;
          card.addEventListener('click', () => {
            selectedLevel = item.lv;
            renderLevels();
            renderStage();
          });
          levelRow.appendChild(card);
        }
      };

      const renderStage = (): void => {
        const lvInfo = levels.find((l) => l.lv === selectedLevel) ?? levels[2];
        stage.style.background = '#000000';
        stage.style.backgroundImage = 'none';

        if (bgMode === 'pure-black') {
          stage.style.background = '#000000';
          stage.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#38bdf8;font-weight:700;font-size:13px;">PURE BLACK #000000 — 透過エリア</span>
              <span style="color:#e2e8f0;font-size:12px;border:1px solid rgba(255,255,255,0.28);padding:3px 10px;border-radius:999px;">目安: ${lvInfo.name}</span>
            </div>
            <div style="text-align:center;margin:28px 0;">
              <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0.04em;">この黒背景は AURA 上で「透明」です</div>
              <div style="font-size:13px;color:#94a3b8;margin-top:8px;">黒い部分の奥にある現実の部屋を見ながら、本体の調光ボタンを押して透過率の変化を確認してください。</div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#38bdf8;font-family:ui-monospace,monospace;">
              <span>RGB(0, 0, 0) = 0 nit</span>
              <span>HUD Text = High Luminance</span>
            </div>
          `;
        } else if (bgMode === 'high-contrast') {
          stage.style.backgroundImage =
            'conic-gradient(#000000 90deg, #ffffff 90deg 180deg, #000000 180deg 270deg, #ffffff 270deg)';
          stage.style.backgroundSize = '64px 64px';
          stage.innerHTML = `
            <div style="align-self:flex-start;background:rgba(0,0,0,0.88);color:#fff;padding:8px 14px;border-radius:10px;border:1px solid #38bdf8;font-size:13px;">
              <strong>高コントラスト市松パターン</strong>：白ブロックと純黒（透過）ブロックの境界でゴースト・滲みを確認
            </div>
            <div style="align-self:flex-end;background:rgba(0,0,0,0.88);color:#bae6fd;padding:6px 12px;border-radius:10px;font-size:12px;">
              調光を強く（Lv.4〜5）するほど、黒部分の奥の背景が消えてコントラストが際立ちます
            </div>
          `;
        } else if (bgMode === 'vivid-gradient') {
          stage.style.background =
            'linear-gradient(125deg, #020617 0%, #0ea5e9 25%, #6366f1 50%, #ec4899 75%, #f59e0b 100%)';
          stage.innerHTML = `
            <div style="background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);padding:10px 14px;border-radius:10px;align-self:flex-start;">
              <strong style="color:#fff;font-size:14px;">Micro-OLED ビビッド発色チェック</strong>
              <div style="color:#e2e8f0;font-size:12px;margin-top:2px;">Lv.1（透過優先）と Lv.5（最大遮光）で、彩度・階調の濃さがどれだけ変わるか見比べてください。</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;">
              <div style="height:44px;border-radius:8px;background:#ef4444;border:1px solid rgba(255,255,255,0.4);"></div>
              <div style="height:44px;border-radius:8px;background:#f59e0b;border:1px solid rgba(255,255,255,0.4);"></div>
              <div style="height:44px;border-radius:8px;background:#22c55e;border:1px solid rgba(255,255,255,0.4);"></div>
              <div style="height:44px;border-radius:8px;background:#06b6d4;border:1px solid rgba(255,255,255,0.4);"></div>
              <div style="height:44px;border-radius:8px;background:#6366f1;border:1px solid rgba(255,255,255,0.4);"></div>
              <div style="height:44px;border-radius:8px;background:#000000;border:1px solid rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;">#000</div>
            </div>
          `;
        } else {
          stage.style.background = '#000000';
          stage.innerHTML = `
            <div style="display:flex;justify-content:space-between;color:#38bdf8;font-size:18px;font-family:ui-monospace,monospace;">
              <span>┌─</span>
              <span style="font-size:12px;color:#94a3b8;">実世界透視レティクル（純黒98%）</span>
              <span>─┐</span>
            </div>
            <div style="text-align:center;color:#38bdf8;font-size:28px;font-weight:300;letter-spacing:0.2em;">＋</div>
            <div style="display:flex;justify-content:space-between;color:#38bdf8;font-size:18px;font-family:ui-monospace,monospace;">
              <span>└─</span>
              <span style="font-size:12px;color:#94a3b8;">現実の照明や窓を見ながら調光ボタンをテスト</span>
              <span>─┘</span>
            </div>
          `;
        }
      };

      renderLevels();
      renderStage();

      return () => {
        // No async timers to cancel in dimming tab
      };
    }

    function renderTab(): void {
      clearTab();
      tabButtons.forEach((btn, id) => {
        btn.classList.toggle('is-active', id === activeTab);
      });
      if (activeTab === 'fov') {
        tabCleanup = renderFovTab();
      } else if (activeTab === 'ppd') {
        tabCleanup = renderPpdTab();
      } else if (activeTab === 'refresh') {
        tabCleanup = renderRefreshTab();
      } else {
        tabCleanup = renderDimmingTab();
      }
    }

    renderTab();

    return () => {
      disposed = true;
      clearTab();
      container.innerHTML = '';
    };
  },
};
