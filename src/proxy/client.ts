/**
 * ProxyClient
 * Manages SwitchyOmega proxy profiles, URL construction, and connectivity checks.
 */

export interface ProxyProfile {
  mode: "edge" | "local" | "direct";
  scheme: "http" | "socks5";
  host: string;
  port: string;
  localServerPort: string;
}

export class ProxyClient {
  profile: ProxyProfile = {
    mode: (localStorage.getItem("paper_proxy_mode") as ProxyProfile["mode"]) || "edge",
    scheme: (localStorage.getItem("paper_proxy_scheme") as ProxyProfile["scheme"]) || "http",
    host: localStorage.getItem("paper_proxy_host") || "127.0.0.1",
    port: localStorage.getItem("paper_proxy_port") || "7890",
    localServerPort: localStorage.getItem("paper_local_port") || "3000",
  };

  localHealth: "online" | "offline" | "unknown" = "unknown";

  getFullProxyAgentUri(): string {
    if (this.profile.port === "none" || !this.profile.port) return "";
    return `${this.profile.scheme}://${this.profile.host}:${this.profile.port}`;
  }

  getLocalProxyUrl(): string {
    const base = `http://127.0.0.1:${this.profile.localServerPort}/api/proxy`;
    const agent = this.getFullProxyAgentUri();
    const agentQuery = agent ? `&proxy_agent=${encodeURIComponent(agent)}` : "";
    return `${base}?clash_port=${encodeURIComponent(this.profile.port)}${agentQuery}`;
  }

  getProxiedUrl(targetUrl: string): string {
    if (!targetUrl) return "";
    if (this.profile.mode === "direct") {
      return targetUrl;
    }
    if (this.profile.mode === "local") {
      const base = this.getLocalProxyUrl();
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}url=${encodeURIComponent(targetUrl)}`;
    }
    return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  }

  getSandboxAttr(): string {
    if (this.profile.mode === "direct") {
      return "";
    }
    return 'sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox"';
  }

  setMode(mode: ProxyProfile["mode"]): void {
    this.profile.mode = mode;
    localStorage.setItem("paper_proxy_mode", mode);
  }

  setSwitchyProfile(scheme: ProxyProfile["scheme"], host: string, port: string): void {
    this.profile.scheme = scheme;
    this.profile.host = host;
    this.profile.port = port;
    localStorage.setItem("paper_proxy_scheme", scheme);
    localStorage.setItem("paper_proxy_host", host);
    localStorage.setItem("paper_proxy_port", port);
  }

  setLocalServerPort(port: string): void {
    this.profile.localServerPort = port;
    localStorage.setItem("paper_local_port", port);
  }

  async checkHealth(): Promise<boolean> {
    if (this.profile.mode !== "local") return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const resp = await fetch(`${this.getLocalProxyUrl()}&url=https://example.com`, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      this.localHealth =
        resp.ok || resp.status === 200 || resp.status === 204 ? "online" : "offline";
      return this.localHealth === "online";
    } catch {
      this.localHealth = "offline";
      return false;
    }
  }
}
