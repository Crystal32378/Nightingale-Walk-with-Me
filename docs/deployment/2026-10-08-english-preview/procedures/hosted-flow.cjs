// Scripted remote descriptions through the real English UI/API. No GPS/field claim.
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const url = process.env.NIGHTINGALE_PREVIEW_URL, api = process.env.NIGHTINGALE_TEST_API;
assert.match(url || '', /^https:\/\/nightingale-walk-with-me--english-20261008-/);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const events=[];const errors=[];const requests=[];
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(40000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/api/')){requests.push(r.url());assert.ok(r.url().startsWith(api+'/'));}});
  await page.addInitScript(()=>{navigator.geolocation.watchPosition=()=>0;});
  await page.goto(url+'/?flow=last300m&photo=1&lang=en');
  const press=async name=>{
   const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/sessions'));
   await page.getByRole('button',{name,exact:true}).click();const r=await response;assert.ok(r.ok());const b=await r.json();events.push({name,checkpoint:b.session.checkpointId,action:b.action.type,messageKey:b.action.messageKey,expects:b.expects});return b;
  };
  const send=async text=>{await page.getByRole('textbox',{name:'What can you see?'}).fill(text);return press('Send');};
  await press('Start');await press('I am at Exit 2');
  assert.equal((await send('I see a YouBike station')).action.messageKey,'ask.youbike');
  const held=await send("I don't see Renai Road");assert.equal(held.session.checkpointId,'cp2');
  await send('I am at the intersection of Renai Road and Fuxing South Road');
  await page.getByRole('button',{name:'Yes, all of those are true',exact:true}).waitFor();
  let count=requests.length;await page.getByLabel('Language / 語言').selectOption('zh-TW');await page.getByLabel('Language / 語言').selectOption('en');assert.equal(requests.length,count);
  await press('No / not sure');
  assert.equal((await send("I see Lane 116, Section 1, Da'an Road")).session.checkpointId,'cp2x');
  assert.equal(await page.getByRole('button',{name:'Say a sentence',exact:true}).count(),0);
  await press('I have crossed');
  const question=await send('Renai Road?');assert.equal(question.session.checkpointId,'cp3');assert.equal(question.action.type,'REANCHOR');
  assert.equal((await send('I see Renai Road')).session.checkpointId,'cp3x');await press('I have crossed');
  assert.equal((await send('I see the emergency department')).session.checkpointId,'cp5');
  assert.match(await page.locator('.l3-sign-hint').innerText(),/急診/);
  for(const [text,key]of[["I see Da'an Road",'recover.daan'],['I see the green-roofed corridor','recover.canopy'],['I see the emergency department','recover.er']])assert.equal((await send(text)).action.messageKey,key);
  assert.equal((await send('I see a rehabilitation bus')).action.type,'ASK');
  assert.equal((await send('I see a rehabilitation bus')).action.type,'CONFIRM_ARRIVAL');
  await page.getByText('At the entrance',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(__dirname,'../hosted-english-arrival.png'),fullPage:true});
  const result={checkedAt:new Date().toISOString(),url,api,status:'PASS',scope:'Desktop remote scripted English descriptions through real tagged API/Vertex/Firestore; not physical outdoor acceptance.',events,errors};
  fs.writeFileSync(path.join(__dirname,'../hosted-flow.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'PASS',turns:events.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
