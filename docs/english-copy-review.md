# English fixed voice copy — accepted recording script

Purpose: the same verified Taipei route, understandable to an English-speaking walker. Crystal accepted this recording script and the revised normal-pace style; the 44 accepted Chinese recordings remain untouched. Leda and Puck will share the same fixed words. No regional accent is assumed.

Crystal accepted normal-pace `cp2.along` and `reanchor` samples in both voices, then authorized the full batch. All 44 clips were generated and imported; two Puck place-name clips also passed her spot listening. Other clips have machine text/hash checks, not individual human listening acceptance.

| Key | Accepted Chinese source | Proposed English |
|---|---|---|
| cp1.guide | 搭1號電梯到一樓。出電梯，就是出口2。 | Take Elevator 1 to street level. Exit 2 is just outside. |
| cp1.board | 到了出口2，先看看旁邊的告示板。上面有寫「聯合醫院仁愛院區」，就是這個出口。 | At Exit 2, look at the notice board nearby. Look for the Chinese name of Taipei City Hospital, Renai Branch. |
| cp1.exit | 出口2出來，往右轉。 | Outside Exit 2, turn right. |
| cp2.cross | 等綠燈，過復興南路。 | Wait for the green pedestrian signal, then cross Fuxing South Road. |
| cp2.after | 過完馬路，往右轉。 | Now that you have crossed, turn right. |
| cp2.along | 沿復興南路直走。 | Continue straight along Fuxing South Road. |
| cp2.bike | 這段人行道，腳踏車也會騎。靠內側走。 | Bicycles use this sidewalk too. Stay on the inner side. |
| cp2.water | 沿路有全家，可以買水。不用趕。 | There is a FamilyMart along the way if you need water. Take your time. |
| cp3.cross | 等綠燈，過仁愛路。 | Wait for the green pedestrian signal, then cross Renai Road. |
| cp3.after | 過完左轉，醫院在這一側。 | After crossing, turn left. The hospital is on this side. |
| cp4.driveway | 紅色「急診」和「P」的車道口，是給車子用的。大廳入口還在前面一點。 | The driveway with the red Chinese characters for Emergency and the letter P is for vehicles. The lobby entrance is a little farther ahead. |
| ask.entrance | 你前面的門，上面寫「急診」嗎？一般門診，要走大廳的玻璃自動門。 | Does the sign above the door show the Chinese characters for Emergency? For outpatient visits, use the automatic glass doors to the lobby. |
| cp5.lobby | 往一整排玻璃自動門進去，就是大廳的入口。 | The row of automatic glass doors is the lobby entrance. |
| recover.er | 那是急診的車道口。大廳入口還在前面一點。 | That is the emergency driveway. The lobby entrance is a little farther ahead. |
| recover.daan.a | 這條路會通到大安路。我們先轉身。 | This road leads to Da'an Road. Let us turn around. |
| recover.daan.b | 再沿著醫院牆面往回走，會看到玻璃自動門。 | Follow the hospital wall back until you see the automatic glass doors. |
| recover.canopy | 綠色頂棚的長廊是側邊通道。左轉往仁愛路走2分鐘，大廳入口就在前面。 | The green-roofed corridor is a side passage. Turn left toward Renai Road. The lobby entrance is ahead. |
| arrived | 醫院入口，到了。進門之後，服務台在左手邊，可以帶你到下一站。 | This is the hospital entrance. The service desk is on your left inside. They can help you with the next step. |
| reanchor | 你附近看得到什麼？跟我說就可以。 | What can you see nearby? Just tell me. |
| photo.remind | 只拍招牌就好，別拍到人臉、車牌和病患資料。照片會交給 Google 辨識，我們不保存原始照片。 | Photograph the sign only. Keep faces, number plates, and patient information out of the picture. Google will read the photo. Nightingale does not save the original image. |
| photo.wait | 我看一下這張照片。 | Let me take a look at this photo. |
| photo.wait2 | 快好了。 | I am still looking. |

## Translation decisions

- Keep Chinese sign words on screen beside the English explanation, especially 急診 (Emergency), the two lane signs, 福華飯店 and the hospital name. Audio explains their meaning; it does not assert that every sign is printed in English.
- `recover.canopy` retains the turn and destination but omits the Chinese two-minute walking estimate, which is not a reliable pace promise for all walkers. Route coordinates, recovery pointer and canonical Chinese facts do not change.
- `photo.wait2` uses “I am still looking” rather than promising an almost-finished operation.
- The clinic sign 瀚群骨科 is preserved as Chinese with an “orthopedic clinic” explanation; an unverified official English proper name is not invented or accepted as a generic location alias.
- Proper names checked against primary sources: [Taipei Metro — Zhongxiao Fuxing and Exit 2 elevator](https://web.metro.taipei/pages2026/WebStation/010), [Taipei City Hospital — Renai Branch](https://english.tch.gov.taipei/News_Content.aspx?n=7CFFF52251AD7D0D&s=39BB2BE4093D9A5E), [City Hospital branch directory](https://english.gov.taipei/News_Content.aspx?n=C0DC89E2D264B498&s=63614FA8AD520DFC), [The Howard Plaza Hotel Taipei](https://taipei.howard-hotels.com.tw/zh_TW/Promo/1501).

Full UI inventory: start/route metadata, concise steps/full wording, exit and crossing confirmations, text entry/send, photo reminder/privacy/wait/error, voice input start/permission/stop/transcribe/review/cancel/error, cp2 YouBike follow-up, crossing-history confirm/cancel/expiry, recovery and arrival, help-card controls/speech/volume accessibility labels, voice selector/mute/replay/bike/water, and language control. English presentation uses stable action message identities, never matching or translating arbitrary server prose.
