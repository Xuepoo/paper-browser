# Paper Browser (纸张浏览器) 📄

> **Interactive 3D HTML-in-Canvas Floating Paper Browser Experience**
>
> A spatial, tactile web browsing experience rendering live web pages inside a physics-driven 3D floating sheet of paper using HTML5 Canvas, CSS 3D spatial transforms, fluid ink ripples, and transparent Cloudflare Edge proxies.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun%201.4+-black.svg)](https://bun.sh)
[![Vite](https://img.shields.io/badge/bundler-Vite%208-646CFF.svg)](https://vitejs.dev)
[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare%20Pages-F38020.svg)](https://pages.cloudflare.com)
[![Oxlint](https://img.shields.io/badge/lint-Oxlint-brightgreen.svg)](https://oxc.rs)
[![CarryCtx](https://img.shields.io/badge/context-CarryCtx-purple.svg)](https://github.com/Xuepoo)

---

## 🌟 Features (核心特性)

- **3D Spatial Paper Physics (空间物理纸张引擎)**: 具有弹簧阻尼与惯性倾角的 3D 纸张效果，随鼠标或焦点平滑倾斜，并伴有光斑反射与动态阴影。
- **Fluid Ink Ripples (流体水墨画布图层)**: 基于 HTML5 Canvas 的动态水墨微澜效果，实时响应用户在纸面上的点击、振颤与交互。
- **Transparent Edge Web Proxy (无缝边缘反向代理)**: 基于 Cloudflare Pages Functions / Cloudflare Workers 构建的边缘反向代理，自动剥离 `X-Frame-Options` 与 `CSP frame-ancestors` 限制，并注入交互桥接脚本实现倾斜纸面内的链接跳转、滚动转发与表单提交。
- **HiDPI Scaling & Multi-Scale Zoom (高分屏与缩放)**: 自动适配 Device Pixel Ratio (DPR)，支持 50% ~ 200% 页面级缩放，保证纸面内容与水墨渲染纤毫毕现。
- **Dynamic Tabs Lifecycle (动态多标签管理)**: 支持新建标签页、切换、独立历史记录管理（前进/后退/刷新）与关闭标签。
- **Production-Ready Toolchain (严谨工程基建)**:
  - 构建工具：**Bun** + **Vite**
  - 代码质量检查：**Oxlint** + **Oxfmt**
  - 任务与生命周期协同：**CarryCtx**（包含 Git hooks 自动化注入）
  - 双重部署架构：Cloudflare Pages 全栈服务 + 独立 Cloudflare Worker 代理

---

## 🏛️ Architecture & Dual Surface (系统架构与双后端)

Paper Browser 采用清晰解耦的**双后端渲染架构 (Dual Surface Architecture)**：

```text
                         Paper Browser Core
                                 │
                       BrowserSurface 接口规范
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
                ▼                                 ▼
         IframeSurface                   HtmlCanvasSurface
                │                                 │
      (外部公共网页沙箱渲染)             (WICG 原生画布置入实验)
                │                                 │
     Proxy Layer / Direct Mode             layoutsubtree
                │                                 │
           CSS 3D 矩阵变换               ctx.drawElementImage()
```

### 核心架构与安全文档

- 🛡️ [安全架构与只读边界规范 (docs/security.md)](docs/security.md) — 详述 SSRF 防护规则、PostMessage 鉴权协议与非凭据输入安全模型。
- 📊 [浏览器语义与技术兼容性支持矩阵 (docs/compatibility.md)](docs/compatibility.md) — 详述跳转、表单、SPA 路由、缩放、多标签在不同渲染后端下的行为对照。

---

## 🚀 Quick Start (快速开始)

### Prerequisites

- [Bun](https://bun.sh) (v1.2+)
- (可选) [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (用于部署到 Cloudflare)

### Installation

```bash
# 克隆仓库
git clone https://github.com/Xuepoo/paper-browser.git
cd paper-browser

# 安装依赖
bun install
```

### Local Development

#### 1. 使用 Vite 前端开发服务器（热更新）

```bash
bun run dev
```

#### 2. 使用 Bun 全栈独立服务器（内置代理与静态托管）

```bash
bun run server
# 打开 http://localhost:3000
```

### Build & Code Quality

```bash
# 生产构建（输出到 dist/）
bun run build

# Oxlint 静态检查
bun run lint

# Oxfmt 格式化检查
bun run format:check

# 自动格式化
bun run format
```

---

## ☁️ Cloudflare Deployment (云端部署)

本工程支持两种部署形态：

### 1. Cloudflare Pages 部署（推荐，全栈一体化）

Cloudflare Pages 会自动打包 `dist/` 中的前端静态资源，并将 `functions/api/proxy.ts` 编译为同域边缘函数：

```bash
# 构建前端
bun run build

# 部署至 Cloudflare Pages
bun run deploy
# 或: wrangler pages deploy dist --project-name paper-browser
```

### 2. 独立 Cloudflare Worker 部署（可选代理服务）

如果希望将反向代理部署为独立的 Worker：

```bash
bun run deploy:worker
# 或: wrangler deploy -c worker/wrangler.jsonc
```

前端可通过配置 `window.__PAPER_PROXY_ENDPOINT__` 指向该 Worker 地址。

### 自定义域名绑定

在 Cloudflare 控制台或使用 Cloudflare API 将自定义域名（例如 `browser.xuepoo.xyz`）解析绑定至 Pages 项目即可。

---

## 🧠 CarryCtx Task & Session Management

本项目采用 [CarryCtx](https://github.com/Xuepoo) 进行本地优先的任务规划与上下文持久化管理：

```bash
# 查看项目状态与任务依赖
carryctx status

# 查看任务详情与进度记录
carryctx task show CTX-0001

# Git Hooks 状态检查
carryctx hooks status
```

---

## 📄 License

本项目采用 [Apache License 2.0](LICENSE) 开源授权。
Copyright (c) 2026 Xuepoo.
