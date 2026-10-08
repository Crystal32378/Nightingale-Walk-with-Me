// Explicitly authorized limited-preview smoke; creates fresh sessions only.
// Uses real Firestore/Vertex. Never reuse an existing walk or save photo bytes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { webkit } = require(process.env.PLAYWRIGHT_MODULE);
const preview = process.env.NIGHTINGALE_PREVIEW_URL;
const api = process.env.NIGHTINGALE_TEST_API;
assert.match(preview || '', /^https:\/\/nightingale-walk-with-me--field-fix-20261008-[a-z0-9]+\.web\.app$/);
assert.match(api || '', /^https:\/\/field-fix-20261008---nightingale-[a-z0-9-]+\.a\.run\.app$/);
const photoPath = process.env.NIGHTINGALE_SMOKE_PHOTO;
assert.ok(photoPath && fs.existsSync(photoPath));
const out = path.resolve(__dirname, '..');
const receipt = { checkedAt: new Date().toISOString(), scope: 'Actual hosted desktop WebKit, one existing field JPEG, real Vertex and Firestore; not iPhone LINE or field acceptance',
  preview, api, events: [], audio: [], errors: [], unexpectedOrigins: [], status: 'RUNNING' };
const summary = body => ({ checkpoint: body.session?.checkpointId, action: body.action?.type,
  actionCheckpoint: body.action?.checkpointId, expects: body.expects, confirmationOffered: !!body.action?.confirmation,
  photoHold: body.verdict?.photoHold ?? null });
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  return { status: r.status, body: await r.json() };
}
(async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    receipt.browser = { engine: 'desktop WebKit', version: browser.version(), viewport: { width: 390, height: 844 }, geolocationPermission: 'not granted' };
    const context = await browser.newContext({ viewport: receipt.browser.viewport, permissions: [], serviceWorkers: 'block' });
    const origins = new Set([preview, api]);
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if (origins.has(u.origin)) return route.continue();
      receipt.unexpectedOrigins.push(u.origin + u.pathname);
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', e => receipt.errors.push(String(e)));
    page.on('response', r => { if (r.url().includes('/audio/outdoor/')) receipt.audio.push({ file: new URL(r.url()).pathname, status: r.status() }); });
    const observationUrl = r => r.url().startsWith(api + '/api/sessions/') && r.url().endsWith('/observations') && r.request().method() === 'POST';
    const act = async (label, trigger) => {
      const waiting = page.waitForResponse(observationUrl);
      await trigger(); const response = await waiting;
      assert.equal(response.status(), 200, label);
      const body = await response.json(); receipt.events.push({ label, ...summary(body) });
      return body;
    };
    const say = async text => {
      await page.getByPlaceholder('跟我說你看到什麼').fill(text);
      return act(text, () => page.getByRole('button', { name: '傳送', exact: true }).click());
    };
    const click = (name) => act(name, () => page.getByRole('button', { name, exact: true }).click());
    await page.goto(preview + '/?flow=last300m&photo=1');
    await page.getByRole('combobox', { name: '聲音' }).selectOption('Puck');
    const started = page.waitForResponse(r => r.url() === api + '/api/sessions' && r.request().method() === 'POST');
    await page.getByRole('button', { name: '開始', exact: true }).click();
    const created = await started; assert.equal(created.status(), 201);
    const sessionId = (await created.json()).sessionId;
    const endpoint = api + '/api/sessions/' + encodeURIComponent(sessionId) + '/observations';
    assert.equal((await click('我到出口2了')).session.checkpointId, 'cp2');
    await page.getByRole('button', { name: '拍招牌', exact: true }).click();
    const uploaded = await act('one real photo via WebKit preprocessing', () => page.locator('input[type=file]').setInputFiles(photoPath));
    assert.equal(uploaded.observation.source, 'photo');
    assert.equal(uploaded.session.checkpointId, 'cp2');
    const stored = await (await fetch(api + '/api/sessions/' + encodeURIComponent(sessionId))).json();
    assert.equal(stored.photoCount, 1);
    receipt.photo = { file: path.basename(photoPath), inputSha256: crypto.createHash('sha256').update(fs.readFileSync(photoPath)).digest('hex'),
      acceptedPhotoCount: stored.photoCount, observation: uploaded.observation, action: uploaded.action, photoHold: uploaded.verdict.photoHold ?? null };
    assert.equal(await page.getByText('這張照片我打不開。用文字跟我說也可以。', { exact: true }).count(), 0);
    const bike = await say('youbike站');
    assert.equal(bike.action.type, 'ASK'); assert.equal(bike.session.checkpointId, 'cp2');
    assert.ok(bike.action.question.includes('YouBike'));
    const question = await say('仁愛復興路口');
    assert.equal(question.action.confirmation.kind, 'renai-before-second-crossing');
    assert.equal(question.session.checkpointId, 'cp2');
    await page.getByRole('button', { name: '是，這些都符合', exact: true }).waitFor();
    assert.equal(await page.locator('input[type=file], .l3-input').count(), 0);
    assert.equal(await page.getByRole('button', { name: '過完了', exact: true }).count(), 0);
    await page.screenshot({ path: path.join(out, 'hosted-webkit-question.png'), fullPage: true });
    assert.equal((await click('不是／不確定')).session.checkpointId, 'cp2');
    const stale = await post(endpoint, { confirmation: { id: question.action.confirmation.id, answer: 'confirm' } });
    assert.equal(stale.status, 409); receipt.cancelledConfirmationReplayStatus = 409;
    await say('仁愛復興路口');
    const continued = await click('是，這些都符合');
    assert.equal(continued.session.checkpointId, 'cp3x'); assert.equal(continued.expects, 'walker');
    assert.equal(await page.locator('.l3-input, input[type=file]').count(), 0);
    assert.equal((await click('過完了')).session.checkpointId, 'cp4');
    assert.equal((await say('急診停車場車道')).session.checkpointId, 'cp5');
    assert.equal((await say('復康巴士')).action.type, 'ASK');
    assert.equal((await say('復康巴士')).action.type, 'CONFIRM_ARRIVAL');
    await page.getByText('到了', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, 'hosted-webkit-arrival.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.unexpectedOrigins, []);
    receipt.status = 'PASS'; receipt.arrived = true;
  } catch (error) {
    receipt.status = 'FAIL'; receipt.failure = String(error); throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'hosted-webkit.json'), JSON.stringify(receipt, null, 2) + '\n');
    await browser.close();
  }
  console.log(JSON.stringify({ status: receipt.status, browser: receipt.browser, realPhoto: receipt.photo, arrived: receipt.arrived, events: receipt.events.length }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
