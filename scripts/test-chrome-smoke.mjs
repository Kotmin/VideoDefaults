import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

function resolveCachedBrowserBin(prefix, relBinParts) {
  const base = join(process.env.HOME, '.cache', 'ms-playwright');
  const dir = readdirSync(base).filter((d) => d.startsWith(prefix)).sort().pop();
  if (!dir) throw new Error(`no cached ${prefix}* Playwright build found under ${base}`);
  return join(base, dir, ...relBinParts);
}

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const EXT = join(REPO, 'apps', 'chrome-extension');
const FIXTURE = readFileSync(join(REPO, 'tests', 'fixtures', 'youtube-watch-basic.html'), 'utf8');

const sync = spawnSync('bash', [join(REPO, 'scripts', 'sync-extension-lib.sh')], { stdio: 'inherit' });
if (sync.status !== 0) throw new Error('sync-extension-lib.sh failed');

const profileDir = mkdtempSync(join(tmpdir(), 'vd-chrome-smoke-'));
let context = null;

async function main() {
  context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    executablePath: process.env.VD_CHROMIUM_BIN
      || resolveCachedBrowserBin('chromium-', ['chrome-linux64', 'chrome']),
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
    ],
  });

  const page = await context.newPage();
  await page.route('https://www.youtube.com/**', (route) => {
    route.fulfill({ contentType: 'text/html', body: FIXTURE });
  });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('https://www.youtube.com/watch?v=smoke');
  await page.waitForFunction(
    () => document.querySelector('video')?.playbackRate === 2,
    null,
    { timeout: 10_000 },
  );

  const rate = await page.evaluate(() => document.querySelector('video').playbackRate);
  const defaultRate = await page.evaluate(() => document.querySelector('video').defaultPlaybackRate);
  if (rate !== 2 || defaultRate !== 2) {
    throw new Error(`expected playbackRate/defaultPlaybackRate 2/2, got ${rate}/${defaultRate}`);
  }
  await page.keyboard.press('Control+a');
  await page.keyboard.press('o');
  await page.waitForSelector('[data-videodefaults-overlay] span', { timeout: 5000 });
  const labelCount = await page.evaluate(
    () => document.querySelectorAll('[data-videodefaults-overlay] span').length,
  );
  if (labelCount < 3) throw new Error(`expected >=3 jump labels, got ${labelCount}`);
  await page.keyboard.press('Escape');
  const overlayGone = await page.evaluate(
    () => document.querySelector('[data-videodefaults-overlay]') === null,
  );
  if (!overlayGone) throw new Error('overlay did not close on Escape');

  await page.keyboard.press('Control+a');
  await page.keyboard.press('y');
  await page.waitForURL('https://www.youtube.com/', { timeout: 5000 });

  const vdErrors = errors.filter((e) => e.includes('[VideoDefaults]'));
  if (vdErrors.length > 0) {
    throw new Error(`content script errors: ${vdErrors.join('; ')}`);
  }
  console.log(JSON.stringify({
    ok: true, playbackRate: rate, defaultPlaybackRate: defaultRate,
    jumpLabels: labelCount, wentHome: true,
  }));
}

main()
  .then(() => cleanup(0))
  .catch((e) => { console.error('smoke test failed:', e.message); cleanup(1); });

async function cleanup(code) {
  try { await context?.close(); } catch { /* already gone */ }
  rmSync(profileDir, { recursive: true, force: true });
  process.exit(code);
}
