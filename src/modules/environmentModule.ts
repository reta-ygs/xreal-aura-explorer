import * as THREE from 'three';
import type { CapabilityReport, ExperienceModule, XrSceneContext } from '../types';
import { mountXrViewport } from '../xr/xrEngine';

type PlaceableKind = 'cube' | 'solar' | 'clock';

interface PlaceableDefinition {
  kind: PlaceableKind;
  label: string;
}

const PLACEABLES: readonly PlaceableDefinition[] = [
  { kind: 'cube', label: 'フローティング・キューブ' },
  { kind: 'solar', label: 'ミニ太陽系' },
  { kind: 'clock', label: '空間クロック' },
] as const;

interface PlacedItem {
  kind: PlaceableKind;
  root: THREE.Group;
  anchor: XRAnchor | null;
  spawnTime: number;
  update: (delta: number, elapsed: number) => void;
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (mat && 'map' in mat && mat.map instanceof THREE.Texture) {
          mat.map.dispose();
        }
        mat?.dispose();
      }
    }
  });
}

function createFloatingCube(): { group: THREE.Group; update: (delta: number, elapsed: number) => void } {
  const group = new THREE.Group();
  const content = new THREE.Group();
  content.position.y = 0.14;
  group.add(content);

  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.15,
    metalness: 0.35,
    transparent: true,
    opacity: 0.72,
  });
  const outerCube = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), outerMat);
  content.add(outerCube);

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.165, 0.165, 0.165)),
    new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.85 }),
  );
  content.add(wire);

  const innerCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.05, 0),
    new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.4,
    }),
  );
  content.add(innerCore);

  // Subtle shadow/glow ring on the surface
  const baseRingGeo = new THREE.RingGeometry(0.06, 0.085, 32);
  baseRingGeo.rotateX(-Math.PI / 2);
  const baseRing = new THREE.Mesh(
    baseRingGeo,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    }),
  );
  baseRing.position.y = 0.002;
  group.add(baseRing);

  return {
    group,
    update: (delta: number, elapsed: number) => {
      content.position.y = 0.14 + Math.sin(elapsed * 2.1) * 0.015;
      outerCube.rotation.y += delta * 0.65;
      outerCube.rotation.x += delta * 0.3;
      wire.rotation.copy(outerCube.rotation);
      innerCore.rotation.y -= delta * 1.4;
      innerCore.rotation.z += delta * 0.9;
    },
  };
}

function createMiniSolarSystem(): { group: THREE.Group; update: (delta: number, elapsed: number) => void } {
  const group = new THREE.Group();
  const center = new THREE.Group();
  center.position.y = 0.16;
  group.add(center);

  // Sun
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.35,
      roughness: 0.25,
    }),
  );
  center.add(sun);

  interface PlanetSpec {
    radius: number;
    size: number;
    speed: number;
    phase: number;
    color: number;
    emissive: number;
    tilt: number;
    hasRing?: boolean;
  }

  const specs: PlanetSpec[] = [
    { radius: 0.085, size: 0.012, speed: 2.1, phase: 0.2, color: 0x38bdf8, emissive: 0x0284c7, tilt: 0.08 },
    { radius: 0.13, size: 0.017, speed: 1.35, phase: 2.1, color: 0x34d399, emissive: 0x059669, tilt: -0.06 },
    { radius: 0.18, size: 0.02, speed: 0.85, phase: 4.3, color: 0xc084fc, emissive: 0x7e22ce, tilt: 0.12, hasRing: true },
  ];

  const pivots: { pivot: THREE.Group; speed: number }[] = [];

  for (const spec of specs) {
    // Orbit ring
    const orbitGeo = new THREE.RingGeometry(spec.radius - 0.0015, spec.radius + 0.0015, 48);
    orbitGeo.rotateX(-Math.PI / 2);
    const orbitMesh = new THREE.Mesh(
      orbitGeo,
      new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    orbitMesh.rotation.z = spec.tilt;
    center.add(orbitMesh);

    const pivot = new THREE.Group();
    pivot.rotation.z = spec.tilt;
    pivot.rotation.y = spec.phase;
    center.add(pivot);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(spec.size, 18, 18),
      new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.emissive,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.2,
      }),
    );
    planet.position.x = spec.radius;
    pivot.add(planet);

    if (spec.hasRing) {
      const saturnRingGeo = new THREE.RingGeometry(spec.size * 1.35, spec.size * 2.05, 32);
      saturnRingGeo.rotateX(-Math.PI / 2.4);
      const saturnRing = new THREE.Mesh(
        saturnRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0xe9d5ff,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
        }),
      );
      planet.add(saturnRing);
    }

    pivots.push({ pivot, speed: spec.speed });
  }

  // Stand stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.012, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 }),
  );
  stem.position.y = 0.06;
  group.add(stem);

  return {
    group,
    update: (delta: number) => {
      sun.rotation.y += delta * 0.5;
      for (const item of pivots) {
        item.pivot.rotation.y += delta * item.speed;
      }
    },
  };
}

function createSpatialClock(): { group: THREE.Group; update: (delta: number, elapsed: number) => void } {
  const group = new THREE.Group();
  const clockGroup = new THREE.Group();
  clockGroup.position.y = 0.16;
  group.add(clockGroup);

  // Outer metallic bezel
  const bezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.01, 16, 48),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    }),
  );
  clockGroup.add(bezel);

  // Dynamic canvas face showing live local time
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx2d = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 40),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  clockGroup.add(face);

  // Base pedestal disc
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.014, 24),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.25,
      metalness: 0.7,
      roughness: 0.3,
    }),
  );
  base.position.y = 0.007;
  group.add(base);

  let lastSecond = -1;

  const drawFace = (): void => {
    if (!ctx2d) {
      return;
    }
    const now = new Date();
    const sec = now.getSeconds();
    if (sec === lastSecond) {
      return;
    }
    lastSecond = sec;

    const min = now.getMinutes();
    const hr = now.getHours();

    const cx = 128;
    const cy = 128;
    ctx2d.clearRect(0, 0, 256, 256);

    // Dark dial background
    ctx2d.fillStyle = 'rgba(7, 13, 25, 0.9)';
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, 122, 0, Math.PI * 2);
    ctx2d.fill();

    // Hour tick marks
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const inner = i % 3 === 0 ? 92 : 102;
      const outer = 114;
      ctx2d.strokeStyle = i % 3 === 0 ? '#7dd3fc' : 'rgba(148, 163, 184, 0.65)';
      ctx2d.lineWidth = i % 3 === 0 ? 4 : 2;
      ctx2d.beginPath();
      ctx2d.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx2d.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx2d.stroke();
    }

    // Digital readout
    const pad = (n: number): string => String(n).padStart(2, '0');
    ctx2d.fillStyle = '#e0f2fe';
    ctx2d.font = 'bold 26px ui-monospace, SFMono-Regular, monospace';
    ctx2d.textAlign = 'center';
    ctx2d.fillText(`${pad(hr)}:${pad(min)}:${pad(sec)}`, cx, cy + 56);

    // Hour hand
    const hrAngle = (((hr % 12) + min / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    ctx2d.strokeStyle = '#f8fafc';
    ctx2d.lineWidth = 6;
    ctx2d.lineCap = 'round';
    ctx2d.beginPath();
    ctx2d.moveTo(cx, cy);
    ctx2d.lineTo(cx + Math.cos(hrAngle) * 54, cy + Math.sin(hrAngle) * 54);
    ctx2d.stroke();

    // Minute hand
    const minAngle = ((min + sec / 60) / 60) * Math.PI * 2 - Math.PI / 2;
    ctx2d.strokeStyle = '#7dd3fc';
    ctx2d.lineWidth = 4;
    ctx2d.beginPath();
    ctx2d.moveTo(cx, cy);
    ctx2d.lineTo(cx + Math.cos(minAngle) * 80, cy + Math.sin(minAngle) * 80);
    ctx2d.stroke();

    // Second hand
    const secAngle = (sec / 60) * Math.PI * 2 - Math.PI / 2;
    ctx2d.strokeStyle = '#f43f5e';
    ctx2d.lineWidth = 2.5;
    ctx2d.beginPath();
    ctx2d.moveTo(cx, cy);
    ctx2d.lineTo(cx + Math.cos(secAngle) * 92, cy + Math.sin(secAngle) * 92);
    ctx2d.stroke();

    // Center pin
    ctx2d.fillStyle = '#38bdf8';
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx2d.fill();

    texture.needsUpdate = true;
  };

  drawFace();

  return {
    group,
    update: (_delta: number, elapsed: number) => {
      drawFace();
      clockGroup.position.y = 0.16 + Math.sin(elapsed * 1.5) * 0.008;
    },
  };
}

function createPlaceable(kind: PlaceableKind): {
  group: THREE.Group;
  update: (delta: number, elapsed: number) => void;
} {
  switch (kind) {
    case 'cube':
      return createFloatingCube();
    case 'solar':
      return createMiniSolarSystem();
    case 'clock':
      return createSpatialClock();
  }
}

export const environmentModule: ExperienceModule = {
  id: 'environment',
  title: '環境認識 & 空間アンカー配置',
  subtitle: 'WebXR Hit-Test・平面検出レティクル・空間オブジェクト配置',
  badge: 'Hit-Test + Anchor',
  summary:
    'WebXR Hit-Testで現実の机や床を検出し、ピンチやタップでフローティング・キューブ、ミニ太陽系、空間クロックを空間アンカー固定。非XR環境でもバーチャルテーブル上でクリック配置を体験できます。',
  supportsWebXr: true,

  mount(container: HTMLElement, capabilities: CapabilityReport): () => void {
    let sceneCtx: XrSceneContext | null = null;
    let activeSession: XRSession | null = null;
    let hitTestSource: XRHitTestSource | null = null;
    let lastHitResult: XRHitTestResult | null = null;

    let selectedKind: PlaceableKind = 'cube';
    let currentElapsed = 0;

    const moduleRoot = new THREE.Group();
    const placedGroup = new THREE.Group();
    moduleRoot.add(placedGroup);

    const placedItems: PlacedItem[] = [];

    // Reticle (shared between WebXR hit-test and virtual tabletop preview)
    const reticle = new THREE.Group();
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;

    const outerRingGeo = new THREE.RingGeometry(0.055, 0.072, 36);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRing = new THREE.Mesh(
      outerRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    reticle.add(outerRing);

    const innerDotGeo = new THREE.CircleGeometry(0.012, 20);
    innerDotGeo.rotateX(-Math.PI / 2);
    const innerDot = new THREE.Mesh(
      innerDotGeo,
      new THREE.MeshBasicMaterial({
        color: 0x6ee7b7,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    reticle.add(innerDot);
    moduleRoot.add(reticle);

    // Virtual tabletop for 3D preview fallback
    const tabletopGroup = new THREE.Group();
    tabletopGroup.position.set(0, 0.85, -0.9);

    const tableSurfaceMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.036, 1.15),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: 0x0c192c,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.5,
        transparent: true,
        opacity: 0.92,
      }),
    );
    tableSurfaceMesh.position.y = -0.018;
    tabletopGroup.add(tableSurfaceMesh);

    const tableEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.76, 0.04, 1.16)),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 }),
    );
    tableEdge.position.y = -0.018;
    tabletopGroup.add(tableEdge);

    const tableGrid = new THREE.GridHelper(1.1, 11, 0x1e3a5f, 0x172554);
    tableGrid.position.y = 0.002;
    tableGrid.scale.set(1.5, 1, 1);
    tabletopGroup.add(tableGrid);

    moduleRoot.add(tabletopGroup);

    // Raycasting for virtual tabletop fallback
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const previewReticleMatrix = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3(1, 1, 1);

    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerDownActive = false;

    // Overlay UI controls
    let toolbar: HTMLDivElement | null = null;
    let countBadge: HTMLSpanElement | null = null;
    let resetButton: HTMLButtonElement | null = null;
    const itemButtons = new Map<PlaceableKind, HTMLButtonElement>();

    const updateToolbarStyles = (): void => {
      for (const [kind, btn] of itemButtons.entries()) {
        const active = kind === selectedKind;
        btn.style.background = active
          ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.92), rgba(37, 99, 235, 0.92))'
          : 'rgba(15, 23, 42, 0.78)';
        btn.style.border = active
          ? '1px solid rgba(125, 211, 252, 0.9)'
          : '1px solid rgba(148, 163, 184, 0.32)';
        btn.style.color = active ? '#ffffff' : '#cbd5e1';
      }
      if (countBadge) {
        countBadge.textContent = `配置数: ${placedItems.length}`;
      }
    };

    const spawnItemAtMatrix = (matrix: THREE.Matrix4, anchor: XRAnchor | null): void => {
      const built = createPlaceable(selectedKind);
      matrix.decompose(tmpPos, tmpQuat, tmpScale);

      built.group.position.copy(tmpPos);
      built.group.quaternion.copy(tmpQuat);
      built.group.scale.setScalar(0.01);
      placedGroup.add(built.group);

      placedItems.push({
        kind: selectedKind,
        root: built.group,
        anchor,
        spawnTime: currentElapsed,
        update: built.update,
      });

      updateToolbarStyles();
      const def = PLACEABLES.find((p) => p.kind === selectedKind);
      const anchorNote = anchor ? '（空間アンカー固定）' : '（ワールド座標固定）';
      sceneCtx?.setStatus(`「${def?.label ?? selectedKind}」を配置しました ${anchorNote}`);
    };

    const clearAllPlaced = (): void => {
      for (const item of placedItems) {
        if (item.anchor) {
          try {
            item.anchor.delete();
          } catch {
            // Ignore anchor deletion errors if session ended
          }
        }
        placedGroup.remove(item.root);
        disposeObjectTree(item.root);
      }
      placedItems.length = 0;
      updateToolbarStyles();
      sceneCtx?.setStatus('配置したすべてのオブジェクトをリセットしました');
    };

    // WebXR select event -> place item at current hit-test reticle
    const onXrSelect = (): void => {
      if (!sceneCtx || !sceneCtx.isXrActive() || !reticle.visible) {
        return;
      }

      const placementMatrix = reticle.matrix.clone();
      const hitResultForAnchor = lastHitResult as
        | (XRHitTestResult & { createAnchor?: () => Promise<XRAnchor> })
        | null;

      if (hitResultForAnchor && typeof hitResultForAnchor.createAnchor === 'function') {
        void hitResultForAnchor
          .createAnchor()
          .then((anchor) => {
            spawnItemAtMatrix(placementMatrix, anchor);
          })
          .catch(() => {
            spawnItemAtMatrix(placementMatrix, null);
          });
      } else {
        spawnItemAtMatrix(placementMatrix, null);
      }
    };

    // Preview tabletop pointer hover & click-to-place
    const hitTabletop = (event: PointerEvent): THREE.Vector3 | null => {
      if (!sceneCtx || sceneCtx.isXrActive()) {
        return null;
      }
      const rect = sceneCtx.renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, sceneCtx.camera);

      const hits = raycaster.intersectObject(tableSurfaceMesh, false);
      if (hits.length === 0) {
        return null;
      }
      // Only accept top surface hits
      if (hits[0].face && hits[0].face.normal.y < 0.5) {
        return null;
      }
      return hits[0].point;
    };

    const onPreviewPointerMove = (event: PointerEvent): void => {
      if (!sceneCtx || sceneCtx.isXrActive()) {
        return;
      }
      const hitPoint = hitTabletop(event);
      if (hitPoint) {
        tmpPos.set(hitPoint.x, 0.852, hitPoint.z);
        tmpQuat.identity();
        tmpScale.set(1, 1, 1);
        previewReticleMatrix.compose(tmpPos, tmpQuat, tmpScale);
        reticle.matrix.copy(previewReticleMatrix);
        reticle.visible = true;
      } else {
        reticle.visible = false;
      }
    };

    const onPreviewPointerDown = (event: PointerEvent): void => {
      if (!sceneCtx || sceneCtx.isXrActive()) {
        return;
      }
      if (event.button !== 0 && event.pointerType === 'mouse') {
        return;
      }
      pointerDownActive = true;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
    };

    const onPreviewPointerUp = (event: PointerEvent): void => {
      if (!pointerDownActive || !sceneCtx || sceneCtx.isXrActive()) {
        pointerDownActive = false;
        return;
      }
      pointerDownActive = false;

      const dist = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
      // Treat short click/tap as placement; longer movement was camera orbit
      if (dist > 6) {
        return;
      }

      const hitPoint = hitTabletop(event);
      if (hitPoint) {
        tmpPos.set(hitPoint.x, 0.851, hitPoint.z);
        tmpQuat.identity();
        tmpScale.set(1, 1, 1);
        previewReticleMatrix.compose(tmpPos, tmpQuat, tmpScale);
        spawnItemAtMatrix(previewReticleMatrix, null);
      }
    };

    const unmount = mountXrViewport(
      container,
      capabilities,
      {
        title: '環境認識（Hit-Test）& 空間アンカー配置',
        arButtonLabel: 'WebXR (AR) 開始',
        instructions:
          'ARでは机や床にレティクルを合わせてピンチ／タップで配置。3Dプレビューではバーチャルテーブル上をクリックして3Dアイテムを配置できます。',
        optionalFeatures: ['hit-test', 'anchors', 'local-floor'],
      },
      {
        init(ctx: XrSceneContext): void {
          sceneCtx = ctx;
          ctx.scene.add(moduleRoot);

          // Build Japanese item selector + reset toolbar in overlayRoot
          toolbar = document.createElement('div');
          toolbar.style.display = 'flex';
          toolbar.style.flexWrap = 'wrap';
          toolbar.style.alignItems = 'center';
          toolbar.style.justifyContent = 'space-between';
          toolbar.style.gap = '8px';
          toolbar.style.pointerEvents = 'none';

          const selectorGroup = document.createElement('div');
          selectorGroup.style.display = 'flex';
          selectorGroup.style.flexWrap = 'wrap';
          selectorGroup.style.gap = '6px';
          selectorGroup.style.pointerEvents = 'auto';
          toolbar.appendChild(selectorGroup);

          for (const def of PLACEABLES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = def.label;
            btn.style.padding = '6px 11px';
            btn.style.borderRadius = '8px';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '600';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'all 140ms ease';
            btn.addEventListener('click', () => {
              selectedKind = def.kind;
              updateToolbarStyles();
              ctx.setStatus(`配置アイテムを「${def.label}」に切り替えました`);
            });
            selectorGroup.appendChild(btn);
            itemButtons.set(def.kind, btn);
          }

          const rightGroup = document.createElement('div');
          rightGroup.style.display = 'flex';
          rightGroup.style.alignItems = 'center';
          rightGroup.style.gap = '8px';
          rightGroup.style.pointerEvents = 'auto';
          toolbar.appendChild(rightGroup);

          countBadge = document.createElement('span');
          countBadge.style.padding = '5px 10px';
          countBadge.style.borderRadius = '999px';
          countBadge.style.fontSize = '12px';
          countBadge.style.fontWeight = '600';
          countBadge.style.color = '#e0f2fe';
          countBadge.style.background = 'rgba(15, 23, 42, 0.78)';
          countBadge.style.border = '1px solid rgba(56, 189, 248, 0.35)';
          rightGroup.appendChild(countBadge);

          resetButton = document.createElement('button');
          resetButton.type = 'button';
          resetButton.textContent = 'すべてリセット';
          resetButton.style.padding = '6px 12px';
          resetButton.style.borderRadius = '8px';
          resetButton.style.fontSize = '12px';
          resetButton.style.fontWeight = '600';
          resetButton.style.color = '#fecaca';
          resetButton.style.background = 'rgba(127, 29, 29, 0.65)';
          resetButton.style.border = '1px solid rgba(248, 113, 113, 0.45)';
          resetButton.style.cursor = 'pointer';
          resetButton.addEventListener('click', clearAllPlaced);
          rightGroup.appendChild(resetButton);

          updateToolbarStyles();

          // Insert toolbar cleanly above the bottom HUD bar
          const lastChild = ctx.overlayRoot.lastElementChild;
          if (lastChild) {
            ctx.overlayRoot.insertBefore(toolbar, lastChild);
          } else {
            ctx.overlayRoot.appendChild(toolbar);
          }

          ctx.renderer.domElement.addEventListener('pointermove', onPreviewPointerMove);
          ctx.renderer.domElement.addEventListener('pointerdown', onPreviewPointerDown);
          window.addEventListener('pointerup', onPreviewPointerUp);

          ctx.setStatus(
            capabilities.immersiveArSupported
              ? 'AR開始で平面スキャン（Hit-Test）＆空間アンカー配置を体験できます'
              : '3Dプレビュー: バーチャルテーブル上をクリックして3Dアイテムを配置してください',
          );
        },

        onSessionStart(session: XRSession): void {
          activeSession = session;
          tabletopGroup.visible = false;
          reticle.visible = false;
          lastHitResult = null;

          session.addEventListener('select', onXrSelect);

          void session
            .requestReferenceSpace('viewer')
            .then((viewerSpace) => {
              if (typeof session.requestHitTestSource !== 'function') {
                sceneCtx?.setStatus('この端末は WebXR Hit-Test に未対応です');
                return null;
              }
              return session.requestHitTestSource({ space: viewerSpace });
            })
            .then((source) => {
              if (source && activeSession === session) {
                hitTestSource = source;
                sceneCtx?.setStatus('周囲の机や床をゆっくり見回して平面を検出してください...');
              }
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              sceneCtx?.setStatus(`Hit-Test初期化エラー: ${msg}`);
            });
        },

        onSessionEnd(): void {
          if (hitTestSource) {
            hitTestSource.cancel();
            hitTestSource = null;
          }
          if (activeSession) {
            activeSession.removeEventListener('select', onXrSelect);
            activeSession = null;
          }
          lastHitResult = null;
          reticle.visible = false;
          tabletopGroup.visible = true;
        },

        onFrame(delta: number, elapsed: number, frame?: XRFrame): void {
          currentElapsed = elapsed;

          // Update WebXR Hit-Test reticle & Spatial Anchors
          if (frame && activeSession && sceneCtx) {
            const refSpace = sceneCtx.renderer.xr.getReferenceSpace();
            if (refSpace) {
              if (hitTestSource) {
                const results = frame.getHitTestResults(hitTestSource);
                if (results.length > 0) {
                  lastHitResult = results[0];
                  const pose = results[0].getPose(refSpace);
                  if (pose) {
                    reticle.visible = true;
                    reticle.matrix.fromArray(pose.transform.matrix);
                  }
                } else {
                  lastHitResult = null;
                  reticle.visible = false;
                }
              }

              // Track anchored objects via WebXR Anchors API
              for (const item of placedItems) {
                if (item.anchor) {
                  const anchorPose = frame.getPose(item.anchor.anchorSpace, refSpace);
                  if (anchorPose) {
                    const p = anchorPose.transform.position;
                    const o = anchorPose.transform.orientation;
                    item.root.position.set(p.x, p.y, p.z);
                    item.root.quaternion.set(o.x, o.y, o.z, o.w);
                  }
                }
              }
            }
          }

          // Subtle pulse on reticle
          if (reticle.visible) {
            const pulse = 1 + Math.sin(elapsed * 4.5) * 0.06;
            outerRing.scale.setScalar(pulse);
          }

          // Animate all placed items + smooth pop-in scale
          for (const item of placedItems) {
            const age = elapsed - item.spawnTime;
            const scale = Math.min(1, age * 4.5);
            const eased = 1 - Math.pow(1 - scale, 3);
            item.root.scale.setScalar(Math.max(0.01, eased));
            item.update(delta, elapsed);
          }
        },

        dispose(): void {
          if (hitTestSource) {
            hitTestSource.cancel();
            hitTestSource = null;
          }
          if (activeSession) {
            activeSession.removeEventListener('select', onXrSelect);
            activeSession = null;
          }

          if (sceneCtx) {
            sceneCtx.renderer.domElement.removeEventListener('pointermove', onPreviewPointerMove);
            sceneCtx.renderer.domElement.removeEventListener('pointerdown', onPreviewPointerDown);
            sceneCtx.scene.remove(moduleRoot);
          }
          window.removeEventListener('pointerup', onPreviewPointerUp);

          if (resetButton) {
            resetButton.removeEventListener('click', clearAllPlaced);
          }
          if (toolbar && toolbar.parentElement) {
            toolbar.parentElement.removeChild(toolbar);
          }

          clearAllPlaced();
          disposeObjectTree(moduleRoot);
          itemButtons.clear();
          sceneCtx = null;
        },
      },
    );

    return unmount;
  },
};
