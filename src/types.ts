export interface Memory {
  id: string;
  userId: string;
  title: string;
  body?: string | null;
  link?: string | null;
  imageUrl?: string | null;
  imageType?: string | null;
  createdAt: string; // ISO 8601 string
  isPinned?: boolean;
  archivedAt?: string | null;
}

export interface ShareReceiverResponse {
  success: boolean;
  message?: string;
  memory?: Memory;
}

export interface MemoriesResponse {
  snippets: Memory[];
  serverTime: string;
}

export interface UserTokenInfo {
  shareToken: string;
  userId: string;
  shareUrl: string;
  manifestUrl: string;
}

// ─── Network Multi-Address Support ───────────────────────────────────────────

export type NetworkAdapterType = "wifi" | "hotspot" | "ethernet" | "cloud" | "localhost";

export interface NetworkAddress {
  /** Human-readable interface name e.g. "Wi-Fi", "Hotspot", "Ethernet" */
  name: string;
  /** Raw OS interface name e.g. "Wi-Fi", "Local Area Connection* 12" */
  interfaceName: string;
  /** IPv4 address */
  ip: string;
  /** Classified adapter type */
  type: NetworkAdapterType;
  /** Full share URL with this IP injected */
  shareUrl: string;
}

export interface NetworkInfo {
  /** APP_URL from env (cloud deploy URL), null if not configured */
  cloudUrl: string | null;
  /** Server port */
  serverPort: number;
  /** All detected local addresses with type classification */
  addresses: NetworkAddress[];
  /** localhost fallback */
  localhostUrl: string;
  /** Whether Vercel KV is configured (optional for local/non-Vercel) */
  kvConfigured?: boolean;
  /** Whether a persistent database (Neon DB / PostgreSQL) is configured */
  dbConfigured?: boolean;
}

export type ConnectionMode = "cloud" | "wifi" | "hotspot" | "localhost";
