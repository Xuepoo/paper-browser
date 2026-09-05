/**
 * SSRF & Open Proxy Guard
 * Validates target URLs to prevent internal network scanning,
 * cloud metadata service leakage, and open proxy abuse.
 */

const PRIVATE_IPV4_PATTERNS = [
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Loopback
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // RFC 1918 Class A
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // RFC 1918 Class B
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // RFC 1918 Class C
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // Link-local / Cloud Metadata (169.254.169.254)
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Current network
  /^224\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Multicast
  /^255\.255\.255\.255$/, // Broadcast
];
const BLOCKED_HOSTNAMES: Record<string, true> = {
  localhost: true,
  "metadata.google.internal": true,
  "instance-data": true,
  "router.asus.com": true,
  "tplinkwifi.net": true,
  "miwifi.com": true,
};

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".arpa",
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  parsedUrl?: URL;
}

/**
 * Validates if a target URL is safe to fetch via proxy.
 * Blocks non-HTTP protocols, private IPs, loopbacks, and metadata endpoints.
 */
export function validateTargetUrl(rawUrl: string): ValidationResult {
  let trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: "Empty URL provided" };
  }

  // Prepend https:// if protocol is missing
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = "https://" + trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Malformed URL";
    return { valid: false, error: `Invalid URL: ${msg}` };
  }

  // 1. Protocol validation: strictly http or https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Protocol '${parsed.protocol}' is forbidden. Only HTTP/HTTPS is allowed.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Exact blocked hostnames
  if (BLOCKED_HOSTNAMES[hostname]) {
    return {
      valid: false,
      error: `Access to internal hostname '${hostname}' is blocked by SSRF policy.`,
    };
  }

  // 3. Suffix checks (.local, .internal, etc.)
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return {
        valid: false,
        error: `Access to internal domain suffix '${suffix}' is blocked by SSRF policy.`,
      };
    }
  }

  // 4. IPv6 Loopback / Link-Local / Unique Local
  if (
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80:")
  ) {
    return {
      valid: false,
      error: `IPv6 address '${hostname}' is blocked by SSRF policy.`,
    };
  }

  // 5. Check IPv4 ranges
  const cleanIp = hostname.replace(/^\[|\]$/g, "");
  for (const pattern of PRIVATE_IPV4_PATTERNS) {
    if (pattern.test(cleanIp)) {
      return {
        valid: false,
        error: `Target IP '${hostname}' belongs to private/metadata range and is blocked.`,
      };
    }
  }

  // 6. Decimal / Octal / Hex obfuscated IP checks (e.g. 2130706433 -> 127.0.0.1)
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) {
    return {
      valid: false,
      error: `Numeric/hexadecimal IP notation '${hostname}' is blocked by SSRF policy.`,
    };
  }

  return { valid: true, parsedUrl: parsed };
}
