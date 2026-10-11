import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

export interface AsyncState<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly reload: () => Promise<void>;
}

/**
 * Carga datos de la API y expone estado de carga, error y recarga.
 *
 * `key` identifica la consulta (por ejemplo `${desde}|${hasta}`): cuando cambia, se vuelve a
 * pedir. Se usa una clave en lugar de una lista de dependencias para que ESLint pueda
 * verificar el efecto, y el loader se guarda en una referencia para no re-disparar la carga
 * en cada render.
 *
 * Es el único lugar del panel que pide datos desde un efecto. Pedirlos al montar implica un
 * render extra; con un panel chico y sin librería de datos, es el costo razonable a cambio de
 * no sumar dependencias.
 */
export function useAsync<T>(loader: () => Promise<T>, key = ""): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loaderRef.current());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Pedir datos al montar obliga a actualizar estado desde un efecto. Es el compromiso de
    // no usar una librería de datos, y queda acotado a este hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [run, key]);

  return { data, error, loading, reload: run };
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "No se pudo completar la operación.";
}
