import { useEffect, type ReactNode } from 'react';
import './page-header.scss';

interface Props {
  titulo: string;
  subtitulo?: string;
  descripcion?: string;
  children?: ReactNode;
}

export function PageHeader({ titulo, subtitulo = '', descripcion = '', children }: Props) {
  useEffect(() => {
    document.title = `${titulo} · Rímac 21`;
  }, [titulo]);

  return (
    <header className="r21-page-header">
      <div className="header-main">
        <div className="title-row">
          <h1 className="r21-page-title">{titulo}</h1>
          {subtitulo && <span className="header-subtitulo">{subtitulo}</span>}
        </div>
        {descripcion && <p className="header-descripcion">{descripcion}</p>}
      </div>
      <div className="header-actions">{children}</div>
    </header>
  );
}
