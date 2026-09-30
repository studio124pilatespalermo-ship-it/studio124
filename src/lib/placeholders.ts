/** Un dato pendiente se escribe entre llaves dobles: {{PRECIO}}, {{DIRECCION}}… */
export const PLACEHOLDER_PATTERN = /\{\{[A-Z0-9_]+\}\}/;
export const PLACEHOLDER_PATTERN_GLOBAL = /\{\{[A-Z0-9_]+\}\}/g;

export function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERN.test(value);
}

/** Valor listo para mostrar y si todavía es un dato pendiente. */
export interface DisplayValue {
  readonly text: string;
  readonly pending: boolean;
}

/** Convierte un dato opcional en texto visible; `null` muestra el placeholder indicado. */
export function displayValue(value: string | number | null, placeholder: string): DisplayValue {
  if (value === null) return { text: placeholder, pending: true };
  const text = String(value);
  return { text, pending: isPlaceholder(text) };
}

/** Devuelve `value` sólo si es un dato real; útil para no publicar placeholders en el JSON-LD. */
export function definedOrUndefined(value: string): string | undefined {
  return isPlaceholder(value) ? undefined : value;
}
