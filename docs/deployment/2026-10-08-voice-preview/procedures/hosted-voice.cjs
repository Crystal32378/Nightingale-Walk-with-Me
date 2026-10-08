// Real hosted API/Vertex/Firestore; only microphone input is replaced with an
// existing accepted synthetic voice sample. This is not iPhone LINE acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE);
const url = process.env.NIGHTINGALE_PREVIEW_URL;
const api = process.env.NIGHTINGALE_TEST_API;
assert.match(url || '', /^https:\/\/nightingale-walk-with-me--voice-input-20261008-/);
assert.match(api || '', /^https:\/\/voice-input-20261008---nightingale-/);
(async () => {
  const results = [];
  for (const engine of ['chromium', 'webkit']) {
    const browser = await ({ chromium, webkit })[engine].launch({ headless: true,
      ...(engine === 'chromium' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.setDefaultTimeout(45000);
      const apiRequests = []; const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', req => { if (req.url().includes('/api/')) apiRequests.push({ url: req.url(), method: req.method() }); });
      await page.addInitScript(engine => {
        window.__voice = { duration: 0, streams: [] };
        navigator.geolocation.watchPosition = () => 0;
        HTMLMediaElement.prototype.play = () => Promise.resolve();
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
          const context = new AudioContext(); await context.resume();
          const data = await fetch('/audio/outdoor/renai-001/leda/reanchor.wav').then(r => r.arrayBuffer());
          const audio = await context.decodeAudioData(data); const source = context.createBufferSource(); source.buffer = audio;
          const destination = context.createMediaStreamDestination(); source.connect(destination); source.start();
          window.__voice.duration = audio.duration; window.__voice.streams.push(destination.stream);
          for (const track of destination.stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { stop(); void context.close(); }; }
          return destination.stream;
        } } });
        if (engine === 'webkit') { const native = MediaRecorder.isTypeSupported.bind(MediaRecorder); MediaRecorder.isTypeSupported = m => m.startsWith('audio/mp4') && native(m); }
      }, engine);
      await page.goto(url + '/?flow=last300m&photo=1');
      await page.getByRole('button', { name: '開始', exact: true }).click();
      await page.getByRole('button', { name: '我到出口2了', exact: true }).click();
      const speak = page.getByRole('button', { name: '說一句', exact: true }); await speak.waitFor();
      const sessionReq = apiRequests.find(r => r.url.endsWith('/observations'));
      const sessionUrl = sessionReq.url.replace(/\/observations$/, '');
      const before = await fetch(sessionUrl).then(r => r.json());
      await speak.click(); await page.getByRole('button', { name: '說完了', exact: true }).waitFor();
      const seconds = await page.evaluate(() => window.__voice.duration); await page.waitForTimeout((seconds + 0.25) * 1000);
      const responsePromise = page.waitForResponse(r => r.url().endsWith('/transcriptions'));
      await page.getByRole('button', { name: '說完了', exact: true }).click();
      const response = await responsePromise; const status = response.status(); const body = await response.json();
      assert.equal(status, 200, JSON.stringify(body)); assert.match(body.text, /附近/); assert.match(body.text, /跟我說/);
      const input = page.getByRole('textbox', { name: '你看到什麼' });
      await page.waitForFunction(() => document.querySelector('.l3-input')?.value?.includes('附近'));
      assert.equal(apiRequests.filter(r => r.url.endsWith('/observations')).length, 1);
      const after = await fetch(sessionUrl).then(r => r.json());
      assert.deepEqual(after.session, before.session); assert.deepEqual(after.lastAction, before.lastAction);
      assert.equal(after.audioCount, 1); assert.ok(!JSON.stringify(after).includes(body.text));
      assert.equal(await page.evaluate(() => window.__voice.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
      await page.screenshot({ path: path.join(__dirname, `../hosted-${engine}-review.png`), fullPage: true });
      await input.fill('youbike站');
      const observed = page.waitForResponse(r => r.url().endsWith('/observations'));
      await page.getByRole('button', { name: '傳送', exact: true }).dblclick();
      const observedResponse = await observed; assert.equal(observedResponse.status(), 200);
      const observedBody = await observedResponse.json(); assert.equal(observedBody.session.checkpointId, 'cp2');
      assert.equal(apiRequests.filter(r => r.url.endsWith('/observations')).length, 2);
      assert.ok(apiRequests.every(r => r.url.startsWith(api + '/'))); assert.deepEqual(errors, []);
      results.push({ engine, browserVersion: browser.version(), transcriptionStatus: status, syntheticTranscript: body.text,
        mime: response.request().headers()['content-type'], durationSeconds: seconds, sessionUnchangedBeforeSend: true,
        persistedAudioCount: after.audioCount, explicitSendCount: 1, checkpointAfterEditedText: observedBody.session.checkpointId,
        microphoneTracksReleased: true, allApiRequestsTagged: true, errors });
    } finally { await browser.close(); }
  }
  const receipt = { checkedAt: new Date().toISOString(), url, api, status: 'PASS', scope: 'Desktop real MediaRecorder and hosted Vertex/Firestore, with accepted synthetic Leda speech replacing microphone. No iPhone LINE or outdoor acceptance.', results };
  fs.writeFileSync(path.join(__dirname, '../hosted-voice.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
