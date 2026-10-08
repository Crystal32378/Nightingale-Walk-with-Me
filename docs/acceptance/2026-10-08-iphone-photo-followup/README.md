# iPhone LINE 照片續查與限定診斷預覽

後續更新：Crystal 已回報 `P-DECODE / JPEG / 2219K / TypeError / B1`，同一 photo-check channel 已更新為前端 `9aa1e9c` 的相容修正版。最新連結、到期與證據以 [iOS 16 修正紀錄](../2026-10-08-ios16-photo/README.md) 為準；下方保留原診斷階段紀錄。

Crystal 在 2026-10-08 回報：「照片無法使用，當我補充路牌文字就會在正確的關卡」，並確認仍顯示「這張照片我打不開。用文字跟我說也可以。」。

**文字有使用者操作成功回報；iPhone LINE 照片仍失敗；完整實走與正式發布仍 HOLD。** 桌面 WebKit 通過不等同真機根因已解決。

## 線上證據

[server-receipt.json](server-receipt.json) 記錄新版 `nightingale-fieldfix20261008` 的 LINE 請求：10:34–10:35 台灣時間，有一筆相符行程已到 `cp4`，照片計數仍 0；user agent 為 iOS 16.7.16／LINE 15.7.2。時間／user agent 相符不是唯一身分證明。完整提示屬於前端 `PhotoPrepareError`；尚未分清真機停在解碼、canvas、編碼、JPEG framing 或 metadata 檢查。

## 診斷連結與邊界

[從 LINE 開啟照片診斷版](https://nightingale-walk-with-me--photo-check-20261008-yl1k8e08.web.app/?flow=last300m&photo=1&photoCheck=1)

到期：**2026-10-09 上午 10:54，台灣時間**（`2026-10-09T02:54:47.774618910Z`）。獨立 Hosting channel `photo-check-20261008`，沒有新增 Cloud Run revision／tag。

- 前端 commit：`807f9145e499bf2c22d4c7aff0712acfb78fccf8`；後端維持 `0f9e345`／field-fix tag。
- 只有 `photoCheck=1` 且照片準備失敗時，才在原提示後顯示檢查代碼；普通連結提示及成功圖片 bytes 不變。
- 短碼僅包含固定階段、前 32 bytes 分類出的格式、大小 KiB、白名單原生錯誤名稱，以及 `createImageBitmap` 是否存在。不包含檔名、原始 header、EXIF、原始例外訊息或照片內容。
- 診斷只顯示於裝置畫面，沒有新增診斷上傳／儲存。失敗照片仍不送後端，沒有加入推測性的解碼 fallback。
- `P-DECODE`＝讀取圖片；`P-CANVAS`＝取得畫布；`P-ENCODE`＝JPEG 編碼；`P-JPEG`＝編碼後 JPEG framing；`P-META`＝最終 metadata 檢查。代碼只定位階段，不能單獨當成根因。

## 驗證

前端 319 tests、typecheck、build 通過。Chromium／WebKit 的八個本機注入案例通過：錯誤階段可區分、普通提示不變、失敗不傳照片或診斷、文字仍可操作、成功 payload 不變。[本機結果](browser-diagnostic.json)

[獨立診斷範圍 PASS](diagnostic-review.md)，相同圖片的成功輸出 bytes 與 80d1ce4 相同。線上 bundle hash 對上乾淨 archive build；以模擬 decoder 失敗及 mocked API 確認短碼可見，未呼叫 Firestore／模型。[線上內容檢查](hosted-diagnostic.json)

[部署後狀態](after-state.json) 證明舊 Hosting versions、Cloud Run 最新 revision 與正式流量保持原狀。這些結果不表示 iPhone 照片已修好。

下一步：請 Crystal 在診斷連結重試一次拍照，回報新增的「檢查代碼」整段。沒有真機碼前，不指定 HEIC、ImageBitmap 或 JPEG parser 為現場根因。

測試結束或到期後，只需刪除此 Hosting channel；field-fix 後端仍供正常預覽使用，不能一併移除。沒有新增自動清理工作。

```bash
npx firebase-tools@15.31.0 hosting:channel:delete photo-check-20261008 --site nightingale-walk-with-me --project nightingale-walk-with-me --force
```
