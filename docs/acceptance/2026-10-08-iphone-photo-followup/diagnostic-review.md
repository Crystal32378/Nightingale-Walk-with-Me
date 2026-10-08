# 2026-10-08 iPhone 照片追查：診斷範圍獨立審查

結論：**診斷範圍 PASS，沒有未解決的阻擋問題。這是收集真機錯誤代碼的前端改動，不是 iPhone 照片修復驗收。**

審查基準為前端 `80d1ce4` 至當下 worktree 的產品 diff，包含新檔 `photoDiagnostic.ts` 與測試；另讀取本機 `server-receipt.json` 作為回報脈絡。本 reviewer 未呼叫雲端、未部署、未 commit；除本報告外沒有修改檔案。

## 已核對的範圍與隱私

- `photo.ts` 只為原有失敗分支加上固定型別代碼，並保留解碼器例外的名稱。沒有增加解碼 fallback、略過 metadata 檢查或改成上傳原圖。
- 只有 URL 的 `photoCheck=1` 會開啟診斷；`useLast300m` 只在既有 `PhotoPrepareError` 失敗時呼叫 helper，普通頁面的提示維持原文。
- helper 只讀原檔前 32 bytes 作格式提示，最多等待 1 秒。輸出為固定階段代碼、格式列舉、向上取整的 KiB 大小、白名單例外名稱、ImageBitmap API 是否存在。
- 未回傳檔名、MIME 原字串、原始 header、EXIF、像素、GPS 或 `error.message`。非白名單例外名稱顯示 OTHER。
- 新 helper 沒有網路、localStorage、IndexedDB 或記錄端點；失敗流程未呼叫照片 API。成功上傳仍走原有重新編碼與 metadata 清理流程。

## 審查發現

已修正一項分類問題：AVIF 的 compatible brands 可同時包含 `mif1`，先判 generic HEIF 會誤標。最終 helper 先判 AVIF，mixed-brand 回歸測試通過。

另外已核對非 Error 子類別的原生例外名稱仍能保留，而呈現前仍受相同白名單限制。

## 獨立執行

| 檢查 | 結果 |
|---|---|
| `photo.test.ts` 與 `photoDiagnostic.test.ts` | 34/34 PASS |
| 前端 typecheck、`git diff --check` | PASS |
| 原照片 browser regression | WebKit 26.5／Chrome 154，共 6/6 PASS，零網路請求 |
| 同一合成 PNG，基準版本與診斷版在相同 browser 重新編碼 | WebKit、Chrome 的 MIME 與完整 base64 bytes 各自完全相同；零網路請求 |

整頁 forced-failure browser script 已讀碼；其整頁執行由主實作者另存 receipt，本報告不將那份執行算成本 reviewer 獨立重跑。審查用的輸出 byte 比對只輸出相等布林與長度，沒有保存或印出照片 bytes。

## 驗收界線

- 目前缺少真實 iPhone LINE 錯誤代碼；根因仍未確認。
- 前 32 bytes 的格式提示不是完整檔案驗證，API 存在也不代表支援該圖片格式。
- 本結論支持限定用途的診斷預覽。預覽網址、一天到期與保持既有後端的實際部署設定，由部署流程另行確認；本 reviewer 沒有執行或宣稱部署完成。
- 不把桌面測試、代碼顯示或使用者文字已能前進，延伸宣稱照片已修復或完整路線實走已通過。
