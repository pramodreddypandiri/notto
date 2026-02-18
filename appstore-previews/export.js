#!/usr/bin/env node

/**
 * App Store Preview Exporter
 *
 * Exports all preview screens as 1290x2796 PNG images.
 *
 * Usage:
 *   npm install puppeteer
 *   node export.js
 *
 * Output: ./exports/preview-1.png, preview-2.png, etc.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, 'exports');
const HTML_FILE = path.join(__dirname, 'index.html');

async function exportPreviews() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 2000, height: 3000, deviceScaleFactor: 1 });
  await page.goto(`file://${HTML_FILE}`, { waitUntil: 'networkidle0' });

  const canvases = await page.$$('.preview-canvas');
  console.log(`Found ${canvases.length} preview screens.`);

  const labels = [
    'voice-capture',
    'smart-tasks',
    'photo-journal',
    'location-reminders',
    'ai-insights',
    'voice-recording',
  ];

  for (let i = 0; i < canvases.length; i++) {
    const filename = `preview-${i + 1}-${labels[i] || 'screen'}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    // Remove the CSS transform so we capture at full 1290x2796
    await page.evaluate((idx) => {
      const el = document.querySelectorAll('.preview-canvas')[idx];
      el.style.transform = 'none';
    }, i);

    await canvases[i].screenshot({
      path: filepath,
      type: 'png',
      clip: {
        x: (await canvases[i].boundingBox()).x,
        y: (await canvases[i].boundingBox()).y,
        width: 1290,
        height: 2796,
      },
    });

    // Restore transform
    await page.evaluate((idx) => {
      const el = document.querySelectorAll('.preview-canvas')[idx];
      el.style.transform = 'scale(0.25)';
    }, i);

    console.log(`  Exported: ${filename}`);
  }

  await browser.close();
  console.log(`\nDone! ${canvases.length} previews saved to ${OUTPUT_DIR}/`);
}

exportPreviews().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
