# 最新狀態：英文已完成受限部署，接 demo／deck

更新2026-10-08。英文完整操作、44個獨立英文音檔、獨立覆檢、配對受限部署與hosted驗證已完成。最新網址：https://nightingale-walk-with-me--english-20261008-q4gion1y.web.app/?flow=last300m&photo=1&lang=en ，11/07 13:27台灣時間到期。

後端runtime34bc9be、前端runtimecdb9da5；revision `nightingale-english20261008`正式流量0%，原正式revision100%。source/expiry/133檔與88WAV hash/17turnEnglishflow/語音重測收據見`docs/deployment/2026-10-08-english-preview/README.md`和`state.json`。

Crystal說英文初樣太慢、咬字用力，要求正常語速；新版已回覆「這版可以，全部用正常語速」，兩段地名也回覆「兩句地名都可以」。6段個別人審，38段machine/hash/content checks；不把44段全部寫成人審通過。中文44段與路線事實未改。第一次hosted合成聲音尾詞辨識差異保留；測試起音時點修正後兩browser通過，不宣稱ASR永遠正確。

英文GitHub發布基準為兩repo的 `en-preview-2026-10-08`，原中文兩tag保留。接著錄固定版英文demo及deck/PDF。English真機／印度隊友walkthrough未宣稱完成；Chinese iPhone LINE短句流程已由Crystal回報成功，不重做診斷。完整戶外與正式導航發布HOLD，影片與最後提交仍由Crystal確認。

下方中文交接保留作歷史基準。

---

# Nightingale 交接 — 中文語音輸入完成，接英文版

更新：2026-10-08（Asia/Taipei）。下一階段順序：保存中文基準後 → 依 `docs/english-preparation.md` 做完整英文流程 → 驗證／獨立複驗／受限部署／再次保存 GitHub → 固定版本英文 demo、deck／PDF。正式導航發布與影片／比賽最終提交仍由 Crystal 確認。

## 本輪結果

**中文語音輸入實作、獨立覆檢、受限配對部署與線上測試均通過；Crystal 回報 iPhone LINE「錄音、改字、傳送都成功」。** 此為指定短句流程的真機回報，不是完整戶外導航驗收。

- 點擊才錄音，最長 15 秒；停錄後釋放麥克風，短句傳至既有 Vertex 轉成可修改文字。使用者按「傳送」才進原有文字判路。
- 起點 walker 確認、兩次過街、pending 位置確認與抵達不提供錄音；取消、背景、幫我問、步驟變更與離頁釋放 tracks／timer／暫存內容。
- 原始音訊及未確認文字不寫入 Firestore 或一般 application logs；Firestore 只新增 numeric audioCount。Google 自身保留政策不能推成永不保留。
- 後端有實際 bytes／音訊解碼／大小／時長／配額限制。獨立 reviewer 抓到 stalled upload blocker，已在 `03bc45e` 修正並以真時間重現複驗。
- 前端 337 tests、後端 161 tests、typecheck/build、真桌面 MediaRecorder WebM／MP4＋hosted Vertex／Firestore通過。兩者不混稱 iPhone 實測；iPhone證據來自 Crystal 原話。
- 原 route fixture、照片基準與 44 個中文定稿 WAV 保持不變。不要重做照片診斷或中文試聽。

## 最新受限預覽

https://nightingale-walk-with-me--voice-input-20261008-oajxumay.web.app/?flow=last300m&photo=1

到期：**2026-10-15 12:17 台灣時間**。API：`https://voice-input-20261008---nightingale-uwker3cn5a-de.a.run.app`。

- 後端 runtime `03bc45e7ce39b39ff2efda829a120f098f9acd6f`。
- 前端 runtime `5d11a5006d0234443dd730503ab8e40d7a00eddb`。
- revision `nightingale-voiceinput20261008`，tag/channel `voice-input-20261008`；min 0/max 1、正式流量0%。
- 正式 `nightingale-00010-ff2` 仍100%；正式 Hosting及3個舊preview release未變。新部署前仍需重查當下狀態。
- `reviewed-sha`為繼承的舊label，不作此版來源證據；independent hosted review已核對Cloud Build source zip 23檔、Git blob、image digest與ready revision。
- 後續文件commits不同於runtime SHA；原 `zh-tw-preview-2026-10-08` tags不移動。兩repo維持既有分工，正常保存，不force push／rebase／改作者。

## 證據與圖源

- `docs/acceptance/2026-10-08-voice-input/independent-review.md`：程式與stalled-upload獨立複驗。
- `docs/acceptance/2026-10-08-voice-input/hosted-review.md`：部署provenance／流量／hosted證據覆核。
- `docs/acceptance/2026-10-08-voice-input/iphone-receipt.json`：Crystal真機流程回報。
- `docs/deployment/2026-10-08-voice-preview/README.md`、`state.json`：runtime配對／期限／撤回與所有收據。
- `docs/architecture/README.md`：判路總圖與語音sequence，各有Mermaid可編輯源、SVG、PNG；英文完成後更新同份圖。
- `docs/handoffs/2026-10-08-photo-to-voice.md`：本輪前的完整照片／文字交接，作歷史背景。

## 接續限制

英文涵蓋整個操作流程、錄音權限／錯誤、追問與cp2恢復；保留中文真實招牌作route evidence，英文僅呈現。英文音檔用獨立目錄／manifest，先審稿與小樣；中文44檔不覆蓋。家屬LINE路線卡不插入本輪。

原始實拍照片／影片仍留後端 ignored `field trip photos/`。前端`.h3-tasks/`、briefings、`nightingale-*`工作目錄、`videos/`保留，不提交；不要`git add -A`。

建置從乾淨Git archive，使用 `VITE_LAST300M_API=<tagged HTTPS API> npm run build`，不要 `build:hosting`。Dockerfile已帶FFmpeg；舊buildpack服務首次用Dockerfile時需 `--clear-base-image`。Hosting到期不會移除Cloud Run tag；清理只限指定版本，舊photo-check仍共用field-fix，勿順手刪除。

正式導航與完整戶外接受保持HOLD；中文語音短句流程的成功不擴張為所有瀏覽器／所有手機或全路線實走通過。
