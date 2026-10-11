import { useState } from "react";

/**
 * Estado editable que arranca de un valor externo (props o datos recién cargados) y se
 * reinicia cuando ese valor cambia.
 *
 * Es el patrón que recomienda React para "ajustar estado cuando cambian las props":
 * se compara durante el render en lugar de copiar el valor dentro de un `useEffect`,
 * que provoca un render extra y deja ver por un instante el valor viejo.
 */
export function useDerivedState<T>(source: T): [T, (value: T) => void, boolean] {
  const [previous, setPrevious] = useState(source);
  const [edited, setEdited] = useState<{ value: T } | null>(null);

  if (previous !== source) {
    setPrevious(source);
    setEdited(null);
  }

  const value = edited ? edited.value : source;
  const isEdited = edited !== null;
  return [value, (next: T) => setEdited({ value: next }), isEdited];
}
