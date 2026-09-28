import { Calendar } from 'primereact/calendar';
import { desdeIso, fechaLocalIso, sumarDias } from '../../shared/utils/format';
import './date-selector.scss';

interface Props {
  fechaIso: string;
  onFechaSeleccionada: (iso: string) => void;
}

export function DateSelector({ fechaIso, onFechaSeleccionada }: Props) {
  const hoy = fechaLocalIso();
  const esHoy = fechaIso === hoy;

  return (
    <div className="r21-date-selector" aria-label="Control de fecha">
      {/* Botón día anterior */}
      <button
        type="button"
        className="nav-date-btn"
        onClick={() => onFechaSeleccionada(sumarDias(fechaIso, -1))}
        title="Día anterior"
        aria-label="Día anterior"
      >
        <i className="pi pi-chevron-left"></i>
      </button>

      {/* Selector con Calendar de PrimeReact */}
      <div className="calendar-picker-box">
        <i className="pi pi-calendar date-lead-icon"></i>
        <span>
          <Calendar
            value={desdeIso(fechaIso)}
            onChange={(e) => {
              if (e.value) onFechaSeleccionada(fechaLocalIso(e.value as Date));
            }}
            dateFormat="D dd M yy"
            showIcon={false}
            readOnlyInput
            appendTo={document.body}
            panelClassName="r21-calendar-popup"
            className="r21-calendar-control"
            inputClassName="r21-calendar-text"
            ariaLabel="Seleccionar fecha"
          />
        </span>
        <i className="pi pi-chevron-down date-trail-icon"></i>
      </div>

      {/* Botón día siguiente */}
      <button
        type="button"
        className="nav-date-btn"
        onClick={() => onFechaSeleccionada(sumarDias(fechaIso, 1))}
        title="Día siguiente"
        aria-label="Día siguiente"
      >
        <i className="pi pi-chevron-right"></i>
      </button>

      {/* Botón Hoy */}
      {!esHoy && (
        <button type="button" className="btn-today-pill" onClick={() => onFechaSeleccionada(hoy)}>
          Hoy
        </button>
      )}
    </div>
  );
}
