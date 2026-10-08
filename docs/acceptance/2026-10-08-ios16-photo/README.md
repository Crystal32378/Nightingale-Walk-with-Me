# iOS 16 照片解碼相容修正

Crystal 回報的真機診斷碼：`P-DECODE / JPEG / 2219K / TypeError / B1`。

這證實檔案前段可辨認為 JPEG、約 2219 KiB、`createImageBitmap` 存在，失敗發生在原呼叫解碼分支，例外名稱為 TypeError。尚未證實此照片完整 bytes 的有效性；沒有把原圖保存到此資料夾。

## 查證與修正

目前程式明確傳入 `imageOrientation: 'from-image'`。[WebKit Safari 17.2 release note](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#image-orientation) 說明該版才採用這個新名稱；[原始提交 556e20c](https://github.com/WebKit/WebKit/commit/556e20c0b0053bc5c7f6d1a5635ad2467c6bade8) 同時保留了舊 Blob 呼叫的 TypeError 測試，以及舊／新選項與預設值的變化。

這與 iOS 16.7.16／LINE 15.7.2 和此次診斷碼高度吻合。最小修正為 **`createImageBitmap(file)`**，使用瀏覽器原生預設值，省略舊版無法識別的選項名稱。沒有加入第二套 decoder、UA 分支或上傳原圖的 fallback；縮圖、重新編碼、metadata 清理與檢查維持原樣。

前端 commit：`9aa1e9c0dc89aa76a9e9b6c534a2b179e934ae9a`。後端保持 `0f9e345`／`nightingale-fieldfix20261008`，未重新部署。

## 證據

- RED：真實 Chromium／WebKit 加上模擬舊版 enum 限制，16 例有 8 例失敗，全部為 `P-DECODE/TypeError`；不加限制時通過。[修正前](legacy-red.json)
- GREEN：同一批 16 例全通過，包括真實 JPEG EXIF 1／6／8 的尺寸與四色角落方向，以及 4032×3024 圖片縮到 960×1280；metadata 檢查仍通過。[修正後](legacy-green.json)
- 前端 319 tests、typecheck、build 通過；[獨立窄修審查 PASS](independent-review.md)。
- 已發布 JS bytes 與乾淨 Git archive build 一致，沒有明確的 imageOrientation 選項，沒有 `/api` 導回正式站的 rewrite。[資產收據](hosted-assets.json)
- 線上桌面 WebKit 加同一 enum 限制，經真實 UI 上傳既有 IMG_5593.jpg，照片計數為 1；Vertex 讀到兩個巷名，定位缺失時依原規則停在 cp2。沒有頁面錯誤，沒有額外來源請求。[上傳收據](hosted-photo.json)

**這是已部署的有證據相容修正，iPhone LINE 修後結果仍待 Crystal 確認。** enum shim 只重現選項拒絕，沒有模擬完整舊版 iOS 解碼器。舊 Safari 的 Blob／EXIF 行為也有[歷史問題](https://bugs.webkit.org/show_bug.cgi?id=237895)，不能以現代桌面測試宣稱所有舊手機方向都已驗收。

## 手機測試連結

[iOS 16 相容修正版](https://nightingale-walk-with-me--photo-check-20261008-yl1k8e08.web.app/?flow=last300m&photo=1&photoCheck=1&v=ios16-1)

更新既有 `photo-check-20261008` channel，保留診斷碼；`v=ios16-1` 用來明確區分本次打開的連結。到期更新為 **2026-10-09 上午 11:11，台灣時間**（`2026-10-09T03:11:16.366282638Z`）。正式 Hosting、其他 preview 及 Cloud Run revision／流量不變。[部署後狀態](after-state.json)

下一步是在 iPhone LINE 原地再拍一次，確認是否仍出現打不開；有新錯誤時保留整段診斷碼。成功上傳不代表定位已確認，原照片 guard 仍可能要求路牌文字。

本輪沒有推送 GitHub，原始照片未納入 Git。診斷結束或到期後，只刪除此 Hosting channel，不刪共用的 field-fix 後端 tag。未建立自動清理工作。
