# Nightingale submission assets 接手入口 — 2026-10-08

## Crystal 最新決定與本輪終點

Crystal 決定把 submission assets 放到另一個對話；本輪只做到英文版完成、驗證、受限部署並推上 GitHub。這個切分依工作單元，沒有把她回報的 context 51.6% 當成技術門檻。

**本輪已完成：中文語音輸入 → 獨立覆檢 → 受限部署 → architecture → GitHub → 完整英文版 → 獨立複驗／受限部署／再次保存 GitHub。**

**下一輪才做：固定版本英文 demo、英文 deck／PDF、作品說明與 submission assets。Demo 影片與 deck/PDF 尚未製作，也沒有上傳影片或提交比賽。** 正式導航發布、影片公開與最終提交仍保留 Crystal 的確認。

## 先讀與固定版本

1. 後端 `/Users/crystalchang/Desktop/Fable Suite/nightingale/HANDOFF.md`。
2. `docs/deployment/2026-10-08-english-preview/README.md` 與 `state.json`。
3. `docs/acceptance/2026-10-08-english/independent-review.md`、`hosted-review.md`。
4. `docs/architecture/README.md`，再依需要讀 `docs/english-copy-review.md`。

GitHub 兩 repo 均為 public，main／功能分支已正常 fast-forward/push，發布基準固定為 **`en-preview-2026-10-08`**：

- 後端／路線／證據：[Nightingale-Walk-with-Me](https://github.com/Crystal32378/Nightingale-Walk-with-Me/tree/en-preview-2026-10-08)。本機分支 `feat/photo-eval-gates`；tag peeled commit `2c121ba9f6b94a058d098146024b898e973a0aa4`。
- 前端／小鳥／音檔：[Nightingale](https://github.com/Crystal32378/Nightingale/tree/en-preview-2026-10-08)。本機 `/Users/crystalchang/Desktop/Opus Chamber/Nightingale`，分支 `feat/photo-gates`；tag peeled commit `086a5a7e686813a304f50be534dd7f9db434fc53`。
- 後端實際部署 runtime：`34bc9be7c27e996eb789ba9c1f0f2240b608d1b8`。
- 前端實際部署 runtime：`cdb9da550b0b7b039380ca52505a1bd193e26b52`。
- tag 包含後續文件，不要把文件 commit 當作 runtime commit。新增交接文件後 main 可能再前進，但上述tag不移動。
- 原 `zh-tw-preview-2026-10-08`、`zh-tw-voice-preview-2026-10-08` 兩組中文tag都保留原值。不 force-push、不 rebase、不改作者、不整併repo。

## 最新可用預覽

英文入口：
https://nightingale-walk-with-me--english-20261008-q4gion1y.web.app/?flow=last300m&photo=1&lang=en

頁面可直接切繁體中文，不重設session／pending confirmation。到期：**2026-11-07 13:27台灣時間**；精確UTC：`2026-11-07T05:27:43.895321215Z`。

- API：`https://english-20261008---nightingale-uwker3cn5a-de.a.run.app`。
- revision：`nightingale-english20261008`，tag/channel：`english-20261008`。
- 新revision min0/max1，一般正式流量0%；原 `nightingale-00010-ff2` 仍100%。正式Hosting與原5個release（live＋4preview）未更動。
- Cloud Build `92947d1c-4151-47e1-8a34-55e393fd394f`，image digest `461f5f6df44ab15c0b80972afeeb716194b10c55fac66cf0db43efb14d4ec5bd`。獨立review核對source zip24/24檔與Git一致。
- 預覽可公開存取，不是登入保護的私密站。Hosting到期不會移除Cloud Run tag；沒有建立自動清理。任何新部署／清理前重讀當下流量。

## 已驗證與證據界限

- 後端193 tests、前端354 tests、兩邊typecheck與clean build通過；獨立程式／資產與hosted覆核PASS。
- 全133 hosted檔與build hash一致；中文44＋英文44 WAV hash一致。中文音檔未重錄／覆蓋；路線JSON只增加呈現messageKey，其餘路線事實逐項一致。
- 真桌面Chromium與WebKit：完整英文操作、語言切換不送API／不重設進度、錄音取消、實際WAV解碼與播放隊列、help-card焦點和英語speech語系通過。
- 真hosted API：17回合英文文字操作與14次structured guard checks通過；兩次過街只接受walker確認，英文否定／問句／尋找不直接變肯定位置，三種recovery固定identity可區分。
- Desktop native WebM／MP4、合成英文聲音輸入 → 真Vertex／Firestore轉錄，先editable draft再explicit Send通過。這不是實體麥克風或戶外GPS證據。
- 第一個hosted合成語音檢查把尾詞聽成 `Just type`。測試源原本在MediaRecorder ready前起音；補350ms lead-in後兩browser得到原句。第一次差異與其browser未留存限制保留在attempt1；不宣稱唯一根因或ASR必然正確。
- Crystal已回報中文preview的iPhone LINE「錄音、改字、傳送都成功」。不要重請她做照片診斷或中文短句驗收。
- **English iPhone／LINE、印度隊友遠端walkthrough及完整戶外軟體實走，尚未宣稱完成。** 路線資料曾實地走查，和這版軟體完整實走通過是兩件事。正式導航仍HOLD。

## 英文聲音：Crystal 已決定正常語速

第一版英文小樣被回報太慢、咬字用力。她要求「正常語速即可，不需要特別變慢」。新版移除英文 `unhurried`／`grandchild walking an elder`，採 **normal conversational pace、relaxed articulation、warm calm tone**，沒有依印度隊友指定地區口音。

Crystal接受新版：「**這版可以，全部用正常語速**」。兩段Puck地名（Renai Road／Da'an Road）也確認：「**兩句地名都可以**」。不要重做聲音casting或再放慢。

- 固定英文22句×Leda/Puck=44檔，前端 `public/audio/outdoor/renai-001-en/`，manifest `src/remote/outdoor-manifest.en.json`，文稿 `src/remote/outdoor-en-script.json`。
- 個別人審6檔：兩聲音的`cp2.along`／`reanchor`四小樣，以及Puck `cp3.cross`／`recover.daan.a`。**不是44檔逐句人審。**
- 全44做機器轉錄交叉檢查：36 normalized一致＋6數字等義＋2地名由Crystal聽審。原轉錄結果與差異保留，不改寫成零失敗紀錄。
- 聲音原始生成provenance在 `Desktop/Astra Atelier/outputs/nightingale-english-normal-2026-10-08/recordings.json`；交付音檔／manifest已進Git，不能依賴暫存build。
- 新demo若另寫旁白，要保持正常語速；旁白與App實際固定播放應明確區分，不拿另生成旁白冒充App當時輸出的聲音。

## Submission assets 建議順序

1. 以已固定的英文preview／tag建立demo腳本，少於3分鐘。拍的是遠端腳本描述時，就明確標示；現場片段、遠端操作、模擬回放分開，不宣稱整趟真機戶外接受。
2. 從實際部署錄操作畫面，不重畫UI當成實機證據。可展示語音變文字、改字後送出、地標追問、walker過街、恢復與入口；不要為拍片改路線真相。
3. 製作英文deck與PDF、README／作品說明、可用部署與public GitHub連結。架構已有可編輯Mermaid、SVG、PNG：`docs/architecture/nightingale-overview.*`、`voice-input-sequence.*`。
4. 影片與PDF渲染後檢查，保留可編輯來源與版本對照，再交Crystal確認。未確認前不公開影片、不最終提交、不promote正式導航。

官方2026-10-08重查：英文submission materials；Cloud Run／Firebase可運作部署、public GitHub、少於3分鐘demo、deck/PDF。[要求](https://aibuildercup.com/themes.html)、[FAQ](https://aibuildercup.com/Faqs.html)。[時程](https://aibuildercup.com/)：組隊10/11、提交10/18、evaluation10/19–11/06、finalists11/07、finale12/04。精確截止時區仍以報名後台為準；隊友邀請狀態本輪未查。不寄信或替她提交。

## 資產與工具交接

- 原始實拍在後端ignored `field trip photos/`；不推Git，不把未審的臉／車牌／病患資訊帶進公開作品。前端`.h3-tasks/`、briefings、`nightingale-*`工作目錄、`videos/`保留，不提交，不用`git add -A`。
- 預覽build：`VITE_LAST300M_API=<tagged HTTPS API> npm run build`；不要`build:hosting`。以乾淨Git archive重建，流程在部署`procedures/prepare.py`。
- 本輪可用本機FFmpeg：`/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1`。
- Playwright可用module：`/Users/crystalchang/.local/lib/node_modules/@qwen-code/qwen-code/bundled/browser-use/runtime/node_modules/playwright-core`；Chromium executable為`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，另有desktopWebKit26.5。不能把它稱iPhone。
- 本輪只讀了Presentations／PDF技能作下一步準備，沒有建立deck。當時工具表沒有Artifact Session／`load_workspace_dependencies`，Astra cwd也無`@oai/artifact-tool`可resolve。下一輪先查當下runtime，依實際可用工具完成可編輯來源與PDF，不假裝已有PowerPoint驗收。

## 新對話可貼

> Astra，請讀 `/Users/crystalchang/Desktop/Astra Atelier/HANDOFF-Nightingale-submission-assets-2026-10-08.md`。中文與英文版本已完成、受限部署並保存GitHub，從固定英文版本開始做少於三分鐘的demo與英文deck／PDF。英文使用已接受的正常語速，保留證據界限；影片公開、正式導航發布與最後提交仍等我確認。
