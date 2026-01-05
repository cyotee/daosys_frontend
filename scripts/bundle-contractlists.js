#!/usr/bin/env node
/**
 * Build-time contractlist bundler for examples.
 *
 * Copies one or more wagmi-declare contractlist JSON files into:
 *   public/contractlists/
 * and writes an index manifest at:
 *   public/contractlists/index.json
 *
 * Usage:
 *   node scripts/bundle-contractlists.js --schema-dir=<path>
 *   node scripts/bundle-contractlists.js --manifest=<path>
 */

const fs = require('fs');
const path = require('path');

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeCopy(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const schemaDir = path.resolve(args['schema-dir'] || path.join(__dirname, '..', '..', 'example', 'schema'));
  const manifestPath = path.resolve(args['manifest'] || path.join(schemaDir, 'contractlists.manifest.json'));

  const outputDir = path.join(__dirname, '..', 'public', 'contractlists');
  const outputIndexPath = path.join(outputDir, 'index.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`Contractlists manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = readJson(manifestPath);
  const items = Array.isArray(manifest.items) ? manifest.items : [];

  ensureDir(outputDir);

  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      schemaDir,
      manifestPath
    },
    items: []
  };

  for (const item of items) {
    if (!item || !item.id || !item.file) continue;

    const srcPath = path.join(schemaDir, item.file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`Skipping missing contractlist: ${srcPath}`);
      continue;
    }

    const destFileName = path.basename(item.file);
    const destPath = path.join(outputDir, destFileName);

    safeCopy(srcPath, destPath);

    index.items.push({
      id: String(item.id),
      file: destFileName,
      path: `/contractlists/${destFileName}`,
      defaultUi: item.defaultUi === 'abi' ? 'abi' : 'contractlist',
      matchContractNames: Array.isArray(item.matchContractNames) ? item.matchContractNames.map(String) : []
    });
  }

  fs.writeFileSync(outputIndexPath, JSON.stringify(index, null, 2));

  console.log(`Bundled ${index.items.length} contractlists -> ${outputIndexPath}`);
}

if (require.main === module) {
  main();
}
