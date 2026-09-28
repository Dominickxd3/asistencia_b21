import { cx } from '../utils/format';
import './paginador.scss';

interface Props {
  total: number;
  pagina: number;
  tamano: number;
  onPagina: (pagina: number) => void;
  onTamano?: (tamano: number) => void;
  tamanos?: number[];
  /** Sustantivo en plural para el resumen («personas») */
  unidad?: string;
}

/** Páginas visibles: 1 … 4 5 [6] 7 8 … 20 */
function paginasVisibles(actual: number, ultima: number): (number | '…')[] {
  if (ultima <= 7) return Array.from({ length: ultima }, (_, i) => i + 1);
  const set = new Set([1, ultima, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= ultima));
  const orden = [...set].sort((a, b) => a - b);
  const res: (number | '…')[] = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - orden[i - 1] > 1) res.push('…');
    res.push(n);
  });
  return res;
}

/** Pie de tabla: «Mostrando 1–25 de 120», filas por página y navegación */
export function Paginador({ total, pagina, tamano, onPagina, onTamano, tamanos = [10, 25, 50, 100], unidad = 'registros' }: Props) {
  const ultima = Math.max(1, Math.ceil(total / tamano));
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = Math.min(total, pagina * tamano);

  return (
    <div className="r21-paginador">
      <span className="paginador-resumen">
        {total === 0 ? `Sin ${unidad}` : `Mostrando ${desde}–${hasta} de ${total} ${unidad}`}
      </span>
      <div className="paginador-controles">
        {onTamano && (
          <label className="paginador-tamano">
            Filas
            <select
              className="form-select form-select-sm"
              value={tamano}
              onChange={(e) => onTamano(Number(e.target.value))}
              aria-label="Filas por página"
            >
              {tamanos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}
        {ultima > 1 && (
          <nav className="paginador-paginas" aria-label="Paginación">
            <button type="button" className="btn btn-sm btn-r21-ghost" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)} aria-label="Página anterior">
              <i className="pi pi-chevron-left"></i>
            </button>
            {paginasVisibles(pagina, ultima).map((n, i) =>
              n === '…' ? (
                <span key={`e${i}`} className="paginador-elipsis">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  className={cx('paginador-num', n === pagina && 'activa')}
                  aria-current={n === pagina ? 'page' : undefined}
                  onClick={() => onPagina(n)}
                >
                  {n}
                </button>
              ),
            )}
            <button type="button" className="btn btn-sm btn-r21-ghost" disabled={pagina >= ultima} onClick={() => onPagina(pagina + 1)} aria-label="Página siguiente">
              <i className="pi pi-chevron-right"></i>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
