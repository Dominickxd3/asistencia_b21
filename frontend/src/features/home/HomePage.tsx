import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { environment } from '../../environments/environment';
import { useAuth } from '../../core/auth/auth.service';
import { http } from '../../core/http/http';
import type { DashboardHoy } from '../../core/models/api.models';
import { realtimeService } from '../../core/services/realtime.service';
import { PageHeader } from '../../shared/components/PageHeader';
import { fechaLocalIso } from '../../shared/utils/format';
import { DateSelector } from './DateSelector';
import { GateControlPanel } from './GateControlPanel';
import { GroupMetricsDeck } from './GroupMetricsDeck';
import { RecentActivity } from './RecentActivity';
import './home.scss';

export function HomePage() {
  const { perfil } = useAuth();

  const [datos, setDatos] = useState<DashboardHoy | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [fechaActual, setFechaActual] = useState<string>(() => fechaLocalIso());

  // Fecha vigente para las recargas disparadas por el WebSocket
  const fechaRef = useRef(fechaActual);
  const refrescoPendiente = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async (opciones: { silencioso?: boolean } = {}): Promise<void> => {
    if (!opciones.silencioso) setCargando(true);
    setErrorCarga(false);
    const fecha = fechaRef.current;
    try {
      const data = await http.get<DashboardHoy>(`${environment.apiUrl}/dashboard/today`, {
        params: { fecha },
      });
      if (fechaRef.current === fecha) setDatos(data);
    } catch {
      if (!opciones.silencioso) {
        setDatos(null);
        setErrorCarga(true);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // Las actualizaciones en vivo refrescan sin volver a mostrar los skeletons
    const programarRefresco = () => {
      if (refrescoPendiente.current) return;
      refrescoPendiente.current = setTimeout(() => {
        refrescoPendiente.current = null;
        void cargar({ silencioso: true });
      }, 400);
    };

    void cargar();
    const quitar = realtimeService.on('dashboard.actualizar', programarRefresco);

    return () => {
      quitar();
      if (refrescoPendiente.current) clearTimeout(refrescoPendiente.current);
      refrescoPendiente.current = null;
    };
  }, [cargar]);

  function onFechaSeleccionada(nuevaFechaIso: string): void {
    fechaRef.current = nuevaFechaIso;
    setFechaActual(nuevaFechaIso);
    void cargar();
  }

  const nombre = perfil?.persona.nombres;
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
  const titulo = nombre ? `${saludo}, ${nombre}` : saludo;

  return (
    <>
      {/* CABECERA INSTITUCIONAL CON SELECTOR DE FECHA */}
      <PageHeader titulo={titulo} descripcion="Panel operativo · Cuartel Rímac 21">
        <DateSelector fechaIso={fechaActual} onFechaSeleccionada={onFechaSeleccionada} />
      </PageHeader>

      {cargando ? (
        /* ESTADO 1: CARGANDO */
        <div className="home-page-container" aria-busy="true">
          <Skeleton width="100%" height="180px" borderRadius="8px" />
          <Skeleton width="100%" height="200px" borderRadius="8px" />
          <Skeleton width="100%" height="240px" borderRadius="8px" />
        </div>
      ) : errorCarga || !datos ? (
        /* ESTADO 2: ERROR DE CARGA CON BOTÓN REINTENTAR */
        <div className="r21-card error-card-box">
          <div className="error-circle-icon">
            <i className="pi pi-exclamation-circle"></i>
          </div>
          <div className="error-text-content">
            <h3 className="error-heading">No se pudo cargar la información operativa</h3>
            <p className="error-paragraph">
              Ocurrió un inconveniente al conectar con el servidor. Verifica tu conexión e intenta
              nuevamente.
            </p>
          </div>
          <Button
            label="Reintentar"
            icon="pi pi-refresh"
            className="p-button-sm p-button-outlined"
            onClick={() => void cargar()}
          />
        </div>
      ) : (
        /* ESTADO 3: PANTALLA OPERATIVA PRINCIPAL */
        <div className="home-page-container">
          {/* Control de puerta */}
          <GateControlPanel
            resumen={datos.resumen}
            jornadas={datos.jornadas}
            esHoy={datos.esHoy}
            fecha={datos.fecha}
          />

          {/* Indicadores del mes por grupo */}
          <GroupMetricsDeck grupos={datos.grupos} fecha={datos.fecha} />

          {/* Actividad reciente */}
          <RecentActivity actividad={datos.actividad} fecha={datos.fecha} esHoy={datos.esHoy} />
        </div>
      )}
    </>
  );
}
