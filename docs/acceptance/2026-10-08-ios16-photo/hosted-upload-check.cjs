// Authorized limited-preview smoke: one existing JPEG and a newly created session.
// The enum shim models only the documented old WebKit option rejection, not iOS itself.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { webkit } = require(process.env.PLAYWRIGHT_MODULE);
const base = 'https://nightingale-walk-with-me--photo-check-20261008-yl1k8e08.web.app';
const api = 'https://field-fix-20261008---nightingale-uwker3cn5a-de.a.run.app';
const fixture = process.env.NIGHTINGALE_SMOKE_PHOTO;
assert.ok(fixture && fs.existsSync(fixture));
(async () => {
  const browser = await webkit.launch({ headless: true });
  const receipt = { checkedAt: new Date().toISOString(), scope: 'Hosted desktop WebKit with legacy option enum shim; real photo/Firestore/Vertex; not actual iPhone acceptance', status: 'RUNNING', errors: [], unexpectedOrigins: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: [] });
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if ([base, api].includes(u.origin)) return route.continue();
      receipt.unexpectedOrigins.push(u.origin); return route.abort();
    });
    await context.addInitScript(() => {
      const native = window.createImageBitmap.bind(window);
      window.createImageBitmap = (source, options) => {
        if (options?.imageOrientation !== undefined && !['none', 'flipY'].includes(options.imageOrientation)) throw new TypeError('Type error');
        return native(source, options);
      };
    });
    const page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on('pageerror', e => receipt.errors.push(String(e)));
    await page.goto(base + '/?flow=last300m&photo=1&photoCheck=1&v=ios16-1');
    const started = page.waitForResponse(r => r.url() === api + '/api/sessions' && r.request().method() === 'POST');
    await page.getByRole('button', { name: '開始', exact: true }).click();
    const created = await started; assert.equal(created.status(), 201);
    const id = (await created.json()).sessionId;
    await page.getByRole('button', { name: '我到出口2了', exact: true }).click();
    await page.getByPlaceholder('跟我說你看到什麼').waitFor();
    await page.getByRole('button', { name: '拍招牌', exact: true }).click();
    const uploaded = page.waitForResponse(r => r.url().endsWith('/observations') && r.request().method() === 'POST');
    await page.locator('input[type=file]').setInputFiles(fixture);
    const response = await uploaded; assert.equal(response.status(), 200);
    const result = await response.json(); assert.equal(result.observation.source, 'photo');
    const saved = await (await fetch(api + '/api/sessions/' + encodeURIComponent(id))).json();
    assert.equal(saved.photoCount, 1);
    assert.equal(result.session.checkpointId, 'cp2');
    assert.equal(await page.getByText(/照片我打不開|P-DECODE/).count(), 0);
    assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.unexpectedOrigins, []);
    receipt.inputSha256 = crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex');
    receipt.photoCount = saved.photoCount; receipt.observation = result.observation;
    receipt.action = result.action; receipt.photoHold = result.verdict.photoHold ?? null;
    receipt.status = 'PASS'; receipt.version = browser.version();
    await page.screenshot({ path: path.join(__dirname, 'hosted-photo-result.png'), fullPage: true });
  } catch (e) { receipt.status = 'FAIL'; receipt.error = String(e); throw e; }
  finally { fs.writeFileSync(path.join(__dirname, 'hosted-photo.json'), JSON.stringify(receipt, null, 2) + '\n'); await browser.close(); }
  console.log(JSON.stringify(receipt, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
