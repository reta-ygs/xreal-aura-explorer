import * as THREE from 'three';
import type { CapabilityReport, ExperienceModule, XrSceneContext } from '../types';
import { mountXrViewport } from '../xr/xrEngine';

const HAND_JOINTS: readonly XRHandJoint[] = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip',
] as const;

const PINCH_START_DIST = 0.026;
const PINCH_END_DIST = 0.038;
const HAND_GRAB_RADIUS = 0.24;

interface GrabbableObject {
  id: string;
  label: string;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  accentMaterial: THREE.MeshStandardMaterial;
  baseEmissiveIntensity: number;
  homePosition: THREE.Vector3;
  anchorPosition: THREE.Vector3;
  idlePhase: number;
  grabbedBy: string | null;
}

interface HandVisual {
  root: THREE.Group;
  joints: Map<XRHandJoint, THREE.Mesh>;
  pinchOrb: THREE.Mesh;
  pinchOrbMat: THREE.MeshBasicMaterial;
  isPinching: boolean;
  grabbedObj: GrabbableObject | null;
  grabOffset: THREE.Vector3;
  lastHandQuat: THREE.Quaternion;
  hasLastQuat: boolean;
}

interface PointerRayState {
  line: THREE.Line;
  grabbedObj: GrabbableObject | null;
  grabDistance: number;
  lastRayQuat: THREE.Quaternion;
  hasLastQuat: boolean;
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

function createInfoPanelTexture(
  canvas: HTMLCanvasElement,
  camPos: THREE.Vector3,
  pedestalPos: THREE.Vector3,
  handsDetected: number,
  interactionText: string,
): void {
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) {
    return;
  }
  const w = canvas.width;
  const h = canvas.height;
  ctx2d.clearRect(0, 0, w, h);

  // Translucent dark holographic backing
  ctx2d.fillStyle = 'rgba(8, 15, 30, 0.88)';
  ctx2d.strokeStyle = 'rgba(56, 189, 248, 0.7)';
  ctx2d.lineWidth = 4;
  ctx2d.beginPath();
  ctx2d.roundRect(8, 8, w - 16, h - 16, 20);
  ctx2d.fill();
  ctx2d.stroke();

  // Header
  ctx2d.fillStyle = '#38bdf8';
  ctx2d.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx2d.fillText('6DoF 空間アンカー & ハンドトラッキング', 32, 54);

  // Divider
  ctx2d.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx2d.lineWidth = 2;
  ctx2d.beginPath();
  ctx2d.moveTo(32, 72);
  ctx2d.lineTo(w - 32, 72);
  ctx2d.stroke();

  const dist = camPos.distanceTo(pedestalPos);

  ctx2d.fillStyle = '#e2e8f0';
  ctx2d.font = '600 21px ui-monospace, SFMono-Regular, monospace';
  ctx2d.fillText(
    `視点位置: X ${camPos.x.toFixed(2)}m  Y ${camPos.y.toFixed(2)}m  Z ${camPos.z.toFixed(2)}m`,
    32,
    114,
  );
  ctx2d.fillText(`ペデスタル距離: ${dist.toFixed(2)} m`, 32, 150);

  ctx2d.fillStyle = handsDetected > 0 ? '#6ee7b7' : '#94a3b8';
  ctx2d.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx2d.fillText(`検出ハンド: ${handsDetected} 本 (最大25関節/手)`, 32, 192);

  ctx2d.fillStyle = '#fcd34d';
  ctx2d.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx2d.fillText(`状態: ${interactionText}`, 32, 232);

  ctx2d.fillStyle = '#94a3b8';
  ctx2d.font = '16px system-ui, -apple-system, sans-serif';
  ctx2d.fillText('回り込んで6DoF固定を確認 / つまんでオブジェクトを移動', 32, 276);
}

export const spatialHandModule: ExperienceModule = {
  id: 'spatial-hand',
  title: '6DoF 空間アンカー & ハンドトラッキング',
  subtitle: '25関節ハンド認識・ピンチ操作・空間固定オブジェクト',
  badge: 'WebXR 6DoF',
  summary:
    '目線の高さに固定された3Dオブジェクトと情報ペデスタルで6DoFの空間定着を体感。WebXR 25関節ハンドトラッキングのピンチ操作やCompute Puckポインターでオブジェクトを掴んで移動・回転できます。',
  supportsWebXr: true,

  mount(container: HTMLElement, capabilities: CapabilityReport): () => void {
    let sceneCtx: XrSceneContext | null = null;
    let activeSession: XRSession | null = null;

    const moduleRoot = new THREE.Group();
    const grabbables: GrabbableObject[] = [];

    // Pedestal telemetry canvas
    const panelCanvas = document.createElement('canvas');
    panelCanvas.width = 640;
    panelCanvas.height = 310;
    const panelTexture = new THREE.CanvasTexture(panelCanvas);
    const pedestalWorldPos = new THREE.Vector3(0, 1.32, -1.18);
    let lastPanelUpdate = 0;
    let currentInteractionText = '待機中（オブジェクトを掴めます）';

    // Hand tracking visuals (keyed by handedness 'left' | 'right')
    const handVisuals = new Map<string, HandVisual>();
    const pointerRays = new Map<XRInputSource, PointerRayState>();

    // Shared geometries for hand joints
    const jointSphereGeo = new THREE.SphereGeometry(0.0075, 10, 10);
    const tipSphereGeo = new THREE.SphereGeometry(0.011, 12, 12);
    const pinchOrbGeo = new THREE.SphereGeometry(0.016, 16, 16);

    const regularJointMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.1,
    });
    const pinchTipMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.15,
    });

    // Mouse/touch drag fallback state (3D preview)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const dragIntersection = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();
    let previewGrabbed: GrabbableObject | null = null;
    let previewPointerId: number | null = null;
    let lastPreviewClientX = 0;
    let lastPreviewClientY = 0;

    // Reusable math temporaries
    const tmpPosA = new THREE.Vector3();
    const tmpPosB = new THREE.Vector3();
    const tmpMid = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpDeltaQuat = new THREE.Quaternion();
    const tmpRayOrigin = new THREE.Vector3();
    const tmpRayDir = new THREE.Vector3();
    const tmpCamPos = new THREE.Vector3();
    const tmpCamDir = new THREE.Vector3();

    // Overlay control bar elements
    let controlBar: HTMLDivElement | null = null;
    let resetBtn: HTMLButtonElement | null = null;
    let stateChip: HTMLSpanElement | null = null;

    const updateStateChip = (text: string): void => {
      currentInteractionText = text;
      if (stateChip) {
        stateChip.textContent = text;
      }
    };

    const setObjectHighlighted = (obj: GrabbableObject, grabbed: boolean): void => {
      obj.accentMaterial.emissiveIntensity = grabbed ? 1.5 : obj.baseEmissiveIntensity;
      obj.group.scale.setScalar(grabbed ? 1.1 : 1.0);
    };

    const buildPedestal = (): void => {
      const pedestalGroup = new THREE.Group();
      pedestalGroup.position.copy(pedestalWorldPos);

      // Holographic info screen at eye level
      const screenGeo = new THREE.PlaneGeometry(0.68, 0.33);
      const screenMat = new THREE.MeshBasicMaterial({
        map: panelTexture,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      screenMesh.position.set(0, 0.14, 0);
      pedestalGroup.add(screenMesh);

      // Sleek floating frame border
      const frameEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.7, 0.35, 0.015));
      const frameLines = new THREE.LineSegments(
        frameEdges,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 }),
      );
      frameLines.position.copy(screenMesh.position);
      pedestalGroup.add(frameLines);

      // Thin holographic pillar down to a floor anchor ring (visualizes 6DoF grounding)
      const pillarGeo = new THREE.CylinderGeometry(0.012, 0.025, 1.12, 16);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.55,
        metalness: 0.7,
        roughness: 0.25,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(0, -0.62, 0);
      pedestalGroup.add(pillar);

      // Anchor base ring
      const ringGeo = new THREE.RingGeometry(0.18, 0.22, 40);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const baseRing = new THREE.Mesh(ringGeo, ringMat);
      baseRing.position.set(0, -1.18, 0);
      pedestalGroup.add(baseRing);

      moduleRoot.add(pedestalGroup);
    };

    const buildInteractiveObjects = (): void => {
      // 1. Crystal Octahedron (left-front)
      {
        const group = new THREE.Group();
        const home = new THREE.Vector3(-0.42, 1.24, -0.82);
        group.position.copy(home);

        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.55,
          roughness: 0.15,
          metalness: 0.3,
          transparent: true,
          opacity: 0.88,
        });
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), coreMat);
        group.add(core);

        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.125, 0)),
          new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.65 }),
        );
        group.add(wire);

        moduleRoot.add(group);
        grabbables.push({
          id: 'crystal',
          label: 'クリスタル八面体',
          group,
          hitMesh: core,
          accentMaterial: coreMat,
          baseEmissiveIntensity: 0.55,
          homePosition: home.clone(),
          anchorPosition: home.clone(),
          idlePhase: 0,
          grabbedBy: null,
        });
      }

      // 2. Gyro Ring (center-front, reachable)
      {
        const group = new THREE.Group();
        const home = new THREE.Vector3(0.0, 1.16, -0.74);
        group.position.copy(home);

        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xa855f7,
          emissive: 0x7e22ce,
          emissiveIntensity: 0.55,
          roughness: 0.2,
          metalness: 0.75,
        });
        const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 16, 40), ringMat);
        group.add(outerRing);

        const innerRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.068, 0.01, 14, 32),
          new THREE.MeshStandardMaterial({
            color: 0x22d3ee,
            emissive: 0x0891b2,
            emissiveIntensity: 0.65,
            roughness: 0.2,
            metalness: 0.7,
          }),
        );
        innerRing.rotation.x = Math.PI / 2;
        group.add(innerRing);

        const centerSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.028, 18, 18),
          new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            emissive: 0xe0f2fe,
            emissiveIntensity: 0.8,
          }),
        );
        group.add(centerSphere);

        // Invisible slightly larger hit sphere for comfortable grabbing
        const hitMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 12, 12),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        group.add(hitMesh);

        moduleRoot.add(group);
        grabbables.push({
          id: 'gyro',
          label: 'ジャイロ・リング',
          group,
          hitMesh,
          accentMaterial: ringMat,
          baseEmissiveIntensity: 0.55,
          homePosition: home.clone(),
          anchorPosition: home.clone(),
          idlePhase: 2.1,
          grabbedBy: null,
        });
      }

      // 3. Spatial Prism Cube (right-front)
      {
        const group = new THREE.Group();
        const home = new THREE.Vector3(0.42, 1.24, -0.82);
        group.position.copy(home);

        const cubeMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.5,
          roughness: 0.2,
          metalness: 0.45,
          transparent: true,
          opacity: 0.85,
        });
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.145, 0.145), cubeMat);
        group.add(cube);

        const frame = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(0.165, 0.165, 0.165)),
          new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.8 }),
        );
        group.add(frame);

        moduleRoot.add(group);
        grabbables.push({
          id: 'prism',
          label: '空間プリズム',
          group,
          hitMesh: cube,
          accentMaterial: cubeMat,
          baseEmissiveIntensity: 0.5,
          homePosition: home.clone(),
          anchorPosition: home.clone(),
          idlePhase: 4.2,
          grabbedBy: null,
        });
      }
    };

    const getOrCreateHandVisual = (handKey: string): HandVisual => {
      const existing = handVisuals.get(handKey);
      if (existing) {
        return existing;
      }

      const root = new THREE.Group();
      const joints = new Map<XRHandJoint, THREE.Mesh>();

      for (const jointName of HAND_JOINTS) {
        const isPinchTip = jointName === 'index-finger-tip' || jointName === 'thumb-tip';
        const mesh = new THREE.Mesh(
          isPinchTip ? tipSphereGeo : jointSphereGeo,
          isPinchTip ? pinchTipMat : regularJointMat,
        );
        mesh.visible = false;
        root.add(mesh);
        joints.set(jointName, mesh);
      }

      const pinchOrbMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.0,
      });
      const pinchOrb = new THREE.Mesh(pinchOrbGeo, pinchOrbMat);
      pinchOrb.visible = false;
      root.add(pinchOrb);

      moduleRoot.add(root);

      const visual: HandVisual = {
        root,
        joints,
        pinchOrb,
        pinchOrbMat,
        isPinching: false,
        grabbedObj: null,
        grabOffset: new THREE.Vector3(),
        lastHandQuat: new THREE.Quaternion(),
        hasLastQuat: false,
      };
      handVisuals.set(handKey, visual);
      return visual;
    };

    const getOrCreatePointerRay = (source: XRInputSource): PointerRayState => {
      const existing = pointerRays.get(source);
      if (existing) {
        return existing;
      }

      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -2.5),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75,
      });
      const line = new THREE.Line(geom, mat);
      line.visible = false;
      moduleRoot.add(line);

      const state: PointerRayState = {
        line,
        grabbedObj: null,
        grabDistance: 1.0,
        lastRayQuat: new THREE.Quaternion(),
        hasLastQuat: false,
      };
      pointerRays.set(source, state);
      return state;
    };

    const resetObjects = (): void => {
      for (const obj of grabbables) {
        obj.grabbedBy = null;
        obj.anchorPosition.copy(obj.homePosition);
        obj.group.position.copy(obj.homePosition);
        obj.group.rotation.set(0, 0, 0);
        setObjectHighlighted(obj, false);
      }
      for (const hv of handVisuals.values()) {
        hv.grabbedObj = null;
      }
      for (const pr of pointerRays.values()) {
        pr.grabbedObj = null;
      }
      previewGrabbed = null;
      updateStateChip('オブジェクト位置をリセットしました');
      sceneCtx?.setStatus('オブジェクトを初期の6DoFアンカー位置にリセットしました');
    };

    // WebXR Compute Puck / select fallback handlers
    const onSelectStart = (event: XRInputSourceEvent): void => {
      if (!sceneCtx || !activeSession) {
        return;
      }
      const source = event.inputSource;
      // If this input source is a tracked hand, pinch logic handles grabbing directly
      if (source.hand) {
        return;
      }
      const refSpace = sceneCtx.renderer.xr.getReferenceSpace();
      if (!refSpace) {
        return;
      }
      const pose = event.frame.getPose(source.targetRaySpace, refSpace);
      if (!pose) {
        return;
      }

      tmpRayOrigin.set(
        pose.transform.position.x,
        pose.transform.position.y,
        pose.transform.position.z,
      );
      tmpQuat.set(
        pose.transform.orientation.x,
        pose.transform.orientation.y,
        pose.transform.orientation.z,
        pose.transform.orientation.w,
      );
      tmpRayDir.set(0, 0, -1).applyQuaternion(tmpQuat).normalize();
      raycaster.set(tmpRayOrigin, tmpRayDir);

      const hitMeshes = grabbables.map((g) => g.hitMesh);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length > 0) {
        const hitObj = grabbables.find((g) => g.hitMesh === hits[0].object);
        if (hitObj && hitObj.grabbedBy === null) {
          const rayState = getOrCreatePointerRay(source);
          rayState.grabbedObj = hitObj;
          rayState.grabDistance = Math.max(0.35, hits[0].distance);
          rayState.lastRayQuat.copy(tmpQuat);
          rayState.hasLastQuat = true;
          hitObj.grabbedBy = `pointer:${source.handedness}`;
          setObjectHighlighted(hitObj, true);
          updateStateChip(`ポインター把持中: ${hitObj.label}`);
          sceneCtx.setStatus(`Compute Puck / ポインターで「${hitObj.label}」を移動中`);
        }
      }
    };

    const onSelectEnd = (event: XRInputSourceEvent): void => {
      const rayState = pointerRays.get(event.inputSource);
      if (rayState && rayState.grabbedObj) {
        const obj = rayState.grabbedObj;
        obj.anchorPosition.copy(obj.group.position);
        obj.grabbedBy = null;
        setObjectHighlighted(obj, false);
        rayState.grabbedObj = null;
        rayState.hasLastQuat = false;
        updateStateChip('待機中（空間に固定しました）');
        sceneCtx?.setStatus(`「${obj.label}」を新しい6DoF座標に固定しました`);
      }
    };

    // 3D preview mouse/touch drag fallback
    const updatePointerNdc = (event: PointerEvent): boolean => {
      if (!sceneCtx) {
        return false;
      }
      const rect = sceneCtx.renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      return true;
    };

    const onPreviewPointerDown = (event: PointerEvent): void => {
      if (!sceneCtx || sceneCtx.isXrActive()) {
        return;
      }
      if (event.button !== 0 && event.pointerType === 'mouse') {
        return;
      }
      if (!updatePointerNdc(event)) {
        return;
      }

      raycaster.setFromCamera(pointerNdc, sceneCtx.camera);
      const hits = raycaster.intersectObjects(
        grabbables.map((g) => g.hitMesh),
        false,
      );
      if (hits.length === 0) {
        return;
      }

      const target = grabbables.find((g) => g.hitMesh === hits[0].object);
      if (!target) {
        return;
      }

      // Prevent xrEngine from orbiting while dragging an object
      event.preventDefault();

      previewGrabbed = target;
      previewPointerId = event.pointerId;
      lastPreviewClientX = event.clientX;
      lastPreviewClientY = event.clientY;
      target.grabbedBy = 'preview-pointer';
      setObjectHighlighted(target, true);

      sceneCtx.camera.getWorldDirection(tmpCamDir);
      dragPlane.setFromNormalAndCoplanarPoint(tmpCamDir.negate(), target.group.position);
      if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        dragOffset.copy(target.group.position).sub(dragIntersection);
      } else {
        dragOffset.set(0, 0, 0);
      }

      updateStateChip(`ドラッグ移動中: ${target.label}`);
      sceneCtx.setStatus(`「${target.label}」をドラッグ移動中（離すと空間固定）`);
    };

    const onPreviewPointerMove = (event: PointerEvent): void => {
      if (
        !sceneCtx ||
        sceneCtx.isXrActive() ||
        !previewGrabbed ||
        previewPointerId !== event.pointerId
      ) {
        return;
      }
      if (!updatePointerNdc(event)) {
        return;
      }

      const dx = event.clientX - lastPreviewClientX;
      const dy = event.clientY - lastPreviewClientY;
      lastPreviewClientX = event.clientX;
      lastPreviewClientY = event.clientY;

      raycaster.setFromCamera(pointerNdc, sceneCtx.camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        previewGrabbed.group.position.copy(dragIntersection).add(dragOffset);
        previewGrabbed.anchorPosition.copy(previewGrabbed.group.position);
      }
      previewGrabbed.group.rotation.y += dx * 0.012;
      previewGrabbed.group.rotation.x += dy * 0.008;
    };

    const onPreviewPointerUp = (event: PointerEvent): void => {
      if (!previewGrabbed || previewPointerId !== event.pointerId) {
        return;
      }
      const released = previewGrabbed;
      released.anchorPosition.copy(released.group.position);
      released.grabbedBy = null;
      setObjectHighlighted(released, false);
      previewGrabbed = null;
      previewPointerId = null;
      updateStateChip('待機中（空間に固定しました）');
      sceneCtx?.setStatus(`「${released.label}」を新しい空間位置に固定しました`);
    };

    const unmount = mountXrViewport(
      container,
      capabilities,
      {
        title: '6DoF 空間アンカー & 25関節ハンドトラッキング',
        arButtonLabel: 'WebXR (AR) 開始',
        instructions:
          'ARでは手をかざして25関節トラッキングを確認し、親指と人差し指のピンチ（またはCompute Puckのトリガー）で3Dオブジェクトを移動・回転できます。3Dプレビューではオブジェクト直接ドラッグに対応。',
        optionalFeatures: ['hand-tracking', 'local-floor', 'bounded-floor'],
      },
      {
        init(ctx: XrSceneContext): void {
          sceneCtx = ctx;
          ctx.scene.add(moduleRoot);

          buildPedestal();
          buildInteractiveObjects();

          // Subtle floating grid reference ring in 3D preview
          const grid = new THREE.GridHelper(3.2, 16, 0x1e3a5f, 0x0f172a);
          grid.position.set(0, 0.14, -0.9);
          grid.name = 'preview-floor-grid';
          moduleRoot.add(grid);

          // Add compact overlay control bar inside overlayRoot
          controlBar = document.createElement('div');
          controlBar.style.display = 'flex';
          controlBar.style.flexWrap = 'wrap';
          controlBar.style.alignItems = 'center';
          controlBar.style.justifyContent = 'space-between';
          controlBar.style.gap = '8px';
          controlBar.style.pointerEvents = 'none';

          stateChip = document.createElement('span');
          stateChip.textContent = currentInteractionText;
          stateChip.style.pointerEvents = 'auto';
          stateChip.style.padding = '6px 10px';
          stateChip.style.borderRadius = '999px';
          stateChip.style.fontSize = '12px';
          stateChip.style.fontWeight = '600';
          stateChip.style.color = '#e0f2fe';
          stateChip.style.background = 'rgba(14, 165, 233, 0.22)';
          stateChip.style.border = '1px solid rgba(56, 189, 248, 0.45)';
          stateChip.style.backdropFilter = 'blur(8px)';
          controlBar.appendChild(stateChip);

          resetBtn = document.createElement('button');
          resetBtn.type = 'button';
          resetBtn.textContent = '位置リセット';
          resetBtn.style.pointerEvents = 'auto';
          resetBtn.style.padding = '6px 12px';
          resetBtn.style.borderRadius = '8px';
          resetBtn.style.fontSize = '12px';
          resetBtn.style.fontWeight = '600';
          resetBtn.style.color = '#f8fafc';
          resetBtn.style.background = 'rgba(15, 23, 42, 0.8)';
          resetBtn.style.border = '1px solid rgba(148, 163, 184, 0.38)';
          resetBtn.style.cursor = 'pointer';
          resetBtn.addEventListener('click', resetObjects);
          controlBar.appendChild(resetBtn);

          // Insert before bottom HUD bar so layout stays clean
          const lastChild = ctx.overlayRoot.lastElementChild;
          if (lastChild) {
            ctx.overlayRoot.insertBefore(controlBar, lastChild);
          } else {
            ctx.overlayRoot.appendChild(controlBar);
          }

          // Bind preview pointer listeners
          ctx.renderer.domElement.addEventListener('pointerdown', onPreviewPointerDown);
          window.addEventListener('pointermove', onPreviewPointerMove);
          window.addEventListener('pointerup', onPreviewPointerUp);
          window.addEventListener('pointercancel', onPreviewPointerUp);

          // Draw initial pedestal panel
          ctx.camera.getWorldPosition(tmpCamPos);
          createInfoPanelTexture(
            panelCanvas,
            tmpCamPos,
            pedestalWorldPos,
            0,
            currentInteractionText,
          );
          panelTexture.needsUpdate = true;

          ctx.setStatus(
            capabilities.immersiveArSupported
              ? 'AR開始で25関節ハンドトラッキング＆6DoF空間アンカーを体験できます'
              : '3Dプレビュー: オブジェクトを直接ドラッグ移動 / 背景ドラッグで視点回転',
          );
        },

        onSessionStart(session: XRSession): void {
          activeSession = session;
          session.addEventListener('selectstart', onSelectStart);
          session.addEventListener('selectend', onSelectEnd);

          const grid = moduleRoot.getObjectByName('preview-floor-grid');
          if (grid) {
            grid.visible = false;
          }
          updateStateChip('AR稼働中 — 手をかざしてピンチ操作');
        },

        onSessionEnd(): void {
          if (activeSession) {
            activeSession.removeEventListener('selectstart', onSelectStart);
            activeSession.removeEventListener('selectend', onSelectEnd);
            activeSession = null;
          }
          for (const hv of handVisuals.values()) {
            hv.root.visible = false;
            if (hv.grabbedObj) {
              hv.grabbedObj.grabbedBy = null;
              setObjectHighlighted(hv.grabbedObj, false);
              hv.grabbedObj = null;
            }
            hv.isPinching = false;
            hv.hasLastQuat = false;
          }
          for (const pr of pointerRays.values()) {
            pr.line.visible = false;
            if (pr.grabbedObj) {
              pr.grabbedObj.grabbedBy = null;
              setObjectHighlighted(pr.grabbedObj, false);
              pr.grabbedObj = null;
            }
          }
          const grid = moduleRoot.getObjectByName('preview-floor-grid');
          if (grid) {
            grid.visible = true;
          }
          updateStateChip('3Dプレビュー（ドラッグ移動可能）');
        },

        onFrame(delta: number, elapsed: number, frame?: XRFrame): void {
          if (!sceneCtx) {
            return;
          }

          // Animate idle grabbable objects around their rock-solid 6DoF anchor positions
          for (const obj of grabbables) {
            if (obj.grabbedBy === null) {
              obj.group.position.x = obj.anchorPosition.x;
              obj.group.position.z = obj.anchorPosition.z;
              obj.group.position.y =
                obj.anchorPosition.y + Math.sin(elapsed * 1.6 + obj.idlePhase) * 0.014;
              obj.group.rotation.y += delta * 0.35;
            }
          }

          let activeHandCount = 0;

          // Process WebXR 25-joint hands and Compute Puck pointers
          if (frame && activeSession) {
            const refSpace = sceneCtx.renderer.xr.getReferenceSpace();
            if (refSpace) {
              const seenHands = new Set<string>();
              const seenPointers = new Set<XRInputSource>();

              for (const source of activeSession.inputSources) {
                // 1) 25-joint Hand Tracking
                if (source.hand && typeof frame.getJointPose === 'function') {
                  const handKey = source.handedness || 'none';
                  seenHands.add(handKey);
                  activeHandCount += 1;

                  const hv = getOrCreateHandVisual(handKey);
                  hv.root.visible = true;

                  let hasIndexTip = false;
                  let hasThumbTip = false;
                  let hasWristQuat = false;

                  for (const jointName of HAND_JOINTS) {
                    const jointSpace = source.hand.get(jointName);
                    const mesh = hv.joints.get(jointName);
                    if (!jointSpace || !mesh) {
                      continue;
                    }
                    const jointPose = frame.getJointPose(jointSpace, refSpace);
                    if (!jointPose) {
                      mesh.visible = false;
                      continue;
                    }
                    mesh.visible = true;
                    const p = jointPose.transform.position;
                    mesh.position.set(p.x, p.y, p.z);

                    if (jointName === 'index-finger-tip') {
                      tmpPosA.set(p.x, p.y, p.z);
                      hasIndexTip = true;
                    } else if (jointName === 'thumb-tip') {
                      tmpPosB.set(p.x, p.y, p.z);
                      hasThumbTip = true;
                    } else if (jointName === 'wrist') {
                      const o = jointPose.transform.orientation;
                      tmpQuat.set(o.x, o.y, o.z, o.w);
                      hasWristQuat = true;
                    }
                  }

                  if (hasIndexTip && hasThumbTip) {
                    const pinchDist = tmpPosA.distanceTo(tmpPosB);
                    tmpMid.addVectors(tmpPosA, tmpPosB).multiplyScalar(0.5);

                    const wasPinching = hv.isPinching;
                    hv.isPinching = wasPinching
                      ? pinchDist < PINCH_END_DIST
                      : pinchDist < PINCH_START_DIST;

                    // Pinch feedback orb
                    if (pinchDist < 0.08) {
                      hv.pinchOrb.visible = true;
                      hv.pinchOrb.position.copy(tmpMid);
                      const proximity = Math.max(0, 1 - pinchDist / 0.08);
                      hv.pinchOrbMat.opacity = hv.isPinching ? 0.92 : proximity * 0.55;
                      hv.pinchOrbMat.color.setHex(hv.isPinching ? 0x10b981 : 0xfde047);
                      hv.pinchOrb.scale.setScalar(hv.isPinching ? 1.25 : 0.7 + proximity * 0.4);
                    } else {
                      hv.pinchOrb.visible = false;
                    }

                    // Pinch started -> try grabbing nearest object
                    if (hv.isPinching && !wasPinching && !hv.grabbedObj) {
                      let nearest: GrabbableObject | null = null;
                      let minDist = HAND_GRAB_RADIUS;
                      for (const obj of grabbables) {
                        if (obj.grabbedBy !== null) {
                          continue;
                        }
                        const d = obj.group.position.distanceTo(tmpMid);
                        if (d < minDist) {
                          minDist = d;
                          nearest = obj;
                        }
                      }
                      if (nearest) {
                        hv.grabbedObj = nearest;
                        hv.grabOffset.copy(nearest.group.position).sub(tmpMid);
                        nearest.grabbedBy = `hand:${handKey}`;
                        setObjectHighlighted(nearest, true);
                        if (hasWristQuat) {
                          hv.lastHandQuat.copy(tmpQuat);
                          hv.hasLastQuat = true;
                        }
                        updateStateChip(`ピンチ把持中: ${nearest.label}`);
                        sceneCtx.setStatus(`ピンチで「${nearest.label}」を移動・回転中`);
                      }
                    }

                    // Pinch held -> move & rotate grabbed object
                    if (hv.isPinching && hv.grabbedObj) {
                      hv.grabbedObj.group.position.copy(tmpMid).add(hv.grabOffset);
                      hv.grabbedObj.anchorPosition.copy(hv.grabbedObj.group.position);

                      if (hasWristQuat) {
                        if (hv.hasLastQuat) {
                          tmpDeltaQuat
                            .copy(hv.lastHandQuat)
                            .invert()
                            .premultiply(tmpQuat);
                          hv.grabbedObj.group.quaternion.premultiply(tmpDeltaQuat);
                        }
                        hv.lastHandQuat.copy(tmpQuat);
                        hv.hasLastQuat = true;
                      }
                    }

                    // Pinch released -> lock at new 6DoF world coordinate
                    if (!hv.isPinching && wasPinching && hv.grabbedObj) {
                      const released = hv.grabbedObj;
                      released.anchorPosition.copy(released.group.position);
                      released.grabbedBy = null;
                      setObjectHighlighted(released, false);
                      hv.grabbedObj = null;
                      hv.hasLastQuat = false;
                      updateStateChip('空間に固定しました（ピンチ待機中）');
                      sceneCtx.setStatus(`「${released.label}」を新しい6DoF座標に固定しました`);
                    }
                  }
                } else {
                  // 2) Compute Puck / Controller Pointer Fallback
                  seenPointers.add(source);
                  const rayState = getOrCreatePointerRay(source);
                  const rayPose = frame.getPose(source.targetRaySpace, refSpace);
                  if (rayPose) {
                    const p = rayPose.transform.position;
                    const o = rayPose.transform.orientation;
                    rayState.line.visible = true;
                    rayState.line.position.set(p.x, p.y, p.z);
                    rayState.line.quaternion.set(o.x, o.y, o.z, o.w);

                    if (rayState.grabbedObj) {
                      tmpRayOrigin.set(p.x, p.y, p.z);
                      tmpQuat.set(o.x, o.y, o.z, o.w);
                      tmpRayDir.set(0, 0, -1).applyQuaternion(tmpQuat).normalize();
                      rayState.grabbedObj.group.position
                        .copy(tmpRayOrigin)
                        .addScaledVector(tmpRayDir, rayState.grabDistance);
                      rayState.grabbedObj.anchorPosition.copy(rayState.grabbedObj.group.position);

                      if (rayState.hasLastQuat) {
                        tmpDeltaQuat
                          .copy(rayState.lastRayQuat)
                          .invert()
                          .premultiply(tmpQuat);
                        rayState.grabbedObj.group.quaternion.premultiply(tmpDeltaQuat);
                      }
                      rayState.lastRayQuat.copy(tmpQuat);
                      rayState.hasLastQuat = true;
                    }
                  } else {
                    rayState.line.visible = false;
                  }
                }
              }

              // Hide hands that are no longer tracked this frame
              for (const [key, hv] of handVisuals.entries()) {
                if (!seenHands.has(key)) {
                  hv.root.visible = false;
                }
              }
              for (const [src, pr] of pointerRays.entries()) {
                if (!seenPointers.has(src)) {
                  pr.line.visible = false;
                }
              }
            }
          }

          // Refresh 6DoF telemetry pedestal ~6 times per second
          if (elapsed - lastPanelUpdate > 0.16) {
            lastPanelUpdate = elapsed;
            const activeCam = sceneCtx.isXrActive()
              ? sceneCtx.renderer.xr.getCamera()
              : sceneCtx.camera;
            activeCam.getWorldPosition(tmpCamPos);
            createInfoPanelTexture(
              panelCanvas,
              tmpCamPos,
              pedestalWorldPos,
              activeHandCount,
              currentInteractionText,
            );
            panelTexture.needsUpdate = true;
          }
        },

        dispose(): void {
          if (sceneCtx) {
            sceneCtx.renderer.domElement.removeEventListener('pointerdown', onPreviewPointerDown);
            sceneCtx.scene.remove(moduleRoot);
          }
          window.removeEventListener('pointermove', onPreviewPointerMove);
          window.removeEventListener('pointerup', onPreviewPointerUp);
          window.removeEventListener('pointercancel', onPreviewPointerUp);

          if (resetBtn) {
            resetBtn.removeEventListener('click', resetObjects);
          }
          if (controlBar && controlBar.parentElement) {
            controlBar.parentElement.removeChild(controlBar);
          }

          disposeObjectTree(moduleRoot);
          jointSphereGeo.dispose();
          tipSphereGeo.dispose();
          pinchOrbGeo.dispose();
          regularJointMat.dispose();
          pinchTipMat.dispose();
          panelTexture.dispose();

          handVisuals.clear();
          pointerRays.clear();
          grabbables.length = 0;
          sceneCtx = null;
        },
      },
    );

    return unmount;
  },
};
