#!/usr/bin/env python3
"""Import a complete fixed English set; never writes a Chinese path."""
import argparse, hashlib, json, shutil, wave
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--frontend',type=Path,required=True);a=p.parse_args()
script_path=a.frontend/'src/remote/outdoor-en-script.json';script=json.loads(script_path.read_text());source=json.loads((a.source/'recordings.json').read_text())
assert script['status']=='approved_for_recording'
assert len(script['utterances'])==22 and len(source['recordings'])==44
manifest={'routeId':'renai-001','locale':'en','model':source['model'],'style':source['style'],'scriptSha256':hashlib.sha256(script_path.read_bytes()).hexdigest(),'acceptance':'Crystal accepted fixed copy, Leda/Puck voice IDs and revised normal-pace samples. Other clips have generation/hash checks, not individual human listening acceptance.','utterances':{}}
files=[]
for key,text in script['utterances'].items():
 entry={'text':text,'voices':{}}
 for voice in ['Leda','Puck']:
  item=source['recordings'][voice+':'+key];assert item['text']==text and item['voice']==voice and item['key']==key
  src=(a.source/item['file']).resolve();assert src.is_relative_to(a.source.resolve())
  assert hashlib.sha256(src.read_bytes()).hexdigest()==item['sha256']
  with wave.open(str(src),'rb') as w:
   assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,24000)
   assert w.getnframes()>12000
  relative=f'audio/outdoor/renai-001-en/{voice.lower()}/{key}.wav'
  dst=a.frontend/'public'/relative
  if dst.exists(): assert hashlib.sha256(dst.read_bytes()).hexdigest()==item['sha256'],'Refuse overwriting different accepted audio'
  files.append((src,dst));entry['voices'][voice]={'file':relative,'sha256':item['sha256'],'seconds':item['seconds'],'generatedAt':item['generatedAt'],'listeningReview':item.get('listeningReview','pending')}
 manifest['utterances'][key]=entry
for src,dst in files:
 dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
(a.frontend/'src/remote/outdoor-manifest.en.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'imported':len(files),'scriptSha256':manifest['scriptSha256'],'chinesePathsWritten':0}))
