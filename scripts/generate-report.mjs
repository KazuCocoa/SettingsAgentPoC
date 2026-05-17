#!/usr/bin/env node

/**
 * Generate a report from Settings PoC artifacts
 * Summarizes targets reached, transitions, and outcomes
 */

import fs from 'node:fs';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const ARTIFACTS_DIR = 'artifacts';
const SCREENSHOT_DIR = path.join(ARTIFACTS_DIR, 'screenshots');
const PAGE_SOURCE_DIR = path.join(ARTIFACTS_DIR, 'page-source');
const LOGS_DIR = path.join(ARTIFACTS_DIR, 'logs');

function log(message) {
  console.log(message);
}

function readLogs() {
  const logs = {
    explore: null,
    reachability: null,
  };

  if (fs.existsSync(LOGS_DIR)) {
    const files = fs.readdirSync(LOGS_DIR);

    files.forEach((file) => {
      if (file.includes('explore')) {
        logs.explore = readFileSync(path.join(LOGS_DIR, file), 'utf-8');
      } else if (file.includes('reachability')) {
        logs.reachability = readFileSync(path.join(LOGS_DIR, file), 'utf-8');
      }
    });
  }

  return logs;
}

function countArtifacts() {
  const counts = {
    screenshots: 0,
    pageSources: 0,
  };

  if (fs.existsSync(SCREENSHOT_DIR)) {
    counts.screenshots = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith('.png')).length;
  }

  if (fs.existsSync(PAGE_SOURCE_DIR)) {
    counts.pageSources = fs.readdirSync(PAGE_SOURCE_DIR).filter((f) => f.endsWith('.xml')).length;
  }

  return counts;
}

function generateReport() {
  const logs = readLogs();
  const artifacts = countArtifacts();
  const timestamp = new Date().toISOString();

  let reportContent = `# Settings PoC Run Report

**Generated:** ${timestamp}

## Summary

`;

  if (logs.explore || logs.reachability) {
    reportContent += `### Runs Executed
`;
    if (logs.explore) {
      reportContent += `- ✓ Exploration run completed\n`;
    }
    if (logs.reachability) {
      reportContent += `- ✓ Reachability run completed\n`;
    }
  } else {
    reportContent += `**No run logs found.** Run the PoC with \`npm run poc\` to generate artifacts.

`;
  }

  reportContent += `
### Artifacts Collected

- **Screenshots:** ${artifacts.screenshots} PNG files
- **Page Source:** ${artifacts.pageSources} XML files
- **Total evidence files:** ${artifacts.screenshots + artifacts.pageSources}

## Detailed Results

`;

  if (logs.explore) {
    reportContent += `### Exploration Run

\`\`\`
${logs.explore}
\`\`\`

`;
  }

  if (logs.reachability) {
    reportContent += `### Reachability Run

\`\`\`
${logs.reachability}
\`\`\`

`;
  }

  reportContent += `## Files

### Screenshots
`;
  if (fs.existsSync(SCREENSHOT_DIR)) {
    const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith('.png'));
    if (screenshots.length > 0) {
      screenshots.forEach((f) => {
        const filePath = path.join(SCREENSHOT_DIR, f);
        const size = fs.statSync(filePath).size;
        reportContent += `- \`${f}\` (${(size / 1024).toFixed(2)} KB)\n`;
      });
    } else {
      reportContent += `*None*\n`;
    }
  }

  reportContent += `
### Page Source Files
`;
  if (fs.existsSync(PAGE_SOURCE_DIR)) {
    const sources = fs.readdirSync(PAGE_SOURCE_DIR).filter((f) => f.endsWith('.xml'));
    if (sources.length > 0) {
      sources.forEach((f) => {
        const filePath = path.join(PAGE_SOURCE_DIR, f);
        const size = fs.statSync(filePath).size;
        reportContent += `- \`${f}\` (${(size / 1024).toFixed(2)} KB)\n`;
      });
    } else {
      reportContent += `*None*\n`;
    }
  }

  reportContent += `
## Recommendations

`;

  if (artifacts.screenshots === 0 && artifacts.pageSources === 0) {
    reportContent += `1. No artifacts found. Run \`npm run poc\` to start a PoC exploration.
2. Ensure Appium server is running (\`appium\`).
3. Ensure Android emulator is running (\`adb devices\` should list an active emulator).
4. Check environment: \`npm run validate-env\`.
`;
  } else {
    reportContent += `1. Review screenshots in \`artifacts/screenshots/\`.
2. Inspect page source in \`artifacts/page-source/\` for UI analysis.
3. Check logs in \`artifacts/logs/\` for navigation paths and errors.
4. Use Appium Inspector to debug any specific screens or interactions.
`;
  }

  return reportContent;
}

async function main() {
  log('Generating report from artifacts...');

  const report = generateReport();

  const reportPath = path.join(ARTIFACTS_DIR, 'run-report.md');
  fs.writeFileSync(reportPath, report, 'utf-8');

  log(`Report saved: ${reportPath}`);
  log('\n' + report);

  process.exit(0);
}

main().catch((err) => {
  console.error('Error generating report:', err.message);
  process.exit(1);
});
