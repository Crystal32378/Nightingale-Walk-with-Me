# Nightingale 窄修獨立複驗 — 2026-10-08

本次依 `HANDOFF-Nightingale-narrow-fix-2026-10-08.md` 驗收。後端凍結為 `65de4d86a59f9aaade7d8b44f4342a36f5678efe`，比較基底 `83639dd`；前端仍為 `f4016ba8b0b009aa209cbbcfc72b5487823da913`。

| 驗收範圍 | 判定 | 意義 |
| --- | --- | --- |
| 本次兩項照片情境窄修 | **PASS** | 原先提前過街與錯誤回復的保存案例已由現行引擎擋住；正向路徑與重拍檢查通過。 |
| 交接提出的限時手機測試預覽 | **PASS** | 僅核准下列不移轉正式流量的 Cloud Run tag＋7 天 Firebase preview，以及先 hosted smoke、後手機／陪同實測的順序。 |
| 完整正式／公開導航發布 | **HOLD** | 本輪未申請、亦未核准；七組辨識與本機 Chrome 不能替代真機定位、戶外聲音與整趟走行驗收。 |

未發現阻擋上述**限定預覽**的新增缺陷。這次核准的是具體測試部署範圍，沒有把「測試版」當成免除驗收的理由。

## 已獨立重現的證據

1. **修正範圍正確。** [engine.ts](</Users/crystalchang/Desktop/Fable Suite/nightingale/src/engine.ts:67>) 只新增兩道 photo guard，共 11 行 runtime 變更，另有診斷型別。照片在無／unknown zone 時不能啟動下一個 walker 過街步驟，也不能觸發有指定 zone 的 recovery。沒有檔名白名單，沒有靠 questionCount 計次放行。`parseObservation()` 由呼叫端覆寫 source 為 photo，模型不能自行宣告 text 繞過。route、人工 labels、scorer、前端程式均未改。

2. **歷史與新紀錄分開重算。** 495 筆歷史 readings 的 rows／failures／unsupported／來源 hash 與提交結果完全相同：原先 7 個 reachable 提前確認、3 個錯誤 recovery 變成 0，第一步 false arrival 仍為 0。歷史 `vocabularyMatches: false` 保留。七組現行模型成功 observations 重算亦為三項皆 0，`vocabularyMatches: true`；這是七個 image／variant pairs 的窄樣本，不是重新跑了 99 張。

3. **不是靠新模型恰好不犯錯。** 直接用舊／新引擎比較新 observation：`S__121634865_0.jpg` crop 的「急診」在舊引擎為 RECOVER，新引擎為 REANCHOR；`S__121634854_0.jpg` orig 的「瀚群骨科」在舊引擎為 GUIDE，新引擎為 REANCHOR。原始七組舊失敗也由 regression tests 重送驗證。

4. **正向與連續行為通過。** 獨立將七組新 observation 在 absent／unknown 位置、questionCount 0／1／9 各重送五次，未出現 GUIDE、RECOVER 或 CONFIRM_ARRIVAL。另直接驗證：相容 zone 加地標才前進；zone 單獨不前進；錯 zone 擋下；文字補充仍能前進；照片不能代按兩處「過完了」；相容 er／daan recovery 保留；photo hold 不消耗入口提問額度，下一筆 arrival evidence 仍先 ASK。

5. **新模型證據有來源。** 兩份 committed attempt logs 合計 8 次 interpreter calls，保留 `S__121634854_0.jpg` orig 的 429；其餘 7 筆恰好等於 `live-seven.json`，沒有 timeout／schema-invalid 混入成功筆數。已本地重算七份縮圖／裁切 bytes 的 input hash，全相符；當前 `buildPhotoPrompt()` hash 亦相符：`940e17f3dc603168c5943ec1c0d6b9c3571e6fb8085b91c528026b460befe2a7`。8 是 interpreter calls，不冒稱 SDK 底層 HTTP 請求數。本次複驗沒有呼叫模型。

6. **實際前端流程通過。** 本人重新啟動 8788 replay server，重跑 committed `scripts/check-photo-context-browser.cjs`：六次照片上傳在 cp2／cp3／cp5 正確停住，沒有提前要求過街音檔；文字補充、兩次 walker 確認、入口 ASK 與抵達完整通過；無 page error。親自檢視照片 hold 截圖，畫面保留可輸入文字的流程。這是真實前端＋HTTP API＋保存 observation 注入，沒有冒稱即時模型或 GPS。本人啟動的 8788 服務已停止。

7. **工程與資產保持完整。** `npm test` 95 項及 `npm run typecheck` 通過；44 WAV 實體 SHA-256 與原 manifest 全相符。前端仍在原凍結 commit。本次後端新增檔案無 binary 媒體；route、labels、scorer 零差異，工作樹保持乾淨。沒有修改 repositories、commit、push、部署或重錄。

## 接受的取捨與仍未證實的事

無可用 zone 時，照片不能自動帶人開始過街或回復，必須以既有文字流程補充；historical orig／crop 的 none home-hit 均由 3/8 降為 2/8，place 模式分別保持 6/8、5/8。這是明確的可用性取捨，手機實測應觀察是否容易卡住。

文字判路、arrival 分支與 zone 正確性並未由本次窄修改寫；第一步零 false arrival 仍不能證明整趟安全。iPhone 權限／相機／Safari audio、實際 GPS、網路等待、戶外可懂度與完整走行均尚未驗收。這些須在測試 URL 存在後量測，不作為禁止建立受限預覽的循環條件。

## 本次 preview PASS 的執行範圍

已讀取 [預建來源清單](</Users/crystalchang/Desktop/Astra Atelier/Nightingale-preview-prebuild-2026-10-08.json>) 並實際核對兩個 archive 解出目錄：後端 16 個 runtime 檔案與凍結 commit 逐 byte 相同，未混入評測／照片；前端 src 與凍結 commit 相同。`firebase.preview.json` 的 rewrites 為空。現有預建 bundle 含 `https://preview-api-pending.invalid`，不含預設正式 API URL；這份 placeholder bundle **不得直接部署**，須取得真實 tag URL 後重建並核對。

- 從已接受 commit 的乾淨 Git archive 部署同專案、同 identity、同 schema 的 Cloud Run 新 revision，**tag URL、`--no-traffic`、revision min 0／max 1**。部署前後核對正式流量保持原 target（提案列 `nightingale-00010-ff2`）；若當前 target 不同，先查明，不猜測或替換。不得提升正式流量或變更 IAM／billing。
- 前端精確使用 `f4016ba`，把 **tagged HTTPS API** 編入 bundle，使用 `VITE_LAST300M_API=<tag-url> npm run build`。**不得用 `build:hosting`**，因為該 script 會把此變數清空。
- 只部署 **7 天 Firebase Hosting preview channel**，preview-only config 沒有 `/api` 導回正式 backend 的 rewrite；不得部署 live channel。preview URL 與 tag URL 都不是登入／存取控制邊界，只限原定測試分享，不能宣稱私密。
- 先完成 proposal 已列的 hosted smoke：實際 bundle／API 版本配對、44 WAV hash、已保存退化案例、兩處 walker crossing、unknown hold，以及一張窄範圍真實照片。不得把 replay seam 部署成 production entrypoint，且不能把 injected observation 稱為 hosted 即時模型驗證。
- hosted smoke 通過後，才將 URL 交 Crystal 做 iPhone 檢查，再進行原有人證路線的陪同實測。新建 UUID test session，不重用正式既有 session；測試仍會使用既有真實後端資源。
- 配對失敗或再次出現提前指令即停止測試；撤下 preview channel、移除新 tag，保留正式 traffic target。七天 Hosting expiry 不代表 Cloud Run tag 自動消失，結束／到期時一併處理 tag。一般正式發布須另案提交現場結果。

上述 tag 不接正式流量且可直連測試的行為，已核對 [Cloud Run 官方文件](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)。Firebase 的 public preview／真實後端資源行為及 `--expires 7d`，已核對 [preview 文件](https://firebase.google.com/docs/hosting/test-preview-deploy) 與 [到期管理文件](https://firebase.google.com/docs/hosting/manage-hosting-resources)。這些是部署機制核對，不是已部署成功的證據。

## 重跑入口

後端目錄：

```bash
npm test
npm run typecheck
./node_modules/.bin/tsx eval/photo-eval.ts --replay eval/reviews/trip2-2026-10-07/saved-readings.json --labels eval/reviews/trip2-2026-10-07/labels-after.route-terms.json --out /tmp/nightingale-fu-narrow/historical
./node_modules/.bin/tsx eval/photo-eval.ts --replay eval/reviews/narrow-fix-2026-10-08/live-seven.json --labels eval/reviews/trip2-2026-10-07/labels-after.route-terms.json --out /tmp/nightingale-fu-narrow/current
```

browser 驗證須每次新啟動 `eval/guard-browser-server.ts`，再跑 committed `scripts/check-photo-context-browser.cjs`；本次結果為 `/tmp/nightingale-photo-context-browser.json`。長期重現依據是 committed 程式與保存 observations，不保證 `/tmp` 長期存在。
