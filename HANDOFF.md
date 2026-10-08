# Nightingale 交接 — 實走修正版已部署預覽，待 iPhone LINE 複驗

更新：2026-10-08（Asia/Taipei）。這份文件是新 context 的接手入口，不必重讀整段對話。先讀本頁，再按需要開連結中的證據。

## 現在最重要的事

Crystal 已完成 22 段新錄音的逐句試聽，最後的 Puck `photo.wait` 也通過；聲音定稿，不再重錄。57 張第二趟標註已由她核對、匯入並保存。後端窄修經獨立 agent 複驗通過，限時手機測試預覽已部署且完成線上檢查。

**本次實走修正：本機 PASS／獨立程式複驗 PASS／iPhone LINE 待驗收／正式發布 HOLD。** 已修正 WebKit 相片轉檔被拒，以及「youbike站」「仁愛復興路口」卡在前關的問題。後端 130 tests、前端 313 tests 通過；桌面 Chromium／WebKit 的照片與完整文字流程通過。原路線及 44 段音檔未變。[修正說明](docs/field-fixes-2026-10-08.md)、[獨立複驗](docs/acceptance/2026-10-08-field-fixes/independent-review.md)、[整合測試](docs/acceptance/2026-10-08-field-fixes/ui-browser-summary.json)。

**這批修正已配對部署至新的受限預覽，線上驗證 PASS；尚未推送 GitHub。** 新增確認協定的前後端已一起更新。下一步是 iPhone LINE 複驗，不要求 Crystal 重走舊版。實走原話與根因證據保留在[回報](docs/field-report-2026-10-08.md)。家屬經 LINE 傳路線卡與語音輸入需求已記錄，尚未實作。

前輪中文版 GitHub 基準仍保留；本輪已部署七天受限預覽，正式流量與正式 Hosting release 未改動。英文版尚未實作；依 [英文版準備清單](docs/english-preparation.md) 的順序，先處理實走阻擋。

## 專案入口與版本

- [主 repo：Nightingale-Walk-with-Me](https://github.com/Crystal32378/Nightingale-Walk-with-Me)：後端、路線真相、照片評測、驗收及部署紀錄。
- [前端 repo：Nightingale](https://github.com/Crystal32378/Nightingale)：React 操作介面、小鳥、44 個固定中文音檔。
- 兩個 repo 保留既有分工；不要為了交接改成 monorepo 或搬動來源。
- 兩邊以 `zh-tw-preview-2026-10-08` tag 保存這次中文基準；`main` 是最新原始碼入口。此 tag 表示已核對的**測試版本**，不是正式發布驗收。
- 新預覽實際部署的後端程式 commit：`0f9e345078d50a1c937dcfc09596094e0c436c5b`。
- 新預覽實際部署的前端程式 commit：`80d1ce46b14bac867ae6225c9a08d399f97c9e4c`。
- 其後的版本含驗收、部署與交接文件；不得把文件 commit 與部署的 runtime commit 混為一談。
- [版本對照檔](docs/zh-tw-preview-baseline.json) 記錄兩個 repo 與上述部署版本。

## 可用的手機測試網址

**使用新的 [Nightingale 實走修正版](https://nightingale-walk-with-me--field-fix-20261008-ac1wlluu.web.app/?flow=last300m&photo=1)。** 到期為 **2026-10-15 上午 10:22，台灣時間**。

新 channel／tag 為 `field-fix-20261008`；revision 為 `nightingale-fieldfix20261008`；tagged API 為 `https://field-fix-20261008---nightingale-uwker3cn5a-de.a.run.app`。正式流量維持 `nightingale-00010-ff2=100%`，新 revision min 0／max 1，沒有正式流量。

新 JS 與 44 WAV hash 通過，實際 WebKit 照片上傳／辨識、文字恢復與抵達流程通過；有一次文字模型 429，備援正常接續，保留此限制。新部署紀錄、到期清理及驗證範圍見 [受限預覽 README](docs/deployment/2026-10-08-field-preview/README.md)。

以下保留舊版本資訊供比對，**不要把舊連結當成修正版**：

[Nightingale 中文手機測試版](https://nightingale-walk-with-me--photo-guard-20261008-lb1kvmut.web.app/?flow=last300m&photo=1)

- Firebase preview channel：`photo-guard-20261008`。
- **到期：2026-10-15 凌晨 01:09，台灣時間**。精確服務端時間為 `2026-10-14T17:09:36.107491900Z`。
- 後端 revision：`nightingale-guard20261008`；tag：`photo-guard-20261008`；專案 `nightingale-walk-with-me`、區域 `asia-east1`。
- tagged API：`https://photo-guard-20261008---nightingale-uwker3cn5a-de.a.run.app`。
- 測試 revision：正式流量 0%、min instances 0／max 1。原 revision `nightingale-00010-ff2` 保持正式流量 100%。這是部署完成時查證的狀態，後續操作前需再讀現況。
- 原正式網址 `https://nightingale-walk-with-me.web.app/?flow=last300m` 尚未換成這批版本。
- 預覽不是登入保護的私密站。它的 build 明確連到 tagged API；preview-only config 沒有 `/api` 導回舊正式後端的 rewrite。

完整 [部署紀錄與 hosted smoke](docs/deployment/2026-10-08-preview/README.md)、[狀態 JSON](docs/deployment/2026-10-08-preview/state.json)。

## 已完成、可引用的結果

### 錄音與前端

- 固定文稿 22 句 × Leda／Puck = 44 段；其中本輪新錄 11 句 × 2 = 22 段，其餘 22 段沿用。
- 口音小樣只移除 `with a natural Taiwanese accent,`，保留溫柔慢慢說、像孫子陪長輩；Crystal 確認自然、標準。沒有另加台灣國語語言代碼。
- 唯一後續修正是 Puck `photo.wait`「我看一下這張照片。」：指定 Puck 卻出現偏高音色，該句單獨加上 `Use a natural adult male voice.` 後重錄並通過。其餘音檔未變。
- 前端固定 `route + checkpoint + action` 選預錄音；不依伺服器自由文字選片，不退回即時生成。缺檔保持安靜。
- `cp2.after → cp2.along` 只在按「過完了」後依序播放。過街途中不插話；切聲音、靜音、換步驟、開啟幫我問會取消舊隊列。
- 三種 `RECOVER:cp5` 目前缺少可區分的協定身分，因此導航錄音保持安靜、顯示文字；不要猜是哪一段 recovery 音檔。
- 聲音驗收與 SHA-256 在前端 `docs/qa/outdoor-voice-2026-10-07/accepted-audio.json`、`src/remote/outdoor-manifest.json`。

### 第二趟標註與窄修

- 57/57 人工核對完成；15 張補改文字，其中 `IMG_5595`、`IMG_5596` 另由 `lane` 更正為 `fuxing_west`。首趟 42 張逐物件保持原樣。
- 人工文字逐字保留，包含不尋常字樣；不得自行改字。主檔為 `eval/photo-labels.json`，原 export、匯入前資料、逐字路線詞對照及評分均在 `eval/reviews/trip2-2026-10-07/`。
- 第一次複核：495 筆歷史辨識／99 張照片／5 種條件，在可達測試格中有 7 個提前確認與 3 個錯誤 recovery，因此部署 HOLD。
- 窄修只在後端新增兩道 photo guard：定位 absent／unknown 時，照片不能啟動過街或有指定區域的 recovery；停在原關卡，保留文字補充。連續重拍也不會繞過，且不消耗入口提問額度。
- 路線 fixture、人工標註、評分器、前端與錄音未為了讓測試變綠而更動。
- 同一批歷史資料重播後，上述可達錯誤變成 0；七組現行模型小量重測亦為 0。七組成功觀測用了八次 interpreter calls，另一次 429 已保留；不能說完全沒有失敗請求，也不能說重跑了全部 99 張新模型。
- 測試：後端 95 項＋typecheck、匯入器 5 項；前端 267 項與建置。線上 44 個 WAV 均比對 hash，真實照片上傳與實際文字整趟操作通過。

[原評測報告](docs/photo-review-2026-10-08.md)、[窄修與限制](docs/photo-context-fix-2026-10-08.md)、[獨立複驗報告](docs/acceptance/2026-10-08-narrow/fu-review.md)。

## 尚未完成與不能擴張的宣稱

- 尚無這一版的 iPhone Safari、實際 GPS、行動網路、原生相機、戶外可聽度與完整實走驗收。
- Chrome 390×844 不是 iPhone；合成 place zone 不是實測定位。
- 零個第一步誤報抵達，不是完整多步導航安全保證。文字判路與原 arrival 分支並未由本輪重寫。
- 定位不可靠時照片會多停一步，需用既有文字流程補充；實走要觀察是否容易卡住。
- 窄樣本與人工試聽不能寫成普遍辨識／口音品質保證。
- 正式 live promotion 仍 HOLD。下一次部署前要以實走證據與獨立驗收作依據。

## 下一步：配對的受限預覽與 iPhone LINE 複驗

不要請她重做已完成的標註或錄音。先讀[本次修正](docs/field-fixes-2026-10-08.md)、新複驗及新部署收據，再接手機回報。線上 WebKit PASS 不等同 iPhone LINE 真機通過。定位仍不自動推進關卡，也未顯示定位狀態；「我在哪」仍只是重播指引，這些不列成本次已修功能。

實走時可簡單記：在哪個位置、看到的招牌字、畫面／聲音說什麼、按了哪個按鈕，以及定位／網路是否允許；有問題時截圖或記時間即可，不必填繁重表單。

優先核對：

1. 手機能否開站、按開始後定位、切換聲音和正常播放。
2. 拍招牌能否上傳；等待、失敗及定位不明時，是否能自然改用文字。
3. 兩次過街是否都等她按「過完了」，途中無額外指令。
4. 急診車道與大廳是否分清；院內樓層牌是否不再錯誤帶回。
5. 入口 ASK、抵達與服務台交接是否合理，沒有提早說到了。

若有問題：保存具體案例 → 窄修 → 獨立 agent 複驗。若完整通過：保存 field acceptance，再討論正式部署及比賽 demo。等待回報期間可先做英文文字盤點／草稿，不修改中文定稿。

## 英文版準備

詳見 [English preparation](docs/english-preparation.md)。目前只有準備規劃，沒有英文操作介面或新英文錄音。需要涵蓋整個操作流程，不是只翻開始按鈕；保留中文招牌作為真實證據，英文只做呈現。不要自動擴充印度或其他醫院路線。

官方網站在 2026-10-08 查核：提交資料（含 code、documentation、presentations）須英文；須提供可運作的部署網址、public GitHub、少於三分鐘的 demo 和 deck。[語言與要求](https://aibuildercup.com/themes.html)、[提交 FAQ](https://aibuildercup.com/Faqs.html)。

官網列組隊截止 10/11、作品截止 10/18；詳細截止時刻與時區以報名後台再核對，不自行猜。[時程](https://aibuildercup.com/)。隊友在印度；可協助英文可理解性與遠端操作測試。組隊邀請是否已完成，本輪未查證。

## 來源與操作邊界

- 實地照片／影片留在本機 ignored 的 `field trip photos/`；Git 只保存文字標註、結構化辨識紀錄與 UI QA 圖。新的實走素材也遵守同一邊界。
- 不把憑證、`.env`、service-account key 或私人素材推上 GitHub；不要求把 secrets 貼到聊天。
- 不改已核定路線真相、不要用模型補出不存在的路線／入口。GPS 單獨不能確認抵達。
- 中文 44 段已驗收，不因英文版重錄、覆蓋或改字。
- 不 rebase、不 force-push、不改 commit 作者或歷史；保留兩個既有 repo。
- 前端原有未追蹤的 briefings、`nightingale-*` 工作資料及 `videos/` 未納入本輪保存；不要 `git add -A`。
- 前端 Git 中的 `src/assets/motion/` 是既有小鳥動畫實驗素材，不是實拍影片；本次抽格核對。`ambient-vp8.webm` 是既有未使用的零位元檔，現行 renderer 使用 canonical artwork；不要順手清理或宣稱已修復它。

## 測試與清理

後端基本檢查：

```bash
npm ci
npm test
npm run typecheck
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p 'test_import_trip2_review.py'
```

前端：`npm ci`、`npm test`、`npm run build`。預覽若需重建，必須用 `VITE_LAST300M_API=<tagged HTTPS API> npm run build`；**不要用 `build:hosting`**，它會清空 API 設定。重跑目前程式測試不需要新的雲端模型呼叫。

預覽到期不會自動移除 Cloud Run tag，也沒有安裝自動清理工作。確認測試結束或到期後，先讀取當下流量，再清理指定測試資源；不要使用 `--to-latest` 或移轉正式流量：

```bash
gcloud run services describe nightingale --project=nightingale-walk-with-me --region=asia-east1 --format='json(status.traffic)'
npx firebase-tools@15.31.0 hosting:channel:delete photo-guard-20261008 --site nightingale-walk-with-me --project nightingale-walk-with-me --force
gcloud run services update-traffic nightingale --project=nightingale-walk-with-me --region=asia-east1 --remove-tags=photo-guard-20261008
```

只有在清理條件成立時才執行；這不是接手時的第一步。長期來源以 Git 與 committed receipts 為準，不能依賴舊 `/tmp` 或 build staging 目錄仍存在。
