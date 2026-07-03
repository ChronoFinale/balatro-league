// The bot's ONLY data access: HTTP calls to the tour web app's /api/bot/* + /api/admin/*
// routes with the Bearer TOUR_ADMIN_TOKEN. The bot holds NO Prisma and NO domain logic —
// one service layer, whether an action comes from Discord or the site (repo convention).
import { env } from "./env";

const TIMEOUT_MS = 15_000;

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${env.TOUR_WEB_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.TOUR_ADMIN_TOKEN}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => call<T>("GET", path);
export const apiPost = <T>(path: string, body: unknown) => call<T>("POST", path, body);
