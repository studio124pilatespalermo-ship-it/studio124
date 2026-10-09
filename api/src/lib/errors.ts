/**
 * Errores de dominio con un código estable. La capa HTTP los traduce a status y al formato
 * `{ error, message, fieldErrors? }`; nunca se filtran detalles internos al cliente.
 */
export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "slot_full"
  | "no_credits"
  | "outside_window"
  | "pack_expired"
  | "not_configured"
  | "upstream_error";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  slot_full: 409,
  no_credits: 409,
  outside_window: 409,
  pack_expired: 409,
  not_configured: 503,
  upstream_error: 502,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = fieldErrors;
  }
}

export const notFound = (what: string) => new AppError("not_found", `${what} no encontrado.`);
