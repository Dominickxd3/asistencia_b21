import { useEffect, useState } from 'react';

/** Valor que solo se actualiza tras `ms` sin cambios (búsquedas mientras se escribe). */
export function useDebounce<T>(valor: T, ms = 300): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return diferido;
}
