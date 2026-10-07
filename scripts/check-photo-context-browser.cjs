// Start eval/guard-browser-server.ts first. Frontend stays the reviewed f4016ba build.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = require('sharp');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [], audio = [], events = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('response', response => { if (response.url().includes('/audio/outdoor/')) audio.push(response.url()); });
    await page.route('http://127.0.0.1:8787/**', route => route.continue({ url: route.request().url().replace(':8787/', ':8788/') }));
    const image = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#888' } }).jpeg().toBuffer();
    await page.goto((process.env.NIGHTINGALE_QA_URL || 'http://127.0.0.1:5178') + '/?flow=last300m&photo=1');
    await page.getByRole('button', { name: '開始', exact: true }).click();
    const action = async (trigger) => {
      const pending = page.waitForResponse(r => r.url().endsWith('/observations') && r.request().method() === 'POST');
      await trigger();
      const response = await pending;
      assert.equal(response.status(), 200);
      const value = await response.json();
      events.push({ action: value.action, session: value.session, photoHold: value.verdict.photoHold ?? null });
      return value;
    };
    const done = name => action(() => page.getByRole('button', { name, exact: true }).click());
    const text = async value => {
      await page.getByPlaceholder('跟我說你看到什麼').fill(value);
      return action(() => page.getByRole('button', { name: '傳送', exact: true }).click());
    };
    const photo = async () => {
      const remind = page.getByRole('button', { name: '拍招牌', exact: true });
      if (await remind.count()) await remind.click();
      return action(() => page.locator('input[type=file]').setInputFiles({ name: 'regression.jpg', mimeType: 'image/jpeg', buffer: image }));
    };
    await done('我到出口2了');
    for (let i = 0; i < 2; i++) {
      const r = await photo();
      assert.equal(r.action.type, 'REANCHOR'); assert.equal(r.session.checkpointId, 'cp2');
      assert.equal(r.verdict.photoHold, 'crossing-needs-location');
    }
    assert.equal(audio.some(url => url.endsWith('/cp2.cross.wav')), false);
    assert.equal(await page.getByRole('button', { name: '過完了', exact: true }).count(), 0);
    await page.screenshot({ path: '/tmp/nightingale-photo-context-hold.png', fullPage: true });
    assert.equal((await text('路牌寫大安路一段116巷')).action.type, 'GUIDE');
    await done('過完了');
    for (let i = 0; i < 2; i++) {
      const r = await photo();
      assert.equal(r.action.type, 'REANCHOR'); assert.equal(r.session.checkpointId, 'cp3');
    }
    assert.equal(audio.some(url => url.endsWith('/cp3.cross.wav')), false);
    assert.equal((await text('我在仁愛路口，看到福華飯店')).action.type, 'GUIDE');
    await done('過完了');
    assert.equal((await text('紅色急診和停車場車道')).session.checkpointId, 'cp5');
    for (let i = 0; i < 2; i++) {
      const r = await photo();
      assert.equal(r.action.type, 'REANCHOR'); assert.equal(r.session.checkpointId, 'cp5');
      assert.equal(r.session.questionCount, 0); assert.equal(r.verdict.photoHold, 'recovery-needs-location');
    }
    assert.equal((await text('門口有復康巴士的牌子')).action.type, 'ASK');
    assert.equal((await text('門口有復康巴士的牌子')).action.type, 'CONFIRM_ARRIVAL');
    assert.deepEqual(errors, []);
    const result = { status: 'PASS', scope: 'Real frontend and HTTP API; six recorded failing photo observations injected at the interpreter seam; no cloud model', photos: 6, arrived: true, errors, events, audio };
    fs.writeFileSync('/tmp/nightingale-photo-context-browser.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: result.status, photos: result.photos, arrived: result.arrived, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
