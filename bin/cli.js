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

(async function main() {
  const raw = process.argv.slice(2);
  const { flags, positional } = parseArgs(raw);

  if (flags.help || flags.h) {
    console.log(`Usage: daosys-frontend [options] [command]

Commands:
  run|dev        Run Next.js in development mode (default)
  build          Build the Next.js app
  start          Start the built Next.js app

Options:
  --local                Enable PWD-based foundry.toml discovery (sets USE_PWD_FOUNDRY=true)
  --out-dir=PATH         Explicitly set FOUNDRY_OUT_DIR
  --enable-local-abis    Enable the local ABIs API (sets ENABLE_LOCAL_ABIS=true)
  --yes-install          Automatically run 'npm install' in the frontend folder if dependencies missing
  --help, -h             Show this help message

Examples:
  npx ./lib/daosys_frontend --local run
  npx daosys-frontend --local --yes-install dev
`);
    process.exit(0);
  }

  // support --local to set USE_PWD_FOUNDRY
  if (flags.local) {
    process.env.USE_PWD_FOUNDRY = 'true';
  }
  // support --out-dir=path
  if (flags['out-dir']) {
    process.env.FOUNDRY_OUT_DIR = flags['out-dir'];
  }
  // support --enable-local-abis to also enable API
  if (flags['enable-local-abis']) {
    process.env.ENABLE_LOCAL_ABIS = 'true';
  }

  // command: run (alias for dev), dev, start, build
  const cmd = positional[0] || 'run';
  let mode;
  if (cmd === 'run' || cmd === 'dev') mode = 'dev';
  else if (cmd === 'start') mode = 'start';
  else if (cmd === 'build') mode = 'build';
  else {
    console.error('Unknown command', cmd);
    process.exit(1);
  }

  // resolve next binary from frontend package dir, then project root, then fallback
  const frontendPkgDir = path.resolve(__dirname, '..');
  let nextBin;
  try {
    nextBin = require.resolve('next/dist/bin/next', { paths: [frontendPkgDir, process.cwd(), __dirname] });
  } catch (e) {
    // fallback candidates
    const candidates = [
      path.join(frontendPkgDir, 'node_modules', '.bin', 'next'),
      path.join(process.cwd(), 'node_modules', '.bin', 'next'),
      path.join(__dirname, '..', 'node_modules', '.bin', 'next')
    ];
    nextBin = candidates.find(p => fs.existsSync(p));
    if (!nextBin) {
      // Attempt auto-install if requested (or by default) to help first-time runs
          const doInstall = async () => {
            console.log('Next.js not found. Running `npm install` in frontend package to install dependencies...');
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
            // prompt for confirmation
            const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
            const answer = await new Promise((resolve) => {
              rl.question('Next.js not found. Run `npm install` in the frontend package to install dependencies? (Y/n) ', (a) => {
                rl.close();
                resolve(a.trim());
              });
            });
            const normalized = String(answer || 'y').toLowerCase();
            if (normalized === 'y' || normalized === 'yes' || normalized === '') {
              await doInstall();
            } else {
              console.error('Aborting: Next.js is required to run the frontend. Install dependencies manually or re-run with --yes-install.');
              process.exit(1);
            }
          }
        // try resolve again
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
        console.error('Could not resolve Next.js binary. Please run `npm install` in the frontend or root project, or rerun with `--yes-install`.');
        process.exit(1);
      }
    }
  }

  const node = process.execPath;
  const args = [nextBin, mode];

  // spawn Next process
  const proc = spawn(node, args, { stdio: 'inherit', env: process.env });
  proc.on('close', (code) => process.exit(code));
})();
