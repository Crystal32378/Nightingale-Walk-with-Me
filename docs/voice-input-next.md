# 下一階段：語音輸入 → 英文版 → 比賽交付

更新：2026-10-08。這是接手工作簡報；語音輸入尚未實作，下面的技術方案是待實測的建議。

## Crystal 的新決定

> 我覺得我們改的差不多啦，其實應該就先這樣，已經已經有了地標追問和恢復進度，先加上語音輸入，獨立agent 覆檢，部署，畫好architecture，上傳github，然後做英文版，然後demo影片就好了？

照片原生錯誤已不再出現，使用者看到了文字／地標追問並聽到固定 reanchor 錄音。唯讀核對的相符 LINE 行程已有 3 張照片被後端接受、observations 回 200，停在 cp2／REANCHOR。這支持上傳及回覆恢復；沒有留存本次 interpreter observation，不能指定是辨識不足或定位 photo hold。完整實走未因此宣告通過。

依 Crystal 的決定收住這一輪；不再擴張照片辨識、定位、自動推進或路線。下一階段直接處理語音輸入，不要求她再做已完成的照片診斷或錄音驗收。

## 已授權的工作順序

1. 加入中文語音輸入。
2. 由未實作該變更的獨立 agent 覆檢，修正阻擋問題。
3. 更新配對的受限預覽，驗證 iPhone X／LINE 的真實錄音與文字確認流程。
4. 根據實際實作畫 architecture：可編輯圖源＋可供 deck／README 使用的圖檔，清楚呈現路線真相、模型解讀、驗證器、session、圖片／音訊資料流與固定播放。
5. 保存至既有兩個 GitHub repos，補齊 README、architecture、證據與版本對照。這次 Crystal 已提出上傳 GitHub；不要重新詢問是否要保存。先讀遠端現況、正常 merge／push，保留作者與歷史，不 force-push，也不移動原 `zh-tw-preview-2026-10-08` tag。
6. 依 `docs/english-preparation.md` 完成整個英文操作流程，驗證、複驗、部署及再次保存 GitHub。
7. 最後錄製固定版本的英文 demo，搭配英文 deck／PDF、README／作品說明及可用部署連結。影片與正式提交仍由 Crystal 最後確認。

此處部署延續目前的受限 preview 範圍；正式導航站與正式流量的 HOLD 沒有解除。LINE 家屬路線卡已記錄但不插進上述首輪交付，除非 Crystal 再調整優先順序。

## 語音輸入的產品範圍

- 使用者按下按鈕才啟動；停止後顯示辨識文字，允許修改，再由使用者按傳送。
- 傳送前不呼叫路線 observe、不改關卡。送出後沿用現有文字 API、追問與恢復進度，不另建一套判路。
- 錄音時停止 Nightingale 自己的播放，避免收進自己的聲音；過街等待 walker 確認時保持安靜，不顯示錄音操作。
- 清楚呈現開始、正在聽、處理中、文字待確認、取消與失敗；麥克風被拒絕或不支援時仍可打字。
- 取消、離開頁面、開啟「幫我問」、步驟切換須釋放 microphone tracks、計時器及暫存音訊；不常駐或背景錄音。
- 44 個固定中文 WAV 不重錄、不覆蓋。語音輸入與導航語音播放分開。

## 技術建議與最先要查的事

優先評估「短句錄音 → 既有 GCP/Vertex 的音訊轉文字 → 使用者確認」。這能保留目前 deterministic engine 的分工。可先用 15 秒的短句上限做最小原型；實際 MIME、大小及請求上限要按裝置小樣與後端驗證結果定稿。

另一條路是瀏覽器 SpeechRecognition；不可只因 API 名稱存在就當作 LINE 可用，也不能把 Safari 或桌面 WebKit 的通過當作 LINE 實測。此次照片的 B1／TypeError 已證明這種判斷不足。

接手先完成一個小範圍的錄音能力檢查：使用者點擊後能否取得音訊、實際 MediaRecorder MIME、停止／取消是否完全釋放資源，再選定 transport。格式要用 `MediaRecorder.isTypeSupported()` 等能力檢查，不能固定假設 iPhone 回 WebM。只有真的需要時才請 Crystal 做一次短句真機測試，其他工作先自行完成。

若送 Google 轉錄，先在錄音入口用清楚的文字告知用途與傳送對象。原始音訊維持短暫處理，不寫入 Git、Firestore 或一般 application logs；勿擴張為「Google 永不保留」的宣稱。後端必須驗證實際音訊格式／bytes、大小、請求頻率，並處理空白／聽不清、429、timeout 與錯誤輸出。轉錄文字是未確認輸入，不是地理證據。

2026-10-08 已查的官方線索（不等同真機通過）：

- [WebKit MediaRecorder](https://webkit.org/blog/11353/mediarecorder-api/) 說明支援與格式能力檢查；WKWebView 的 capture 仍受宿主 app 能力影響。
- [LINE 瀏覽器差異](https://developers.line.biz/en/docs/liff/differences-between-liff-browser-and-line-in-app-browser/)：目前入口是一般 LINE 內開啟，不是已建立的 LIFF app。
- [Google 音訊理解](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/audio-understanding?hl=en)：接手需核對當前模型與 MIME 支援，先不要為此改掉已在用的路線 interpreter／模型。

## 必要驗證

- 先用回歸測試證明「只辨識、不自行送出」；確認後只送一次，空白與取消不前進。
- 權限拒絕、無 API、格式不支援、停錄失敗、timeout／429、切背景與幫我問等情境有可恢復結果。
- 文字、照片、pending continuation ID、取消競態、兩次過街、入口 ASK／抵達規則仍通過。
- iPhone LINE 要實際成功錄音、得到可編輯文字、確認送出到既有路線流程；不能只用模擬 microphone 或 UA 證明。
- reviewer 另列本機、hosted、真機證據，不將一種 PASS 代替另一種。

## 英文與交付補充

英文版要包含新的錄音操作、permission／錯誤、文字確認與 cp2 恢復問題，且保留中文實際招牌作辨識依據。新英文錄音使用獨立目錄／manifest，先試樣與審稿，不動中文定稿。

architecture 應在語音輸入實作後對照真正的 endpoint 與資料保管方式繪製；英文完成後更新同一份圖與 README。demo 使用固定的已部署版本，清楚標示現場片段、遠端操作及模擬回放，保留證據限制。

官方目前要求可用的部署連結、公開 GitHub、**少於 3 分鐘** demo，以及說明方案的 deck；該主題要求 deck/PPT 轉 PDF，提交材料使用英文。[FAQ](https://aibuildercup.com/Faqs.html) · [要求](https://aibuildercup.com/themes.html)。目前預覽有到期日，交付前須確保 demo 連結在評審期間可用；不能直接沿用即將到期的連結當成最後交件。

## Context 接手方式

本輪建議在此交接：照片／文字修正已到可凍結節點，語音輸入是新的工作單元。51.5% 是 Crystal 當下提供的讀數，不是必須換 context 的技術門檻。開新的對話，先讀本機接手入口和 repo `HANDOFF.md`，再讀本檔；不需要重新貼整段除錯歷史。

接下來可在「中文語音輸入＋複驗＋部署＋architecture＋GitHub」完成後再交接，讓英文版單獨成一輪；demo／deck 使用之後凍結的版本。
