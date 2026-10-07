const {chromium}=require('/Users/crystalchang/Library/Caches/ms-playwright-go/1.57.0/package');
const fs=require('node:fs');const assert=require('node:assert/strict');
const m=JSON.parse(fs.readFileSync('/Users/crystalchang/Desktop/Astra Atelier/Nightingale-preview-prebuild-2026-10-08.json','utf8'));
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(45000);const errors=[],audio=[],apiOrigins=new Set();
 p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.url().includes('/audio/outdoor/'))audio.push({path:new URL(r.url()).pathname,status:r.status()});if(r.url().includes('/api/'))apiOrigins.add(new URL(r.url()).origin)});
 await p.goto(m.previewUrl+'/?flow=last300m&photo=1');await p.getByRole('combobox',{name:'聲音'}).selectOption('Puck');await p.getByRole('button',{name:'開始',exact:true}).click();await p.getByRole('button',{name:'我到出口2了'}).click();
 const say=async(value)=>{await p.getByPlaceholder('跟我說你看到什麼').fill(value);const pending=p.waitForResponse(r=>r.url().endsWith('/observations')&&r.request().method()==='POST');await p.getByRole('button',{name:'傳送',exact:true}).click();const r=await pending;assert.equal(r.status(),200);return r.json()};
 assert.equal((await say('路牌寫大安路一段116巷')).action.type,'GUIDE');await p.getByRole('button',{name:'過完了'}).waitFor();assert.equal(await p.getByRole('button',{name:'我在哪',exact:true}).count(),0);await p.screenshot({path:'/tmp/nightingale-hosted-crossing.png',fullPage:true});
 const along=p.waitForResponse(r=>r.url().endsWith('/puck/cp2.along.wav'));await p.getByRole('button',{name:'過完了'}).click();await along;
 assert.equal((await say('路牌寫仁愛路，看到福華飯店')).action.type,'GUIDE');await p.getByRole('button',{name:'過完了'}).waitFor();assert.equal(await p.getByRole('button',{name:'我在哪',exact:true}).count(),0);await p.getByRole('button',{name:'過完了'}).click();
 assert.equal((await say('急診停車場車道')).session.checkpointId,'cp5');assert.equal((await say('復康巴士')).action.type,'ASK');assert.equal((await say('復康巴士')).action.type,'CONFIRM_ARRIVAL');await p.getByText('到了',{exact:true}).waitFor();await p.screenshot({path:'/tmp/nightingale-hosted-arrival.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual([...apiOrigins],[m.apiUrl]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const result={checkedAt:new Date().toISOString(),previewUrl:m.previewUrl,api:m.apiUrl,actualTextApiWalk:true,arrived:true,voice:'Puck',crossingControlsQuiet:true,errors,audio};fs.writeFileSync('/tmp/nightingale-hosted-preview-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',previewUrl:m.previewUrl,arrived:true,apiOrigins:[...apiOrigins],audioRequests:audio.length}));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
