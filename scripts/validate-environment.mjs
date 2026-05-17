#!/usr/bin/env node

/**
 * Validate environment for Android Settings PoC
 * Checks: ANDROID_HOME, adb connectivity, emulator availability
 * Note: Appium server startup is handled by appium-mcp, not validated here
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ANDROID_HOME = process.env.ANDROID_HOME;

let checksPassed = 0;
let checksFailed = 0;

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${message}`);
}

function checkAndroidHome() {
  log('INFO', 'Checking ANDROID_HOME...');
  if (!ANDROID_HOME) {
    log('ERROR', 'ANDROID_HOME environment variable is not set');
    checksFailed++;
    return false;
  }

  if (!fs.existsSync(ANDROID_HOME)) {
    log('ERROR', `ANDROID_HOME path does not exist: ${ANDROID_HOME}`);
    checksFailed++;
    return false;
  }

  log('OK', `ANDROID_HOME is valid: ${ANDROID_HOME}`);
  checksPassed++;
  return true;
}

function checkAdbInPath() {
  log('INFO', 'Checking adb availability...');
  try {
    execSync('which adb', { stdio: 'pipe' });
    log('OK', 'adb is available in PATH');
    checksPassed++;
    return true;
  } catch (e) {
    log('ERROR', 'adb not found in PATH');
    checksFailed++;
    return false;
  }
}

function checkEmulatorConnected() {
  log('INFO', 'Checking Android emulator connectivity...');
  try {
    const output = execSync('adb devices', { encoding: 'utf-8' });
    const lines = output.split('\n').filter((line) => line.trim() && !line.includes('List of'));
    const emulators = lines.filter((line) => !line.includes('offline'));

    if (emulators.length === 0) {
      log('ERROR', 'No active Android emulator found. Start an emulator with: emulator -avd <name>');
      checksFailed++;
      return false;
    }

    emulators.forEach((emulator) => {
      log('OK', `Found emulator: ${emulator}`);
    });
    checksPassed++;
    return true;
  } catch (e) {
    log('ERROR', `Failed to check emulator: ${e.message}`);
    checksFailed++;
    return false;
  }
}

async function main() {
  log('INFO', '=== Android Settings PoC Environment Validation ===');
  log('INFO', 'Note: Appium server startup is handled by appium-mcp');

  checkAndroidHome();
  checkAdbInPath();
  checkEmulatorConnected();

  log('INFO', `=== Summary: ${checksPassed} passed, ${checksFailed} failed ===`);

  if (checksFailed > 0) {
    log('ERROR', 'Environment validation failed. Please fix the issues above.');
    process.exit(1);
  }

  log('OK', 'All environment checks passed!');
  process.exit(0);
}

main().catch((err) => {
  log('ERROR', `Unexpected error: ${err.message}`);
  process.exit(1);
});
