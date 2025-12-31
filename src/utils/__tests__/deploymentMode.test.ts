/**
 * @jest-environment jsdom
 */

import {
  getDeploymentMode,
  getDeploymentModeLabel,
  hasLocalAbis,
  setLocalAbisAvailable,
  type LocationLike,
} from '../deploymentMode';

// Helper to create location objects for testing
function createLocation(overrides: Partial<LocationLike>): LocationLike {
  return {
    hostname: 'localhost',
    protocol: 'http:',
    pathname: '/',
    ...overrides,
  };
}

describe('deploymentMode', () => {
  describe('getDeploymentMode', () => {
    describe('local mode detection', () => {
      it('returns "local" for localhost', () => {
        const location = createLocation({ hostname: 'localhost', protocol: 'http:' });
        expect(getDeploymentMode(location)).toBe('local');
      });

      it('returns "local" for 127.0.0.1', () => {
        const location = createLocation({ hostname: '127.0.0.1', protocol: 'http:' });
        expect(getDeploymentMode(location)).toBe('local');
      });

      it('returns "local" for 0.0.0.0', () => {
        const location = createLocation({ hostname: '0.0.0.0', protocol: 'http:' });
        expect(getDeploymentMode(location)).toBe('local');
      });

      it('returns "local" for *.localhost', () => {
        const location = createLocation({ hostname: 'test.localhost', protocol: 'http:' });
        expect(getDeploymentMode(location)).toBe('local');
      });

      it('returns "local" for subdomain.localhost', () => {
        const location = createLocation({ hostname: 'api.test.localhost', protocol: 'http:' });
        expect(getDeploymentMode(location)).toBe('local');
      });
    });

    describe('IPFS protocol detection', () => {
      it('returns "ipfs" for ipfs:// protocol', () => {
        const location = createLocation({ protocol: 'ipfs:', hostname: '' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for ipns:// protocol', () => {
        const location = createLocation({ protocol: 'ipns:', hostname: '' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });
    });

    describe('IPFS gateway detection', () => {
      it('returns "ipfs" for ipfs.io', () => {
        const location = createLocation({ hostname: 'ipfs.io', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for gateway.ipfs.io', () => {
        const location = createLocation({ hostname: 'gateway.ipfs.io', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for cloudflare-ipfs.com', () => {
        const location = createLocation({ hostname: 'cloudflare-ipfs.com', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for dweb.link', () => {
        const location = createLocation({ hostname: 'dweb.link', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for *.ipfs.dweb.link', () => {
        const location = createLocation({
          hostname: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi.ipfs.dweb.link',
          protocol: 'https:',
        });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for gateway.pinata.cloud', () => {
        const location = createLocation({ hostname: 'gateway.pinata.cloud', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for w3s.link', () => {
        const location = createLocation({ hostname: 'w3s.link', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for ipfs.infura.io', () => {
        const location = createLocation({ hostname: 'ipfs.infura.io', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for ipfs.fleek.co', () => {
        const location = createLocation({ hostname: 'ipfs.fleek.co', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for any *.ipfs.* subdomain', () => {
        const location = createLocation({ hostname: 'my-app.ipfs.nftstorage.link', protocol: 'https:' });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });
    });

    describe('IPFS path detection', () => {
      it('returns "ipfs" for URL with /ipfs/Qm... path', () => {
        const location = createLocation({
          hostname: 'example.com',
          protocol: 'https:',
          pathname: '/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme',
        });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "ipfs" for URL with /ipfs/bafy... path', () => {
        const location = createLocation({
          hostname: 'example.com',
          protocol: 'https:',
          pathname: '/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/readme',
        });
        expect(getDeploymentMode(location)).toBe('ipfs');
      });

      it('returns "hosted" for /ipfs/ path with invalid CID', () => {
        const location = createLocation({
          hostname: 'example.com',
          protocol: 'https:',
          pathname: '/ipfs/invalid',
        });
        expect(getDeploymentMode(location)).toBe('hosted');
      });
    });

    describe('hosted mode detection', () => {
      it('returns "hosted" for regular domain', () => {
        const location = createLocation({
          hostname: 'myapp.vercel.app',
          protocol: 'https:',
          pathname: '/',
        });
        expect(getDeploymentMode(location)).toBe('hosted');
      });

      it('returns "hosted" for custom domain', () => {
        const location = createLocation({
          hostname: 'daosys.example.com',
          protocol: 'https:',
          pathname: '/connect',
        });
        expect(getDeploymentMode(location)).toBe('hosted');
      });

      it('returns "hosted" for netlify domain', () => {
        const location = createLocation({
          hostname: 'my-app.netlify.app',
          protocol: 'https:',
          pathname: '/',
        });
        expect(getDeploymentMode(location)).toBe('hosted');
      });
    });
  });

  describe('getDeploymentModeLabel', () => {
    it('returns "Local Development" for local mode', () => {
      const location = createLocation({ hostname: 'localhost', protocol: 'http:' });
      expect(getDeploymentModeLabel(location)).toBe('Local Development');
    });

    it('returns "IPFS" for ipfs mode', () => {
      const location = createLocation({ hostname: 'ipfs.io', protocol: 'https:' });
      expect(getDeploymentModeLabel(location)).toBe('IPFS');
    });

    it('returns "Hosted" for hosted mode', () => {
      const location = createLocation({
        hostname: 'myapp.com',
        protocol: 'https:',
        pathname: '/',
      });
      expect(getDeploymentModeLabel(location)).toBe('Hosted');
    });
  });

  describe('hasLocalAbis / setLocalAbisAvailable', () => {
    beforeEach(() => {
      // Reset local ABIs flag
      (window as any).__LOCAL_ABIS_AVAILABLE = undefined;
    });

    it('returns false by default', () => {
      expect(hasLocalAbis()).toBe(false);
    });

    it('returns true after setLocalAbisAvailable(true)', () => {
      setLocalAbisAvailable(true);
      expect(hasLocalAbis()).toBe(true);
    });

    it('returns false after setLocalAbisAvailable(false)', () => {
      setLocalAbisAvailable(true);
      setLocalAbisAvailable(false);
      expect(hasLocalAbis()).toBe(false);
    });

    it('persists across multiple checks', () => {
      setLocalAbisAvailable(true);
      expect(hasLocalAbis()).toBe(true);
      expect(hasLocalAbis()).toBe(true);
      expect(hasLocalAbis()).toBe(true);
    });
  });
});
