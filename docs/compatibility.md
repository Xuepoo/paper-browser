# Paper Browser 浏览器语义与技术兼容性支持矩阵 (Compatibility Matrix)

Paper Browser 采用现代**双后端架构 (Dual Surface Architecture)**，针对「公网通用网页浏览」与「前沿 WICG 原生画布置入实验」提供了清晰的语义支持边界。

---

## 1. 核心架构模式对比

| 架构层级                           | 实现方式                                            | 运行环境                                             | 主要用途                                            |
| :--------------------------------- | :-------------------------------------------------- | :--------------------------------------------------- | :-------------------------------------------------- |
| **IframeSurface (沙箱渲染层)**     | `<iframe>` + CSS 3D Transforms                      | 任意现代浏览器 (Chromium / Firefox / Safari)         | 浏览外部公共互联网网页（维基百科、新闻、博客等）    |
| **HtmlCanvasSurface (WICG原生层)** | `<canvas layoutsubtree>` + `ctx.drawElementImage()` | 开启 `canvas-draw-element` 的 Chromium (Chrome 130+) | 真正的 DOM 与 Canvas / WebGL 像素级融合与无障碍实验 |
| **Proxy Layer (边缘与反代层)**     | Cloudflare Pages / Workers / Bun Server             | Edge CDN 或本地开发机                                | 剥离 `X-Frame-Options`、安全改写与 Bridge 注入      |

---

## 2. 浏览器行为与语义支持矩阵 (Semantic Support Matrix)

| 浏览器特性 / 语义                          | IframeSurface | Proxy Layer | Native WICG Canvas | 状态说明                                   |
| :----------------------------------------- | :-----------: | :---------: | :----------------: | :----------------------------------------- |
| **页面跳转 (`<a href>`)**                  |    ✅ 支持    | ✅ 自动改写 |      ✅ 支持       | 内部拦截跳转，保持在纸张内                 |
| **新标签页 (`target="_blank"`)**           |    ✅ 支持    | ✅ 桥接转换 |      ⚠️ 模拟       | 拦截并转化为纸张顶栏新建 Tab               |
| **弹窗与新窗口 (`window.open()`)**         |    ✅ 支持    | ✅ 桥接转换 |      ⚠️ 模拟       | 拦截转化为纸张顶栏新建 Tab                 |
| **GET 搜索表单 (`<form method="GET">`)**   |    ✅ 支持    | ✅ 桥接转换 |      ✅ 支持       | 自动序列化参数并进行内部路由               |
| **POST 凭证表单 (`<form method="POST">`)** |    ⚠️ 受限    | ❌ 故意禁用 |      ⚠️ 受限       | 为防凭据泄露，只读查看器不转发 POST        |
| **SPA 单页路由 (`history.pushState`)**     |  ✅ 实时同步  | ✅ 桥接转发 |        N/A         | 触发 `paper_location_change` 同步地址栏    |
| **页面标题与 Favicon 提取**                |  ✅ 动态同步  | ✅ 自动注入 |      ✅ 支持       | 动态更新标签页标题与图标                   |
| **缩放与高分屏适配 (DPR / Zoom)**          |  ✅ 50%~200%  |     N/A     |    ✅ 自动重绘     | DPR 限制为 ≤2 保护显存                     |
| **纸面触感与水墨微澜 (Ink Bleed)**         |  ✅ 实时渲染  |     N/A     |    ✅ 实时渲染     | 点击坐标通过偏移矩阵实时映射               |
| **3D 物理纸张倾角与阻尼惯性**              |  ✅ 全局支持  |     N/A     |    ✅ 全局支持     | 弹簧动力学计算与光斑反射                   |
| **静态与动画图片 (PNG/JPEG/SVG/GIF)**      |    ✅ 支持    | ✅ 流式透传 |    ✅ 原生合成     | 正常参与 DOM 排版与 Canvas 绘制            |
| **音频与视频流 (`<audio>`, `<video>`)**    |    ✅ 支持    | ✅ 流式透传 |     ⚠️ 实验中      | 支持内嵌媒体播放                           |
| **无障碍辅助功能 (Accessibility Tree)**    |  ✅ 原生保留  |     N/A     |    ✅ 规范保证     | `layoutsubtree` 核心优势：DOM 保留 A11y 树 |
| **第三方登录 / OAuth 授权**                |   ⚠️ 需直连   |  ❌ 不建议  |     ❌ 不适用      | 第三方身份验证请通过直连模式使用           |

---

## 3. 三种网络模式的最佳实践建议

- **☁️ Cloudflare 边缘代理**：
  - **优势**：全球多节点 CDN 转发，免配置，开箱即用。
  - **适合**：维基百科、技术文档、W3C 规范、公开资讯、开源博客。
- **💻 本机网络代理 (Switchy)**：
  - **优势**：通过本地终端运行的 `server.ts` 转发，支持自定义上游科学代理（如 Clash `7890`、Mihomo `7897`、v2rayN `10808` 或局域网软路由 IP）。
  - **适合**：Google 全球搜索、ChatGPT 等对云端机房 IP 实施严格反爬验证的站点。
- **⚡ 直连模式 (Direct)**：
  - **优势**：直接在 iframe 内由当前浏览器加载，100% 继承个人浏览器的登录态、Cookie 及代理插件（搭配 Chrome 扩展 `Ignore X-Frame-Options` 体验最佳）。
  - **适合**：个人已登录账号站点、内部系统、无需代理中转的高带宽站点。
