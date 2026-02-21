# 包袱铺 (Punchliner)

一个段子分享 + AI 增强工具，用户可以浏览段子、使用 AI 续写/改写/吐槽/生成图片，并将段子一键生成朋友圈素材。

## 功能特性

### 核心功能

- **每日一乐卡片** - 首页展示随机段子，支持"换一个"功能（2秒冷却）
- **段子列表** - 无限滚动加载更多段子
- **段子详情** - 点击卡片查看完整段子内容
- **收藏功能** - 收藏感兴趣的段子，存储在本地

### AI 增强功能

- **AI 续写** - 根据原段子内容，让 AI 续写后续情节
- **AI 改写风格** - 将段子改写成不同风格（冷幽默、黑色幽默、沙雕风、文艺复兴、段子手）
- **AI 吐槽** - AI 对段子进行毒舌点评
- **AI 生成图片** - 根据段子内容生成配图

## 技术栈

- **前端框架**: Next.js 16 + React 19 + TypeScript
- **UI 组件库**: Ant Design 6 + Tailwind CSS
- **状态管理**: React useState
- **HTTP 客户端**: fetch
- **AI 集成**: 智谱 AI (GLM-4-Flash, CogView-3)
- **部署平台**: Vercel

## 项目结构

```
punchliner/
├── public/
│   ├── favicon.ico
│   └── logo.jpg
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── jokes/random/route.ts    # 随机段子 API
│   │   │   ├── jokes/list/route.ts      # 分页段子 API
│   │   │   ├── ai/generate/route.ts     # AI 文本生成 API
│   │   │   └── ai/image/route.ts        # AI 图片生成 API
│   │   ├── joke/[id]/page.tsx           # 段子详情页
│   │   ├── collect/page.tsx             # 收藏页
│   │   ├── layout.tsx                   # 根布局
│   │   ├── page.tsx                     # 首页
│   │   ├── providers.tsx                # Antd Provider
│   │   └── globals.css                  # 全局样式
│   ├── lib/
│   │   ├── joke.ts                      # 段子数据获取
│   │   ├── ai.ts                        # 智谱 AI 调用
│   │   └── route.ts                     # 路由前缀工具
│   └── types/index.ts                   # TypeScript 类型定义
├── .env.local.example                    # 环境变量示例
├── package.json
├── tailwind.config.mjs
└── tsconfig.json
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/punchliner.git
cd punchliner
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制环境变量示例文件：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 填入真实的 API Key：

```env
# 智谱 AI API Key (用于 AI 功能)
ZHIPU_API_KEY=your_zhipu_api_key_here

# 段子 API 配置 (来自 mxnzp.com)
MXNZP_APP_ID=your_app_id_here
MXNZP_APP_SECRET=your_app_secret_here

# 路由前缀 (可选，用于子目录部署)
ROUTE_PREFIX=
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 即可使用。

### 5. 构建生产版本

```bash
npm run build
npm run start
```

## API 说明

### 段子 API (mxnzp)

- **随机获取段子**: `GET /api/jokes/random`
- **分页获取段子**: `GET /api/jokes/list?page=1`

### AI API (智谱)

- **AI 文本生成**: `POST /api/ai/generate`
  ```json
  {
    "type": "continue|rewrite|roast|similar|moments",
    "content": "段子内容",
    "style": "冷幽默" // 仅 rewrite 时需要
  }
  ```

- **AI 图片生成**: `POST /api/ai/image`
  ```json
  {
    "content": "段子内容"
  }
  ```

## 数据缓存策略

- **每日段子**: 存储在 `localStorage`，过期时间为当天，当天内不重复请求
- **段子列表**: 存储在 `sessionStorage`，返回列表时从缓存恢复
- **收藏数据**: 存储在 `localStorage`，持久化保存

## 部署

### Vercel 部署

1. 将项目推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

### 静态导出

```bash
npm run build
```

生成的静态文件在 `out/` 目录中。

## License

MIT
