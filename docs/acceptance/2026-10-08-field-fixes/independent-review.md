# 2026-10-08 實走窄修：獨立程式審查

結論：**本機程式審查 PASS，沒有尚未修正的阻擋問題；iPhone LINE 實機與完整實走仍待驗收。**

本次由未實作產品修正的 review agent 讀取兩個 repo 當下未提交的 diff，獨立重跑下列檢查。除本報告外沒有修改檔案，也沒有 commit、推送、部署或切換流量。

## 審查範圍

- 前端 `photo.ts`、照片測試與 browser script：只移除 canvas 新編碼 JPEG 的 APP1、APP13、COM；保留壓縮掃描、色彩資訊及最終檢查；異常 framing 拒絕處理，不退回上傳原圖。
- 後端 `textFollowUp.ts`、`server.ts`、`types.ts`、`store.ts`、`index.ts`：cp2 的 YouBike 路牌追問、仁愛復興路口的 typed confirmation、原子狀態更新與保留原過街確認。
- 前端 `last300mClient.ts`、`useLast300m.ts`、`Last300mPage.tsx`、strings/CSS：確認資料結構、完整提問、專用確認／取消按鈕、失效控制清除與固定錄音映射。

## 審查發現及處理

1. **已修正：取消後舊確認覆寫狀態。** 初版可重現 cancel 已回應 cp2，較慢 confirm 仍寫回 cp3x。最終版使用 `SessionStore.update`；production 接到真正的 Firestore transaction，重試時再次檢查當前 pending。延遲確認對 cancel／新觀察的回歸測試均回 409，保持 cp2。
2. **已修正：精確路口原文被模型猜測混入第一次過街證據。** 初版 interpreter 若額外猜出「大安路一段116巷」，會跳過新問題並開始過復興南路。最終版精確 YouBike 提示只留下空證據；精確仁愛復興路口別名只留下既有「仁愛路」。一般完整巷名輸入維持原流程。
3. **已修正：延遲的第一次過街 done 套用到第二次過街。** 請求開始即保存 checkpoint，且在最後原子更新重新比對；舊 done 回 409，保持 cp3x，不會宣稱第二次過街已完成。
4. **設計已修正：不宣稱福華／瀚群的同側關係。** 新問題只確認已過復興南路、目前安全站在人行道上的仁愛路口、尚未過仁愛路。按下符合後才跑既有 cp3 證據與位置規則，輸出 GUIDE cp3，仍等待第二次過街的 walker done；不會直接 ARRIVED。

## 獨立執行結果

| 檢查 | 結果 |
|---|---|
| 後端完整 `npm test` | 11 files，130/130 PASS |
| 後端 `npm run typecheck` | PASS |
| 前端 photo / textContinuation / outdoorVoice / remoteGuidance | 4 files，66/66 PASS |
| 前端 `npm run typecheck`、`git diff --check` | PASS |
| `scripts/check-photo-browser.cjs` | WebKit 26.5、Chrome 154，各 3 例，6/6 PASS |

Browser 檢查獨立確認重新解碼、尺寸、像素、合成原圖 EXIF 不外洩、APP1/APP13/COM 移除與零網路請求。使用既有 Playwright runtime，沒有下載安裝瀏覽器。

## 證據限制

- 桌面 WebKit 與本機測試不能取代 iPhone X／iOS 16.7.16／LINE 15.7.2 的驗收。尚未證明使用者現場照片或完整行程已成功。
- Firestore transaction 的呼叫接線已讀碼，重試／競態由本機替身驗證；沒有對正式 Firestore 執行寫入驗證。
- 確認時重新讀取前端保存的最新 zone；既有 `watchPosition` ref 沒有 GPS 時間戳過期檢查，不能宣稱取得全新 GPS fix。這次也不增加自動沿路推進。
- 語音輸入未新增；新追問保持無錄音，成功恢復才使用既有 cp3 過街錄音。既有路線 fixture 與固定音檔未納入本次修改。
