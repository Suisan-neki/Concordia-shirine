import { getCognitoIdToken } from "@/lib/cognito";
import type { AuthUser } from "@/types/auth";
import type { BackendSession } from "@/types/session";

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const apiBaseUrl = import.meta.env.VITE_API_URL;

const buildUrl = (path: string) => {
  if (!apiBaseUrl) return path;
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const toQueryString = (params?: Record<string, string | number | boolean | undefined>) => {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return "";
  const search = new URLSearchParams();
  entries.forEach(([key, value]) => {
    search.set(key, String(value));
  });
  return `?${search.toString()}`;
};

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const idToken = getCognitoIdToken();
  const headers = new Headers(options.headers);
  if (idToken) {
    headers.set("Authorization", `Bearer ${idToken}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "detail" in data
        ? String((data as { detail?: unknown }).detail)
        : null) ||
      response.statusText ||
      "Request failed";
    throw new ApiError(message, response.status, data);
  }

  return data as T;
};

export const api = {
  auth: {
    me: () => apiFetch<AuthUser>("/api/v1/auth/me"),
    logout: () => apiFetch<{ success: boolean }>("/api/v1/auth/logout", { method: "POST" }),
  },
  sessions: {
    start: () => apiFetch<{ sessionId: string; startTime: number }>("/api/v1/sessions/start", { method: "POST" }),
    end: (sessionId: string, body: unknown) =>
      apiFetch<{ success: boolean; securitySummary: unknown; securityScore: number }>(
        `/api/v1/sessions/${sessionId}/end`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    list: (limit?: number) =>
      apiFetch<BackendSession[]>(`/api/v1/sessions${toQueryString({ limit })}`),
    get: (sessionId: string) => apiFetch<Record<string, unknown>>(`/api/v1/sessions/${sessionId}`),
    delete: (sessionId: string) =>
      apiFetch<{ success: boolean }>(`/api/v1/sessions/${sessionId}`, { method: "DELETE" }),
    addLog: (sessionId: string, body: unknown) =>
      apiFetch<{ success: boolean }>(`/api/v1/sessions/${sessionId}/logs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  intervention: {
    getSettings: () => apiFetch<Record<string, unknown>>("/api/v1/intervention/settings"),
    updateSettings: (body: unknown) =>
      apiFetch<{ success: boolean }>("/api/v1/intervention/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  },
  security: {
    stats: () => apiFetch<Record<string, unknown>>("/api/v1/security/stats"),
    summary: (sessionId: string) =>
      apiFetch<Record<string, unknown>>(`/api/v1/security/summary/${sessionId}`),
  },
  admin: {
    listUsers: (params: { page?: number; limit?: number; search?: string; includeDeleted?: boolean }) =>
      apiFetch<Record<string, unknown>>(`/api/v1/admin/users${toQueryString(params)}`),
    getUser: (userId: number) => apiFetch<Record<string, unknown>>(`/api/v1/admin/users/${userId}`),
    deleteUser: (userId: number) =>
      apiFetch<{ success: boolean }>(`/api/v1/admin/users/${userId}`, { method: "DELETE" }),
    auditLogs: (params: {
      page?: number;
      limit?: number;
      eventType?: string;
      severity?: string;
      userId?: number;
      sessionId?: number;
    }) => apiFetch<Record<string, unknown>>(`/api/v1/admin/audit-logs${toQueryString(params)}`),
  },
};
