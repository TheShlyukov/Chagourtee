#!/usr/bin/env node
/**
 * Build script for bundling the server with esbuild
 * Handles native modules (better-sqlite3, bcrypt) as external dependencies
 */

const { build } = require('esbuild');
const path = require('path');
const fs = require('fs');

const SERVER_ROOT = path.join(__dirname, '..');
const SRC_ENTRY = path.join(SERVER_ROOT, 'src', 'index.js');
const DIST_DIR = path.join(SERVER_ROOT, 'dist');
const DIST_FILE = path.join(DIST_DIR, 'index.js');

// Native modules that must be kept as external (they have .node binary files)
const NATIVE_MODULES = ['better-sqlite3', 'bcrypt'];

// FFmpeg/FFprobe installers that download binaries at runtime
const INSTALLER_MODULES = ['@ffmpeg-installer/ffmpeg', '@ffprobe-installer/ffprobe'];

// Platform-specific binary packages (for ffmpeg/ffprobe installers)
const PLATFORM_BINARIES = ['@ffmpeg-installer/darwin-arm64', '@ffprobe-installer/darwin-arm64'];

// All external modules (native + dependencies that should not be bundled)
const EXTERNAL_MODULES = [
  ...NATIVE_MODULES,
  ...INSTALLER_MODULES,
  ...PLATFORM_BINARIES,
  // Fastify plugins
  '@fastify/cookie',
  // Other dependencies that work better when not bundled
  'dotenv',
  'fluent-ffmpeg',
  'ws',
  'fastify',
  'fastify-multipart',
];

async function main() {
  console.log('🔨 Building server bundle...');
  console.log(`   Entry: ${SRC_ENTRY}`);
  console.log(`   Output: ${DIST_FILE}`);

  // Clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  try {
    await build({
      entryPoints: [SRC_ENTRY],
      bundle: true,
      platform: 'node',
      target: 'node25',
      outfile: DIST_FILE,
      external: EXTERNAL_MODULES,
      minify: false, // Set to true for production minification
      sourcemap: false, // Set to true for debugging
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      loader: {
        '.node': 'file',
      },
      logLevel: 'info',
    });

    // Copy node_modules that contain native addons to dist
    // In npm workspaces, modules are in the root node_modules
    const WORKSPACE_ROOT = path.join(SERVER_ROOT, '..');
    const distNodeModules = path.join(DIST_DIR, 'node_modules');
    fs.mkdirSync(distNodeModules, { recursive: true });

    console.log('\n📦 Copying native modules to dist/node_modules...');
    for (const mod of NATIVE_MODULES) {
      // Try server/node_modules first, then root node_modules (for workspaces)
      const srcMod = fs.existsSync(path.join(SERVER_ROOT, 'node_modules', mod))
        ? path.join(SERVER_ROOT, 'node_modules', mod)
        : path.join(WORKSPACE_ROOT, 'node_modules', mod);
      const destMod = path.join(distNodeModules, mod);
      
      if (fs.existsSync(srcMod)) {
        fs.cpSync(srcMod, destMod, { recursive: true });
        console.log(`   ✓ ${mod}`);
      } else {
        console.log(`   ⚠ ${mod} not found`);
      }
    }

    // Copy installer modules
    for (const mod of INSTALLER_MODULES) {
      const srcMod = fs.existsSync(path.join(SERVER_ROOT, 'node_modules', mod))
        ? path.join(SERVER_ROOT, 'node_modules', mod)
        : path.join(WORKSPACE_ROOT, 'node_modules', mod);
      const destMod = path.join(distNodeModules, mod);
      
      if (fs.existsSync(srcMod)) {
        fs.cpSync(srcMod, destMod, { recursive: true });
        console.log(`   ✓ ${mod}`);
      } else {
        console.log(`   ⚠ ${mod} not found`);
      }
    }

    // Copy platform-specific binary packages
    for (const mod of PLATFORM_BINARIES) {
      const srcMod = fs.existsSync(path.join(SERVER_ROOT, 'node_modules', mod))
        ? path.join(SERVER_ROOT, 'node_modules', mod)
        : path.join(WORKSPACE_ROOT, 'node_modules', mod);
      const destMod = path.join(distNodeModules, mod);
      
      if (fs.existsSync(srcMod)) {
        fs.cpSync(srcMod, destMod, { recursive: true });
        console.log(`   ✓ ${mod}`);
      } else {
        console.log(`   ⚠ ${mod} not found`);
      }
    }

    // Copy package.json for native modules (needed for node to find them)
    for (const mod of [...NATIVE_MODULES, ...INSTALLER_MODULES, ...PLATFORM_BINARIES]) {
      const WORKSPACE_ROOT = path.join(SERVER_ROOT, '..');
      const srcMod = fs.existsSync(path.join(SERVER_ROOT, 'node_modules', mod))
        ? path.join(SERVER_ROOT, 'node_modules', mod)
        : path.join(WORKSPACE_ROOT, 'node_modules', mod);
      
      if (fs.existsSync(srcMod)) {
        const pkgJson = path.join(srcMod, 'package.json');
        if (fs.existsSync(pkgJson)) {
          const destPkgJson = path.join(distNodeModules, mod, 'package.json');
          fs.cpSync(pkgJson, destPkgJson);
        }
      }
    }

    console.log('\n✅ Server bundle built successfully!');
    console.log(`\nTo run the bundled server:`);
    console.log(`  cd ${DIST_DIR} && node index.js`);
    console.log(`\nOr from root:`);
    console.log(`  npm run start:server`);

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();
