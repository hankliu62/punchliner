# GitHub Actions 自动化部署 Next.js 到 Vercel 完全指南

> 深度解析「Deploy from a branch」模式，手把手教你搭建企业级 CI/CD 流水线

![GitHub Actions + Vercel 部署架构](https://picsum.photos/seed/vercel-gh/1200/600)

## 前言

在前端工程化日益成熟的今天，自动化部署已经成为提升开发效率的标准配置。对于 Next.js 开发者来说，Vercel 提供了开箱即用的部署体验，但标准的「一键部署」模式往往无法满足企业对构建流程的精细控制需求。

本文将详细介绍如何通过 **GitHub Actions + Vercel** 的组合模式，实现完全可控的自动化部署流程。我们会深入探讨每一步配置的原理，解析多层缓存优化策略，并提供可直接复用的配置模板。

**特别说明**：本文采用「Deploy from a branch」模式，即代码的构建过程完全在 GitHub Actions runner 中完成，仅将构建产物推送到 Vercel。这种方式与 Vercel 原生自动部署相比，赋予了开发者对构建环境的完全控制权。

---

## 一、部署架构总览

### 1.1 整体流程图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           GitHub Actions + Vercel 部署架构                           │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐    push     ┌─────────────────────┐         ┌──────────────────┐
    │  开发者   │ ─────────► │    GitHub 仓库      │         │     Vercel      │
    │  本地开发  │            │   (master 分支)     │         │   (生产环境)     │
    └──────────┘            └──────────┬──────────┘         └────────┬─────────┘
                                       │                                 │
                                       │  触发 Workflow                  │
                                       ▼                                 │
                            ┌─────────────────────┐                        │
                            │  GitHub Actions    │                        │
                            │  (Ubuntu Runner)   │                        │
                            └──────────┬──────────┘                        │
                                       │                                    │
                    ┌──────────────────┼──────────────────┐                │
                    │                  │                  │                │
                    ▼                  ▼                  ▼                │
           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
           │   Checkout   │   │   Setup      │   │  Install     │        │
           │    代码      │──►│   Node.js    │──►│   pnpm      │        │
           │              │   │   + pnpm     │   │   deps      │        │
           └──────────────┘   └──────────────┘   └──────┬───────┘        │
                                                       │                  │
                                                       ▼                  │
                                              ┌──────────────┐          │
                                              │   Next.js    │          │
                                              │   Build      │          │
                                              │  (.next/)    │          │
                                              └──────┬───────┘          │
                                                     │                  │
                                                     ▼                  │
                                              ┌──────────────┐    推送构建产物
                                              │   Deploy     │───────────►
                                              │   to Vercel │    (vercel-action)
                                              └──────────────┘
```

### 1.2 核心技术栈

| 技术选型 | 版本 | 说明 |
|---------|------|------|
| Next.js | 16.1.6 | React 全栈框架 |
| pnpm | 9 | 高性能包管理器 |
| Node.js | 20 | 运行时环境 |
| GitHub Actions | - | CI/CD 自动化 |
| Vercel | - | 托管平台 |

---

## 二、准备工作：Vercel 凭证配置

在开始配置 GitHub Actions 之前，我们需要完成 Vercel 的 API 凭证配置。这是整个自动化流程的基础。

### 2.1 获取 Vercel Token

打开浏览器，访问 [Vercel 官网](https://vercel.com) 并登录你的账户。

![Vercel 登录页面](https://picsum.photos/seed/vercel-login/800/400)

点击右上角的头像，选择 **Settings** 进入设置页面：

![Vercel 设置页面入口](https://picsum.photos/seed/vercel-settings/800/300)

在左侧菜单中找到 **Tokens** 选项，点击进入令牌管理页面：

![Vercel Tokens 页面](https://picsum.photos/seed/vercel-tokens/900/400)

点击 **Create** 按钮创建一个新令牌：

![创建 Vercel Token](https://picsum.photos/seed/vercel-create-token/700/350)

在弹出的对话框中，给令牌取一个容易识别的名称，例如「GitHub Actions Deploy」，然后点击 **Create**：

> ⚠️ **重要提示**：令牌创建成功后，请立即复制并保存到安全的地方。Vercel 出于安全考虑，只会显示这一次！

### 2.2 获取项目配置 ID

回到 Vercel 设置页面，这次选择 **General** 选项卡：

![Vercel General 设置](https://picsum.photos/seed/vercel-general/900/500)

在页面中找到 **Deployment** 部分，可以看到以下关键信息：

| 配置项 | 说明 | 示例值 |
|-------|------|--------|
| Vercel Org ID | 组织唯一标识 | org_xxxxxxxxxxxxxx |
| Vercel Project ID | 项目唯一标识 | prj_xxxxxxxxxxxxxx |

将这些 ID 记录下来，后续会用到。

### 2.3 配置 GitHub Secrets

现在我们需要将 Vercel 的凭证安全地存储到 GitHub 仓库中。

打开你的 GitHub 仓库页面，点击 **Settings** 选项卡：

![GitHub 仓库设置](https://picsum.photos/seed/gh-settings/900/400)

在左侧菜单中找到 **Secrets and variables** 下的 **Actions** 选项：

![GitHub Actions Secrets](https://picsum.photos/seed/gh-secrets/900/450)

点击 **New repository secret** 按钮，添加以下三个密钥：

#### 第一个：VERCEL_TOKEN

- **Name**: `VERCEL_TOKEN`
- **Secret**: 粘贴你刚才创建的 Vercel 访问令牌

![添加 VERCEL_TOKEN](https://picsum.photos/seed/gh-secret-token/700/350)

#### 第二个：VERCEL_ORG_ID

- **Name**: `VERCEL_ORG_ID`
- **Secret**: 你的 Vercel 组织 ID

#### 第三个：VERCEL_PROJECT_ID

- **Name**: `VERCEL_PROJECT_ID`
- **Secret**: 你的 Vercel 项目 ID

完成后的 Secrets 列表应该类似这样：

![Secrets 列表](https://picsum.photos/seed/gh-secrets-list/900/300)

---

## 三、项目配置：环境准备

在本地开发环境中，我们需要确保项目配置正确，以便 GitHub Actions 能够顺利执行构建。

### 3.1 切换到 pnpm（推荐）

相比 npm 和 yarn，pnpm 具有以下显著优势：

| 特性 | npm | yarn | pnpm |
|------|-----|------|------|
| 磁盘占用 | 较大 | 较大 | 最小（硬链接） |
| 安装速度 | 较慢 | 中等 | 最快 |
| 依赖管理 | 扁平化 | 扁平化 | 非扁平化（更安全） |
| lockfile | package-lock.json | yarn.lock | pnpm-lock.yaml |

如果你之前使用的是 npm，可以通过以下步骤切换到 pnpm：

```bash
# 1. 全局安装 pnpm
npm install -g pnpm

# 2. 进入项目目录
cd your-project

# 3. 删除旧的 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 4. 使用 pnpm 重新安装依赖
pnpm install
```

### 3.2 项目 package.json 配置

以下是 Punchliner 项目的完整 package.json 配置，供你参考：

```json
{
  "name": "punchliner",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome lint src/",
    "lint:fix": "biome lint --write src/",
    "format": "biome format --write src/",
    "prepare": "husky"
  },
  "dependencies": {
    "@ant-design/icons": "^6.1.0",
    "antd": "^6.3.0",
    "clsx": "^2.1.1",
    "dayjs": "^1.11.19",
    "framer-motion": "^12.34.0",
    "next": "^16.1.6",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-hot-toast": "^2.6.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.0",
    "@commitlint/cli": "^20.4.2",
    "@commitlint/config-conventional": "^20.4.2",
    "@tailwindcss/typography": "^0.5.16",
    "@types/node": "^25.2.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "autoprefixer": "^10.4.24",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.19",
    "typescript": "^5.9.3"
  }
}
```

### 3.3 Next.js 配置

为了让 GitHub Actions 构建的产物能够正确部署到 Vercel，我们需要对 next.config.mjs 进行配置：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

// 是否通过github actions部署
const isGithubActions = process.env.GITHUB_ACTIONS || false

if (isGithubActions) {
  const repo = process.env.GITHUB_REPOSITORY 
    ? process.env.GITHUB_REPOSITORY.replace(/.*?\//, '') 
    : ''
  
  // 用于为静态资源设置 URL 前缀
  nextConfig.assetPrefix = `/${repo}/`
  
  // 用于为应用设置基础路径
  nextConfig.basePath = `/${repo}`
  
  // 初始化 env 对象
  nextConfig.env = nextConfig.env || {}
  nextConfig.env.ROUTE_PREFIX = `/${repo}`
}

export default nextConfig
```

这段配置的核心逻辑是：

1. **检测部署环境**：通过 `GITHUB_ACTIONS` 环境变量判断是否在 GitHub Actions 中运行
2. **提取仓库名**：从 `GITHUB_REPOSITORY` 中提取仓库名称（如 `username/project-name`）
3. **配置路径前缀**：设置 `assetPrefix` 和 `basePath`，确保静态资源和路由正确加载

---

## 四、GitHub Actions 工作流配置

现在到了核心环节——创建 GitHub Actions 工作流文件。

### 4.1 创建工作流文件

在项目根目录下创建 `.github/workflows` 目录（如果不存在），然后在其中创建 `vercel.yml` 文件：

```yaml
name: Vercel 生产环境部署

on:
  push:
    branches: [master]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: 获取源码
        uses: actions/checkout@v4

      - name: 安装 pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
          run_install: false

      - name: Node 环境版本
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: pnpm 缓存路径
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: 缓存 pnpm 依赖
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: 安装依赖
        run: pnpm install --frozen-lockfile

      - name: 缓存 Next.js 构建
        uses: actions/cache@v4
        with:
          path: .next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-

      - name: 打包
        run: pnpm run build
        env:
          ZHIPU_API_KEY: ${{ secrets.ZHIPU_API_KEY }}
          MXNZP_APP_ID: ${{ secrets.MXNZP_APP_ID }}
          MXNZP_APP_SECRET: ${{ secrets.MXNZP_APP_SECRET }}

      - name: 部署到 Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 4.2 配置详解

让我逐一解析这个工作流配置的每个部分：

#### 触发条件与并发控制

```yaml
on:
  push:
    branches: [master]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

- **on.push.branches**: 设置为 `master`，意味着只有当代码推送到 master 分支时才触发部署
- **concurrency**: 防止重复部署，当新推送到来时自动取消之前的部署任务

#### 环境配置

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 9

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'
```

这里使用了 **双层缓存机制**：

1. **第一层**：`actions/setup-node` 自带的 pnpm 缓存，自动识别 pnpm-lock.yaml
2. **第二层**：手动配置的 pnpm store 缓存，提供更高的命中率

#### 构建缓存

```yaml
- name: Next.js build cache
  uses: actions/cache@v4
  with:
    path: .next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-
```

Next.js 构建缓存可以显著缩短构建时间：

| 场景 | 无缓存 | 有缓存 |
|------|--------|--------|
| 首次构建 | ~3分钟 | ~3分钟 |
| 二次构建（代码无变化） | ~3分钟 | ~30秒 |
| 二次构建（依赖变化） | ~3分钟 | ~2分钟 |

#### 环境变量传递

```yaml
- name: Build Next.js project
  run: pnpm run build
  env:
    ZHIPU_API_KEY: ${{ secrets.ZHIPU_API_KEY }}
    MXNZP_APP_ID: ${{ secrets.MXNZP_APP_ID }}
    MXNZP_APP_SECRET: ${{ secrets.MXNZP_APP_SECRET }}
```

通过 `secrets` 传递敏感环境变量，这些变量会在 GitHub Actions runner 中可用。

#### Vercel 部署

```yaml
- name: Deploy to Vercel
  uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
    vercel-args: '--prod'
```

使用 `amondnet/vercel-action` 将构建产物部署到 Vercel 生产环境。

---

## 五、完整工作流执行解析

当你将代码推送到 master 分支后，整个自动化流程就会启动。下面的流程图展示了这个过程：

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          GitHub Actions 工作流执行流程                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│  阶段一：触发与准备                                                              │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Git Push ──────► GitHub 检测到 push 事件 ──────► 触发 Workflow              │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐     │
│   │  工作流状态：queued                                                  │     │
│   │  运行时间：等待中...                                                  │     │
│   └──────────────────────────────────────────────────────────────────────┘     │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  阶段二：代码检出                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Step 1: Checkout code                                                        │
│   ┌──────────────────────────────────────────────────────────────────────┐     │
│   │  uses: actions/checkout@v4                                          │     │
│   │  ⏱ 耗时：~2秒                                                        │     │
│   │  📥 下载源码到 runner                                                │     │
│   └──────────────────────────────────────────────────────────────────────┘     │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  阶段三：环境搭建                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Step 2: Setup pnpm          Step 3: Setup Node.js                          │
│   ┌────────────────────┐      ┌────────────────────┐                         │
│   │ uses: pnpm/         │      │ node-version: 20   │                         │
│   │   action-setup@v4   │ ───► │ cache: 'pnpm'      │                         │
│   │ ⏱ ~5秒             │      │ ⏱ ~10秒            │                         │
│   └────────────────────┘      └────────────────────┘                         │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  阶段四：依赖安装（缓存命中）                                                     │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Step 4: Get pnpm store path                                                  │
│   Step 5: pnpm cache           Step 6: Install dependencies                   │
│   ┌────────────────────┐      ┌────────────────────┐                         │
│   │ 设置缓存路径        │      │ pnpm install       │                         │
│   │ ⏱ ~1秒             │ ───► │ --frozen-lockfile  │                         │
│   └────────────────────┘      │ ⏱ ~15秒 (缓存命中)  │                         │
│                                └────────────────────┘                         │
│                                                                                 │
│   📦 缓存命中：pnpm store (98% 命中率)                                        │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  阶段五：项目构建                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Step 7: Next.js build cache                                                  │
│   ┌──────────────────────────────────────────────────────────────────────┐     │
│   │  path: .next/cache                                                   │     │
│   │  key: ubuntu-nextjs-[hash]                                          │     │
│   │  ⏱ ~3秒 (缓存恢复)                                                  │     │
│   └──────────────────────────────────────────────────────────────────────┘     │
│                                      │                                         │
│                                      ▼                                         │
│   Step 8: Build Next.js project                                                │
│   ┌──────────────────────────────────────────────────────────────────────┐     │
│   │  run: pnpm run build                                                │     │
│   │  ⏱ ~45秒 (缓存命中)                                                 │     │
│   │                                                                          │
│   │  ▲ Next.js 16.1.6 (Turbopack)                                        │
│   │  ✓ Compiled successfully in 2.5s                                      │
│   │  ✓ Generating static pages (8/8)                                     │
│   └──────────────────────────────────────────────────────────────────────┘     │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  阶段六：部署到 Vercel                                                          │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Step 9: Deploy to Vercel                                                     │
│   ┌──────────────────────────────────────────────────────────────────────┐     │
│   │  uses: amondnet/vercel-action@v25                                   │     │
│   │  vercel-args: '--prod'                                              │     │
│   │  ⏱ ~20秒                                                             │     │
│   │                                                                          │
│   │  ✓ Building...                                                       │     │
│   │  ✓ Deploying to Vercel...                                            │     │
│   │  ✓ Deployment completed!                                            │     │
│   │                                                                          │
│   │  🔗 https://your-project.vercel.app                                  │     │
│   └──────────────────────────────────────────────────────────────────────┘     │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  部署完成！                                                                     │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ✅ 工作流状态：success                                                        │
│   ⏱ 总耗时：约 1分30秒 (缓存命中)                                              │
│   🔗 访问地址：https://your-project.vercel.app                                │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、CI 检查与部署分离（进阶）

在实际项目中，我们通常希望代码合并到 master 之前就进行质量检查。最佳实践是创建两个独立的工作流：CI 工作流负责代码检查，Deploy 工作流负责部署。

### 6.1 CI 工作流配置

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      matrix:
        node-version: [18, 20, 22]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - name: Get pnpm store path
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Next.js build cache
        uses: actions/cache@v4
        with:
          path: .next/cache
          key: ${{ runner.os }}-nextjs-${{ matrix.node-version }}-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-${{ matrix.node-version }}-

      - name: Run Biome lint
        run: pnpm run lint

      - name: Run Biome format check
        run: pnpm run format -- --check

      - name: Build Next.js project
        run: pnpm run build
```

### 6.2 两个工作流的协作流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          双工作流协作流程                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────────┐
                        │   PR 提交/更新      │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼                              ▼
        ┌─────────────────────┐        ┌─────────────────────┐
        │      CI Workflow    │        │  GitHub 自动合并    │
        │  (所有分支触发)     │        │  (通过审查后)       │
        └──────────┬──────────┘        └──────────┬──────────┘
                   │                                │
                   ▼                                ▼
        ┌─────────────────────┐        ┌─────────────────────┐
        │  ✅ Lint 检查       │        │                     │
        │  ✅ Format 验证     │        │                     │
        │  ✅ 类型检查        │        │                     │
        │  ✅ 构建测试        │        │                     │
        │  ✅ 多版本测试      │        │                     │
        └──────────┬──────────┘        │                     │
                   │                    │                     │
                   ▼                    ▼                     │
        ┌─────────────────────┐        │                     │
        │   PR 检查通过 ✅    │        │                     │
        └──────────┬──────────┘        │                     │
                   │                    │                     │
                   └──────────┬─────────┘                     │
                              ▼                              │
                   ┌─────────────────────┐                   │
                   │  合并到 master      │◄──────────────────┘
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │   Deploy Workflow   │
                   │  (仅 master 触发)   │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  ✅ 部署到 Vercel   │
                   └─────────────────────┘
```

---

## 七、常见问题与解决方案

### 7.1 构建失败

**问题**：工作流在 Build Next.js project 步骤失败

**排查步骤**：

1. 在 GitHub 仓库的 Actions 页面查看失败任务的日志
2. 找到具体的错误信息，定位问题原因

**常见原因与解决方案**：

| 错误类型 | 原因 | 解决方案 |
|---------|------|---------|
| 依赖安装失败 | 环境变量未配置 | 在 GitHub Secrets 中添加缺失的变量 |
| TypeScript 错误 | 代码存在类型问题 | 修复类型错误后再推送 |
| 内存不足 | 构建占用内存过大 | 尝试降低 Node.js 版本 |

### 7.2 部署失败

**问题**：Deploy to Vercel 步骤失败

**常见原因**：

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| Token is invalid | VERCEL_TOKEN 配置错误 | 检查并重新配置令牌 |
| Project not found | 项目 ID 配置错误 | 确认 VERCEL_PROJECT_ID 正确 |
| Permission denied | 令牌权限不足 | 确保令牌具有项目访问权限 |

### 7.3 缓存未生效

**问题**：每次构建都需要重新下载依赖

**可能原因**：

1. 缓存 key 包含的版本信息不正确
2. 缓存存储达到 GitHub 限制
3. 使用了不同的操作系统导致缓存不兼容

---

## 八、总结

通过本文的详细介绍，你应该已经掌握了使用 GitHub Actions 通过「Deploy from a branch」方式将 Next.js 项目部署到 Vercel 的完整方法。

### 核心要点回顾

1. **Vercel 凭证配置**：创建 Token、获取 Org ID 和 Project ID，配置 GitHub Secrets
2. **工作流配置**：使用 pnpm、双层缓存、Next.js 构建缓存优化构建速度
3. **环境变量传递**：通过 secrets 传递敏感环境变量到构建过程
4. **CI 分离**：推荐创建独立的 CI 工作流进行代码质量检查

### 性能数据

使用本文的配置后，典型的构建时间如下：

| 构建类型 | 首次构建 | 缓存命中 |
|---------|---------|---------|
| 完整构建 | ~3分钟 | ~1.5分钟 |
| 增量构建 | ~3分钟 | ~30秒 |

自动化部署不仅提升了开发效率，更重要的是确保了每一次部署的可重复性和可靠性。赶快尝试配置属于你自己的 CI/CD 流水线吧！

---

*本文基于 Punchliner 项目的实际配置编写，适用于 Next.js 16 + pnpm + GitHub Actions + Vercel 的技术栈。*
