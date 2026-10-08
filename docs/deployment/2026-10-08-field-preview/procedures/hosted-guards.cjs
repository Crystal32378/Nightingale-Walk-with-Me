// Synthetic structured observations only. Uses new test sessions and real Firestore, no model calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = process.env.NIGHTINGALE_TEST_API;
assert.match(api || '', /^https:\/\/field-fix-20261008---nightingale-[a-z0-9-]+\.a\.run\.app$/);
const events = [];
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  assert.ok(r.ok, String(r.status)); return r.json();
}
const observe = (term, source = 'photo', zone) => ({ observation: { landmarks: [], signage: [term], confidence: 'high', source }, ...(zone ? { location: { zone } } : {}) });
(async () => {
  const created = await post(api + '/api/sessions', { routeId: 'renai-001' });
  const endpoint = api + '/api/sessions/' + encodeURIComponent(created.sessionId) + '/observations';
  const send = async body => { const r = await post(endpoint, body); events.push({ checkpoint: r.session.checkpointId, action: r.action.type, photoHold: r.verdict.photoHold ?? null }); return r; };
  assert.equal((await send({ confirm: 'done' })).session.checkpointId, 'cp2');
  for (const zone of [undefined, 'unknown']) {
    const r = await send(observe('大安路一段116巷', 'photo', zone));
    assert.equal(r.session.checkpointId, 'cp2'); assert.equal(r.verdict.photoHold, 'crossing-needs-location');
  }
  assert.equal((await send(observe('大安路一段116巷', 'photo', 'lane'))).session.checkpointId, 'cp2x');
  assert.equal((await send(observe('仁愛路', 'photo', 'renai_fuxing'))).session.checkpointId, 'cp2x');
  assert.equal((await send({ confirm: 'done' })).session.checkpointId, 'cp3');
  assert.equal((await send(observe('仁愛路'))).verdict.photoHold, 'crossing-needs-location');
  assert.equal((await send(observe('仁愛路', 'text'))).session.checkpointId, 'cp3x');
  assert.equal((await send(observe('急診'))).session.checkpointId, 'cp3x');
  assert.equal((await send({ confirm: 'done' })).session.checkpointId, 'cp4');
  assert.equal((await send(observe('急診', 'text'))).session.checkpointId, 'cp5');
  const held = await send(observe('急診'));
  assert.equal(held.verdict.photoHold, 'recovery-needs-location'); assert.equal(held.session.questionCount, 0);
  assert.equal((await send(observe('復康巴士', 'text'))).action.type, 'ASK');
  assert.equal((await send(observe('復康巴士', 'text'))).action.type, 'CONFIRM_ARRIVAL');
  const receipt = { checkedAt: new Date().toISOString(), status: 'PASS', scope: 'Synthetic photo/text observations over tagged HTTP API with real Firestore; no fresh image recognition or physical location', api, events };
  fs.writeFileSync(path.join(__dirname, '../hosted-guards.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', calls: events.length, guardsPreserved: true }));
})().catch(e => { console.error(e); process.exitCode = 1; });
