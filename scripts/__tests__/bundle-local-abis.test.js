/**
 * Tests for bundle-local-abis.js script
 */

const path = require('path');
const fs = require('fs');

// We need to mock fs functions before requiring the module
let existsSyncSpy;
let readFileSyncSpy;
let readdirSyncSpy;
let writeFileSyncSpy;
let mkdirSyncSpy;

beforeEach(() => {
  existsSyncSpy = jest.spyOn(fs, 'existsSync');
  readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
  readdirSyncSpy = jest.spyOn(fs, 'readdirSync');
  writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Mock toml module
jest.mock('toml', () => ({
  parse: jest.fn(),
}));

const toml = require('toml');
const {
  parseArgs,
  findFileUp,
  parseFoundryConfig,
  parseHardhatConfig,
  detectProjectConfig,
  scanFoundryArtifacts,
  scanHardhatArtifacts,
  MAX_CONTRACTS,
} = require('../bundle-local-abis');

describe('bundle-local-abis', () => {
  describe('parseArgs', () => {
    it('parses flag with value', () => {
      const result = parseArgs(['--project-dir=/path/to/project']);
      expect(result['project-dir']).toBe('/path/to/project');
    });

    it('parses flag without value as true', () => {
      const result = parseArgs(['--verbose']);
      expect(result.verbose).toBe(true);
    });

    it('parses multiple flags', () => {
      const result = parseArgs([
        '--project-dir=/path/to/project',
        '--out-dir=./build',
        '--debug',
      ]);
      expect(result['project-dir']).toBe('/path/to/project');
      expect(result['out-dir']).toBe('./build');
      expect(result.debug).toBe(true);
    });

    it('returns empty object for no flags', () => {
      const result = parseArgs([]);
      expect(result).toEqual({});
    });

    it('ignores non-flag arguments', () => {
      const result = parseArgs(['somefile.js', '--flag=value', 'anotherfile']);
      expect(result).toEqual({ flag: 'value' });
    });
  });

  describe('findFileUp', () => {
    it('finds file in current directory', () => {
      existsSyncSpy.mockReturnValue(true);

      const result = findFileUp('/project/dir', 'foundry.toml');

      expect(result).toBe('/project/dir/foundry.toml');
      expect(existsSyncSpy).toHaveBeenCalledWith('/project/dir/foundry.toml');
    });

    it('finds file in parent directory', () => {
      existsSyncSpy
        .mockReturnValueOnce(false) // /project/subdir/foundry.toml
        .mockReturnValueOnce(true); // /project/foundry.toml

      const result = findFileUp('/project/subdir', 'foundry.toml');

      expect(result).toBe('/project/foundry.toml');
    });

    it('returns null when file not found', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = findFileUp('/project/dir', 'foundry.toml', 3);

      expect(result).toBeNull();
    });

    it('respects maxLevels limit', () => {
      existsSyncSpy.mockReturnValue(false);

      findFileUp('/a/b/c/d/e/f', 'foundry.toml', 2);

      // Should check at most 2 levels
      expect(existsSyncSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('parseFoundryConfig', () => {
    it('parses foundry.toml with default out directory', () => {
      readFileSyncSpy.mockReturnValue('[profile.default]\n');
      toml.parse.mockReturnValue({});

      const result = parseFoundryConfig('/project/foundry.toml');

      expect(result).toEqual({
        type: 'foundry',
        projectDir: '/project',
        outDir: path.resolve('/project', 'out'),
        configPath: '/project/foundry.toml',
      });
    });

    it('parses foundry.toml with custom out directory', () => {
      readFileSyncSpy.mockReturnValue('[profile.default]\n');
      toml.parse.mockReturnValue({ out: 'build' });

      const result = parseFoundryConfig('/project/foundry.toml');

      expect(result.outDir).toBe(path.resolve('/project', 'build'));
    });

    it('parses foundry.toml with profile default out', () => {
      readFileSyncSpy.mockReturnValue('[profile.default]\n');
      toml.parse.mockReturnValue({
        profile: { default: { out: 'artifacts' } },
      });

      const result = parseFoundryConfig('/project/foundry.toml');

      expect(result.outDir).toBe(path.resolve('/project', 'artifacts'));
    });

    it('returns null on parse error', () => {
      readFileSyncSpy.mockReturnValue('invalid toml');
      toml.parse.mockImplementation(() => {
        throw new Error('Invalid TOML');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = parseFoundryConfig('/project/foundry.toml');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('parseHardhatConfig', () => {
    it('parses hardhat config with default artifacts directory', () => {
      readFileSyncSpy.mockReturnValue('module.exports = {}');

      const result = parseHardhatConfig('/project/hardhat.config.js');

      expect(result).toEqual({
        type: 'hardhat',
        projectDir: '/project',
        outDir: path.resolve('/project', 'artifacts'),
        configPath: '/project/hardhat.config.js',
      });
    });

    it('parses hardhat config with custom artifacts path', () => {
      readFileSyncSpy.mockReturnValue(`
        module.exports = {
          paths: {
            artifacts: "build/contracts"
          }
        }
      `);

      const result = parseHardhatConfig('/project/hardhat.config.js');

      expect(result.outDir).toBe(path.resolve('/project', 'build/contracts'));
    });

    it('returns null on read error', () => {
      readFileSyncSpy.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = parseHardhatConfig('/project/hardhat.config.js');

      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('detectProjectConfig', () => {
    beforeEach(() => {
      readFileSyncSpy.mockReturnValue('');
      toml.parse.mockReturnValue({});
    });

    it('detects Foundry project', () => {
      existsSyncSpy.mockImplementation((p) => p.endsWith('foundry.toml'));

      const result = detectProjectConfig('/project');

      expect(result.type).toBe('foundry');
    });

    it('detects Hardhat TypeScript project', () => {
      existsSyncSpy.mockImplementation((p) => p.endsWith('hardhat.config.ts'));

      const result = detectProjectConfig('/project');

      expect(result.type).toBe('hardhat');
    });

    it('detects Hardhat JavaScript project', () => {
      existsSyncSpy.mockImplementation((p) => p.endsWith('hardhat.config.js'));

      const result = detectProjectConfig('/project');

      expect(result.type).toBe('hardhat');
    });

    it('prefers Foundry over Hardhat when both exist', () => {
      existsSyncSpy.mockReturnValue(true);

      const result = detectProjectConfig('/project');

      expect(result.type).toBe('foundry');
    });

    it('returns null when no project config found', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = detectProjectConfig('/project');

      expect(result).toBeNull();
    });
  });

  describe('scanFoundryArtifacts', () => {
    it('returns empty object when directory does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = scanFoundryArtifacts('/project/out');

      expect(result).toEqual({});
    });

    it('scans contract artifacts from .sol directories', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((dir, options) => {
        if (dir === '/project/out') {
          return [
            { name: 'MyContract.sol', isDirectory: () => true, isFile: () => false },
          ];
        }
        if (dir === '/project/out/MyContract.sol') {
          return ['MyContract.json'];
        }
        return [];
      });
      readFileSyncSpy.mockReturnValue(
        JSON.stringify({
          contractName: 'MyContract',
          abi: [{ type: 'function', name: 'test' }],
          bytecode: { object: '0x123' },
        })
      );

      const result = scanFoundryArtifacts('/project/out');

      expect(result.MyContract).toBeDefined();
      expect(result.MyContract.abi).toEqual([{ type: 'function', name: 'test' }]);
      expect(result.MyContract.sourcePath).toBe('MyContract.sol');
    });

    it('skips files with empty or missing ABI', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((dir) => {
        if (dir === '/project/out') {
          return [{ name: 'Empty.sol', isDirectory: () => true, isFile: () => false }];
        }
        if (dir === '/project/out/Empty.sol') {
          return ['Empty.json'];
        }
        return [];
      });
      readFileSyncSpy.mockReturnValue(JSON.stringify({ abi: [] }));

      const result = scanFoundryArtifacts('/project/out');

      expect(result).toEqual({});
    });

    it('handles invalid JSON files gracefully', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((dir) => {
        if (dir === '/project/out') {
          return [{ name: 'Bad.sol', isDirectory: () => true, isFile: () => false }];
        }
        return ['Bad.json'];
      });
      readFileSyncSpy.mockReturnValue('not valid json');

      const result = scanFoundryArtifacts('/project/out');

      expect(result).toEqual({});
    });
  });

  describe('scanHardhatArtifacts', () => {
    it('returns empty object when directory does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = scanHardhatArtifacts('/project/artifacts');

      expect(result).toEqual({});
    });

    it('scans contract artifacts from nested directories', () => {
      existsSyncSpy.mockReturnValue(true);

      const mockEntries = {
        '/project/artifacts': [
          { name: 'contracts', isDirectory: () => true, isFile: () => false },
        ],
        '/project/artifacts/contracts': [
          { name: 'Token.sol', isDirectory: () => true, isFile: () => false },
        ],
        '/project/artifacts/contracts/Token.sol': [
          { name: 'Token.json', isDirectory: () => false, isFile: () => true },
        ],
      };

      readdirSyncSpy.mockImplementation((dir, options) => mockEntries[dir] || []);
      readFileSyncSpy.mockReturnValue(
        JSON.stringify({
          contractName: 'Token',
          abi: [{ type: 'function', name: 'transfer' }],
          sourceName: 'contracts/Token.sol',
        })
      );

      const result = scanHardhatArtifacts('/project/artifacts');

      expect(result.Token).toBeDefined();
      expect(result.Token.abi).toEqual([{ type: 'function', name: 'transfer' }]);
    });

    it('skips build-info directory', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((dir) => {
        if (dir === '/project/artifacts') {
          return [{ name: 'build-info', isDirectory: () => true, isFile: () => false }];
        }
        return [];
      });

      const result = scanHardhatArtifacts('/project/artifacts');

      expect(result).toEqual({});
      // Should not try to read build-info directory
      expect(readdirSyncSpy).toHaveBeenCalledTimes(1);
    });

    it('skips .dbg.json files', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((dir) => {
        if (dir === '/project/artifacts') {
          return [
            { name: 'Token.json', isDirectory: () => false, isFile: () => true },
            { name: 'Token.dbg.json', isDirectory: () => false, isFile: () => true },
          ];
        }
        return [];
      });
      readFileSyncSpy.mockReturnValue(
        JSON.stringify({
          contractName: 'Token',
          abi: [{ type: 'function', name: 'test' }],
        })
      );

      const result = scanHardhatArtifacts('/project/artifacts');

      // Should only read Token.json, not Token.dbg.json
      expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
    });

    it('prefers non-dependency contracts when duplicates exist', () => {
      existsSyncSpy.mockReturnValue(true);

      const mockEntries = {
        '/project/artifacts': [
          { name: 'contracts', isDirectory: () => true, isFile: () => false },
          { name: '@openzeppelin', isDirectory: () => true, isFile: () => false },
        ],
        '/project/artifacts/contracts': [
          { name: 'IERC20.json', isDirectory: () => false, isFile: () => true },
        ],
        '/project/artifacts/@openzeppelin': [
          { name: 'IERC20.json', isDirectory: () => false, isFile: () => true },
        ],
      };

      readdirSyncSpy.mockImplementation((dir, options) => mockEntries[dir] || []);

      let callCount = 0;
      readFileSyncSpy.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - contracts/IERC20.json
          return JSON.stringify({
            contractName: 'IERC20',
            abi: [{ type: 'function', name: 'myCustomFunction' }],
            sourceName: 'contracts/IERC20.sol',
          });
        } else {
          // Second call - @openzeppelin/IERC20.json
          return JSON.stringify({
            contractName: 'IERC20',
            abi: [{ type: 'function', name: 'openzeppelinFunction' }],
            sourceName: '@openzeppelin/IERC20.sol',
          });
        }
      });

      const result = scanHardhatArtifacts('/project/artifacts');

      // Should have the non-dependency version
      expect(result.IERC20.sourcePath).toBe('contracts/IERC20.sol');
    });
  });

  describe('MAX_CONTRACTS', () => {
    it('is set to a reasonable limit', () => {
      expect(MAX_CONTRACTS).toBe(500);
    });
  });
});
