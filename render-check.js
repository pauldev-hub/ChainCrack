#!/usr/bin/env node

/**
 * ChainCrack Render Deployment Pre-Flight Check
 * 
 * Validates that the app is ready for deployment to Render.
 * Run this before pushing to GitHub.
 * 
 * Usage: node render-check.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
let warnings = 0;

const check = (name, condition, type = 'error') => {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    if (type === 'warn') {
      console.log(`⚠ ${name}`);
      warnings++;
    } else {
      console.log(`✗ ${name}`);
      failed++;
    }
  }
};

const fileExists = (filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
};

const readJSON = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
};

console.log('🚀 ChainCrack Render Deployment Pre-Flight Check\n');

// ==========================================
// File Structure
// ==========================================
console.log('📁 File Structure');

check('  root package.json exists', fileExists('./package.json'));
check('  backend package.json exists', fileExists('./packages/backend/package.json'));
check('  frontend package.json exists', fileExists('./packages/frontend/package.json'));
check('  render.yaml exists', fileExists('./render.yaml'));

const pkg = readJSON('./package.json');
check('  start:prod script exists', pkg?.scripts?.['start:prod'] !== undefined);

// ==========================================
// Git & Version Control
// ==========================================
console.log('\n🔐 Git & Version Control');

check('  .git directory exists', fileExists('./.git'), 'warn');
check('  .gitignore exists', fileExists('./.gitignore'), 'warn');
check('  package-lock.json exists', fileExists('./package-lock.json'), 'warn');

const gitignore = fs.readFileSync('./.gitignore', 'utf-8').toLowerCase();
check('  .env in .gitignore', gitignore.includes('.env'), 'warn');

// ==========================================
// Backend Configuration
// ==========================================
console.log('\n🔧 Backend Configuration');

const backendPkg = readJSON('./packages/backend/package.json');
check('  backend has dev script', backendPkg?.scripts?.dev !== undefined);
check('  backend has build script', backendPkg?.scripts?.build !== undefined);
check('  backend has start script', backendPkg?.scripts?.start !== undefined);
check('  backend uses express', backendPkg?.dependencies?.express !== undefined);
check('  backend uses socket.io', backendPkg?.dependencies?.['socket.io'] !== undefined);

// ==========================================
// Frontend Configuration
// ==========================================
console.log('\n⚛️  Frontend Configuration');

const frontendPkg = readJSON('./packages/frontend/package.json');
check('  frontend has dev script', frontendPkg?.scripts?.dev !== undefined);
check('  frontend has build script', frontendPkg?.scripts?.build !== undefined);
check('  frontend uses react', frontendPkg?.dependencies?.react !== undefined);
check('  frontend uses vite', frontendPkg?.devDependencies?.vite !== undefined);

// ==========================================
// Environment Variables
// ==========================================
console.log('\n🔑 Environment Variables');

const backendEnvExample = fileExists('./packages/backend/.env.example');
const frontendEnvExample = fileExists('./packages/frontend/.env.example');

check('  backend .env.example exists', backendEnvExample);
check('  frontend .env.example exists', frontendEnvExample);

// ==========================================
// Deployment Configuration
// ==========================================
console.log('\n🚀 Deployment Configuration');

check('  render.yaml is valid YAML', fileExists('./render.yaml'));
check('  RENDER_DEPLOYMENT.md exists', fileExists('./RENDER_DEPLOYMENT.md'));
check('  RENDER_QUICKSTART.md exists', fileExists('./RENDER_QUICKSTART.md'));

// ==========================================
// Results
// ==========================================
console.log('\n' + '='.repeat(50));
console.log(`✓ Passed: ${passed}`);
if (warnings > 0) console.log(`⚠ Warnings: ${warnings}`);
if (failed > 0) console.log(`✗ Failed: ${failed}`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('\n✅ All checks passed! Ready for Render deployment.\n');
  console.log('📋 Next Steps:');
  console.log('  1. git add -A');
  console.log('  2. git commit -m "Setup for Render deployment"');
  console.log('  3. git push origin main');
  console.log('  4. Go to https://render.com and create a new Web Service');
  console.log('  5. Follow the RENDER_QUICKSTART.md guide\n');
  process.exit(0);
} else {
  console.log('\n❌ Fix the errors above before deploying.\n');
  process.exit(1);
}
