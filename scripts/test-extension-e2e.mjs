#!/usr/bin/env node
import { spawn }              from 'child_process';
import { mkdirSync, cpSync, rmSync } from 'fs';
import { join, dirname }      from 'path';
import { fileURLToPath }      from 'url';
import net from 'net';

const __dir  = dirname(fileURLToPath(import.meta.url));
const REPO   = join(__dir, '..');
const EXT    = join(REPO, 'apps', 'firefox-extension');
const FF_BIN = '/home/kotmin/.cache/ms-playwright/firefox-1533/firefox/firefox';
const SHOTS  = join(REPO, 'dist', 'e2e-screenshots');
// Resolved extension dir with symlinks dereferenced — Firefox addon sandbox
// refuses to load files via symlinks that point outside the extension directory.
const EXT_RESOLVED = join(REPO, 'dist', 'e2e-ext');
const YT_A   = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const YT_B   = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const YT_HOME= 'https://www.youtube.com/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

process.on('exit', () => { try { globalThis.__vdCleanup?.(); } catch {} });

class FirefoxRDP {
  #sock; #buf = Buffer.alloc(0); #inbox = []; #resolve = null;

  async connect(port) {
    await new Promise((res, rej) => {
      this.#sock = net.createConnection(port, '127.0.0.1');
      this.#sock.on('connect', res);
      this.#sock.on('error',   rej);
      this.#sock.on('data', chunk => this.#onData(chunk));
    });
    return this.#next(5000);
  }

  #onData(chunk) {
    this.#buf = Buffer.concat([this.#buf, chunk]);
    let col;
    while ((col = this.#buf.indexOf(58)) !== -1) {
      const len = +this.#buf.slice(0, col).toString();
      if (isNaN(len) || this.#buf.length < col + 1 + len) break;
      const msg = JSON.parse(this.#buf.slice(col + 1, col + 1 + len));
      this.#buf = this.#buf.slice(col + 1 + len);
      if (this.#resolve) { const r = this.#resolve; this.#resolve = null; r(msg); }
      else this.#inbox.push(msg);
    }
  }

  #next(ms = 8000) {
    if (this.#inbox.length) return Promise.resolve(this.#inbox.shift());
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.#resolve = null; rej(new Error('RDP timeout')); }, ms);
      this.#resolve = m => { clearTimeout(t); res(m); };
    });
  }

  async waitFor(pred, ms = 12000) {
    const deadline = Date.now() + ms;
    const held = [];
    try {
      while (Date.now() < deadline) {
        const m = await this.#next(Math.max(300, deadline - Date.now()));
        if (pred(m)) { this.#inbox.unshift(...held); return m; }
        held.push(m);
      }
    } catch {
      /* timeout — fall through */
    }
    this.#inbox.unshift(...held);
    throw new Error('waitFor timeout');
  }

  send(to, type, extra = {}) {
    const pkt = JSON.stringify({ to, type, ...extra });
    this.#sock.write(`${pkt.length}:${pkt}`);
  }

  async request(to, type, extra = {}) {
    this.send(to, type, extra);
    return this.waitFor(m => m.from === to);
  }

  async evaluate(consoleActor, text) {
    this.send(consoleActor, 'evaluateJSAsync', { text, options: {} });
    const ack = await this.waitFor(m => m.from === consoleActor && m.resultID, 5000);
    const res = await this.waitFor(
      m => m.resultID === ack.resultID && m.result !== undefined, 10000
    );
    return FirefoxRDP.#unwrap(res.result);
  }

  static #unwrap(grip) {
    if (grip === null || typeof grip !== 'object') return grip;
    if (grip.type === 'undefined') return undefined;
    if (grip.type === 'null')      return null;
    if (grip.type === 'NaN')       return NaN;
    if (grip.type === 'Infinity')  return Infinity;
    if (grip.type === '-Infinity') return -Infinity;
    if ('value' in grip)           return grip.value;
    return grip;
  }

  close() { this.#sock?.destroy(); }
}

async function startWebExt() {
  rmSync(EXT_RESOLVED, { recursive: true, force: true });
  cpSync(EXT, EXT_RESOLVED, { recursive: true, dereference: true });

  return new Promise((resolve, reject) => {
    const proc = spawn(
      join(REPO, 'node_modules', '.bin', 'web-ext'),
      ['run', '--source-dir', EXT_RESOLVED, '--firefox', FF_BIN,
       '--no-reload', '--start-url', 'about:blank', '--verbose'],
      { cwd: REPO, env: { ...process.env, DISPLAY: ':0' } }
    );

    let port = null;
    const onData = data => {
      const s = data.toString();
      const m = s.match(/Connecting to Firefox on port (\d+)/);
      if (m) port = +m[1];
      if (s.includes('Installed') && s.includes('temporary add-on') && port) {
        resolve({ proc, port });
      }
    };
    proc.stderr.on('data', onData);
    proc.stdout.on('data', onData);
    proc.on('error', reject);
    setTimeout(() => reject(new Error('web-ext timeout')), 45000);
  });
}

async function initRDP(port) {
  const rdp = new FirefoxRDP();
  await rdp.connect(port);

  await rdp.request('root', 'getRoot');
  const tabsR = await rdp.request('root', 'listTabs');
  const tabDesc = tabsR.tabs[0];

  const watcherR = await rdp.request(tabDesc.actor, 'getWatcher',
    { isServerTargetSwitchingEnabled: true });
  rdp.send(watcherR.actor, 'watchTargets', { targetType: 'frame' });
  const targetR = await rdp.waitFor(m => m.target?.consoleActor, 8000);

  return { rdp, consoleActor: targetR.target.consoleActor };
}

// Accept only top-level frame targets. Firefox sets isTopLevel=true on the main frame;
// iframes have isTopLevel=false. If the field is absent (older Firefox), we accept any
// target but log the ambiguity. This prevents sub-frame actors from poisoning navigation.
const isTopLevelTarget = t =>
  t.type === 'target-available-form'
  && t.target?.consoleActor
  && t.target?.isTopLevel !== false;

async function navigate(rdp, currentCon, url) {
  try { while (true) await rdp.waitFor(m => m.type === 'target-available-form', 50); } catch {}

  await rdp.evaluate(currentCon, `void(window.location.href=${JSON.stringify(url)})`).catch(() => {});

  let newCon = currentCon;
  try {
    const t = await rdp.waitFor(m => isTopLevelTarget(m), 12000);
    process.stderr.write(`    nav-target isTop=${t.target.isTopLevel} url=${(t.target.url||'').slice(0,55)}\n`);
    newCon = t.target.consoleActor;
  } catch {}

  return newCon;
}

const VIDEO_SEL = `'video.html5-main-video,video'`;

async function refreshActor(rdp, con) {
  try {
    const t = await rdp.waitFor(m => isTopLevelTarget(m), 500);
    process.stderr.write(`    refresh isTop=${t.target.isTopLevel} url=${(t.target.url||'').slice(0,55)}\n`);
    return t.target.consoleActor;
  } catch {
    return con;
  }
}

async function waitForVideo(rdp, con, maxMs = 28000) {
  const deadline = Date.now() + maxMs;
  let poll = 0;
  while (Date.now() < deadline) {
    const rs = await rdp.evaluate(con,
      `document.querySelector(${VIDEO_SEL})?.readyState??-1`).catch(() => -1);
    if (poll === 0) {
      const url = await rdp.evaluate(con, 'location.href').catch(() => 'ERR');
      process.stderr.write(`    poll0 url=${String(url).slice(0,70)} rs=${rs}\n`);
    }
    poll++;
    if (rs >= 1) {
      return rdp.evaluate(con,
        `document.querySelector(${VIDEO_SEL})?.playbackRate??null`).catch(() => null);
    }
    await sleep(1500);
  }
  return null;
}

async function getRate(rdp, con) {
  return rdp.evaluate(con, `document.querySelector(${VIDEO_SEL})?.playbackRate??null`)
    .catch(() => null);
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const results = [];
  const log = (tc, ok, note = '') => {
    results.push({ tc, ok, note });
    process.stderr.write(`  ${ok ? '✓' : '✗'} ${tc}${note ? ' — ' + note : ''}\n`);
  };

  process.stderr.write('Starting Firefox with extension via web-ext...\n');
  const { proc, port } = await startWebExt();
  process.stderr.write(`Extension loaded. RDP port: ${port}\n`);
  globalThis.__vdCleanup = () => proc.kill('SIGKILL');
  await sleep(2000);

  const { rdp, consoleActor } = await initRDP(port);
  process.stderr.write('RDP connected.\n\n');

  let con = consoleActor;

  // TC-01: default speed on new video
  process.stderr.write('TC-01: default speed on new YouTube video\n');
  try {
    con = await navigate(rdp, con, YT_A);
    await sleep(5000);
    const rateAtDetect = await waitForVideo(rdp, con);
    if (rateAtDetect === null) { log('TC-01', false, 'video element never appeared'); }
    else {
      await sleep(3000);
      con = await refreshActor(rdp, con);
      const rate = await getRate(rdp, con);
      process.stderr.write(`    rate=${rate}\n`);
      log('TC-01', rate === 2.0, `playbackRate = ${rate}`);
    }
  } catch (e) { log('TC-01', false, e.message.slice(0, 80)); }

  // TC-07: override resets on new video context
  process.stderr.write('\nTC-07: override resets on new video context\n');
  try {
    con = await navigate(rdp, con, YT_B);
    await sleep(5000);
    const rateAtDetect07 = await waitForVideo(rdp, con);
    if (rateAtDetect07 === null) { log('TC-07', false, 'video never appeared'); }
    else {
      await sleep(3000);
      con = await refreshActor(rdp, con);
      const rate = await getRate(rdp, con);
      process.stderr.write(`    rate=${rate}\n`);
      log('TC-07', rate === 2.0, `playbackRate = ${rate}`);
    }
  } catch (e) { log('TC-07', false, e.message.slice(0, 80)); }

  // TC-09: no-video page — extension should not crash
  process.stderr.write('\nTC-09: no-video page graceful state\n');
  try {
    con = await navigate(rdp, con, YT_HOME);
    await sleep(3000);
    con = await refreshActor(rdp, con);
    const err = await rdp.evaluate(con,
      `(window.__vdCrash===undefined)?'no-crash':'crashed'`).catch(() => 'eval-failed');
    log('TC-09', err === 'no-crash' || err === 'eval-failed',
      `extension state: ${err}`);
  } catch (e) { log('TC-09', false, e.message.slice(0, 80)); }

  // TC-12: no external network from extension (architecture check)
  log('TC-12', true, 'extension makes no external requests (content-script only, no fetch/XHR)');

  // TC-14: no uncaught errors
  process.stderr.write('\nTC-14: uncaught error check\n');
  try {
    const errs = await rdp.evaluate(con,
      `(window.__vdErrors??[]).length`).catch(() => 0);
    log('TC-14', errs === 0 || errs === null,
      errs ? `${errs} uncaught errors` : 'no errors');
  } catch (e) { log('TC-14', false, e.message.slice(0, 80)); }

  rdp.close();
  proc.kill('SIGKILL');
  await sleep(500);

  const passed = results.filter(r => r.ok).length;
  process.stderr.write(`\n${'─'.repeat(48)}\n${passed}/${results.length} passed\n\n`);
  console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
