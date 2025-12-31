#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.split('=');
      flags[k.replace(/^--/, '')] = v === undefined ? true : v;
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function runBundler(projectDir) {
  return new Promise((resolve, reject) => {
    const bundlerPath = path.join(__dirname, '..', 'scripts', 'bundle-local-abis.js');
    const args = projectDir ? ['--project-dir=' + projectDir] : [];

    console.log('Bundling local ABIs...');
    const proc = spawn(process.execPath, [bundlerPath, ...args], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: process.env
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Bundler exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function startWatcher(projectDir) {
  const watcherPath = path.join(__dirname, '..', 'scripts', 'watch-abis.js');
  const args = projectDir ? ['--project-dir=' + projectDir] : [];

  console.log('Starting ABI watcher...');
  const proc = spawn(process.execPath, [watcherPath, ...args], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: process.env,
    detached: false
  });

  // Don't wait for watcher to finish - it runs in parallel
  proc.unref();
  return proc;
}

(async function main() {
  const raw = process.argv.slice(2);
  const { flags, positional } = parseArgs(raw);

  if (flags.help || flags.h) {
    console.log(`Usage: daosys-frontend [options] [command]

Commands:
  run|dev        Run Next.js in development mode (default)
  build          Build the Next.js app
  start          Start the built Next.js app
  export         Build for static export (IPFS deployment)
  bundle         Bundle local ABIs only (no server)
  watch          Watch and bundle local ABIs only (no server)

Options:
  --local                Enable local project mode (uses PWD for foundry/hardhat discovery)
  --project-dir=PATH     Explicitly set project directory for ABI discovery
  --out-dir=PATH         Explicitly set artifact output directory
  --no-watch             Disable auto-rebuild of ABIs in dev mode
  --no-bundle            Skip initial ABI bundling
  --yes-install          Automatically run 'npm install' if dependencies missing
  --help, -h             Show this help message

Examples:
  npx daosys-frontend dev                    # Standard dev mode
  npx daosys-frontend --local dev            # Dev with local project ABIs
  npx daosys-frontend --local --no-watch dev # Dev without ABI watching
  npx daosys-frontend export                 # Build for IPFS deployment
  npx daosys-frontend bundle                 # Just bundle ABIs
`);
    process.exit(0);
  }

  // Determine project directory
  let projectDir = flags['project-dir'] || null;
  if (flags.local && !projectDir) {
    projectDir = process.env.PWD || process.cwd();
  }

  // Support legacy flags
  if (flags.local) {
    process.env.USE_PWD_FOUNDRY = 'true';
  }
  if (flags['out-dir']) {
    process.env.FOUNDRY_OUT_DIR = flags['out-dir'];
  }

  // Command handling
  const cmd = positional[0] || 'run';
  let mode;

  if (cmd === 'bundle') {
    // Just bundle ABIs and exit
    try {
      await runBundler(projectDir);
      console.log('ABI bundling complete.');
    } catch (e) {
      console.error('Bundling failed:', e.message);
      process.exit(1);
    }
    process.exit(0);
  }

  if (cmd === 'watch') {
    // Start watcher only (blocks)
    const watcherPath = path.join(__dirname, '..', 'scripts', 'watch-abis.js');
    const args = projectDir ? ['--project-dir=' + projectDir] : [];

    const proc = spawn(process.execPath, [watcherPath, ...args], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: process.env
    });

    proc.on('close', (code) => process.exit(code));
    return;
  }

  if (cmd === 'export') {
    // Static export for IPFS
    mode = 'build';
    process.env.STATIC_EXPORT = 'true';
  } else if (cmd === 'run' || cmd === 'dev') {
    mode = 'dev';
  } else if (cmd === 'start') {
    mode = 'start';
  } else if (cmd === 'build') {
    mode = 'build';
  } else {
    console.error('Unknown command:', cmd);
    process.exit(1);
  }

  // Bundle ABIs before starting (unless --no-bundle)
  if (!flags['no-bundle'] && (flags.local || projectDir)) {
    try {
      await runBundler(projectDir);
    } catch (e) {
      console.warn('ABI bundling failed (continuing anyway):', e.message);
    }
  }

  // Start watcher in dev mode (unless --no-watch)
  let watcherProc = null;
  if (mode === 'dev' && !flags['no-watch'] && (flags.local || projectDir)) {
    watcherProc = startWatcher(projectDir);
  }

  // Resolve Next.js binary
  const frontendPkgDir = path.resolve(__dirname, '..');
  let nextBin;
  try {
    nextBin = require.resolve('next/dist/bin/next', { paths: [frontendPkgDir, process.cwd(), __dirname] });
  } catch (e) {
    // Fallback candidates
    const candidates = [
      path.join(frontendPkgDir, 'node_modules', '.bin', 'next'),
      path.join(process.cwd(), 'node_modules', '.bin', 'next'),
      path.join(__dirname, '..', 'node_modules', '.bin', 'next')
    ];
    nextBin = candidates.find(p => fs.existsSync(p));

    if (!nextBin) {
      // Attempt auto-install
      const doInstall = async () => {
        console.log('Next.js not found. Running `npm install` in frontend package...');
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const install = spawn(npm, ['install'], { stdio: 'inherit', cwd: frontendPkgDir, env: process.env });
        await new Promise((resolve, reject) => {
          install.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error('npm install failed with code ' + code));
          });
        });
      };

      if (flags['yes-install'] || flags['auto-install'] || flags['install']) {
        await doInstall();
      } else {
        const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((resolve) => {
          rl.question('Next.js not found. Run `npm install`? (Y/n) ', (a) => {
            rl.close();
            resolve(a.trim());
          });
        });
        const normalized = String(answer || 'y').toLowerCase();
        if (normalized === 'y' || normalized === 'yes' || normalized === '') {
          await doInstall();
        } else {
          console.error('Aborting: Next.js is required.');
          process.exit(1);
        }
      }

      // Try resolve again
      try {
        nextBin = require.resolve('next/dist/bin/next', { paths: [frontendPkgDir, process.cwd(), __dirname] });
      } catch (e2) {
        const candidates2 = [
          path.join(frontendPkgDir, 'node_modules', '.bin', 'next'),
          path.join(process.cwd(), 'node_modules', '.bin', 'next')
        ];
        nextBin = candidates2.find(p => fs.existsSync(p));
      }
    }

    if (!nextBin) {
      console.error('Could not resolve Next.js binary. Please run `npm install`.');
      process.exit(1);
    }
  }

  const node = process.execPath;
  const args = [nextBin, mode];

  // Spawn Next.js process
  const proc = spawn(node, args, {
    stdio: 'inherit',
    env: process.env,
    cwd: frontendPkgDir
  });

  proc.on('close', (code) => {
    if (watcherProc) {
      watcherProc.kill();
    }
    process.exit(code);
  });

  // Handle termination signals
  process.on('SIGINT', () => {
    if (watcherProc) watcherProc.kill();
    proc.kill('SIGINT');
  });
  process.on('SIGTERM', () => {
    if (watcherProc) watcherProc.kill();
    proc.kill('SIGTERM');
  });
})();
