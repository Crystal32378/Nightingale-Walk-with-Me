#!/usr/bin/env python3
"""Create a local-only review sheet; never modifies source photos or labels."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / 'eval/photo-labels.json'
data = json.loads(source.read_text())
rows = [row for row in data['photos'] if row['file'].startswith('第二趟/')]
assert len(rows) == 57
for row in rows:
    assert (root / 'field trip photos' / row['file']).is_file()
payload = json.dumps({'rows': rows, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest()}, ensure_ascii=False).replace('<', '\\u003c')
html = '''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nightingale｜第二趟標註核對</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f4ee;color:#2c3a33;font:17px/1.6 -apple-system,"PingFang TC",sans-serif}main{max-width:1060px;margin:auto;padding:28px 16px 90px}h1{font-size:1.7rem;margin:0}h2{font-size:1rem;margin:0}p{margin:8px 0}.lead,.note{color:#4c5e54}.toolbar{position:sticky;top:0;background:#f6f4eef2;padding:12px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:1}.card{display:grid;grid-template-columns:1.1fr 1fr;gap:20px;background:white;border:1px solid #dfe8df;border-radius:16px;padding:18px;margin:18px 0}.card img{width:100%;max-height:520px;object-fit:contain;border-radius:8px}.fields{display:grid;gap:12px}.fields label{display:grid;gap:4px}select,input[type=text],textarea{width:100%;font:inherit;padding:10px;border:1px solid #bfcdbf;border-radius:8px;background:white;color:inherit}textarea{min-height:70px}.fields .checked{display:flex;align-items:center;gap:10px}input[type=checkbox]{width:22px;height:22px}button{font:inherit;padding:12px 20px;border:0;border-radius:12px;background:#2f5d50;color:white;cursor:pointer}select{min-height:48px}.toolbar select{width:auto}.tag{font-size:.85rem;color:#4c5e54}.card[data-reviewed=true]{border-color:#2f5d50}.card[hidden]{display:none}a{color:#2f5d50}#storage{font-size:.9rem}@media(max-width:700px){.card{grid-template-columns:1fr}.toolbar{position:static}}
</style><main><h1>第二趟標註核對</h1><p class="lead">2026 年 9 月 28 日實走 · 12 張照片＋15 段影片各抽 3 格，共 57 張。</p>
<p>目前位置與文字是 Opus 的草稿，尚未由你核對。每張看過後再勾選「這張已核對」；不確定可以直接保留。修改只存在這台電腦，匯出後才交給下一步使用。</p>
<div class="toolbar"><strong id="progress"></strong><select id="filter" aria-label="顯示範圍"><option value="all">全部</option><option value="pending">待核對</option><option value="reviewed">已核對</option></select><button id="export">匯出核對結果</button><span id="storage" role="status"></span></div><div id="cards"></div>
<p>照片、影片與原始標註保持原樣；這份核對頁不會上傳資料，也不會自動修改路線。</p></main><script>
const data=__PAYLOAD__;
const places={station:'站內（地下）',exit2:'出口2 地面層',lane:'復興南路過街巷口',fuxing_west:'復興南路西側',fuxing_east:'復興南路東側',renai_fuxing:'仁愛×復興路口',hospital_side:'過仁愛路後、醫院側',er:'急診車道',lobby:'大廳門口',inside:'院內',past:'走過頭／大安路側',noise:'不確定／無關'};
const key='nightingale-trip2-review-'+data.sourceSha256;
let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
const state=data.rows.map(row=>({...row,reviewed:false,...saved[row.file],file:row.file}));
const cards=document.getElementById('cards');
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const split=t=>t.split('、').map(s=>s.trim()).filter(Boolean);
function persist(){try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(state.map(r=>[r.file,r]))));document.getElementById('storage').textContent='已存於此瀏覽器'}catch{document.getElementById('storage').textContent='瀏覽器未能儲存，請匯出結果'}update()}
function update(){document.getElementById('progress').textContent=state.filter(r=>r.reviewed).length+' / '+state.length+' 張已核對';const f=document.getElementById('filter').value;[...cards.children].forEach((c,i)=>{c.dataset.reviewed=String(state[i].reviewed);c.hidden=f==='pending'?state[i].reviewed:f==='reviewed'?!state[i].reviewed:false})}
state.forEach((row,index)=>{
 const original=data.rows[index],card=el('section');card.className='card';card.dataset.file=row.file;
 const visual=el('div'),img=el('img');img.src=row.file.replace(/^第二趟\\//,'');img.alt=row.file;img.loading='lazy';visual.append(img);
 const file=row.file.split('/').pop();const frame=file.match(/^(IMG_\\d+)_f\\d+\\.jpg$/);
 if(frame){const link=el('a','開啟原始影片');link.href=frame[1]+'.MOV';link.target='_blank';link.rel='noopener';visual.append(link)}
 const fields=el('div');fields.className='fields';fields.append(el('h2',file),el('div','Opus 草稿：'+(places[original.place]||original.place)),el('p',original.note||''));
 const placeLabel=el('label','在哪裡拍的'),select=el('select');select.setAttribute('aria-label',file+' 拍攝位置');Object.entries(places).forEach(([v,t])=>{const o=el('option',t);o.value=v;select.append(o)});select.value=row.place;select.onchange=()=>{row.place=select.value;persist()};placeLabel.append(select);fields.append(placeLabel);
 for(const [name,label] of [['expect','清楚讀得到的詞（以「、」分隔）'],['optional','也可能讀到的詞（以「、」分隔）']]){const l=el('label',label),input=el('input');input.type='text';input.value=(row[name]||[]).join('、');input.oninput=()=>{row[name]=split(input.value);persist()};l.append(input);fields.append(l)}
 const noteLabel=el('label','你的補充'),note=el('textarea');note.value=row.reviewNote||'';note.oninput=()=>{row.reviewNote=note.value;persist()};noteLabel.append(note);fields.append(noteLabel);
 const checked=el('label');checked.className='checked';const box=el('input');box.type='checkbox';box.checked=row.reviewed;box.onchange=()=>{row.reviewed=box.checked;persist()};checked.append(box,el('span','這張已核對'));fields.append(checked);
 card.append(visual,fields);cards.append(card);
});
document.getElementById('filter').onchange=update;
document.getElementById('export').onclick=()=>{const result={routeId:'renai-001',trip:2,source:'eval/photo-labels.json',sourceSha256:data.sourceSha256,exportedAt:new Date().toISOString(),status:state.every(r=>r.reviewed)?'reviewed':'partial',photos:state};const blob=new Blob([JSON.stringify(result,null,2)+'\\n'],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='nightingale-trip2-review-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
update();
</script></html>'''
target = root / 'field trip photos/第二趟/標註核對.html'
target.write_text(html.replace('__PAYLOAD__', payload))
print(target)
