# 2026-10-08 iOS 16 照片相容性窄修：獨立審查

結論：**程式與來源審查 PASS；有足夠依據採用這個單行相容性修正。iPhone LINE 修後結果、直拍照片方向及完整實走仍待驗收。**

審查範圍為前端 `807f914` 至當下 worktree 的 `photo.ts` 修改，以及新的 `check-photo-orientation-browser.cjs`。Reviewer 沒有修改產品程式、commit、部署或呼叫專案雲端；除本報告外沒有寫入檔案。官方文件查核為公開網站唯讀存取。

## 來源與診斷判讀

本次收到的真機代碼為 `P-DECODE / JPEG / 2219K / TypeError / B1`：錯誤發生在 createImageBitmap 階段，前 32 bytes 顯示 JPEG signature，API 本身存在。這些資訊與不支援 option enum 的相容性缺陷吻合；單憑 TypeError 仍不能排除其他解碼問題。

官方 Safari 17.2 說明指出 imageOrientation 舊名稱 none 改為 from-image，屬於名稱與意義表達的調整。這支持沿用瀏覽器原生 default，以免顯式傳入舊實作不認得的名稱。[WebKit 官方說明](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#image-orientation)

獨立讀取原始提交可見：舊 IDL enum 只有 none／flipY；新增 from-image 時同時更改 IDL 與 C++ default；Blob 配合 from-image 的原始測試由 TypeError 變為 PASS。提交說明明確表示新名稱與當時 none 的行為相同。[WebKit 原始提交](https://github.com/WebKit/WebKit/commit/556e20c0b0053bc5c7f6d1a5635ad2467c6bade8)

## 修改邊界

唯一執行行為差異是將 `createImageBitmap(file, { imageOrientation: 'from-image' })` 改成 `createImageBitmap(file)`。沒有 UA 判斷、重試分支、另一套解碼器、EXIF 手動旋轉或檢查放寬。之後的縮圖、canvas JPEG 編碼、metadata 移除與最後檢查、base64 與 API 傳送都維持原流程；原圖不成為送出資料。

舊 Safari 曾有 Blob EXIF 方向的實作問題紀錄。因此程式註解宜表達「採用原生 orientation default，避免不支援的 renamed option」，不宜將所有舊 WebKit 的實際方向行為寫成已驗證保證。這不阻擋本次移除明確不相容選項，但真機複驗應包含直拍照片。[WebKit issue 237895](https://bugs.webkit.org/show_bug.cgi?id=237895)

## 獨立驗證

| 檢查 | 結果 |
|---|---|
| 照片與診斷單元測試 | 34/34 PASS |
| 前端 typecheck、diff check | PASS |
| 新 orientation browser script | 16/16 PASS |
| 根據保存的 RED／GREEN receipt 核對 | RED 16 例中 8 個 legacy enum 案例失敗；GREEN 16 例全通過 |

16 例覆蓋 WebKit 26.5 與 Chrome 154，各自使用正常 API 和狹義 legacy enum shim，處理真正 JPEG EXIF orientation 1、6、8，以及 4032×3024 圖片縮至 960×1280。獨立重跑確認輸出尺寸、四角色塊的旋轉方向、metadata 清除，並確認沒有網路請求。

legacy enum shim 只模擬舊 API 對 from-image 的拒絕；實際圖片解碼仍由當代桌面引擎完成。它不能代表舊 iOS 的記憶體限制、全部解碼細節或 LINE WebView 行為。RED receipt 由主實作者產生，本 reviewer 讀取核對；GREEN script 是本 reviewer 另行獨立執行。

## 驗收結論

沒有程式層面的剩餘阻擋問題。這次結果可支持相容性修正版進入限定預覽複驗；不得宣稱真機已修好、全部照片格式皆可用、定位或整條路線已驗收。下一個有意義的證據是同一台 iPhone LINE 上傳後能收到辨識回應，並確認直拍照片方向正常。
