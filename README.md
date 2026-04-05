# 醫美門市請購系統

## 上線前，請先在 Supabase SQL Editor 執行以下補充指令

```sql
-- 補充：在 requisitions 表格加入退回原因欄位
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS reject_reason TEXT;
```

## 設定步驟

1. 複製 `.env.example` 改名為 `.env`
2. 填入你的 Supabase Project URL 和 anon key
3. 執行 `npm install`
4. 執行 `npm run dev` 本機測試

## 部署到 Vercel

1. 上傳到 GitHub
2. 在 Vercel 匯入專案
3. 設定環境變數 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
4. 點 Deploy

## 使用者角色

- `staff`：門市員工
- `manager`：門市店長
- `purchasing`：採購人員

角色在 Supabase user_profiles 表格的 role 欄位設定。
