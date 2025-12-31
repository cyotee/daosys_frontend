#!/usr/bin/env node
/**
 * Watch mode for auto-rebuilding ABI manifest
 *
 * Monitors the Foundry/Hardhat output directory and re-bundles ABIs
 * whenever contract artifacts change.
 *
 * Usage:
 *   node scripts/watch-abis.js [--project-dir=<path>]
 */

const fs = require('fs');
const path = require('path');

const DEBOUNCE_MS = 500; // Wait for rapid file changes to settle

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

    let outDir = config.out ||
                 (config.profile && config.profile.default && config.profile.default.out) ||
                 'out';

    return {
      type: 'foundry',
      projectDir: path.dirname(configPath),
      outDir: path.resolve(path.dirname(configPath), outDir)
    };
  } catch (e) {
    return null;
  }
}

function parseHardhatConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    let artifactsDir = 'artifacts';

    const pathsMatch = content.match(/paths\s*:\s*\{[^}]*artifacts\s*:\s*['"]([^'"]+)['"]/);
    if (pathsMatch) {
      artifactsDir = pathsMatch[1];
    }

    return {
      type: 'hardhat',
      projectDir: path.dirname(configPath),
      outDir: path.resolve(path.dirname(configPath), artifactsDir)
    };
  } catch (e) {
    return null;
  }
}

function detectProjectConfig(startDir) {
  const foundryPath = findFileUp(startDir, 'foundry.toml');
  if (foundryPath) {
    return parseFoundryConfig(foundryPath);
  }

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

function runBundler(projectDir) {
  const { spawn } = require('child_process');
  const bundlerPath = path.join(__dirname, 'bundle-local-abis.js');

  const args = ['--project-dir=' + projectDir];
  const proc = spawn(process.execPath, [bundlerPath, ...args], {
    stdio: 'inherit',
    cwd: __dirname
  });

  return new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Bundler exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectDir = args['project-dir'] || process.env.PWD || process.cwd();

  const config = detectProjectConfig(projectDir);

  if (!config) {
    console.error('No Foundry or Hardhat project found. Cannot watch.');
    process.exit(1);
  }

  console.log(`Watching ${config.type} project: ${config.projectDir}`);
  console.log(`Artifacts directory: ${config.outDir}`);

  // Run initial bundle
  console.log('\nInitial bundle...');
  try {
    await runBundler(projectDir);
  } catch (e) {
    console.error('Initial bundle failed:', e.message);
  }

  // Set up watch
  let debounceTimer = null;
  let isRebuilding = false;

  function scheduleRebuild() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      if (isRebuilding) {
        // Schedule another rebuild after current one finishes
        scheduleRebuild();
        return;
      }

      isRebuilding = true;
      console.log('\nArtifacts changed, rebuilding...');

      try {
        await runBundler(projectDir);
        console.log('Rebuild complete.');
      } catch (e) {
        console.error('Rebuild failed:', e.message);
      }

      isRebuilding = false;
    }, DEBOUNCE_MS);
  }

  // Watch the artifacts directory
  if (!fs.existsSync(config.outDir)) {
    console.log(`Artifacts directory doesn't exist yet. Waiting for it to be created...`);

    // Watch parent directory for the out dir to be created
    const parentDir = path.dirname(config.outDir);
    const outDirName = path.basename(config.outDir);

    if (fs.existsSync(parentDir)) {
      fs.watch(parentDir, { recursive: false }, (eventType, filename) => {
        if (filename === outDirName && fs.existsSync(config.outDir)) {
          console.log(`Artifacts directory created. Starting watch...`);
          startWatch();
        }
      });
    }
  } else {
    startWatch();
  }

  function startWatch() {
    try {
      fs.watch(config.outDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          scheduleRebuild();
        }
      });
      console.log(`\nWatching for changes... (Ctrl+C to stop)`);
    } catch (e) {
      console.error('Failed to start watch:', e.message);
      console.log('Falling back to polling mode...');

      // Fallback to polling
      let lastMtime = null;
      setInterval(() => {
        try {
          const stat = fs.statSync(config.outDir);
          if (lastMtime && stat.mtime > lastMtime) {
            scheduleRebuild();
          }
          lastMtime = stat.mtime;
        } catch (e) {
          // Directory might not exist yet
        }
      }, 2000);
    }
  }

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nStopping watch...');
    process.exit(0);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
