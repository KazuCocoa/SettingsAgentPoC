#!/usr/bin/env node

/**
 * Validate artifacts from Settings PoC runs
 * Checks: screenshots are readable PNGs, page source XMLs are valid, logs are non-empty
 */

import fs from 'node:fs';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const ARTIFACTS_DIR = 'artifacts';
const SCREENSHOT_DIR = path.join(ARTIFACTS_DIR, 'screenshots');
const PAGE_SOURCE_DIR = path.join(ARTIFACTS_DIR, 'page-source');
const LOGS_DIR = path.join(ARTIFACTS_DIR, 'logs');

let checksPerformed = 0;
let checksPassed = 0;
let checksFailed = 0;

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${message}`);
}

function checkDirectoryExists(dirPath) {
  log('INFO', `Checking directory: ${dirPath}`);
  checksPerformed++;

  if (!fs.existsSync(dirPath)) {
    log('WARN', `Directory does not exist: ${dirPath}`);
    checksFailed++;
    return false;
  }

  log('OK', `Directory exists: ${dirPath}`);
  checksPassed++;
  return true;
}

function getUserFiles(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => fs.statSync(path.join(dirPath, name)).isFile());
}

function checkScreenshots() {
  log('INFO', 'Validating screenshots...');

  if (!checkDirectoryExists(SCREENSHOT_DIR)) {
    return;
  }

  const files = getUserFiles(SCREENSHOT_DIR);

  if (files.length === 0) {
    log('WARN', 'No screenshots found');
    checksFailed++;
    checksPerformed++;
    return;
  }

  files.forEach((file) => {
    checksPerformed++;

    if (!file.endsWith('.png')) {
      log('ERROR', `Invalid screenshot extension: ${file} (expected .png)`);
      checksFailed++;
      return;
    }

    const filePath = path.join(SCREENSHOT_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.size === 0) {
      log('ERROR', `Screenshot is empty: ${file}`);
      checksFailed++;
      return;
    }

    // Basic PNG magic number check (89 50 4E 47)
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const magicNumber = buffer.toString('hex');
    if (!magicNumber.startsWith('89504e47')) {
      log('ERROR', `Invalid PNG magic number: ${file}`);
      checksFailed++;
      return;
    }

    log('OK', `Screenshot valid: ${file} (${stats.size} bytes)`);
    checksPassed++;
  });
}

function checkPageSources() {
  log('INFO', 'Validating page source files...');

  if (!checkDirectoryExists(PAGE_SOURCE_DIR)) {
    return;
  }

  const files = getUserFiles(PAGE_SOURCE_DIR);

  if (files.length === 0) {
    log('WARN', 'No page source files found');
    checksFailed++;
    checksPerformed++;
    return;
  }

  files.forEach((file) => {
    checksPerformed++;

    if (!file.endsWith('.xml')) {
      log('WARN', `Non-XML file: ${file}`);
      return; // Skip non-XML files
    }

    const filePath = path.join(PAGE_SOURCE_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.size === 0) {
      log('ERROR', `Page source file is empty: ${file}`);
      checksFailed++;
      return;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');

      // Basic XML validation: check for XML declaration or root element
      if (!content.includes('<?xml') && !content.includes('<')) {
        log('ERROR', `File does not appear to be XML: ${file}`);
        checksFailed++;
        return;
      }

      // Try to parse first 1000 chars to catch obvious issues
      const sampleParse = content.substring(0, 1000);
      if (!sampleParse.includes('<') || !sampleParse.includes('>')) {
        log('ERROR', `File lacks XML structure: ${file}`);
        checksFailed++;
        return;
      }

      log('OK', `Page source valid: ${file} (${stats.size} bytes)`);
      checksPassed++;
    } catch (err) {
      log('ERROR', `Failed to read page source: ${file} (${err.message})`);
      checksFailed++;
    }
  });
}

function checkLogs() {
  log('INFO', 'Validating log files...');

  if (!checkDirectoryExists(LOGS_DIR)) {
    return;
  }

  const files = getUserFiles(LOGS_DIR);

  if (files.length === 0) {
    log('WARN', 'No log files found');
    checksFailed++;
    checksPerformed++;
    return;
  }

  files.forEach((file) => {
    checksPerformed++;

    if (!file.endsWith('.log') && !file.endsWith('.md')) {
      log('WARN', `Non-log file: ${file}`);
      return; // Skip non-log files
    }

    const filePath = path.join(LOGS_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.size === 0) {
      log('ERROR', `Log file is empty: ${file}`);
      checksFailed++;
      return;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');

      if (content.trim().length === 0) {
        log('ERROR', `Log file has no content: ${file}`);
        checksFailed++;
        return;
      }

      log('OK', `Log file valid: ${file} (${stats.size} bytes)`);
      checksPassed++;
    } catch (err) {
      log('ERROR', `Failed to read log file: ${file} (${err.message})`);
      checksFailed++;
    }
  });
}

function reportSummary() {
  log('INFO', `=== Artifact Validation Summary ===`);
  log('INFO', `Total checks: ${checksPerformed}`);
  log('INFO', `Passed: ${checksPassed}`);
  log('INFO', `Failed: ${checksFailed}`);

  if (checksFailed === 0) {
    log('OK', 'All artifact checks passed!');
    return true;
  } else {
    log('ERROR', `${checksFailed} artifact checks failed.`);
    return false;
  }
}

async function main() {
  log('INFO', '=== Android Settings PoC Artifact Validation ===');

  checkScreenshots();
  checkPageSources();
  checkLogs();

  const passed = reportSummary();

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  log('ERROR', `Unexpected error: ${err.message}`);
  process.exit(1);
});
