# Frontend

## 运行环境
- Node.js 18+
- npm 9+

## 启动步骤
1. 进入目录：
   `cd frontend`
2. 安装依赖：
   `npm install`
3. 启动开发服务：
   `npm run dev`
4. 浏览器访问：
   `http://127.0.0.1:5173`

## 接口说明
- 当前前端仅连接 Supabase，不再依赖本地 Flask 服务。
- 需要配置 `.env.local` 里的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
