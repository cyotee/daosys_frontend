#!/usr/bin/env node
/**
 * Build-time ABI bundler for local development
 *
 * Scans Foundry (foundry.toml) or Hardhat (hardhat.config.js/ts) projects
 * and bundles contract ABIs into public/local-abis.json for static access.
 *
 * Usage:
 *   node scripts/bundle-local-abis.js [--project-dir=<path>] [--out-dir=<path>]
 */

const fs = require('fs');
const path = require('path');

const MAX_CONTRACTS = 500;

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.split('=');
      flags[k.replace(/^--/, '')] = v === undefined ? true : v;
    }
  }
  return flags;
}

function findFileUp(startDir, filename, maxLevels = 8) {
  let dir = startDir;
  for (let i = 0; i < maxLevels; i++) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseFoundryConfig(configPath) {
  try {
    const toml = require('toml');
    const content = fs.readFileSync(configPath, 'utf8');
    const config = toml.parse(content);

    // Check for out directory in various locations
    let outDir = config.out ||
                 (config.profile && config.profile.default && config.profile.default.out) ||
                 'out';

    return {
      type: 'foundry',
      projectDir: path.dirname(configPath),
      outDir: path.resolve(path.dirname(configPath), outDir),
      configPath
    };
  } catch (e) {
    console.error(`Failed to parse foundry.toml: ${e.message}`);
    return null;
  }
}

function parseHardhatConfig(configPath) {
  try {
    // Read the config file and look for artifacts path
    // We can't directly require() it as it may have dependencies not installed
    const content = fs.readFileSync(configPath, 'utf8');

    // Try to extract paths.artifacts from the config
    let artifactsDir = 'artifacts'; // Hardhat default

    // Look for paths: { artifacts: "..." } pattern
    const pathsMatch = content.match(/paths\s*:\s*\{[^}]*artifacts\s*:\s*['"]([^'"]+)['"]/);
    if (pathsMatch) {
      artifactsDir = pathsMatch[1];
    }

    return {
      type: 'hardhat',
      projectDir: path.dirname(configPath),
      outDir: path.resolve(path.dirname(configPath), artifactsDir),
      configPath
    };
  } catch (e) {
    console.error(`Failed to parse hardhat config: ${e.message}`);
    return null;
  }
}

function detectProjectConfig(startDir) {
  // Check for Foundry first
  const foundryPath = findFileUp(startDir, 'foundry.toml');
  if (foundryPath) {
    return parseFoundryConfig(foundryPath);
  }

  // Check for Hardhat (TypeScript first, then JavaScript)
  const hardhatTsPath = findFileUp(startDir, 'hardhat.config.ts');
  if (hardhatTsPath) {
    return parseHardhatConfig(hardhatTsPath);
  }

  const hardhatJsPath = findFileUp(startDir, 'hardhat.config.js');
  if (hardhatJsPath) {
    return parseHardhatConfig(hardhatJsPath);
  }

  return null;
}

function scanFoundryArtifacts(outDir) {
  const contracts = {};

  if (!fs.existsSync(outDir)) {
    return contracts;
  }

  // Foundry structure: out/<ContractName.sol>/<ContractName>.json
  const entries = fs.readdirSync(outDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith('.sol')) {
      const solDir = path.join(outDir, entry.name);
      const jsonFiles = fs.readdirSync(solDir).filter(f => f.endsWith('.json'));

      for (const jsonFile of jsonFiles) {
        try {
          const artifactPath = path.join(solDir, jsonFile);
          const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

          if (artifact.abi && Array.isArray(artifact.abi) && artifact.abi.length > 0) {
            const name = artifact.contractName || jsonFile.replace('.json', '');
            contracts[name] = {
              abi: artifact.abi,
              sourcePath: entry.name,
              bytecode: artifact.bytecode?.object || artifact.bytecode || undefined,
              deployedBytecode: artifact.deployedBytecode?.object || artifact.deployedBytecode || undefined
            };
          }
        } catch (e) {
          // Skip invalid JSON files
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      // Also check for JSON files directly in out/ (some configurations)
      try {
        const artifactPath = path.join(outDir, entry.name);
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

        if (artifact.abi && Array.isArray(artifact.abi) && artifact.abi.length > 0) {
          const name = artifact.contractName || artifact.name || entry.name.replace('.json', '');
          contracts[name] = {
            abi: artifact.abi,
            sourcePath: undefined,
            bytecode: artifact.bytecode?.object || artifact.bytecode || undefined,
            deployedBytecode: artifact.deployedBytecode?.object || artifact.deployedBytecode || undefined
          };
        }
      } catch (e) {
        // Skip invalid JSON files
      }
    }
  }

  return contracts;
}

function scanHardhatArtifacts(artifactsDir) {
  const contracts = {};

  if (!fs.existsSync(artifactsDir)) {
    return contracts;
  }

  // Hardhat structure: artifacts/contracts/<Path>/<ContractName>.sol/<ContractName>.json
  // Also: artifacts/@openzeppelin/... for dependencies
  function scanDir(dir, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Skip debug files directory
        if (entry.name === 'build-info') continue;
        scanDir(fullPath, relPath);
      } else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.dbg.json')) {
        try {
          const artifact = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

          if (artifact.abi && Array.isArray(artifact.abi) && artifact.abi.length > 0) {
            const name = artifact.contractName || entry.name.replace('.json', '');

            // Skip if already have this contract (prefer non-dependency versions)
            if (contracts[name] && relPath.includes('@')) continue;

            contracts[name] = {
              abi: artifact.abi,
              sourcePath: artifact.sourceName || relPath,
              bytecode: artifact.bytecode || undefined,
              deployedBytecode: artifact.deployedBytecode || undefined
            };
          }
        } catch (e) {
          // Skip invalid JSON files
        }
      }
    }
  }

  scanDir(artifactsDir);
  return contracts;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Determine project directory
  let projectDir = args['project-dir'] || process.env.PWD || process.cwd();

  // Detect project configuration
  let config = null;

  if (args['out-dir']) {
    // Direct out directory override
    config = {
      type: 'override',
      projectDir,
      outDir: path.resolve(args['out-dir']),
      configPath: null
    };
  } else {
    config = detectProjectConfig(projectDir);
  }

  if (!config) {
    console.log('No Foundry or Hardhat project found. Creating empty manifest.');
    const manifest = {
      contracts: {},
      projectType: null,
      projectDir: null,
      generatedAt: new Date().toISOString(),
      empty: true
    };

    const outputPath = path.join(__dirname, '..', 'public', 'local-abis.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    console.log(`Wrote empty manifest to ${outputPath}`);
    return;
  }

  console.log(`Detected ${config.type} project at: ${config.projectDir}`);
  console.log(`Artifacts directory: ${config.outDir}`);

  // Scan artifacts
  let contracts = {};
  if (config.type === 'foundry' || config.type === 'override') {
    contracts = scanFoundryArtifacts(config.outDir);
  } else if (config.type === 'hardhat') {
    contracts = scanHardhatArtifacts(config.outDir);
  }

  // Limit number of contracts
  const contractNames = Object.keys(contracts);
  if (contractNames.length > MAX_CONTRACTS) {
    console.warn(`Warning: Found ${contractNames.length} contracts, limiting to ${MAX_CONTRACTS}`);
    const limited = {};
    contractNames.slice(0, MAX_CONTRACTS).forEach(name => {
      limited[name] = contracts[name];
    });
    contracts = limited;
  }

  // Remove bytecode to reduce file size (keep just ABIs)
  // Bytecode can be loaded on-demand if needed
  for (const name of Object.keys(contracts)) {
    delete contracts[name].bytecode;
    delete contracts[name].deployedBytecode;
  }

  const manifest = {
    contracts,
    projectType: config.type,
    projectDir: config.projectDir,
    outDir: config.outDir,
    generatedAt: new Date().toISOString(),
    contractCount: Object.keys(contracts).length
  };

  const outputPath = path.join(__dirname, '..', 'public', 'local-abis.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

  console.log(`Bundled ${Object.keys(contracts).length} contracts to ${outputPath}`);

  // List contracts
  if (Object.keys(contracts).length > 0 && Object.keys(contracts).length <= 20) {
    console.log('Contracts:', Object.keys(contracts).join(', '));
  }
}

main();
