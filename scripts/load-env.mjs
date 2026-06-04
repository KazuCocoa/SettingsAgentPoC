import fs from 'node:fs';
import path from 'node:path';

const envPath = new URL('../.env', import.meta.url);

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf-8');

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const pathParts = [process.env.PATH || ''];

if (process.env.HOME) {
  const nvmVersionsDir = path.join(process.env.HOME, '.nvm/versions/node');
  if (fs.existsSync(nvmVersionsDir)) {
    for (const version of fs.readdirSync(nvmVersionsDir)) {
      const binDir = path.join(nvmVersionsDir, version, 'bin');
      if (fs.existsSync(binDir)) {
        pathParts.unshift(binDir);
      }
    }
  }
}

if (process.env.ANDROID_HOME) {
  const platformToolsDir = path.join(process.env.ANDROID_HOME, 'platform-tools');
  if (fs.existsSync(platformToolsDir)) {
    pathParts.unshift(platformToolsDir);
  }
}

process.env.PATH = pathParts.filter(Boolean).join(path.delimiter);
