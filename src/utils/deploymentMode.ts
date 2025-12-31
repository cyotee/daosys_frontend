'use client';

export type DeploymentMode = 'local' | 'ipfs' | 'hosted';

// Known IPFS gateway domains
const IPFS_GATEWAY_PATTERNS = [
  /^ipfs\.io$/,
  /^gateway\.ipfs\.io$/,
  /^cloudflare-ipfs\.com$/,
  /^dweb\.link$/,
  /\.ipfs\.dweb\.link$/,
  /^gateway\.pinata\.cloud$/,
  /^ipfs\.infura\.io$/,
  /^ipfs\.fleek\.co$/,
  /^w3s\.link$/,
  /\.ipfs\./,
];

/**
 * Detect the current deployment mode based on the URL
 */
export function getDeploymentMode(): DeploymentMode {
  if (typeof window === 'undefined') {
    return 'local'; // SSR context, assume local
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Check for ipfs:// or ipns:// protocols
  if (protocol === 'ipfs:' || protocol === 'ipns:') {
    return 'ipfs';
  }

  // Check for localhost/development
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost')
  ) {
    return 'local';
  }

  // Check for known IPFS gateways
  for (const pattern of IPFS_GATEWAY_PATTERNS) {
    if (pattern.test(hostname)) {
      return 'ipfs';
    }
  }

  // Check if URL contains IPFS hash patterns
  const path = window.location.pathname;
  if (path.match(/\/ipfs\/Qm[a-zA-Z0-9]{44}/) || path.match(/\/ipfs\/bafy[a-zA-Z0-9]+/)) {
    return 'ipfs';
  }

  return 'hosted';
}

/**
 * Check if local ABIs are available
 */
export function hasLocalAbis(): boolean {
  // This will be set by the loader after checking public/local-abis.json
  return typeof window !== 'undefined' && (window as any).__LOCAL_ABIS_AVAILABLE === true;
}

/**
 * Mark local ABIs as available (called by the loader)
 */
export function setLocalAbisAvailable(available: boolean): void {
  if (typeof window !== 'undefined') {
    (window as any).__LOCAL_ABIS_AVAILABLE = available;
  }
}

/**
 * Get a human-readable description of the current mode
 */
export function getDeploymentModeLabel(): string {
  const mode = getDeploymentMode();
  switch (mode) {
    case 'local':
      return 'Local Development';
    case 'ipfs':
      return 'IPFS';
    case 'hosted':
      return 'Hosted';
    default:
      return 'Unknown';
  }
}

/**
 * Check if we're in a mode that can potentially have local ABIs
 */
export function canHaveLocalAbis(): boolean {
  const mode = getDeploymentMode();
  // Local mode can have bundled ABIs
  // IPFS/hosted can also have bundled ABIs if they were bundled at build time
  return true; // We check at runtime via hasLocalAbis()
}
