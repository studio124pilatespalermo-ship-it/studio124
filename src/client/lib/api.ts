import { PUBLIC_API_URL } from "astro:env/client";

/**
 * Cliente de la API del sistema de reservas.
 *
 * Las sesiones viajan en cookie HttpOnly, por eso `credentials: "include"`: el panel
 * nunca guarda tokens en el navegador.
 */
export const API_BASE = PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "network", "No se pudo conectar con el servidor. Revisá tu conexión.");
  }

  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) throw errorFrom(response.status, body);
  return body as T;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function errorFrom(status: number, body: Record<string, unknown> | null): ApiError {
  return new ApiError(
    status,
    text(body?.["error"], "error"),
    text(body?.["message"], "No se pudo completar la operación."),
    body?.["fieldErrors"] as Record<string, string[]> | undefined,
  );
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
