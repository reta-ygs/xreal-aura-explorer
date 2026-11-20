// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { environmentModule } from '../modules/environmentModule.ts';
import { guideModule } from '../modules/guideModule.ts';
import { opticsModule } from '../modules/opticsModule.ts';
import { spatialAudioModule } from '../modules/spatialAudioModule.ts';
import { spatialHandModule } from '../modules/spatialHandModule.ts';
import type { CapabilityReport } from '../types.ts';

const mockCapabilities: CapabilityReport = {
  isSecureContext: true,
  webXrAvailable: false,
  immersiveArSupported: false,
  webAudioAvailable: false,
  deviceMotionAvailable: false,
  isStandalonePwa: false,
  userAgent: 'vitest',
};

describe('XREAL AURA Explorer modules', () => {
  const allModules = [
    opticsModule,
    spatialHandModule,
    environmentModule,
    spatialAudioModule,
    guideModule,
  ];

  it('registers all 5 modules with unique IDs and required metadata', () => {
    const ids = allModules.map((m) => m.id);
    expect(new Set(ids).size).toBe(5);

    for (const mod of allModules) {
      expect(mod.title.length).toBeGreaterThan(0);
      expect(mod.subtitle.length).toBeGreaterThan(0);
      expect(mod.badge.length).toBeGreaterThan(0);
      expect(typeof mod.mount).toBe('function');
    }
  });

  it('marks WebXR modules accurately', () => {
    expect(opticsModule.supportsWebXr).toBe(false);
    expect(guideModule.supportsWebXr).toBe(false);
    expect(spatialHandModule.supportsWebXr).toBe(true);
    expect(environmentModule.supportsWebXr).toBe(true);
    expect(spatialAudioModule.supportsWebXr).toBe(true);
  });
});

describe('guideModule DOM & localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('mounts checklist items, toggles state, persists to localStorage, and cleans up', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const unmount = guideModule.mount(root, mockCapabilities);
    const buttons = root.querySelectorAll<HTMLButtonElement>('button[data-action="toggle-check"]');
    expect(buttons.length).toBeGreaterThanOrEqual(8);

    const firstId = buttons[0].dataset.id;
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');

    buttons[0].click();
    const updated = root.querySelector<HTMLButtonElement>(
      `button[data-action="toggle-check"][data-id="${firstId}"]`
    );
    expect(updated?.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.length).toBeGreaterThan(0);

    unmount();
    expect(root.innerHTML).toBe('');
  });
});

describe('opticsModule DOM lifecycle', () => {
  it('mounts and unmounts cleanly', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const unmount = opticsModule.mount(root, mockCapabilities);
    expect(root.textContent).toContain('70');
    unmount();
    expect(root.innerHTML).toBe('');
  });
});

describe('PWA assets', () => {
  it('has a valid manifest.webmanifest', () => {
    const raw = readFileSync(resolve(process.cwd(), 'public/manifest.webmanifest'), 'utf-8');
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    expect(manifest.name).toBe('XREAL AURA Explorer');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(Array.isArray(manifest.icons)).toBe(true);
  });

  it('has a service worker with install, activate, and fetch handlers', () => {
    const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf-8');
    expect(sw).toContain("'install'");
    expect(sw).toContain("'activate'");
    expect(sw).toContain("'fetch'");
  });
});
