#!/usr/bin/env node

/**
 * Railway Deployment Validator
 * 
 * Checks if your app is ready to deploy to Railway.
 * Run: node railway-check.js
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const checks = [];
let passedCount = 0;
let failedCount = 0;

function addCheck(name, status, message) {
  checks.push({ name, status, message });
  const icon = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✗';
  const color = status === 'pass' ? '\x1b[32m' : status === 'warn' ? '\x1b[33m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${name}`);
  if (message) console.log(`  ${message}`);
  if (status === 'pass') passedCount++;
  else if (status === 'fail') failedCount++;
}

async function checkNodeVersion() {
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const major = parseInt(version.split('.')[0].slice(1));
    if (major >= 18) {
      addCheck('Node.js version', 'pass', `${version}`);
    } else {
      addCheck('Node.js version', 'fail', `${version} (need 18+)`);
    }
  } catch (e) {
    addCheck('Node.js installed', 'fail', 'node command not found');
  }
}

function checkFile(filePath, name) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    addCheck(`${name} exists`, 'pass', filePath);
  } else {
    addCheck(`${name} exists`, 'fail', `Not found: ${filePath}`);
  }
  return exists;
}

function checkGit() {
  try {
    const status = require('child_process').execSync('git status --porcelain', {
      encoding: 'utf8',
      cwd: process.cwd()
    });
    if (status.trim() === '') {
      addCheck('Git status', 'pass', 'All changes committed');
    } else {
      addCheck('Git status', 'warn', 'Uncommitted changes detected (can still deploy)');
    }
  } catch (e) {
    addCheck('Git repository', 'warn', 'Not a git repo or git not installed');
  }
}

function checkEnvFiles() {
  const backendEnv = checkFile(
    path.join(process.cwd(), 'packages/backend/.env.example'),
    'Backend .env.example'
  );
  const frontendEnv = checkFile(
    path.join(process.cwd(), 'packages/frontend/.env.example'),
    'Frontend .env.example'
  );
  return backendEnv && frontendEnv;
}

function checkConfigFiles() {
  const railway = checkFile(
    path.join(process.cwd(), 'railway.json'),
    'railway.json'
  );
  const procfile = checkFile(
    path.join(process.cwd(), 'Procfile'),
    'Procfile'
  );
  return railway && procfile;
}

async function checkBuilds() {
  try {
    console.log('\nChecking builds...');
    await execAsync('npm run build --workspaces && echo "Build check passed"', {
      cwd: process.cwd(),
      timeout: 120000
    });
    addCheck('Production build', 'pass', 'Frontend and backend build successfully');
  } catch (e) {
    addCheck('Production build', 'fail', 'Build failed - see errors above');
  }
}

function checkPackageJson() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  if (pkg.scripts['start:prod']) {
    addCheck('start:prod script', 'pass', pkg.scripts['start:prod']);
  } else {
    addCheck('start:prod script', 'fail', 'Not found in package.json');
  }
}

async function main() {
  console.log('\n🚀 Railway Deployment Pre-Check\n');
  
  console.log('Environment:');
  await checkNodeVersion();
  checkGit();
  
  console.log('\nConfiguration Files:');
  checkEnvFiles();
  checkConfigFiles();
  
  console.log('\nPackage Setup:');
  checkPackageJson();
  
  console.log('\nBuild Testing:');
  await checkBuilds();
  
  console.log('\n' + '='.repeat(50));
  console.log(`\nResults: \x1b[32m${passedCount} passed\x1b[0m, \x1b[31m${failedCount} failed\x1b[0m\n`);
  
  if (failedCount === 0) {
    console.log('✓ Your app is ready to deploy to Railway!');
    console.log('\nNext steps:');
    console.log('1. Push to GitHub: git push origin main');
    console.log('2. Go to https://railway.app');
    console.log('3. Click "New Project" → "Deploy from GitHub"');
    console.log('4. Select ChainCrack repo');
    console.log('5. Add environment variables in Railway dashboard');
    console.log('6. Watch deployment in the Deployments tab\n');
  } else {
    console.log('✗ Please fix the issues above before deploying.');
    process.exit(1);
  }
}

main().catch(console.error);
