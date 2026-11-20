import * as THREE from 'three';
import type { CapabilityReport, XrSceneContext, XrSceneHooks } from '../types';

export interface XrViewportOptions {
  title: string;
  arButtonLabel?: string;
  instructions: string;
  optionalFeatures?: string[];
}

interface OrbitState {
  target: THREE.Vector3;
  radius: number;
  theta: number;
  phi: number;
}

const DEFAULT_ORBIT_TARGET = new THREE.Vector3(0, 1.2, -0.9);
const DEFAULT_ORBIT_RADIUS = 1.95;
const DEFAULT_ORBIT_THETA = 0;
const DEFAULT_ORBIT_PHI = 1.4;

export function mountXrViewport(
  container: HTMLElement,
  capabilities: CapabilityReport,
  options: XrViewportOptions,
  hooks: XrSceneHooks,
): () => void {
  const defaultArLabel = options.arButtonLabel ?? 'WebXR (AR) 開始';

  // Root viewport wrapper
  const root = document.createElement('div');
  root.className = 'xr-viewport';
  root.style.position = 'relative';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.minHeight = '520px';
  root.style.borderRadius = '16px';
  root.style.overflow = 'hidden';
  root.style.background =
    'radial-gradient(circle at 50% 35%, #121c30 0%, #060913 62%, #000000 100%)';
  root.style.border = '1px solid rgba(148, 163, 184, 0.2)';
  root.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.45)';
  root.style.userSelect = 'none';
  root.style.touchAction = 'none';
  root.style.fontFamily =
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif';
  container.appendChild(root);

  // Canvas host
  const canvasHost = document.createElement('div');
  canvasHost.className = 'xr-canvas-host';
  canvasHost.style.position = 'absolute';
  canvasHost.style.inset = '0';
  canvasHost.style.width = '100%';
  canvasHost.style.height = '100%';
  root.appendChild(canvasHost);

  // DOM Overlay root (used both in 3D preview and WebXR dom-overlay)
  const overlayRoot = document.createElement('div');
  overlayRoot.className = 'xr-overlay-root';
  overlayRoot.style.position = 'absolute';
  overlayRoot.style.inset = '0';
  overlayRoot.style.pointerEvents = 'none';
  overlayRoot.style.display = 'flex';
  overlayRoot.style.flexDirection = 'column';
  overlayRoot.style.justifyContent = 'space-between';
  overlayRoot.style.padding = '14px';
  overlayRoot.style.gap = '10px';
  overlayRoot.style.zIndex = '10';
  overlayRoot.style.boxSizing = 'border-box';
  root.appendChild(overlayRoot);

  // Top HUD bar
  const topBar = document.createElement('div');
  topBar.className = 'xr-hud-top';
  topBar.style.display = 'flex';
  topBar.style.flexWrap = 'wrap';
  topBar.style.alignItems = 'center';
  topBar.style.justifyContent = 'space-between';
  topBar.style.gap = '10px';
  topBar.style.padding = '10px 14px';
  topBar.style.borderRadius = '12px';
  topBar.style.background = 'rgba(7, 11, 20, 0.72)';
  topBar.style.backdropFilter = 'blur(12px)';
  topBar.style.border = '1px solid rgba(148, 163, 184, 0.22)';
  topBar.style.pointerEvents = 'auto';
  overlayRoot.appendChild(topBar);

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.alignItems = 'center';
  titleWrap.style.gap = '10px';
  titleWrap.style.minWidth = '0';
  topBar.appendChild(titleWrap);

  const modeBadge = document.createElement('span');
  modeBadge.className = 'xr-mode-badge';
  modeBadge.textContent = '3Dプレビュー';
  modeBadge.style.fontSize = '11px';
  modeBadge.style.fontWeight = '700';
  modeBadge.style.letterSpacing = '0.04em';
  modeBadge.style.padding = '4px 8px';
  modeBadge.style.borderRadius = '999px';
  modeBadge.style.background = 'rgba(56, 189, 248, 0.16)';
  modeBadge.style.color = '#7dd3fc';
  modeBadge.style.border = '1px solid rgba(56, 189, 248, 0.35)';
  modeBadge.style.whiteSpace = 'nowrap';
  titleWrap.appendChild(modeBadge);

  const titleEl = document.createElement('div');
  titleEl.className = 'xr-hud-title';
  titleEl.textContent = options.title;
  titleEl.style.fontSize = '14px';
  titleEl.style.fontWeight = '600';
  titleEl.style.color = '#f8fafc';
  titleEl.style.whiteSpace = 'nowrap';
  titleEl.style.overflow = 'hidden';
  titleEl.style.textOverflow = 'ellipsis';
  titleWrap.appendChild(titleEl);

  const arButton = document.createElement('button');
  arButton.type = 'button';
  arButton.className = 'xr-ar-button';
  arButton.textContent = capabilities.immersiveArSupported
    ? defaultArLabel
    : `${defaultArLabel} (非対応)`;
  arButton.disabled = !capabilities.immersiveArSupported;
  arButton.style.padding = '8px 14px';
  arButton.style.borderRadius = '10px';
  arButton.style.fontSize = '13px';
  arButton.style.fontWeight = '600';
  arButton.style.border = '1px solid rgba(56, 189, 248, 0.45)';
  arButton.style.cursor = capabilities.immersiveArSupported
    ? 'pointer'
    : 'not-allowed';
  arButton.style.transition = 'all 160ms ease';
  arButton.style.whiteSpace = 'nowrap';
  arButton.style.background = capabilities.immersiveArSupported
    ? 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
    : 'rgba(51, 65, 85, 0.55)';
  arButton.style.color = capabilities.immersiveArSupported
    ? '#ffffff'
    : '#94a3b8';
  topBar.appendChild(arButton);

  // Bottom HUD bar
  const bottomBar = document.createElement('div');
  bottomBar.className = 'xr-hud-bottom';
  bottomBar.style.display = 'flex';
  bottomBar.style.flexDirection = 'column';
  bottomBar.style.gap = '6px';
  bottomBar.style.padding = '10px 14px';
  bottomBar.style.borderRadius = '12px';
  bottomBar.style.background = 'rgba(7, 11, 20, 0.72)';
  bottomBar.style.backdropFilter = 'blur(12px)';
  bottomBar.style.border = '1px solid rgba(148, 163, 184, 0.22)';
  bottomBar.style.pointerEvents = 'auto';
  overlayRoot.appendChild(bottomBar);

  const statusRow = document.createElement('div');
  statusRow.style.display = 'flex';
  statusRow.style.flexWrap = 'wrap';
  statusRow.style.alignItems = 'center';
  statusRow.style.justifyContent = 'space-between';
  statusRow.style.gap = '8px';
  bottomBar.appendChild(statusRow);

  const statusText = document.createElement('div');
  statusText.className = 'xr-status-text';
  statusText.textContent = capabilities.immersiveArSupported
    ? '準備完了 — WebXR AR対応環境です'
    : '3Dプレビュー稼働中（WebXR AR非対応ブラウザ）';
  statusText.style.fontSize = '12px';
  statusText.style.fontWeight = '600';
  statusText.style.color = '#e2e8f0';
  statusRow.appendChild(statusText);

  const orbitHint = document.createElement('div');
  orbitHint.className = 'xr-orbit-hint';
  orbitHint.textContent =
    'ドラッグで視点回転 / ホイールでズーム / ダブルクリックで視点リセット';
  orbitHint.style.fontSize = '11px';
  orbitHint.style.color = '#94a3b8';
  statusRow.appendChild(orbitHint);

  const instructionsEl = document.createElement('div');
  instructionsEl.className = 'xr-instructions';
  instructionsEl.textContent = options.instructions;
  instructionsEl.style.fontSize = '12px';
  instructionsEl.style.lineHeight = '1.45';
  instructionsEl.style.color = '#cbd5e1';
  bottomBar.appendChild(instructionsEl);

  // Three.js core setup
  const scene = new THREE.Scene();

  const initialWidth = Math.max(canvasHost.clientWidth, 320);
  const initialHeight = Math.max(canvasHost.clientHeight, 320);

  const camera = new THREE.PerspectiveCamera(
    58,
    initialWidth / initialHeight,
    0.01,
    60,
  );

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(initialWidth, initialHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.xr.enabled = true;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  canvasHost.appendChild(renderer.domElement);

  // Default balanced spatial lighting
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.15);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
  keyLight.position.set(2.5, 4.5, 3.0);
  scene.add(keyLight);

  const accentLight = new THREE.PointLight(0x38bdf8, 0.9, 10);
  accentLight.position.set(-1.8, 2.2, -1.6);
  scene.add(accentLight);

  // Orbit camera fallback state
  const orbit: OrbitState = {
    target: DEFAULT_ORBIT_TARGET.clone(),
    radius: DEFAULT_ORBIT_RADIUS,
    theta: DEFAULT_ORBIT_THETA,
    phi: DEFAULT_ORBIT_PHI,
  };

  const applyOrbitCamera = (): void => {
    const sinPhi = Math.sin(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta),
    );
    camera.lookAt(orbit.target);
  };
  applyOrbitCamera();

  // State flags
  let activeSession: XRSession | null = null;
  let isRequestingSession = false;
  let disposed = false;

  const isXrActive = (): boolean =>
    activeSession !== null || renderer.xr.isPresenting;

  const setStatus = (text: string): void => {
    if (!disposed) {
      statusText.textContent = text;
    }
  };

  // Drag-to-orbit fallback interaction (inactive during WebXR)
  let isOrbitDragging = false;
  let activePointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const onPointerDown = (event: PointerEvent): void => {
    if (isXrActive() || event.defaultPrevented) {
      return;
    }
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    isOrbitDragging = true;
    activePointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (
      !isOrbitDragging ||
      activePointerId !== event.pointerId ||
      isXrActive()
    ) {
      return;
    }
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    orbit.theta -= dx * 0.0065;
    orbit.phi = Math.max(0.2, Math.min(Math.PI - 0.2, orbit.phi - dy * 0.0065));
    applyOrbitCamera();
  };

  const onPointerUpOrCancel = (event: PointerEvent): void => {
    if (activePointerId === event.pointerId) {
      isOrbitDragging = false;
      activePointerId = null;
    }
  };

  const onWheel = (event: WheelEvent): void => {
    if (isXrActive()) {
      return;
    }
    event.preventDefault();
    orbit.radius = Math.max(
      0.7,
      Math.min(5.5, orbit.radius + event.deltaY * 0.0018),
    );
    applyOrbitCamera();
  };

  const onDoubleClick = (): void => {
    if (isXrActive()) {
      return;
    }
    orbit.target.copy(DEFAULT_ORBIT_TARGET);
    orbit.radius = DEFAULT_ORBIT_RADIUS;
    orbit.theta = DEFAULT_ORBIT_THETA;
    orbit.phi = DEFAULT_ORBIT_PHI;
    applyOrbitCamera();
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUpOrCancel);
  window.addEventListener('pointercancel', onPointerUpOrCancel);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('dblclick', onDoubleClick);

  // Resize handling
  const updateSize = (): void => {
    if (disposed || renderer.xr.isPresenting) {
      return;
    }
    const width = Math.max(canvasHost.clientWidth, 1);
    const height = Math.max(canvasHost.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const resizeObserver = new ResizeObserver(() => {
    updateSize();
  });
  resizeObserver.observe(canvasHost);

  // WebXR session management
  const updateArUiState = (inAr: boolean): void => {
    if (inAr) {
      root.style.background = 'transparent';
      modeBadge.textContent = 'WebXR AR 稼働中';
      modeBadge.style.background = 'rgba(16, 185, 129, 0.22)';
      modeBadge.style.color = '#6ee7b7';
      modeBadge.style.border = '1px solid rgba(16, 185, 129, 0.45)';
      arButton.textContent = 'ARセッション終了';
      arButton.style.background =
        'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
      arButton.style.border = '1px solid rgba(248, 113, 113, 0.55)';
      orbitHint.style.display = 'none';
    } else {
      root.style.background =
        'radial-gradient(circle at 50% 35%, #121c30 0%, #060913 62%, #000000 100%)';
      modeBadge.textContent = '3Dプレビュー';
      modeBadge.style.background = 'rgba(56, 189, 248, 0.16)';
      modeBadge.style.color = '#7dd3fc';
      modeBadge.style.border = '1px solid rgba(56, 189, 248, 0.35)';
      arButton.textContent = capabilities.immersiveArSupported
        ? defaultArLabel
        : `${defaultArLabel} (非対応)`;
      arButton.style.background = capabilities.immersiveArSupported
        ? 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
        : 'rgba(51, 65, 85, 0.55)';
      arButton.style.border = '1px solid rgba(56, 189, 248, 0.45)';
      orbitHint.style.display = 'block';
    }
  };

  const onSessionEnd = (): void => {
    activeSession = null;
    updateArUiState(false);
    applyOrbitCamera();
    updateSize();
    setStatus('WebXR ARセッションを終了しました（3Dプレビューに復帰）');
    hooks.onSessionEnd?.();
  };

  const toggleArSession = async (): Promise<void> => {
    if (isRequestingSession || disposed) {
      return;
    }

    if (activeSession) {
      try {
        await activeSession.end();
      } catch (err) {
        console.warn('[xrEngine] Failed to end XR session:', err);
      }
      return;
    }

    if (!navigator.xr || !capabilities.immersiveArSupported) {
      setStatus(
        'この端末またはブラウザは WebXR immersive-ar に対応していません',
      );
      return;
    }

    isRequestingSession = true;
    arButton.disabled = true;
    setStatus('WebXR ARセッションを開始しています...');

    try {
      const optionalFeatures = Array.from(
        new Set([
          'local-floor',
          'dom-overlay',
          ...(options.optionalFeatures ?? []),
        ]),
      );

      const sessionInit: XRSessionInit = {
        optionalFeatures,
        domOverlay: { root: overlayRoot },
      };

      const session = await navigator.xr.requestSession(
        'immersive-ar',
        sessionInit,
      );
      if (disposed) {
        await session.end();
        return;
      }

      session.addEventListener('end', onSessionEnd);

      try {
        renderer.xr.setReferenceSpaceType('local-floor');
        await renderer.xr.setSession(session);
      } catch {
        renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(session);
      }

      activeSession = session;
      updateArUiState(true);
      setStatus('WebXR AR 起動中 — 周囲を見回して空間体験をお試しください');
      hooks.onSessionStart?.(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`WebXR ARの起動に失敗しました: ${message}`);
    } finally {
      isRequestingSession = false;
      if (!disposed) {
        arButton.disabled = !capabilities.immersiveArSupported;
      }
    }
  };

  const onArButtonClick = (): void => {
    void toggleArSession();
  };
  arButton.addEventListener('click', onArButtonClick);

  // Initialize module hooks
  const ctx: XrSceneContext = {
    scene,
    camera,
    renderer,
    isXrActive,
    overlayRoot,
    setStatus,
  };

  void Promise.resolve(hooks.init(ctx)).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(`シーン初期化エラー: ${message}`);
  });

  // Main animation loop (works seamlessly in both 3D preview and WebXR)
  let lastTimeMs: number | null = null;
  let elapsedSec = 0;

  renderer.setAnimationLoop((timeMs: number, frame?: XRFrame) => {
    if (disposed) {
      return;
    }
    const delta =
      lastTimeMs === null
        ? 0.016
        : Math.min(Math.max((timeMs - lastTimeMs) / 1000, 0), 0.1);
    lastTimeMs = timeMs;
    elapsedSec += delta;

    hooks.onFrame(delta, elapsedSec, frame);
    renderer.render(scene, camera);
  });

  // Cleanup function
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;

    renderer.setAnimationLoop(null);

    if (activeSession) {
      const sessionToEnd = activeSession;
      activeSession = null;
      sessionToEnd.removeEventListener('end', onSessionEnd);
      void sessionToEnd.end().catch(() => {
        // Ignore errors when ending session during unmount
      });
    }

    resizeObserver.disconnect();
    arButton.removeEventListener('click', onArButtonClick);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUpOrCancel);
    window.removeEventListener('pointercancel', onPointerUpOrCancel);
    renderer.domElement.removeEventListener('wheel', onWheel);
    renderer.domElement.removeEventListener('dblclick', onDoubleClick);

    try {
      hooks.dispose();
    } catch (err) {
      console.warn('[xrEngine] Error during hooks.dispose():', err);
    }

    renderer.dispose();
    if (root.parentElement === container) {
      container.removeChild(root);
    }
  };
}
