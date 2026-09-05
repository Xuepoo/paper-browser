# Security Architecture & Trust Boundaries (安全边界规范)

Paper Browser 是一个用于空间计算与 3D 纸张物理渲染的 **公开网页空间浏览器 / 只读查看器 (Read-Only Spatial Web Viewer)**。

为了保障用户资产安全，防止跨域污染、机房代理滥用与内部网络探测，项目严格实施以下安全边界规范：

---

## 1. 信任模型与只读边界 (Trust Model: Read-Only Contract)

1. **非密码/凭据输入环境**：
   - Paper Browser v1 设计用于公开文档、知识库、论文阅读、技术演示及只读浏览。
   - **禁止** 在本演示的内嵌网页中输入银行密码、支付凭据或高度敏感账号。
   - 上游反向代理**不转发、不留存任何用户 Cookie 或 Authorization 凭证**。
2. **表单提交限制**：
   - 桥接脚本仅对搜索引擎等只读 `GET` 表单进行内部导航转发。
   - 任何涉及凭证修改的 `POST` 操作均不会被代理后端执行，防止凭据窃取与跨站请求伪造 (CSRF)。

---

## 2. SSRF 与开放代理防护 (SSRF & Open Proxy Guard)

反向代理服务（包括 Cloudflare Pages Functions、Cloudflare Worker 及本地 Bun 服务）在拉取任何目标前，均必须通过 `validateTargetUrl()` 执行以下校验：

- **仅允许 HTTP/HTTPS 协议**：严禁 `file://`、`gopher://`、`javascript:`、`data:` 等协议注入。
- **私有与回环网段拦截**：
  - `127.0.0.0/8`, `::1` (本机回环)
  - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (私有内部局域网)
  - `169.254.0.0/16` (本地链路 / 云平台元数据服务 `169.254.169.254`)
  - `0.0.0.0/8`, `224.0.0.0/4` (广播 / 多播)
- **特殊域名屏蔽**：
  - `localhost`, `*.local`, `*.internal`, `*.lan`, `*.arpa`
  - 路由器配置域名（`tplinkwifi.net`, `miwifi.com`, `router.asus.com` 等）
- **数值混淆检测**：
  - 拦截纯十进制数 IP（如 `2130706433`）及十六进制 IP（如 `0x7f000001`）伪装。

---

## 3. PostMessage 通信认证协议 (Bridge Protocol Authentication)

为杜绝第三方脚本伪造事件控制 3D 纸张舞台，制定了标准握手协议：

```typescript
interface PaperBridgeMessage {
  version: 1;
  type:
    | "paper_iframe_mousemove"
    | "paper_iframe_click"
    | "paper_iframe_zoom"
    | "paper_navigate"
    | "paper_new_tab";
  clientX?: number;
  clientY?: number;
  deltaY?: number;
  url?: string;
}
```

- **消息版本验证**：宿主窗口接收到消息后，首先校验 `event.data.version === 1`。
- **来源对象校验 (Source Authentication)**：
  宿主必须校验 `event.source` 是否隶属于当前活动标签页的真实 `iframe.contentWindow`，非受管来源的消息一律静默丢弃。
