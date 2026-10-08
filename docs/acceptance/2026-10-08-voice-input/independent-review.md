# 中文語音輸入獨立覆檢 — 2026-10-08

最新結論：**PASS_CODE_REVIEW_FOR_LIMITED_PREVIEW**。初次發現的 R1 上傳期限 blocker 已在後端 `03bc45e` 修復，獨立複驗通過；沒有待修的程式覆檢 blocker。可進入已授權的受限 preview 建置／部署與 hosted 驗證階段。這不等於 Linux container、hosted 或 iPhone LINE 已驗收；正式導航／正式流量維持 HOLD。

Reviewer：獨立 agent `voice_independent_review`，未參與實作；採用 `engineering:code-review`，發現異常後依 `systematic-debugging` 以暫存程式重現。只讀實作、執行本機檢查及撰寫本報告；未修實作、未部署、未推送。

## 版本與範圍

- 後端：`20c720c..f2bee82379494d4ae32caa58e907875a638ce6c4`。
- 修復複驗：`f2bee82..03bc45e7ce39b39ff2efda829a120f098f9acd6f`；**目前接受的後端程式版本為 `03bc45e`**。
- 前端：`9aa1e9c..5d11a50`，checkout 為 `/Users/crystalchang/Desktop/Opus Chamber/Nightingale`。
- 契約來源：`docs/voice-input-next.md`、`docs/superpowers/specs/2026-10-08-voice-input-design.md`。
- 下列初次覆檢行號對應上述版本；修正版本與複驗結果應在本報告後續節次另記。

## 阻擋問題

### R1 / P1：未完成上傳超過 28 秒仍占住 instance 唯一轉錄名額 — 已修復並複驗

位置：後端 `src/transcriptionRoutes.ts:26`、`:38-45`、`:66-67`。

`active = true` 後，handler 等待 `c.req.arrayBuffer()`；28 秒 timer 只 abort 自建 controller。該 signal 沒有傳入 body reader，也沒有與本文讀取競速，故本文不結束時不會抵達 `finally`。同一 instance 的其他正常請求持續收到 `429 transcription_limited`。Hono `bodyLimit` 在有 Content-Length 時直接交給 handler；沒有 Content-Length 時，middleware 本身又會在 handler／deadline 之前無期限讀 stream。前端自己的 30 秒 timeout 不能替匿名 HTTP endpoint 建立伺服器資源邊界。

獨立重現使用真實 Hono `app.fetch(Request)` 與可控制的 ReadableStream；只有 decode／Vertex 為 seam。建立合法 cp2 session，宣告 `Content-Length: 16`，只送入 4 bytes，不關閉本文：

```json
{"elapsedMs":29005,"firstSettled":false,"nextRequestStatus":429,"nextRequestBody":{"error":"transcription_limited"},"modelCalls":0}
```

手動補完本文後，第一請求才回 `504 cancelled`；接著正常請求立即恢復 `200`。這定位到本文等待與名額釋放，並非模型延遲。未對 hosted endpoint 做攻擊測試。

修復接受條件：有／無 Content-Length 的本文皆有實際 byte 上限與上傳 deadline；timeout／client abort 會取消 reader、結束請求且釋放 `active`，不觸發模型、不增加 session 音訊額度；下一個正常請求可成功。佔住名額期間的 store await 亦應受同一請求期限約束，避免相同問題轉移到後續 I/O。

暫存重現：`/tmp/nightingale-voice-independent-review.mts`；不屬於 Git 交付物。初次覆檢因此給予 REQUEST_CHANGES；修復複驗如下。

### R1 修復複驗：`03bc45e`

`src/audioUpload.ts:5-43` 改為直接讀 stream，實讀 2 MiB 上限、8 秒上傳 timeout、signal abort 與 reader.cancel；取消來源的 promise 即使永不完成，也不阻塞 HTTP 回應。`src/transcriptionRoutes.ts:28-37,39-71,80-82` 為完整工作加入 28 秒 Promise.race，所有 await 後檢查 signal，由取得名額的該次請求釋放名額。遲到的 store 結果不能再啟動 Vertex。

Reviewer 另寫 `/tmp/nightingale-voice-independent-retest.mts`，使用真實時間、真 Hono Request／ReadableStream，分開建立 session／app，沒有依賴新 regression 的 fake timer：

| 獨立情境 | 實際結果 |
|---|---|
| 有 Content-Length、4 bytes 後停住 | **8004 ms** 回 504 `audio_upload_timeout`；reader cancel 1 次；下一筆正常請求 200 |
| 無 Content-Length、4 bytes 後停住 | **8005 ms** 回 504；reader cancel 1 次；下一筆 200 |
| 無 Content-Length，且來源 cancel promise 永不 resolve | **8005 ms** 回 504；名額釋放；下一筆 200 |
| client 在讀取本文時 abort | 回 504；reader cancel 1 次；下一筆 200 |
| 宣告 16 bytes，實際提供超過 2 MiB | 回 413；reader cancel 1 次；下一筆 200 |
| quota store.update 停住，timeout 後才放行 | **28002 ms** 回 504 `transcription_timeout`；下一筆 200；放行舊 transaction 後，模型總呼叫仍只有新正常請求的 1 次 |

前三個上傳 timeout 另外 assertion 確認：模型呼叫 0、audioCount 未寫入。後端全測再次由 reviewer 重跑，**161／161** 與 typecheck PASS。前端未變，沿用同次覆檢的 337 項、建置及雙 browser PASS。

資料庫 transaction 本身沒有在此新增取消 API；已送出的 numeric quota transaction 仍可能在 HTTP timeout 後完成。此修復保證 HTTP／slot 期限及遲到操作不會啟動模型，不宣稱底層 Firestore RPC 被強制終止，也不會將音訊／未確認轉錄寫入該 transaction。

## 已獨立確認的行為

| 範圍 | 程式證據與檢查 | 結果 |
|---|---|---|
| 未確認轉錄不推關卡 | 前端 `VoiceInput.tsx:39-43` 只呼叫 transcriptions／填入 draft；`Last300mPage.tsx:268-274` 的明確 submit 才呼叫 observe。後端 endpoint 不呼叫 engine；route test 比較轉錄前後 session／lastAction。 | PASS，本機 |
| 確認後只送一次 | 既有 `useLast300m` 的 inFlight ref 保留；browser harness 修改辨識文字後 dblclick 傳送，只收到一筆文字 observation。 | PASS，桌面攔截 API |
| cp1、兩次 crossing、pending／arrival 禁錄 | 前端 `Last300mPage.tsx:312-352` 不掛載 VoiceInput；後端 `transcriptionRoutes.ts:19-22` 由 route 的 walker 與 pending／ARRIVED 判斷。額外重現也確認 cp1 回 409，原有 tests／browser checks 覆蓋 cp2x、cp3x、pending。 | PASS，本機／桌面 |
| 取消與遲到 permission | `voiceCapture.ts:34-43,50-56,93-98` 的 generation token、track.stop、AbortController 與清除 chunks；單元測試重跑取消後 grant、12 秒 permission timeout 後 grant、遲到 transcript。 | PASS，本機 |
| 停錄／背景／幫我問／step change | `voiceCapture.ts:75-88` 停止 tracks 後轉錄；`VoiceInput.tsx:47-58` 監聽 visibilitychange／pagehide 及 dispose；`Last300mPage.tsx:348,361` action key 與 help cancel。browser 重跑 cancel／help／pagehide；step unmount 與 visibility 路徑另外做程式追查。 | PASS；visibility／任意外部 step 競態主要為程式證據 |
| 不收進自己播放 | `Last300mPage.tsx:199-213,350` 開始前停止播放／speechSynthesis，錄音與轉錄期間 inputActive 阻擋播放，播放控制 disabled。browser 檢查 capture 期間 playback count 不增加。 | PASS，桌面 |
| 音訊與時長 | `audio.ts:11-15,29-64` 檢查 MIME／container，真正 FFmpeg 解碼；2 MiB、16 秒 decoded PCM、至少 0.2 秒、5 秒 decoder deadline；pipe only、無 shell／暫存檔，decoder stderr 丟棄。實際 WAV 解碼與假 MIME、空 payload、17 秒、oversize tests 重跑。 | PASS，本機 FFmpeg；上傳時間另見 R1 |
| 成本／模型輸出 | `transcriptionRoutes.ts:15-17,32-38,47-54`：12/session、6/client/min、10/instance/min、1 active；quota 以 store.update 累加，decode 失敗不花 session quota／模型。`transcription.ts:7-38,49-57`：500 字元與控制字元限制、單一 JSON text、600 output tokens、20 秒 real Promise.race、429 分流。 | PASS，本機；整體 request deadline 另見 R1 |
| 原始資料不持久化 | 新音訊／轉錄路径沒有 file／Firestore／application-log 寫入；`store.ts:86-105` 只新增 numeric audioCount。route test 確認未確認字串不在 session record。前端只放 React draft。這不代表 Google 的保留政策。 | PASS，程式／本機 store |
| 原有文字、照片、pending ID、入口與抵達 | 兩邊完整測試重跑，包含 text-follow-up、textContinuation、photo-context-guard、route-renai、engine、outdoorVoice。此次沒有變更 route fixture／44 個固定中文 WAV。 | PASS，本機回歸 |

成本窗口是 instance 記憶體限制，會隨 scale-out／restart 改變；不應稱為專案全域絕對費用上限。此限制為程式可見範圍，部署前仍須核對實際 max instances。

## Reviewer 自行執行的驗證

- 後端：`FFMPEG_PATH=/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1 npm test`，**157／157**；`npm run typecheck` PASS。
- 前端：`npm test -- --run`，**337／337**；`npm run typecheck` PASS。
- 前端 production build：`VITE_LAST300M_API=https://review.invalid npm run build -- --outDir /tmp/nightingale-voice-review-dist` PASS。刻意使用測試用無效 API origin，僅證明建置可完成；不屬於可部署的配對 bundle。
- 重跑既有 `scripts/check-voice-input-browser.cjs`：Chromium **154.0.8037.98**／desktop WebKit **26.5**，390×844；真 MediaRecorder、合成 oscillator、攔截 API。此次 WebM **5642 bytes**、MP4 **2788 bytes**；無 auto-send、可編輯、單次傳送、取消保留草稿、help／pagehide 停 tracks、兩次 crossing／pending 禁錄、無 pageerror／水平溢出皆通過。WebKit 的 MIME 能力表限制為 native MP4；不能視為 iPhone LINE 實測。
- 獨立 slow-body 重現得到 R1；另驗證 cp1 API 不可轉錄。

## Docker／正式依賴的證據界限

`Dockerfile:1-11` 的靜態檢查通過：Node 22、distribution FFmpeg 與 CA certificates、`npm ci --omit=dev`、非 root `node`。`tsx` 已列於 production dependencies；兩個 index.ts 引入的 fixture 都在 `.dockerignore` allowlist。

Reviewer 用 `git archive f2bee82` 抽出 Dockerfile／package／src／必要 fixture／tsconfig 到全新暫存目錄，執行實際 `npm ci --omit=dev --no-audit --no-fund`，130 packages 安裝完成；Node **v22.23.1** 下以 `npm start` 啟動並取得 `/api/health = {"ok":true}`，同時確認 `node_modules/typescript` 不存在。未設定 GCP project，這是正式依賴／啟動檢查，沒有呼叫雲端模型。

本機 `docker info` 未在可用時間內回應，已終止該唯讀檢查；**未成功 build/run Linux Docker image**。以上 macOS 啟動與本機 FFmpeg 不取代 Cloud Build image、Cloud Run runtime、hosted 真轉錄的證據。此處沒有發現靜態 runtime blocker，正式 image 可執行性仍須在修復 R1 後以受限部署階段驗證。

## 他人提供且已讀取的補充證據

- 主代理的 `local-vertex.json`：本機 Node 到真 Vertex `gemini-2.5-flash`，使用既有合成 Leda reanchor WAV，**1595 ms**，回傳 `你附近看得到什麼,跟我說就可以`。這不是 reviewer 重跑，也不是真人／hosted 錄音。
- 主代理 `local.md` 記載桌面真 MediaRecorder WebM／MP4 經真 FFmpeg 解碼為 **0.60／0.66 秒**。Reviewer 自行重跑了 browser 與 WAV decoder tests；沒有把這兩筆特定 blob 的額外解碼稱為自己的重跑。

## 尚缺的接受證據

1. clean paired preview 的真 Linux container／hosted Vertex／原正式流量保留證據。
2. 一次 iPhone X／LINE 真麥克風錄音、可編輯文字、明確確認後送入既有文字流程的接受證據。

本機 PASS 不能取代上述階段。未宣稱完整戶外行走、正式導航發布或比賽最終提交已通過。
