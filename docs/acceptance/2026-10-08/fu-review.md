# Nightingale 獨立驗收 — 2026-10-08

驗收角色：Crystal 本輪明確授權的獨立「福」驗收角色。依 `HANDOFF-Nightingale-acceptance-2026-10-08.md` 執行，使用 engineering:code-review 的正確性與證據核對方法。本報告不是作者自評，也不宣稱是另一個既存外部 agent。

## 判定

| 項目 | 判定 | 理由 |
| --- | --- | --- |
| 評測／資料／語音資產準備 | **PASS** | 57 筆人工標註忠實匯入、來源與雜湊吻合；同方法的前後評分可重現且限制明載；44 音檔與來源原件相符；固定播放與取消流程通過窄範圍瀏覽器驗證；提交範圍符合交接。 |
| 本輪提議的手機／實地導航部署 | **HOLD** | 現行引擎仍有可達的提前過街確認與錯誤回復指令，未修復也未從部署範圍排除；歷史辨識輸出與合成定位不足以驗證現行手機照片導航。沒有 deployment PASS，Astra 這一輪不應部署。 |

**本次未發現由資料匯入或固定音訊接線新引入的必修缺陷。部署阻礙是凍結版本仍存在的導航行為與驗證缺口。** PASS 僅接受準備成果，不接受整趟導航安全或對外可用性。

凍結目標已於驗收前後確認：

- 後端 `/Users/crystalchang/Desktop/Fable Suite/nightingale`：`feat/photo-eval-gates`，`2bdf76d5e494a1d7a1baeac10de26d2c923ff77c`，比較基底 `ea23c83`。
- 前端 `/Users/crystalchang/Desktop/Opus Chamber/Nightingale`：`feat/photo-gates`，`f4016ba8b0b009aa209cbbcfc72b5487823da913`，比較基底 `4dd9327`。
- 未修改兩個 repository 的 tracked 檔案、labels、route 或音檔，未 commit、push、部署或呼叫付費模型。測試僅使用暫存輸出及既有本機測試服務。後端保持 clean；前端保持交接已列的既有 untracked 檔案。

## 部署阻礙，依優先序

### P1 — 位置未到，現行引擎已發出過街指令（既有缺陷）

已直接把提交的 saved observation 送入凍結版本 `step()`，不依賴作者摘要：

| 保存案例 | 人工地點／變形 | 當前 checkpoint | 實際結果 |
| --- | --- | --- | --- |
| `第二趟/jpg/IMG_5591.jpg` | `fuxing_west`／small | cp2 | 辨識成 `仁愛路三段123巷13弄`，回 `GUIDE:cp2`「等綠燈，過復興南路。」並前進到 cp2x。人工文字是 `FamilyMart`、`復興南路一段219巷`。 |
| `第二趟/frames/IMG_5600_f1.jpg` | exit2／crop | cp2 | 無定位時回 `GUIDE:cp2`；合成 exit2 zone 才擋下。 |
| `S__121634854_0.jpg` | `fuxing_east`／orig、small | cp3 | 讀到 `瀚群骨科`，回 `GUIDE:cp3`「等綠燈，過仁愛路。」並前進到 cp3x。 |

全部 99 張、五種影像條件：none 模式 4 件、place 模式 3 件，共 7 個提前確認案例；同圖不同變形／定位模式不是獨立事故。兩個 Fuxing 地點在 place 模式仍是 `unknown`，所以不能把這三件解讀成可靠 GPS 仍誤判，也不能宣稱實際手機定位會擋住它們。

機制：後端 [validator.ts:83](</Users/crystalchang/Desktop/Fable Suite/nightingale/src/validator.ts:83>) 接受一個符合的 registered expected term；[engine.ts:102](</Users/crystalchang/Desktop/Fable Suite/nightingale/src/engine.ts:102>) 與 `zoneRule()` 在 unknown 時不 veto 一般 checkpoint，接著輸出 GUIDE。前端 [outdoorVoice.ts:10](</Users/crystalchang/Desktop/Opus Chamber/Nightingale/src/remote/outdoorVoice.ts:10>) 會忠實播出相應過街錄音。聲音映射本身正確，但會使既有錯誤指令成為可聽見的導航指令。

解除條件：針對上述已保存案例，明確決定並驗證能避免提前過街指令的窄修；或把照片／文字自動判路從本次測試部署實際隔離，再重新提出明確範圍供驗收。不可只以「這是測試版」或假設一定有準確 GPS 排除。

### P1 — 室內樓層牌會觸發急診車道回復指令（既有缺陷）

`S__121634865_0.jpg` crop、`S__121634868_0.jpg` crop、`S__121634867_0.jpg` orig，人工位置均為 inside，在 cp5 無定位時共 3 件 `RECOVER`。已直接重現 867 orig：輸出「那是急診的車道口。大廳入口還在前面一點。」

後端 [engine.ts:68](</Users/crystalchang/Desktop/Fable Suite/nightingale/src/engine.ts:68>) 的 conflict zone 只在已有非 unknown 位置且位置不符時 veto。室內告示包含「急診」，不足以判定人位於急診車道。合成 lobby zone 能擋下，但這是標註推導的位置，不是室內真機定位證據。

前端刻意不播放身分不明的 `RECOVER:cp5` 音檔，這是正確的聲音限制；錯誤回復文字仍會顯示，不能因此視為已修復。解除條件是補上此三例的正確 runtime 行為或在測試範圍中真正排除相關導航功能，再驗證。

### P2 — 本批 replay 不能替代現行手機導航驗證（已揭露的限制）

- 評分器 [eval/score.ts:65](</Users/crystalchang/Desktop/Fable Suite/nightingale/eval/score.ts:65>) 每格從 `AT_CHECKPOINT`、`questionCount: 0` 呼叫一次 `step()`；reachable 只按標註位置是否位於前後兩 checkpoint 間判定，沒有走完整 session。
- [engine.ts:107](</Users/crystalchang/Desktop/Fable Suite/nightingale/src/engine.ts:107>) 對 arrival evidence 在 unknown／ask zone 先問一次，之後可接受。因此 0 個第一步 false arrival 不能當成後續提問或完整路線保證。本次額外以原判為 reachable 的 cp5 ASK 案例，重送相同保存 observation 一次，沒有找到新增 false arrival；這個窄檢查也沒有涵蓋不同照片／不同回覆的連續流程。
- 495 readings 來自 `2026-09-28T13-45-15-303Z`，不是本日模型結果；舊詞彙多出 8 個已移除 terms。延遲、timeout 及錯誤也是舊紀錄。
- 未驗收本次凍結版本的 iPhone Safari、真實相機上傳到現行 Vertex、實際定位、行動網路、戶外音量／可懂度、跨步完整走行、Hosting／Cloud Run 新版本部署組合。Chrome 手機尺寸 viewport 不是 iPhone。

此項不是要求在未部署前虛構一份戶外驗收。先處理 P1，或提出真正隔離的測試範圍；之後才能討論受限手機測試部署與其停損／驗收步驟。本報告不批准那個尚未具體提出的替代部署。

## 準備成果的獨立核對

### 資料、人工文字與媒體保管

- Downloads 原始 `nightingale-trip2-review-2026-10-07.json` 與 committed `human-review.json` 逐 byte 相同，SHA-256：`d010f80aa660d250078c0ca8be13a4578ccd95f46558977eba4a1886801e7135`。
- 57 筆唯一檔名、57 筆 `reviewed: true`、export 狀態 `reviewed`；主 labels 的 place／expect／optional 與 export 逐項相等，包含 `急診室哭`，沒有自行猜字修字。
- `labels-before.json` 與 `git show ea23c83:eval/photo-labels.json` 逐 byte 相同，SHA-256：`28e928558d77d54945270b1a33d0c08a3b1db99974203d649c8f99f78773e85b`，與 export 的 source hash 相同。
- 15 筆文字欄位變更，只有 `IMG_5595.jpg`、`IMG_5596.jpg` 另由 lane 改為 fuxing_west；首趟 42 筆逐物件相同。
- route hash `3c0ca31f831c4254d82b2cc7a66233f39f0ab308099a6d111c2f25e9411152f8` 與前一 commit 相同；`git diff ea23c83..HEAD -- src fixtures` 無差異。
- 所有 99 個 label 引用的本地影像檔案存在。`field trip photos/` 仍 ignored，`git ls-files 'field trip photos'` 為空；本次 Git 變更無 jpg／HEIC／MOV／MP4 實地媒體。
- 匯入器的五項測試在 TemporaryDirectory 內運作；成功／拒絕匯入測試沒有重寫實際 repository。

### 評分方法、來源與重現

before／after 的 exact-term projection 均獨立逐列重算，結果及 audit 完全相同。它只挑出大小寫不敏感、最長不重疊 registered substring；主 labels 仍保留完整人類文字。`FamilyMart` 不進分母，`急診 右車道 左車道` 只貢獻 `急診`；這是 grading 輸入，不是新增路線真相。

原始完整讀取輸出 `eval/out/2026-09-28T13-45-15-303Z.json` 確實存在，hash 為 `e89bc9bc4a1be80d5071e70b2052871f8b4b39b74f792782e2756b23efeb193b`。`runId`、`vocabulary`、495 筆 `readings` 與 committed 保存版逐物件相同。保存版 hash 為 `7c81740be807862edf54302664d0d49521e33147a875c0e839a8e94b60bca450`。

已重跑 before-projected、after-projected、trip2-projected、after-verbatim；四組的 rows、failures、unsupported、route／labels／source hashes 與提交結果相同。`summary.json` 的 rows、reachableFailures、totalsByLocation 亦相符。

| 範圍／模式 | 提前確認 | 誤報抵達 | 錯誤回復 |
| --- | ---: | ---: | ---: |
| 全 99 張，none | 4 | 0 | 3 |
| 全 99 張，place | 3 | 0 | 0 |
| 第二趟 57 張，none | 2 | 0 | 0 |
| 第二趟 57 張，place | 1 | 0 | 0 |

上述都是五種影像條件合計。第二趟 orig 在兩模式均為零上述失敗，但其餘條件仍有錯誤。original registered-term recall 是前 21/21、後 26/28，第二趟 8/10；分母已改，不能稱為模型進步或退步。一次 error 從評分排除，timeout 保留 empty observation，沒有被偽裝成成功讀取。

再用本次 replay 輸出 replay 一次，`readingVocabulary` 保持原值、`vocabularyMatches: false` 且 rows 相同。已移除的八詞為：`1號電梯`、`2號出口`、`SOGO復興館`、`YouBike`、`二號出口`、`出口2`、`出口二`、`復興南路`。沒有新詞，因此這仍不是當前 prompt 的新模型評測。

### 語音資產與實際播放

- 22 句共同文稿、Leda／Puck 共 44 檔；44 檔 SHA-256、manifest 秒數、mono／24 kHz／16-bit PCM 全相符，非空且本批樣本峰值未達滿刻度。
- 44 檔逐一與兩批來源原檔比 hash，一致且原檔仍存在；22 檔 revised 與 committed `accepted-audio.json` 及原批次 `recordings.json` 的 approved 紀錄相符；另 22 檔為 inherited。此核對接受 Crystal 的聆聽裁決，不把訊號檢測當成發音驗收。
- `routeId + action.type + checkpointId` 固定選片，server prose 不被朗讀。RECOVER:cp5 因三種回復共用身分保持無導航錄音；未掛載的 cp1.board／cp5.lobby 與 recovery 素材仍保留。
- 重跑既有 `scripts/check-outdoor-browser.cjs` 成功：Chrome 390×844、實際本機頁面／API、音檔 HTTP 200、Web Audio buffer 啟動、cp2 過街後才播 after→along、Puck 切換、靜音取消隊列、幫我問擋住延遲導航語音；無 page error、無水平溢出。已親自檢視本次 crossing／after-crossing 截圖。
- 額外用瀏覽器攔截 cp2.after 回 404：保留「右轉直走」、沒有抓取 cp2.along、沒有呼叫裝置 TTS。額外走到第二個 cp3 過街：照片、重播、補充提醒均未呈現，按「過完了」後才載入 cp3.after 並顯示「左轉找入口」。無 page error。
- 取消、換步驟、mute、missing key／download 失敗由 unit tests 與上述窄 browser cases 共同驗證；離頁清理由 player.dispose／hook cleanup 檢視確認，未宣稱涵蓋所有手機背景切換情境。

額外瀏覽器腳本第一輪因在 click 後才等待已發生的 response 而 timeout；改成先註冊 response wait 再 click 後通過。這是驗收腳本競態，沒有修改產品程式，也沒有當成產品失敗。

### Git 範圍與工程檢查

- 後端本次 23 檔，全部文字資料／程式／文件；前端 63 檔，其中 44 WAV、5 張 UI QA PNG。無實地原始照片／影片、env 或 service-account credential 檔案。本次變更文字的常見私鑰／GCP／GitHub／AWS credential 格式掃描未命中；沒有把此結論擴張為整份 Git history 的掃描。
- 後端 `npm test`：9 files、84 tests PASS；`npm run typecheck` PASS；`PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p 'test_import_trip2_review.py'`：5 tests PASS。
- 前端 `npm test`：23 files、267 tests PASS；`npm run build:hosting` PASS。
- 部分評測測試刻意斷言某輸入會被評為 false_confirm／false_conflict；測試綠燈代表評分器分類正確，並不代表導航已無這些錯誤。

## 最小重現與下一步

在後端目錄執行以下程式，只讀本地檔案，不觸發模型或網路，即可重現兩種提前過街與一種錯誤回復：

```bash
./node_modules/.bin/tsx --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { step } from './src/engine.ts';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const route = read('fixtures/route-renai-001.json');
const readings = read('eval/reviews/trip2-2026-10-07/saved-readings.json').readings;
for (const [file, variant, checkpointId] of [
  ['第二趟/jpg/IMG_5591.jpg', 'small', 'cp2'],
  ['S__121634854_0.jpg', 'orig', 'cp3'],
  ['S__121634867_0.jpg', 'orig', 'cp5'],
]) {
  const r = readings.find(r => r.file === file && r.variant === variant);
  const s = { routeId: route.routeId, state: 'AT_CHECKPOINT', checkpointId, questionCount: 0 };
  console.log(file, step(route, s, r.observation).action);
}
JS
```

完整重跑 after-projected 的命令：

```bash
./node_modules/.bin/tsx eval/photo-eval.ts \
  --replay eval/reviews/trip2-2026-10-07/saved-readings.json \
  --labels eval/reviews/trip2-2026-10-07/labels-after.route-terms.json \
  --out /tmp/nightingale-fu-acceptance/after
```

本次獨立暫存證據：`/tmp/nightingale-fu-acceptance/{before,after,trip2,verbatim,twice}/`、`/tmp/nightingale-voice-browser-result.json`、`/tmp/nightingale-fu-audio-extra.json`、兩張 `/tmp/nightingale-*-crossing.png`。暫存檔不作長期保存保證；上述 committed 輸入與重現指令才是可持續重驗的依據。

下一輪只需就 P1 已列案例提出窄修或明確隔離的手機測試方案，連同序列驗證及現行模型／手機條件的驗證安排交回獨立驗收。這份報告保留 **準備 PASS／部署 HOLD**；不授權自行變更 route、重新錄音或先部署再補驗收。
