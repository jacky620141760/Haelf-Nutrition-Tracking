# Requirements Document

## Introduction

Haelf Nutrition 是一款個人使用、iOS 優先的 Expo React Native 飲食與體重紀錄 App。帳號版採 **Email／密碼登入（Supabase Auth）**，業務資料以裝置端 **SQLite 為離線快取**，並同步至 **Supabase Postgres**（換機可還原）。網路另用於 Open Food Facts（OFF）條碼查詢與使用者主動啟動的 AI 食物分析。Web 僅供開發預覽。

註冊後必須先設定**持續生效的每日目標**（熱量與三大營養素）才能進入主功能；目標會每天套用，直到使用者再次修改。

本規格聚焦可驗收邊界：帳號、雲端同步、飲食日記、營養計算、每日目標、條碼、AI 輔助、體重與趨勢、統計、資料生命週期、可及性及效能。不包含社交、TDEE 自動估算、商店上架或 Web 正式支援。

## 原草案歧義、決策與風險邊界

- **營養基準歧義**：統一為「每 100 g」或「每份」兩種基準；儲存來源值、食用量及確認當下的計算快照，避免產品資料後續變更改寫歷史。
- **日期歸屬風險**：每筆紀錄同時保存 UTC 時間、建立時的本機日期與時區資訊；跨時區後既有紀錄不重新分日。
- **目標回溯歧義**：目標採生效日期版本；修改預設自當日本機日期生效，較早日期維持原版本。
- **外部資料品質風險**：OFF 缺值不得視為 0；外部或 AI 結果都只能形成待確認草稿，必須經使用者確認與補齊後才能寫入日記。
- **AI 相容性與隱私風險**：先檢查模型能力；無法證實支援 vision 時僅允許文字描述。只傳送使用者明確選取的內容，且 AI 輸出需通過 JSON 結構與數值驗證。
- **Web 憑證風險**：Web 預覽不持久保存 API Key，避免以一般瀏覽器儲存模擬 Secure Store。
- **本機資料風險**：資料庫遷移必須具備交易與回復行為；v1 不承諾裝置遺失、移除 App 或資料庫毀損後的內建還原。
- **統計解讀歧義**：7 日與 30 日皆指以所選日期為結束日、含首尾的連續本機日曆日；無資料與數值 0 分開呈現。

## Glossary

- **App**：Haelf Nutrition 應用程式。
- **使用者**：在單一裝置上操作 App 的個人。
- **iOS**：v1 的主要執行平台。
- **Web_Preview**：僅供開發驗證、非正式支援的瀏覽器版本。
- **SQLite_Store**：儲存 App 結構化本機資料的 SQLite 資料庫。
- **Secure_Store**：iOS 上由 `expo-secure-store` 提供的敏感資料儲存區。
- **API_Key**：使用者提供給 AI_Endpoint 的存取憑證。
- **Local_Date**：依紀錄建立或編輯時裝置時區計算並持久保存的 `YYYY-MM-DD` 日期。
- **UTC_Timestamp**：採 UTC 保存的時間點。
- **Time_Zone_Metadata**：產生 Local_Date 時的 IANA 時區識別碼與 UTC offset。
- **Day_Boundary_Manager**：判定目前 Local_Date 與換日事件的 App 元件。
- **Meal_Type**：早餐、午餐、晚餐或點心四種分類之一。
- **Food_Entry**：一筆已確認的飲食紀錄，包含食物名稱、Meal_Type、營養基準、食用量、營養計算快照及日期時間。
- **Nutrition_Basis**：`PER_100_G`（每 100 g）或 `PER_SERVING`（每份）兩種營養標示基準之一。
- **Source_Nutrients**：依 Nutrition_Basis 表示的 kcal、蛋白質 P、脂肪 F、碳水化合物 C 原始值。
- **Consumed_Quantity**：`PER_100_G` 下的食用克數，或 `PER_SERVING` 下的食用份數。
- **Nutrition_Snapshot**：Food_Entry 確認時，依 Source_Nutrients 與 Consumed_Quantity 算出的 kcal、P、F、C 結果。
- **Daily_Goal_Version**：含生效 Local_Date 與每日 kcal、P、F、C 目標的一個不可回溯版本。
- **Food_Catalog**：本機儲存且可重用的食物資料集合。
- **Favorite_Food**：使用者明確標示為常用的 Food_Catalog 項目。
- **Recent_Food**：依最近確認使用時間排序的 Food_Catalog 項目。
- **Barcode_Cache**：以正規化條碼為鍵、保存使用者確認後產品資料的本機快取。
- **OFF**：Open Food Facts 外部產品資料服務。
- **OFF_Result**：OFF 回傳但尚未經使用者確認的產品資料。
- **Data_Quality_Warning**：指出來源、缺欄、單位或營養值可疑狀況的非阻斷提示。
- **AI_Endpoint**：使用 OpenAI-compatible 通訊格式的使用者設定 DeepSeek 服務端點。
- **Capability_Check**：在傳送圖片前，判定指定 AI_Endpoint 與模型是否已明確證實支援 vision 的檢查。
- **AI_Request**：使用者明確啟動後送往 AI_Endpoint 的圖片或文字描述。
- **AI_Suggestion**：AI 回傳且通過 JSON 結構驗證、但尚未確認的食物草稿。
- **AI_Response_Parser**：依本規格 AI JSON Schema 將回應轉成 AI_Suggestion 或錯誤的元件。
- **AI_Response_Serializer**：依相同 AI JSON Schema 將 AI_Suggestion 轉成標準 JSON 的元件。
- **AI_JSON_Schema**：要求單一 JSON 物件包含 `name`、`basis`、`quantity`、`kcal`、`protein_g`、`fat_g`、`carbs_g` 與 `confidence`；`basis` 僅可為 `PER_100_G` 或 `PER_SERVING`，其餘數值欄位須為有限十進位數。
- **Weight_Entry**：一筆含公斤值、UTC_Timestamp、Local_Date 與 Time_Zone_Metadata 的體重紀錄。
- **Daily_Last_Weight**：某 Local_Date 中 UTC_Timestamp 最大的 Weight_Entry；時間相同時取建立序號最大的紀錄。
- **Chart**：呈現飲食或體重統計的視覺化元件。
- **Supported_Dataset**：最多 10,000 筆 Food_Entry、5,000 筆 Weight_Entry 與 2,000 筆 Food_Catalog 項目的本機資料量。
- **Reference_Device**：執行 release build、未開啟除錯工具的 iPhone 12 或效能更高的 iPhone。
- **Decimal_Half_Up**：數字恰位於中點時向絕對值較大的方向進位之十進位四捨五入規則。
- **Database_Migration**：將 SQLite_Store 從已支援舊 schema 版本轉換至目前 schema 版本的程序。

## Requirements

### Requirement 1: 本機優先與平台範圍

**User Story:** 身為個人使用者，我希望免帳號即可在 iPhone 記錄資料，以便在沒有網路時仍可使用核心功能。

#### Acceptance Criteria

1. THE App SHALL 以繁體中文提供 v1 的導覽、欄位標籤、提示與錯誤訊息。
2. THE App SHALL 允許使用者在未建立帳號的情況下使用所有本機核心功能。
3. THE SQLite_Store SHALL 在裝置端保存 Food_Entry、Daily_Goal_Version、Food_Catalog、Barcode_Cache 與 Weight_Entry。
4. WHILE 裝置無網路連線, THE App SHALL 保持飲食、目標、體重、歷史與統計等本機功能可用。
5. WHERE 執行平台為 Web_Preview, THE App SHALL 顯示「僅供開發預覽，資料與安全儲存行為不代表 iOS 正式版本」標示。

### Requirement 2: 飲食日記與餐別

**User Story:** 身為使用者，我希望依日期和餐別管理飲食，以便檢視每日攝取。

#### Acceptance Criteria

1. WHEN 使用者選擇 Local_Date, THE App SHALL 顯示該 Local_Date 依早餐、午餐、晚餐及點心分組的 Food_Entry。
2. WHEN 使用者確認有效的食物草稿, THE App SHALL 建立一筆包含 Meal_Type、來源資料與 Nutrition_Snapshot 的 Food_Entry。
3. WHEN 使用者編輯 Food_Entry 的食物、營養基準、食用量、Meal_Type 或時間, THE App SHALL 重新驗證並保存更新後的 Nutrition_Snapshot 與日期時間欄位。
4. WHEN 使用者要求刪除 Food_Entry, THE App SHALL 在二次確認後永久刪除指定 Food_Entry 並重新計算受影響日期的統計。
5. WHEN Food_Entry 被刪除, THE Food_Catalog SHALL 保留對應食物資料與 Favorite_Food 狀態。

### Requirement 3: 份量與營養統一計算

**User Story:** 身為使用者，我希望每 100 g 與每份標示都能一致換算，以便得到可比較的攝取量。

#### Acceptance Criteria

1. WHERE Nutrition_Basis 為 `PER_100_G`, THE App SHALL 將每一 Nutrition_Snapshot 欄位計算為對應 Source_Nutrients 欄位乘以 Consumed_Quantity 再除以 100。
2. WHERE Nutrition_Basis 為 `PER_SERVING`, THE App SHALL 將每一 Nutrition_Snapshot 欄位計算為對應 Source_Nutrients 欄位乘以 Consumed_Quantity。
3. WHEN App 建立或更新 Food_Entry, THE App SHALL 保存 Nutrition_Basis、Source_Nutrients、Consumed_Quantity 與未經顯示層四捨五入的 Nutrition_Snapshot。
4. WHEN Food_Catalog 或 Barcode_Cache 的來源營養值後續變更, THE App SHALL 維持既有 Food_Entry 的 Nutrition_Snapshot 不變。
5. WHEN App 顯示 Nutrition_Snapshot, THE App SHALL 以 Decimal_Half_Up 將 kcal 顯示至整數並將 P、F、C 顯示至 0.1 g。
6. WHEN App 彙總多筆 Food_Entry, THE App SHALL 先加總未經顯示層四捨五入的 Nutrition_Snapshot 再套用顯示四捨五入。

### Requirement 4: 數值驗證

**User Story:** 身為使用者，我希望 App 阻止無效數值，以便避免錯誤統計。

#### Acceptance Criteria

1. WHEN 使用者輸入 kcal、P、F、C、食用克數、食用份數、每日目標或體重, THE App SHALL 接受整數或十進位數並拒絕空字串、非數字、非有限數、負數及超出允許範圍的值。
2. WHERE Nutrition_Basis 為 `PER_100_G`, THE App SHALL 限制 Consumed_Quantity 為大於 0 且不超過 10,000 g。
3. WHERE Nutrition_Basis 為 `PER_SERVING`, THE App SHALL 限制 Consumed_Quantity 為大於 0 且不超過 100 份。
4. THE App SHALL 限制 Source_Nutrients 與每日目標為 kcal 介於 0 至 100,000 且 P、F、C 各介於 0 至 10,000 g。
5. THE App SHALL 限制 Weight_Entry 的公斤值為大於 0 且不超過 1,000 kg。
6. IF 任何必要欄位缺漏或未通過驗證, THEN THE App SHALL 保留可修正的草稿並以繁體中文指出每一個無效欄位。
7. WHEN App 保存有效數值, THE App SHALL 以十進位精度至少 0.01 保存營養值、數量、目標與體重。

### Requirement 5: 日期、時區與換日

**User Story:** 身為會旅行或跨午夜使用 App 的使用者，我希望紀錄日期穩定且今日畫面正確換日，以便避免紀錄被移到錯誤日期。

#### Acceptance Criteria

1. WHEN App 建立 Food_Entry 或 Weight_Entry, THE App SHALL 保存 UTC_Timestamp、當下 Local_Date 與 Time_Zone_Metadata。
2. WHEN 裝置時區後續改變, THE App SHALL 維持既有 Food_Entry 與 Weight_Entry 所保存的 Local_Date 不變。
3. WHEN 使用者編輯紀錄時間, THE App SHALL 依編輯時裝置時區重新計算並保存該紀錄的 Local_Date 與 Time_Zone_Metadata。
4. WHEN 裝置跨越本機午夜或 App 從背景返回前景, THE Day_Boundary_Manager SHALL 在 60 秒內更新目前 Local_Date。
5. WHILE 使用者正在檢視歷史 Local_Date, THE App SHALL 在換日後維持所選歷史 Local_Date 並提供返回今日的操作。

### Requirement 6: 每日目標版本

**User Story:** 身為使用者，我希望手動設定每日營養目標且修改不影響過去，以便如實比較不同時期。

#### Acceptance Criteria

1. WHEN 使用者首次保存有效的 kcal、P、F、C 目標, THE App SHALL 建立以當下 Local_Date 為生效日期的 Daily_Goal_Version。
2. WHEN 使用者修改每日目標, THE App SHALL 建立或取代以當下 Local_Date 為生效日期的 Daily_Goal_Version。
3. WHEN App 顯示某 Local_Date 的目標, THE App SHALL 使用生效日期不晚於該 Local_Date 且生效日期最晚的 Daily_Goal_Version。
4. IF 某 Local_Date 之前不存在 Daily_Goal_Version, THEN THE App SHALL 將該日目標顯示為「尚未設定」。
5. WHEN Daily_Goal_Version 被新增或修改, THE App SHALL 維持較早 Local_Date 所解析出的目標不變。

### Requirement 7: 手動新增、常用與最近

**User Story:** 身為使用者，我希望能手動新增並重用常用或最近食物，以便降低重複輸入成本。

#### Acceptance Criteria

1. WHEN 使用者選擇手動新增, THE App SHALL 提供食物名稱、Nutrition_Basis、Source_Nutrients、Consumed_Quantity 與 Meal_Type 欄位。
2. WHEN 使用者確認有效的手動食物草稿, THE Food_Catalog SHALL 保存可供後續選用的食物資料。
3. WHEN 使用者切換食物的常用狀態, THE Food_Catalog SHALL 更新對應 Favorite_Food 狀態。
4. WHEN App 顯示常用清單, THE App SHALL 僅列出仍存在且標示為 Favorite_Food 的 Food_Catalog 項目。
5. WHEN App 顯示最近清單, THE App SHALL 依 Food_Catalog 項目最近一次建立已確認 Food_Entry 的時間由新至舊排序並最多顯示 20 項。
6. WHEN 使用者從常用或最近清單選擇食物, THE App SHALL 建立可編輯且需再次確認的食物草稿。
7. WHEN 使用者要求刪除 Food_Catalog 項目, THE App SHALL 在二次確認後刪除該項目、對應 Favorite_Food 狀態及對應 Barcode_Cache 項目，並維持既有 Food_Entry 不變。

### Requirement 8: 條碼、本機快取與 OFF 查詢

**User Story:** 身為使用者，我希望掃描條碼時優先使用本機資料並可查詢 OFF，以便快速建立可靠紀錄。

#### Acceptance Criteria

1. WHEN App 取得可辨識條碼, THE App SHALL 先以移除空白且保留前導零的條碼值查詢 Barcode_Cache。
2. WHEN Barcode_Cache 命中條碼, THE App SHALL 顯示來源標示為本機快取且需使用者確認的食物草稿。
3. WHEN Barcode_Cache 未命中且裝置有網路連線, THE App SHALL 查詢 OFF 並在 10 秒內取得結果或回報逾時。
4. WHEN OFF 回傳產品, THE App SHALL 將 OFF_Result 映射為可編輯草稿並標示資料來源、產品名稱、Nutrition_Basis、可取得的營養欄位及缺漏欄位。
5. IF OFF 無對應產品、連線失敗或查詢逾時, THEN THE App SHALL 顯示原因並提供重試及改用手動新增的操作。
6. WHILE 裝置無網路連線且 Barcode_Cache 未命中, THE App SHALL 停止外部查詢並提供改用手動新增的操作。
7. WHEN 使用者確認由 OFF_Result 形成的有效草稿, THE Barcode_Cache SHALL 以該條碼更新使用者確認後的產品資料與確認時間。
8. WHEN 使用者取消 OFF_Result 或本機快取草稿, THE App SHALL 保持 Food_Entry 與 Barcode_Cache 不變。

### Requirement 9: OFF 缺欄位與資料品質

**User Story:** 身為使用者，我希望辨識外部資料的缺漏與可疑值，以便在寫入前修正。

#### Acceptance Criteria

1. WHEN OFF_Result 缺少 kcal、P、F 或 C, THE App SHALL 將各缺漏欄位顯示為「未知」而非數值 0。
2. IF OFF_Result 缺少食物名稱、Nutrition_Basis、Consumed_Quantity 或任何 Source_Nutrients 欄位, THEN THE App SHALL 要求使用者補齊並通過驗證後才可確認 Food_Entry。
3. IF `PER_100_G` 的 P、F 或 C 任一欄位大於 100 g, THEN THE App SHALL 顯示 Data_Quality_Warning。
4. IF Source_Nutrients 的巨量營養素換算熱量與 kcal 差異同時超過 50 kcal 及 kcal 的 20%, THEN THE App SHALL 顯示 Data_Quality_Warning；換算公式為 P×4 + F×9 + C×4。
5. IF OFF_Result 的營養單位無法明確映射至 kcal 與 g, THEN THE App SHALL 將受影響欄位視為未知並顯示 Data_Quality_Warning。
6. WHEN 食物草稿具有 Data_Quality_Warning 且所有必要欄位有效, THE App SHALL 要求使用者再次明確確認後才可建立 Food_Entry。

### Requirement 10: AI 設定、能力檢查與降級

**User Story:** 身為使用者，我希望 AI 分析能依端點能力安全降級，以便在不同 DeepSeek 相容模型上得到可預期行為。

#### Acceptance Criteria

1. WHEN 使用者在 iOS 保存 AI_Endpoint 設定, THE Secure_Store SHALL 保存 API_Key，且 SQLite_Store SHALL 僅保存不含 API_Key 的端點與模型設定。
2. WHERE 執行平台為 Web_Preview, THE App SHALL 僅在目前頁面工作階段的記憶體中保存 API_Key 並顯示不支援安全持久儲存的警告。
3. WHEN Web_Preview 頁面重新載入或工作階段結束, THE App SHALL 清除記憶體中的 API_Key。
4. WHEN 使用者要求圖片分析且指定端點與模型尚無成功的 Capability_Check, THE App SHALL 在傳送圖片前執行 Capability_Check。
5. WHEN 使用者變更 AI_Endpoint 的端點或模型, THE App SHALL 使先前 Capability_Check 結果失效。
6. IF Capability_Check 明確證實 vision 支援, THEN THE App SHALL 允許使用者確認後傳送所選圖片。
7. IF Capability_Check 回報不支援、失敗、逾時或結果不明, THEN THE App SHALL 停止傳送圖片並改為要求使用者提供文字描述。
8. WHEN AI_Request 連線失敗、逾時或服務回傳錯誤, THE App SHALL 保留使用者草稿並顯示原因、重試及手動新增操作。
9. WHILE 裝置無網路連線, THE App SHALL 停止 Capability_Check 與 AI_Request 並提供手動新增操作。

### Requirement 11: AI JSON 驗證、確認與往返一致性

**User Story:** 身為使用者，我希望 AI 回應經過嚴格驗證且由我確認，以便避免錯誤資料直接進入日記。

#### Acceptance Criteria

1. WHEN AI_Endpoint 回傳內容, THE AI_Response_Parser SHALL 依 AI_JSON_Schema 接受單一 JSON 物件或拒絕整個回應並回傳可辨識的驗證錯誤。
2. IF AI 回應包含 markdown code fence、額外非 JSON 文字、缺少必要欄位、未知 basis、非有限數或不符需求 4 範圍的數值, THEN THE AI_Response_Parser SHALL 拒絕整個回應。
3. WHEN AI_Response_Parser 接受回應, THE App SHALL 將 AI_Suggestion 顯示為標示「AI 推估」與 confidence 的可編輯草稿。
4. WHEN 使用者確認有效的 AI_Suggestion, THE App SHALL 建立 Food_Entry 並將資料來源標示為 AI 推估。
5. WHEN 使用者取消 AI_Suggestion, THE App SHALL 保持 Food_Entry 與 Food_Catalog 不變。
6. WHEN AI_Response_Serializer 序列化有效 AI_Suggestion, THE AI_Response_Serializer SHALL 產生符合 AI_JSON_Schema 且不含額外欄位的 JSON。
7. WHEN AI_Response_Parser 解析由 AI_Response_Serializer 產生的 JSON, THE AI_Response_Parser SHALL 產生與原 AI_Suggestion 各欄位等值的結果。

### Requirement 12: AI 隱私

**User Story:** 身為使用者，我希望知道哪些資料會送往外部 AI，以便控制個人資料揭露。

#### Acceptance Criteria

1. WHEN 使用者首次啟動 AI_Request, THE App SHALL 在傳送前揭露 AI_Endpoint 為外部服務、將傳送的資料類型及資料用途並取得明確同意。
2. WHEN 使用者啟動後續 AI_Request, THE App SHALL 在傳送按鈕旁標示將送往外部服務的圖片或文字內容。
3. WHEN App 建立 AI_Request, THE App SHALL 僅包含使用者為該次分析選取的圖片或輸入文字，以及產生 AI_JSON_Schema 回應所需的指令。
4. WHEN App 傳送圖片, THE App SHALL 在傳送前移除可移除的 EXIF 位置資訊與其他圖片中繼資料。
5. THE App SHALL 排除 Food_Entry 歷史、Weight_Entry、Daily_Goal_Version、其他照片及 API_Key 於 AI_Request 內容之外。
6. WHEN AI_Request 完成、失敗或取消, THE App SHALL 清除該次請求建立的暫存圖片副本與回應暫存內容。
7. WHEN 使用者撤回 AI 外傳同意, THE App SHALL 停止後續 AI_Request，直到使用者再次完成明確同意。

### Requirement 13: 體重紀錄與每日趨勢值

**User Story:** 身為使用者，我希望同一天可記錄多次體重，但趨勢只採最後一筆，以便保留細節且避免圖表重複。

#### Acceptance Criteria

1. WHEN 使用者確認有效體重與時間, THE App SHALL 建立 Weight_Entry 並允許同一 Local_Date 存在多筆 Weight_Entry。
2. WHEN 使用者檢視某 Local_Date 的體重明細, THE App SHALL 依 UTC_Timestamp 由新至舊顯示該日全部 Weight_Entry。
3. WHEN App 計算每日體重趨勢, THE App SHALL 對每一 Local_Date 僅採用 Daily_Last_Weight。
4. WHEN 使用者編輯 Weight_Entry 的公斤值或時間, THE App SHALL 重新驗證紀錄並重新計算受影響 Local_Date 的 Daily_Last_Weight。
5. WHEN 使用者要求刪除 Weight_Entry, THE App SHALL 在二次確認後永久刪除指定 Weight_Entry 並重新計算受影響 Local_Date 的 Daily_Last_Weight。
6. WHEN App 顯示體重, THE App SHALL 以 Decimal_Half_Up 顯示至 0.1 kg 並以未經顯示層四捨五入的值進行趨勢計算。

### Requirement 14: 7 日飲食統計

**User Story:** 身為使用者，我希望檢視近期飲食攝取與目標，以便辨識趨勢。

#### Acceptance Criteria

1. WHEN 使用者選擇飲食統計結束日期, THE App SHALL 使用該 Local_Date 及前 6 個 Local_Date 組成 7 日區間。
2. WHEN 7 日區間中的 Local_Date 至少有一筆 Food_Entry, THE App SHALL 顯示該日 kcal、P、F、C 的 Nutrition_Snapshot 總和。
3. WHEN 7 日區間中的 Local_Date 沒有 Food_Entry, THE Chart SHALL 將該日顯示為「未記錄」而非攝取量 0。
4. WHEN App 計算 7 日平均攝取, THE App SHALL 僅以具有至少一筆 Food_Entry 的 Local_Date 為分母並同時顯示已記錄日數。
5. WHEN 7 日區間中的 Local_Date 具有可解析的 Daily_Goal_Version, THE App SHALL 顯示該日攝取量與該日目標的差值。
6. IF 7 日區間沒有任何 Food_Entry, THEN THE Chart SHALL 顯示「此期間尚無飲食紀錄」與新增飲食紀錄的操作，並隱藏數值座標與平均值。

### Requirement 15: 7 日與 30 日體重統計

**User Story:** 身為使用者，我希望查看短期與中期體重趨勢，以便了解變化。

#### Acceptance Criteria

1. WHEN 使用者選擇 7 日體重範圍, THE App SHALL 使用所選 Local_Date 及前 6 個 Local_Date 組成區間。
2. WHEN 使用者選擇 30 日體重範圍, THE App SHALL 使用所選 Local_Date 及前 29 個 Local_Date 組成區間。
3. WHEN 體重區間包含 Weight_Entry, THE Chart SHALL 對每個有紀錄的 Local_Date 顯示一個 Daily_Last_Weight 資料點並保留無紀錄日期的缺口。
4. WHEN 體重區間至少包含兩個 Daily_Last_Weight, THE App SHALL 將變化量計算為日期最晚資料點減去日期最早資料點的未四捨五入公斤值。
5. WHEN 體重區間僅包含一個 Daily_Last_Weight, THE App SHALL 顯示該資料點並將變化量顯示為「資料不足」。
6. IF 體重區間沒有任何 Weight_Entry, THEN THE Chart SHALL 顯示「此期間尚無體重紀錄」與新增體重紀錄的操作，並隱藏數值座標與變化量。

### Requirement 16: 刪除、快取與全部資料清除

**User Story:** 身為使用者，我希望清楚控制紀錄與快取的刪除範圍，以便避免誤刪歷史。

#### Acceptance Criteria

1. WHEN 使用者清除 Barcode_Cache, THE App SHALL 刪除全部條碼快取項目並維持 Food_Entry、Food_Catalog、Favorite_Food、Daily_Goal_Version 與 Weight_Entry 不變。
2. WHEN Barcode_Cache 項目超過 180 日未被命中或更新, THE App SHALL 在下次快取維護時刪除該項目並維持其他本機資料不變。
3. WHEN Barcode_Cache 項目總數超過 2,000, THE App SHALL 依最後命中或更新時間由舊至新刪除項目直到總數為 2,000。
4. WHEN 使用者要求清除全部本機資料, THE App SHALL 顯示將刪除的資料類型、不可復原警告及輸入指定確認文字的步驟。
5. WHEN 使用者完成全部本機資料清除確認, THE App SHALL 刪除 SQLite_Store 內的全部 App 資料、Secure_Store 內的 API_Key 及 Web_Preview 記憶體中的 API_Key，並回到無資料初始狀態。
6. WHEN 使用者取消任何刪除確認, THE App SHALL 維持刪除範圍內的資料不變。

### Requirement 17: 資料庫遷移與備份邊界

**User Story:** 身為使用者，我希望 App 更新時保護本機紀錄，並清楚知道 v1 的備份限制，以便評估資料風險。

#### Acceptance Criteria

1. WHEN App 開啟現有 SQLite_Store, THE App SHALL 在允許資料寫入前檢查 schema 版本。
2. WHEN SQLite_Store schema 屬於已支援舊版本, THE Database_Migration SHALL 在單一資料庫交易中依序遷移至目前版本。
3. WHEN Database_Migration 成功, THE Database_Migration SHALL 保留遷移前所有可識別 Food_Entry、Daily_Goal_Version、Food_Catalog、Barcode_Cache 與 Weight_Entry 的業務值與關聯。
4. IF Database_Migration 失敗, THEN THE Database_Migration SHALL 回復該次交易、保留遷移前 schema 與資料，並使 App 進入禁止資料寫入的復原畫面。
5. IF SQLite_Store schema 版本高於 App 支援版本或資料庫無法讀取, THEN THE App SHALL 停止資料寫入並顯示保留裝置資料及更新或重新開始的選項。
6. THE App SHALL 在設定頁揭露 v1 不提供內建匯出、匯入、雲端備份或跨裝置還原，且移除 App、裝置遺失及裝置備份政策可能造成資料無法復原。
7. WHEN 作業系統提供 App 容器備份, THE App SHALL 將 SQLite_Store 是否被備份與還原的最終行為交由作業系統備份設定決定，並排除該行為於 v1 驗收保證之外。

### Requirement 18: 可及性

**User Story:** 身為使用輔助功能的使用者，我希望能以 VoiceOver、放大文字與足夠對比操作 App，以便獨立完成核心紀錄流程。

#### Acceptance Criteria

1. WHEN VoiceOver 啟用, THE App SHALL 為所有可操作控制項、Food_Entry、Weight_Entry、統計摘要與 Chart 資料點提供繁體中文可及名稱、角色、值與操作提示。
2. WHEN iOS 文字大小設定為預設值的 200%, THE App SHALL 使核心流程文字可讀且主要操作不因截斷或重疊而無法使用。
3. THE App SHALL 為觸控控制項提供至少 44×44 pt 的可操作區域。
4. THE App SHALL 使一般文字與背景的對比度至少為 4.5:1，且大型文字與背景的對比度至少為 3:1。
5. WHEN App 表示餐別、目標狀態、警告、錯誤或 Chart 數列, THE App SHALL 同時使用文字、圖示或形狀中的至少一種非顏色線索。
6. WHEN 使用者使用鍵盤或輔助切換控制導覽表單, THE App SHALL 以符合視覺閱讀順序的次序移動焦點並將驗證錯誤焦點移至第一個無效欄位。

### Requirement 19: 效能與外部請求時限

**User Story:** 身為使用者，我希望本機操作反應穩定且外部請求有明確時限，以便快速完成紀錄。

#### Acceptance Criteria

1. WHERE 使用 Supported_Dataset 與 Reference_Device, WHEN App 冷啟動且不需 Database_Migration, THE App SHALL 在 3 秒內顯示可操作的今日畫面。
2. WHERE 使用 Supported_Dataset 與 Reference_Device, WHEN 使用者開啟任一日期的飲食日記, THE App SHALL 在 1 秒內顯示該日已儲存 Food_Entry。
3. WHERE 使用 Supported_Dataset 與 Reference_Device, WHEN 使用者開啟 7 日飲食或 7 日及 30 日體重統計, THE App SHALL 在 1 秒內顯示完整本機統計結果。
4. WHERE 使用 Supported_Dataset 與 Reference_Device, WHEN 使用者搜尋常用或最近食物, THE App SHALL 在 500 毫秒內顯示結果。
5. WHEN OFF 請求持續 10 秒仍未完成, THE App SHALL 終止等待並顯示逾時處理。
6. WHEN Capability_Check 持續 10 秒仍未完成, THE App SHALL 將結果判定為不明並套用文字描述降級。
7. WHEN AI_Request 持續 30 秒仍未完成, THE App SHALL 終止等待、保留草稿並顯示逾時處理。
8. WHILE OFF、Capability_Check 或 AI_Request 正在等待回應, THE App SHALL 保持取消操作與所有不依賴該回應的本機畫面可操作。
