import type * as THREE from 'three';

export type ModuleId =
  | 'optics'
  | 'spatial-hand'
  | 'environment'
  | 'spatial-audio'
  | 'guide';

export interface CapabilityReport {
  isSecureContext: boolean;
  webXrAvailable: boolean;
  immersiveArSupported: boolean;
  webAudioAvailable: boolean;
  deviceMotionAvailable: boolean;
  isStandalonePwa: boolean;
  userAgent: string;
}

export interface XrSceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  isXrActive: () => boolean;
  overlayRoot: HTMLElement;
  setStatus: (text: string) => void;
}

export interface XrSceneHooks {
  /** Called once when the scene is initialized */
  init: (ctx: XrSceneContext) => void | Promise<void>;
  /** Called every animation frame (both in WebXR and 3D fallback preview) */
  onFrame: (delta: number, elapsed: number, frame?: XRFrame) => void;
  /** Called when an XR session starts */
  onSessionStart?: (session: XRSession) => void;
  /** Called when an XR session ends */
  onSessionEnd?: () => void;
  /** Cleanup all geometries, materials, audio nodes, and event listeners */
  dispose: () => void;
}

export interface ExperienceModule {
  id: ModuleId;
  title: string;
  subtitle: string;
  badge: string;
  summary: string;
  supportsWebXr: boolean;
  /** Mount the module UI into container and return an unmount cleanup function */
  mount: (container: HTMLElement, capabilities: CapabilityReport) => () => void;
}
