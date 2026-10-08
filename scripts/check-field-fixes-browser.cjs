// Run against the deterministic local API (no GOOGLE_CLOUD_PROJECT) and a Vite
// frontend built with VITE_LAST300M_API=http://127.0.0.1:8791.
// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-field-fixes-browser.cjs
// Desktop browser evidence only: this does not replace iPhone LINE acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function loopback(raw) {
  const url = new URL(raw);
  assert.equal(url.protocol, 'http:', 'Only local HTTP is permitted');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only loopback hosts are permitted');
  assert.equal(url.username + url.password, '', 'URL credentials are not permitted');
  return url;
}

const frontend = loopback(process.env.NIGHTINGALE_QA_URL || 'http://127.0.0.1:5179');
const api = loopback(process.env.NIGHTINGALE_QA_API || 'http://127.0.0.1:8791');
const allowedOrigins = new Set([frontend.origin, api.origin]);
const outDir = path.join(__dirname, '../docs/acceptance/2026-10-08-field-fixes');
const question = '你已經過復興南路，現在安全站在仁愛路口的人行道上，而且還沒有過仁愛路，對嗎？';
const yes = '是，這些都符合';
const cancel = '不是／不確定';
const expired = '剛剛的確認已失效。請再輸入目前看到的路牌。';

function summary(body) {
  return {
    checkpoint: body.session?.checkpointId,
    action: body.action?.type,
    actionCheckpoint: body.action?.checkpointId,
    confirmation: body.action?.confirmation ? { kind: body.action.confirmation.kind, offered: true } : null,
    expects: body.expects,
  };
}

async function inspect(sessionId) {
  const response = await fetch(`${api.origin}/api/sessions/${encodeURIComponent(sessionId)}`);
  assert.equal(response.status, 200);
  return response.json();
}

async function checkEngine(name, engine, launchOptions, syntheticPng) {
  let browser;
  const receipt = { engine: name, version: null, status: 'RUNNING', viewport: { width: 390, height: 844 },
    noGeolocationPermission: true, events: [], checks: [], screenshots: [], audio: [], pageErrors: [], externalRequests: [] };
  try {
    browser = await engine.launch({ headless: true, ...launchOptions });
    receipt.version = browser.version();
    const context = await browser.newContext({ viewport: receipt.viewport, permissions: [], serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const requested = new URL(route.request().url());
      if (allowedOrigins.has(requested.origin)) return route.continue();
      receipt.externalRequests.push(`${requested.origin}${requested.pathname}`);
      return route.abort('blockedbyclient');
    });
    // Observe native AudioBufferSourceNodes; audio decoding/playback is real.
    // The log contains counts only, with no microphone or device recording.
    await context.addInitScript(() => {
      window.qaAudio = { started: 0, stopped: 0, active: 0 };
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      const original = Context.prototype.createBufferSource;
      Context.prototype.createBufferSource = function (...args) {
        const source = original.apply(this, args);
        const start = source.start.bind(source), stop = source.stop.bind(source);
        let active = false;
        const ended = () => { if (active) { active = false; window.qaAudio.active--; } };
        source.addEventListener('ended', ended);
        source.start = (...values) => { start(...values); active = true; window.qaAudio.started++; window.qaAudio.active++; };
        source.stop = (...values) => { stop(...values); window.qaAudio.stopped++; ended(); };
        return source;
      };
    });

    async function newWalk(story) {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => receipt.pageErrors.push({ story, error: String(error) }));
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.pathname.includes('/audio/outdoor/')) receipt.audio.push({ story, file: url.pathname, status: response.status() });
      });
      await page.goto(new URL('/?flow=last300m&photo=1', frontend).href);
      const starting = page.waitForResponse(r => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
      await page.getByRole('button', { name: '開始', exact: true }).click();
      const response = await starting;
      assert.equal(response.status(), 201);
      const started = await response.json();
      receipt.events.push({ story, operation: 'start', ...summary(started) });
      const walk = { page, sessionId: started.sessionId, story };
      await action(walk, 'exit-done', () => page.getByRole('button', { name: '我到出口2了', exact: true }).click());
      return walk;
    }

    async function action(walk, operation, trigger, status = 200) {
      const pending = walk.page.waitForResponse(r => r.url().endsWith('/observations') && r.request().method() === 'POST');
      await trigger();
      const response = await pending;
      assert.equal(response.status(), status, `${walk.story}: ${operation}`);
      const body = await response.json();
      // Flush the UI update caused by the just-observed fetch completion.
      await walk.page.waitForFunction(() => !document.querySelector(
        '.l3-input:disabled, .l3-confirmation button:disabled, .l3-crossed:disabled, .l3-cover .l3-primary:disabled'));
      receipt.events.push({ story: walk.story, operation, status, ...summary(body) });
      return body;
    }

    async function say(walk, value) {
      await walk.page.locator('.l3-input').fill(value);
      return action(walk, value, () => walk.page.getByRole('button', { name: '傳送', exact: true }).click());
    }

    async function expectQuestion(walk, label) {
      const page = walk.page;
      await page.getByRole('button', { name: yes, exact: true }).waitFor();
      assert.equal(await page.locator('.l3-headline').textContent(), question);
      assert.equal(await page.locator('.l3-input').count(), 0);
      assert.equal(await page.locator('input[type=file]').count(), 0);
      assert.equal(await page.getByRole('button', { name: '過完了', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: '幫我問', exact: true }).count(), 1);
      assert.equal((await inspect(walk.sessionId)).session.checkpointId, 'cp2');
      const filename = `ui-${name}-${label}.png`;
      await page.screenshot({ path: path.join(outDir, filename), fullPage: true });
      receipt.screenshots.push(filename);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }

    const walk = await newWalk('photo-text-route');
    const { page } = walk;
    await page.getByRole('button', { name: '拍招牌', exact: true }).click();
    const photographed = await action(walk, 'synthetic-PNG-through-preparePhoto', () => page.locator('input[type=file]').setInputFiles({
      name: 'synthetic-sign.png', mimeType: 'image/png', buffer: syntheticPng,
    }));
    assert.equal(photographed.session.checkpointId, 'cp2');
    assert.equal((await inspect(walk.sessionId)).photoCount, 1);
    receipt.checks.push('Synthetic PNG reached real photo HTTP branch; photoCount=1');

    const bikeAudio = receipt.audio.length;
    const bike = await say(walk, 'youbike站');
    assert.equal(bike.session.checkpointId, 'cp2');
    assert.equal(bike.action.type, 'ASK');
    assert.ok(bike.action.question.includes('路牌'));
    await page.getByText(bike.action.question, { exact: true }).waitFor();
    assert.equal(receipt.audio.length, bikeAudio, 'New YouBike ASK must request no recording');

    const beforeQuestionAudio = receipt.audio.length;
    await say(walk, '仁愛復興路口');
    await expectQuestion(walk, 'question');
    assert.equal(receipt.audio.length, beforeQuestionAudio, 'New location ASK must request no recording');
    const rejected = await action(walk, 'cancel', () => page.getByRole('button', { name: cancel, exact: true }).click());
    assert.equal(rejected.session.checkpointId, 'cp2');
    await page.locator('.l3-input').waitFor();
    assert.equal(await page.getByRole('button', { name: yes, exact: true }).count(), 0);

    await say(walk, '仁愛復興路口');
    await expectQuestion(walk, 'question-again');
    const confirmed = await action(walk, 'confirm', () => page.getByRole('button', { name: yes, exact: true }).click());
    assert.equal(confirmed.action.type, 'GUIDE');
    assert.equal(confirmed.action.checkpointId, 'cp3');
    assert.equal(confirmed.session.checkpointId, 'cp3x');
    assert.equal(confirmed.expects, 'walker');
    await page.getByRole('button', { name: '過完了', exact: true }).waitFor();
    assert.equal(await page.locator('.l3-input').count(), 0);
    assert.equal(await page.getByRole('button', { name: '我在哪', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '幫我問', exact: true }).count(), 0);

    const crossed = await action(walk, 'second-crossing-done', () => page.getByRole('button', { name: '過完了', exact: true }).click());
    assert.equal(crossed.session.checkpointId, 'cp4');
    // Help must stop an actually running route recording and leave the server alone.
    await page.waitForFunction(() => window.qaAudio.active > 0);
    const audioBeforeHelp = await page.evaluate(() => ({ ...window.qaAudio }));
    let helpPosts = 0;
    const countHelpPost = request => { if (request.url().endsWith('/observations') && request.method() === 'POST') helpPosts++; };
    page.on('request', countHelpPost);
    await page.getByRole('button', { name: '幫我問', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    const audioDuringHelp = await page.evaluate(() => ({ ...window.qaAudio }));
    assert.equal(audioDuringHelp.active, 0);
    assert.ok(audioDuringHelp.stopped > audioBeforeHelp.stopped);
    assert.equal((await inspect(walk.sessionId)).session.checkpointId, 'cp4');
    await page.getByRole('dialog').getByRole('button', { name: '好了', exact: true }).click();
    assert.equal(helpPosts, 0);
    page.off('request', countHelpPost);
    receipt.checks.push('Help stopped active native route audio; zero observations; checkpoint stayed cp4');

    assert.equal((await say(walk, '急診')).session.checkpointId, 'cp5');
    assert.equal((await say(walk, '復康巴士')).action.type, 'ASK');
    assert.equal((await say(walk, '復康巴士')).action.type, 'CONFIRM_ARRIVAL');
    await page.getByText('到了', { exact: true }).waitFor();
    assert.equal((await inspect(walk.sessionId)).session.state, 'ARRIVED');
    receipt.checks.push('Full text recovery route reached ARRIVED after entrance ASK');
    await page.close();

    const stale = await newWalk('expired-confirmation');
    await say(stale, '仁愛復興路口');
    await expectQuestion(stale, 'expired-before');
    await stale.page.route('**/api/sessions/*/observations', route => {
      const body = route.request().postDataJSON();
      return body.confirmation ? route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"expired"}' }) : route.fallback();
    });
    await action(stale, 'injected-409', () => stale.page.getByRole('button', { name: yes, exact: true }).click(), 409);
    await stale.page.getByText(expired, { exact: true }).waitFor();
    assert.equal(await stale.page.getByRole('button', { name: yes, exact: true }).count(), 0);
    await stale.page.locator('.l3-input').waitFor();
    assert.equal((await inspect(stale.sessionId)).session.checkpointId, 'cp2');
    receipt.checks.push('Injected HTTP 409 removed stale controls, restored text input, and showed retry prompt');
    await stale.page.close();

    const repeated = await newWalk('duplicate-confirmation');
    await say(repeated, '仁愛復興路口');
    await expectQuestion(repeated, 'duplicate-before');
    let confirmations = 0, releaseResponse;
    const heldResponse = new Promise(resolve => { releaseResponse = resolve; });
    await repeated.page.route('**/api/sessions/*/observations', async route => {
      if (!route.request().postDataJSON().confirmation) return route.fallback();
      confirmations++;
      await heldResponse;
      return route.continue();
    });
    const completed = repeated.page.waitForResponse(r => r.url().endsWith('/observations') && r.request().method() === 'POST');
    await repeated.page.getByRole('button', { name: yes, exact: true }).evaluate(button => { button.click(); button.click(); });
    await repeated.page.waitForFunction(() => [...document.querySelectorAll('.l3-confirmation button')].every(button => button.disabled));
    assert.equal(confirmations, 1);
    releaseResponse();
    const single = await completed;
    assert.equal(single.status(), 200);
    const resumed = await single.json();
    await repeated.page.getByRole('button', { name: '過完了', exact: true }).waitFor();
    assert.equal(confirmations, 1);
    assert.equal(resumed.session.checkpointId, 'cp3x');
    receipt.events.push({ story: repeated.story, operation: 'double-click-delayed-response', status: single.status(), ...summary(resumed) });
    receipt.checks.push('Two synchronous confirmation clicks while response held produced one POST');
    await repeated.page.close();

    assert.deepEqual(receipt.pageErrors, []);
    assert.deepEqual(receipt.externalRequests, []);
    assert.ok(receipt.audio.length > 0, 'Native route recordings must have been requested');
    assert.ok(receipt.audio.every(item => item.status === 200), 'All completed outdoor audio requests must succeed');
    receipt.status = 'PASS';
    await context.close();
  } catch (error) {
    receipt.status = 'FAIL';
    receipt.failure = String(error.stack || error);
  } finally {
    await browser?.close();
    fs.writeFileSync(path.join(outDir, `ui-${name}.json`), JSON.stringify(receipt, null, 2) + '\n');
  }
  return receipt;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const syntheticPng = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#4499ab' } }).png().toBuffer();
  const results = [];
  for (const [name, engine, options] of [
    ['chromium', chromium, { executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--disable-background-networking', '--disable-component-update', '--mute-audio'] }],
    ['webkit', webkit, {}],
  ]) results.push(await checkEngine(name, engine, options, syntheticPng));
  const result = { checkedAt: new Date().toISOString(), scope: 'Local HTTP + desktop Chromium/WebKit at 390x844. Synthetic photo; deterministic interpreter without image understanding. Actual iPhone LINE and live model acceptance pending.',
    frontend: frontend.origin, api: api.origin, status: results.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL',
    results: results.map(r => ({ engine: r.engine, version: r.version, status: r.status, checks: r.checks, failure: r.failure })) };
  fs.writeFileSync(path.join(outDir, 'ui-browser-summary.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
