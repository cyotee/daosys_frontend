import { promises as fs } from 'fs';
import path from 'path';
import toml from 'toml';
import { NextResponse } from 'next/server';

const ENABLE = process.env.ENABLE_LOCAL_ABIS === 'true' || process.env.NEXT_PUBLIC_ENABLE_LOCAL_ABIS === 'true';
const OUT_OVERRIDE = process.env.FOUNDRY_OUT_DIR || process.env.NEXT_PUBLIC_FOUNDRY_OUT_DIR;
const USE_PWD_FOUNDRY = process.env.USE_PWD_FOUNDRY === 'true' || process.env.NEXT_PUBLIC_USE_PWD_FOUNDRY === 'true';
const MAX_ARTIFACTS = 200; // limit payload size

async function findFoundryToml(startDir: string): Promise<string | null> {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'foundry.toml');
    try {
      await fs.access(candidate);
      return candidate;
    } catch (e) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

export async function GET(req: Request) {
  if (!ENABLE) {
    return NextResponse.json({ error: 'Local ABI API disabled' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const contractName = params.get('name');
    const listOnly = params.get('list') === 'true';

    // Decide where to look for foundry.toml / out dir. By default use the server's cwd
    // but allow override via OUT_OVERRIDE. When `USE_PWD_FOUNDRY` is set, prefer
    // the present working directory (process.env.PWD) which is useful when the
    // server is started from a different install location (eg. npx/temp dir).
    let baseDir = OUT_OVERRIDE || process.cwd();
    if (USE_PWD_FOUNDRY && process.env.PWD) {
      baseDir = process.env.PWD;
    }

    // find foundry.toml if override not set
    let outDir: string | null = null;
    if (OUT_OVERRIDE) {
      outDir = path.resolve(OUT_OVERRIDE);
    } else {
      const ft = await findFoundryToml(baseDir);
      if (!ft) return NextResponse.json({ error: 'foundry.toml not found' }, { status: 404 });
      const tomlRaw = await fs.readFile(ft, 'utf8');
      const conf = toml.parse(tomlRaw) as any;
      outDir = conf.out || (conf.profile && conf.profile.default && conf.profile.default.out) || 'out';
      outDir = path.resolve(path.dirname(ft), outDir);
    }

    // ensure outDir exists
    try {
      await fs.access(outDir!);
    } catch (e) {
      return NextResponse.json({ error: 'out dir not found', outDir }, { status: 404 });
    }

    // list json artifact files
    const files = await fs.readdir(outDir!);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // limit to avoid huge payloads
    if (jsonFiles.length > MAX_ARTIFACTS && !contractName && !listOnly) {
      // just return names if too many
      const names = jsonFiles.slice(0, MAX_ARTIFACTS).map(f => f.replace('.json', ''));
      return NextResponse.json({ outDir, truncated: true, names, total: jsonFiles.length });
    }

    if (contractName) {
      const match = jsonFiles.find(f => f.replace(/\.json$/, '') === contractName);
      if (!match) return NextResponse.json({ error: 'contract not found' }, { status: 404 });
      const buf = await fs.readFile(path.join(outDir!, match), 'utf8');
      const artifact = JSON.parse(buf);
      return NextResponse.json({ name: artifact.contractName || artifact.name || match.replace('.json',''), abi: artifact.abi || [] });
    }

    if (listOnly) {
      const names = jsonFiles.map(f => f.replace('.json', '')).slice(0, MAX_ARTIFACTS);
      return NextResponse.json({ outDir, names, total: jsonFiles.length });
    }

    // default: return minimal list with names and ABI lengths
    const artifacts = await Promise.all(jsonFiles.slice(0, MAX_ARTIFACTS).map(async f => {
      const buf = await fs.readFile(path.join(outDir!, f), 'utf8');
      const artifact = JSON.parse(buf);
      return {
        file: f,
        name: artifact.contractName || artifact.name || f.replace('.json',''),
        hasAbi: Array.isArray(artifact.abi),
        abiSize: Array.isArray(artifact.abi) ? artifact.abi.length : 0,
      };
    }));

    return NextResponse.json({ outDir, artifacts, total: jsonFiles.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
