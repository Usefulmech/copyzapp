export interface DeviceDetails {
  name: string;
  type: "phone" | "tablet" | "desktop";
  os: string;
  browser: string;
  channelPin: string;
}

export function getDeviceInfo(shareToken?: string | null): DeviceDetails {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let os = "Device";
  let type: "phone" | "tablet" | "desktop" = "desktop";
  let browser = "Browser";

  if (/android/i.test(ua)) {
    os = "Android";
    type = "phone";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = /ipad/i.test(ua) ? "iPad" : "iPhone";
    type = /ipad/i.test(ua) ? "tablet" : "phone";
  } else if (/windows/i.test(ua)) {
    os = "Windows PC";
    type = "desktop";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "Mac";
    type = "desktop";
  } else if (/linux/i.test(ua)) {
    os = "Linux PC";
    type = "desktop";
  }

  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) {
    browser = "Chrome";
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = "Safari";
  } else if (/edg/i.test(ua)) {
    browser = "Edge";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  }

  const pin = shareToken && shareToken.length >= 6
    ? `CZ-${shareToken.slice(-4).toUpperCase()}`
    : "CZ-LIVE";

  return {
    name: `${os} (${browser})`,
    type,
    os,
    browser,
    channelPin: pin,
  };
}
