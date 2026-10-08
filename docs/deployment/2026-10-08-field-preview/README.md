# 實走修正版：受限預覽部署

更新：2026-10-08（Asia/Taipei）。Crystal 已於本次對話同意更新受限預覽；正式發布仍 HOLD。

[新的 iPhone LINE 測試連結](https://nightingale-walk-with-me--field-fix-20261008-ac1wlluu.web.app/?flow=last300m&photo=1)

到期：**2026-10-15 上午 10:22，台灣時間**。服務端時間為 `2026-10-15T02:22:07.087778608Z`。

## 已部署的來源

- 後端：`0f9e345078d50a1c937dcfc09596094e0c436c5b`，revision `nightingale-fieldfix20261008`。
- 前端：`80d1ce46b14bac867ae6225c9a08d399f97c9e4c`。
- Cloud Run tag／Firebase preview channel：`field-fix-20261008`。
- Tagged API：`https://field-fix-20261008---nightingale-uwker3cn5a-de.a.run.app`。
- 兩邊從上述 commit 的乾淨 Git archive 建立，前端明確編入 tagged API；後端只上傳 17 個 runtime／package／fixture 檔案。`.env.example` 未包含在前端建置 archive；無原始實拍媒體、憑證或本機工作資料上傳為部署來源。
- 建置使用 `VITE_LAST300M_API=<tagged-api> npm run build`；preview config 無 `/api` rewrite。原有正式 Hosting release 與原預覽 release 均未改動。
- 新後端正式流量為 0%，revision min 0／max 1；原 `nightingale-00010-ff2` 保持正式流量 100%。service account 保持原值。
- 修正與本次部署紀錄已在本機 Git 保存；本輪尚未推送 GitHub。

來源、映像 digest 與部署前後狀態分別見 `prebuild.json`、`backend-deployed.json`、`hosting-before.json`、`after-state.json`、`state.json`。建置暫存位置只是本輪收據，不是未來重建的來源；未來從上述 commit 重建。

## 線上驗證

- Health API 200；已發布 JS hash 與本機預覽 build 相同。預覽 `/api/health` 為 404，沒有導回正式 API。
- 44 個線上 WAV 全部符合已驗收 SHA-256。
- 14 次合成 observation 操作經真實 API／Firestore 通過：未知位置照片停住、相符地標與區域才前進、兩次過街都需 walker 確認、急診 recovery guard 與入口 ASK／抵達規則保留。這些不是新模型照片辨識。[結果](hosted-guards.json)
- 桌面 WebKit 26.5、390×844，實際開啟新預覽：透過新版前端處理並上傳一張既有 `IMG_5593.jpg`，照片計數為 1，模型讀到「大安路一段116巷」「仁愛路三段123巷13弄」等字。沒有定位時，後端依原規則停在 cp2；沒有出現「照片我打不開」。原圖 bytes 不包含在本資料夾或 Git。
- 同一線上 UI 以實際文字 API 操作：「youbike站」追問路牌；「仁愛復興路口」出現完整確認；取消後保持 cp2，舊確認重送回 409；重新確認才進第二次過街；其後入口 ASK 與抵達完整通過。頁面無 JS error、無橫向溢出，API 全部指向新 tag。[結果](hosted-webkit.json)
- 此次測試紀錄中有 **一次文字模型 429 RESOURCE_EXHAUSTED**，系統使用既有確定性文字備援繼續，整趟仍通過。不能宣稱所有模型呼叫都成功；沒有為了消除這筆失敗重跑或改寫紀錄。

上述為桌面 WebKit＋實際雲端的有限驗證。尚未完成 iPhone X／LINE 的原生相機、GPS、新舊系統差異或戶外整趟驗收。定位不明時照片停住仍是原安全行為；照片成功上傳不保證每張都會推進關卡。

## 撤回與到期

如果 API 配對錯誤或出現提前指引，停止使用這個預覽，僅撤回這次新增的 channel／tag。測試結束或到期時也採相同步驟，先重讀流量：

```bash
gcloud run services describe nightingale --project=nightingale-walk-with-me --region=asia-east1 --format='json(status.traffic)'
npx firebase-tools@15.31.0 hosting:channel:delete field-fix-20261008 --site nightingale-walk-with-me --project nightingale-walk-with-me --force
gcloud run services update-traffic nightingale --project=nightingale-walk-with-me --region=asia-east1 --remove-tags=field-fix-20261008
```

Hosting 到期不會自動移除 Cloud Run tag；未建立自動清理工作。舊 `photo-guard-20261008` 另有原到期與清理紀錄，保留供本輪比對，不混用兩個網址。

部署機制已再次核對 [Cloud Run tagged revision](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration) 及 [Firebase preview channel](https://firebase.google.com/docs/hosting/test-preview-deploy) 官方文件。預覽網址可公開存取，並使用真實後端資源；本次授權為限定測試，沒有正式流量移轉。
