import { Link } from 'react-router';
import { cx } from '../utils/format';
import './empty-state.scss';

interface Props {
  mensaje: string;
  descripcion?: string;
  icono?: string;
  compacto?: boolean;
  accionTexto?: string;
  accionRuta?: string;
}

export function EmptyState({
  mensaje,
  descripcion = '',
  icono = 'pi pi-inbox',
  compacto = false,
  accionTexto = '',
  accionRuta = '',
}: Props) {
  return (
    <div className={cx('r21-empty-state', compacto && 'compact')}>
      <div className="empty-icon-wrap">
        <i className={icono}></i>
      </div>
      <div className="empty-content">
        <span className="empty-title">{mensaje}</span>
        {descripcion && <span className="empty-desc">{descripcion}</span>}
      </div>
      {accionTexto && accionRuta && (
        <Link to={accionRuta} className="empty-action">
          {accionTexto} <i className="pi pi-arrow-right"></i>
        </Link>
      )}
    </div>
  );
}
