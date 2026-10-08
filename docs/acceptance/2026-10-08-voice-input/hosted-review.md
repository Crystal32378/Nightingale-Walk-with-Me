# 中文語音受限預覽：部署證據獨立覆核

結論：**PASS_LIMITED_HOSTED_EVIDENCE_REVIEW**。後端來源、Docker build、ready revision、tagged API 與 Hosting 配對均有相符證據；正式 Cloud Run 流量仍為原 revision 100%，正式 Hosting release 未變。**iPhone X／LINE 語音流程為 Crystal 使用者回報 PASS；這不是 reviewer 獨立真機驗證，完整實走與正式導航發布仍 HOLD。**

Reviewer：`voice_independent_review`。2026-10-08 只讀部署資料、Cloud Run／Cloud Build／來源封存及 GET 健康檢查；GET 時間為 **12:21（Asia/Taipei）**。本次沒有新增 session、observation、錄音或付費模型呼叫。

## 來源與 runtime 核對

| 項目 | 獨立核對結果 |
|---|---|
| 已接受後端 SHA | `03bc45e7ce39b39ff2efda829a120f098f9acd6f` |
| 前端 SHA | `5d11a5006d0234443dd730503ab8e40d7a00eddb`，由 prebuild／frontend-build 配對記錄確認 |
| Cloud Build | `7f641538-b14a-48e6-a215-6c0e8b23a939`，唯讀 live 查詢為 **SUCCESS**；`run-docker-build` 使用 Dockerfile，於 `2026-10-08T04:16:48.250594Z` 完成 |
| Build source zip | 指定 generation `1791432898762491`；SHA-256 `3cb0f0764a963c8789251ba60e61dd4f3915fb345b836778f67d4066283385ca` 與 Cloud Build sourceProvenance 相符 |
| 來源內容 | 直接讀取該 source zip，**23／23 檔案**逐一與後端 `03bc45e` Git blob 比較完全相同，無額外檔案；包含 Dockerfile、audioUpload、transcriptionRoutes、lockfile、兩個 route fixtures |
| Runtime image | `sha256:030934220f23bb53da1089383a5f1085ea3270678d7e64c2744bdb7f17124f06`，與 Cloud Build results、部署收據、revision imageDigest 相同 |
| Revision | `nightingale-voiceinput20261008`，收據中的 Ready／ContainerHealthy／ContainerReady 皆 True；live service 的 latestReadyRevision 亦為此 revision |
| 邊界 | 1 CPU、512 MiB、maxScale 1、既有 service account；只有 `GOOGLE_CLOUD_PROJECT` 設定，沿用真 Vertex／Firestore 路徑 |

來源封存：`gs://run-sources-nightingale-walk-with-me-asia-east1/services/nightingale/1791432898.598882-9c08e5a2ee4045e0a128069153a2aa8c.zip#1791432898762491`。此 ZIP 與 `prebuild.json` 的 Git TAR 格式不同，沒有直接把兩種封存的 hash 當成同一值；以 ZIP provenance 和 23 個檔案內容完成鏈結。

**舊標籤限制：** service template 繼承的 `reviewed-sha=65de4d8` 已過時，不能當作本輪來源證據。上述 build source／Git bytes／image digest 已獨立核對；不需要為更新描述標籤而重部署。部署 README 的 prepared／pending 文案於覆核時仍待主代理更新，主代理已收到提醒。

## 正式流量與 Hosting 隔離

Reviewer 重新執行唯讀 `gcloud run services describe`：`nightingale-00010-ff2` **100%**。`nightingale-voiceinput20261008` 僅有 tag `voice-input-20261008` 與專用 URL，未配置一般服務流量百分比，**正式流量分配為 0%**；直接 tagged URL 請求仍會執行新 revision。舊 field-fix／photo-guard tags 保留。

已讀取補齊且 `status: success` 的 `hosting-after.json`，與 hosting-before 逐一比較：原有 `live`、`photo-check-20261008`、`field-fix-20261008`、`photo-guard-20261008` 的 release 物件全部相同。正式 live version 仍為 `cd96c56a42be2957`；新 preview version 為 `4381420ef196ddec`，其 config **沒有 API rewrite**，避免走正式 API。

新 channel 到期為 **2026-10-15 12:17:32（台灣時間）**。這是本輪受限預覽期限，不能直接當作評審期間永久可用的最終交件連結。

## Reviewer 自行做的 GET 與雜湊核對

- [Tagged API health](https://voice-input-20261008---nightingale-uwker3cn5a-de.a.run.app/api/health)：**200**、`{"ok":true}`。
- [預覽入口](https://nightingale-walk-with-me--voice-input-20261008-oajxumay.web.app/?flow=last300m&photo=1)：**200**；index SHA-256 `0761acf0bbf446dcbe29511d97a8ddac432311d665a816fc666ab4da9bda41d5` 與兩份收據相同。
- 線上 `assets/index-QAvXyCCs.js`：**200**、225282 bytes；SHA-256 `9d07880abd283445e2c715d4ce11ba6ac411429898b3e2baeb204f27fd14a083` 相符，內容包含正確 `voice-input-20261008` tagged API。
- 程式比較 `frontend-build.json` 與 `hosted-assets.json`：**89／89 hash 完全相同**。其中 **44 個中文戶外 WAV** 的記錄 hash 另外逐一與前端 `5d11a50` 的原始 Git bytes 比較，全部相符。此次 reviewer 沒有重新從網路下載全部 89 檔；其完整線上下載檢查來自主代理的 hosted-assets 收據。

第一個 Python GET 因本機 CA 路徑缺失而失敗；改用 `/etc/ssl/cert.pem` 後正常完成，全程沒有關閉 TLS 驗證。

## Hosted 功能證據的範圍

已讀取 `hosted-voice.json`、`hosted-guards.json` 及各自 procedure，確認 voice procedure 只替換麥克風來源／播放、沒有攔截或 mock API 回應：

- 主代理的 Chromium **154.0.8037.98**／desktop WebKit **26.5** 各一次真 MediaRecorder，使用已接受合成 Leda WAV；WebM／MP4 經 hosted FFmpeg、Vertex、Firestore 回 **200**。
- procedure 實際比較轉錄前後 session／lastAction 未變、audioCount=1、session record 沒有未確認文字、tracks 已結束；手動改字後 dblclick 傳送只增加一筆 observation，全部 API 指向新 tag。此處是**已覆核主代理收據與 procedure**，不是 reviewer 再次呼叫模型的結果。
- 14 次 observations 的 guard smoke 是**結構化合成輸入**與真 Firestore／HTTP 證據，覆蓋 crossing photo hold、walker confirmation、cp5 recovery hold、入口 ASK 與抵達；不構成新照片辨識、真定位或實走證據。沒有把 hosted guards 擴張成新的 pending continuation 真機接受結果。

Linux container 能啟動的證據缺口已由 Cloud Build SUCCESS／revision Ready 與 hosted 真音訊流程補齊。

## iPhone LINE 的使用者回報

本次覆核期間，主代理轉達 Crystal 對指定 iPhone LINE 短句流程的原話：**「錄音、改字、傳送都成功」**。因此將該項從 PENDING 更新為 **PASS_USER_REPORTED_IPHONE_LINE_VOICE_FLOW**。Reviewer 已讀取主代理保存的 `iphone-receipt.json`（`2026-10-08T04:24:45.247407Z`），確認原話、同一 preview、錄音／改字／明確傳送的範圍與 HOLD 限制相符；收據不包含原始音訊或真人轉錄文字。

此接受證據來自 Crystal 的使用者回報，不是 reviewer 在 iPhone 上獨立操作或量測；也不代表完整戶外路線、路況、照片辨識或正式導航驗收。沿用本次指定 preview 的短句錄音／改字／傳送範圍，不要求重做已回報成功的診斷。

來源文件皆位於 `docs/deployment/2026-10-08-voice-preview/`：`prebuild.json`、`revision.json`、`backend-deployed.json`、`traffic-before.json`、`traffic-after.json`、`hosting-before.json`、`hosting-after.json`、`frontend-build.json`、`hosted-assets.json`、`hosted-voice.json`、`hosted-guards.json`、`procedures/hosted-voice.cjs`、`procedures/hosted-guards.cjs`。程式安全覆檢另見 [independent-review.md](independent-review.md)。
