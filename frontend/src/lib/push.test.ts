import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushSupport, urlBase64ToBytes } from './push';

afterEach(() => vi.unstubAllGlobals());

const stubBrowser = (userAgent: string, standalone: boolean) => {
  vi.stubGlobal('navigator', { userAgent, platform: 'iPhone', maxTouchPoints: 5, standalone });
  vi.stubGlobal('matchMedia', () => ({ matches: standalone }));
};

describe('pushSupport', () => {
  it('asks iPhone users to install the app first', () => {
    stubBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', false);
    expect(pushSupport()).toBe('needs-install');
  });

  it('reports a browser without push', () => {
    stubBrowser('Mozilla/5.0 (X11; Linux x86_64)', false);
    expect(pushSupport()).toBe('unsupported');
  });
});

describe('urlBase64ToBytes', () => {
  it('decodes the URL-safe alphabet, with or without padding', () => {
    expect([...urlBase64ToBytes('-_-_')]).toEqual([0xfb, 0xff, 0xbf]);
    expect([...urlBase64ToBytes('AQ')]).toEqual([1]);
  });
});
