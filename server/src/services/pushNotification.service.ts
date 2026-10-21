import { pool } from "../db/db.js";

// In-memory set for fast lookups
const activeTokens = new Set<string>();

let isInitialized = false;

// Ensure push_tokens table exists on startup
export async function initPushTokensTable(): Promise<void> {
  if (isInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) UNIQUE NOT NULL,
        device_type VARCHAR(50) DEFAULT 'unknown',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    const res = await pool.query<{ token: string }>("SELECT token FROM push_tokens");
    for (const row of res.rows) {
      if (row.token) activeTokens.add(row.token);
    }
    isInitialized = true;
    console.log(`[Push] Service initialized with ${activeTokens.size} registered device push token(s)`);
  } catch (err) {
    console.warn("[Push] Table initialization note:", err);
  }
}

// Auto-initialize on import
initPushTokensTable().catch(() => {});

export async function registerDeviceToken(token: string, deviceType: string = "unknown"): Promise<void> {
  if (!token || typeof token !== "string") return;
  const cleanToken = token.trim();
  activeTokens.add(cleanToken);

  try {
    await pool.query(
      `INSERT INTO push_tokens (token, device_type, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (token) DO UPDATE SET updated_at = NOW(), device_type = $2`,
      [cleanToken, deviceType]
    );
    console.log(`[Push] Registered device push token: ${cleanToken.substring(0, 22)}... (${deviceType})`);
  } catch (err) {
    console.warn("[Push] DB persist error (in-memory token retained):", err);
  }
}

export async function removeDeviceToken(token: string): Promise<void> {
  activeTokens.delete(token);
  try {
    await pool.query("DELETE FROM push_tokens WHERE token = $1", [token]);
    console.log(`[Push] Removed inactive device push token: ${token.substring(0, 22)}...`);
  } catch (err) {
    console.warn("[Push] Error deleting inactive push token:", err);
  }
}

export function getRegisteredTokensCount(): number {
  return activeTokens.size;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPushNotification({
  title,
  body,
  data,
}: PushNotificationPayload): Promise<void> {
  if (activeTokens.size === 0) {
    console.log("[Push] No registered device tokens yet. Skipping Expo push dispatch.");
    return;
  }

  const tokenList = Array.from(activeTokens);
  console.log(`[Push] Sending push notification to ${tokenList.length} device(s): "${title}"`);

  // Build message packets for Expo Push API
  const messages = tokenList.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: data || {},
    priority: "high",
    channelId: "occueye-alerts",
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.warn(`[Push] Expo Push API responded with HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const json = (await response.json()) as { data?: Array<{ status: string; message?: string; details?: any }> };
    if (json.data && Array.isArray(json.data)) {
      json.data.forEach((ticket, idx) => {
        if (ticket.status === "error") {
          console.warn(`[Push] Delivery error for token ${tokenList[idx].substring(0, 22)}...:`, ticket.message);
          if (ticket.details?.error === "DeviceNotRegistered") {
            removeDeviceToken(tokenList[idx]);
          }
        }
      });
    }
  } catch (error) {
    console.error("[Push] Failed to dispatch push notification via Expo Push API:", error);
  }
}
