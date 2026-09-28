import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Skeleton } from 'primereact/skeleton';
import { useAuth } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/http/http';
import { geoService, type GeoPayload } from '../../core/services/geo.service';
import { realtimeService } from '../../core/services/realtime.service';
import { EmptyState } from '../../shared/components/EmptyState';
import { useNotificar } from '../../shared/components/Notificaciones';
import {
  cx,
  fechaLocalIso,
  formatoFecha,
  formatoFechaTitulo,
  sumarDias,
} from '../../shared/utils/format';
import { attendanceApi } from './attendance-api';
import type {
  HoraManualResult,
  ResumenUbicacion,
  JornadaItem,
  PizarraItem,
  SolicitudAccion,
} from './attendance.models';
import { AttendanceBoard } from './AttendanceBoard';
import { HoraManualDialog } from './HoraManualDialog';
import { MotivoDialog } from './MotivoDialog';
import { QrScannerDialog } from './QrScannerDialog';
import { QrCardsDialog } from './QrCardsDialog';
import { ESTADO_GEO, type EstadoGeografico } from '../../shared/components/GeoBadge';
import './attendance.scss';

/** Lo que devuelve cada acción: mensaje y evidencia geográfica validada por el backend */
interface ResultadoAccion {
  texto: string;
  ubicacion?: ResumenUbicacion;
  errorGeo?: string | null;
}

type DialogoActivo = 'motivo' | 'horaManual' | null;

interface ConfigMotivo {
  titulo: string;
  etiqueta: string;
  ayuda: string;
  boton: string;
  destructivo: boolean;
}

const CONFIG_MOTIVO: Record<string, ConfigMotivo> = {
  'falta-justificada': {
    titulo: 'Falta justificada',
    etiqueta: 'Motivo de la falta',
    ayuda: 'Quedará pendiente de revisión por la jefatura.',
    boton: 'Registrar falta',
    destructivo: false,
  },
  'salida-anticipada': {
    titulo: 'Salida anticipada',
    etiqueta: 'Motivo de la salida',
    ayuda: 'Se registra la salida con la hora actual.',
    boton: 'Registrar salida',
    destructivo: false,
  },
  observacion: {
    titulo: 'Observación',
    etiqueta: 'Observación',
    ayuda: 'Reemplaza la observación anterior, si la hubiera.',
    boton: 'Guardar',
    destructivo: false,
  },
  anular: {
    titulo: 'Anular registro',
    etiqueta: 'Motivo de la anulación',
    ayuda: 'El registro no se borra: queda anulado con su motivo en la auditoría.',
    boton: 'Anular registro',
    destructivo: true,
  },
};

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function horaActual(): string {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
}


export function AttendancePage() {
  const { tienePermiso } = useAuth();
  const notificar = useNotificar();
  const [params, setParams] = useSearchParams();

  const [hoy, setHoy] = useState(() => fechaLocalIso());
  const fechaParam = params.get('fecha');
  const fecha = fechaParam && FECHA_VALIDA.test(fechaParam) ? fechaParam : hoy;
  const jornadaParam = Number(params.get('jornada')) || null;

  const [jornadas, setJornadas] = useState<JornadaItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [pizarra, setPizarra] = useState<PizarraItem[]>([]);
  const [cargandoPizarra, setCargandoPizarra] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  const [dialogo, setDialogo] = useState<DialogoActivo>(null);
  const [solicitud, setSolicitud] = useState<SolicitudAccion | null>(null);
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [credencialesVisible, setCredencialesVisible] = useState(false);
  const [credencialPersonaId, setCredencialPersonaId] = useState<number | null>(null);

  // La jornada operativa cambia a medianoche sin exigir que el usuario recargue la página.
  useEffect(() => {
    const reloj = window.setInterval(() => {
      const nuevaFecha = fechaLocalIso();
      setHoy((actual) => actual === nuevaFecha ? actual : nuevaFecha);
    }, 30_000);
    return () => window.clearInterval(reloj);
  }, []);

  const jornadaActual = useMemo(() => {
    if (jornadaParam) {
      const buscada = jornadas.find((j) => j.id === jornadaParam);
      if (buscada) return buscada;
    }
    if (jornadas.length === 0) return null;

    const ahora = horaActual();

    if (fecha < hoy) {
      return (
        jornadas.find((j) => j.tipoJornada === 'OBLIGATORIA' && j.estado !== 'CANCELADA') ??
        jornadas[0]
      );
    }

    // Si es hoy, verificar si hay citación obligatoria
    const obligatoria = jornadas.find(
      (j) => j.tipoJornada === 'OBLIGATORIA' && j.estado !== 'CANCELADA',
    );

    if (obligatoria && obligatoria.horaInicio) {
      const [hIni] = obligatoria.horaInicio.split(':').map(Number);
      // Ventana de citación: 1 hora antes de la hora inicio (ej. 18:30 para 19:30, o 06:30 para 07:30)
      const horaUmbral = `${String(Math.max(0, hIni - 1)).padStart(2, '0')}:30`;
      if (ahora >= horaUmbral) {
        return obligatoria;
      }
      // En la mañana o antes de la citación, si existe jornada voluntaria se prioriza
      const voluntaria = jornadas.find(
        (j) => j.tipoJornada === 'VOLUNTARIA' && j.estado !== 'CANCELADA',
      );
      if (voluntaria) return voluntaria;
      return obligatoria;
    }

    return (
      obligatoria ??
      jornadas.find((j) => j.estado === 'ABIERTA') ??
      jornadas[0]
    );
  }, [jornadas, jornadaParam, fecha, hoy]);
  const jornadaId = jornadaActual?.id ?? null;

  const puedeRegistrar = tienePermiso('attendance.register');
  const puedeAjustar = tienePermiso('attendance.update');
  const puedeAnular = tienePermiso('attendance.cancel');

  // Referencias vigentes para los handlers del WebSocket
  const jornadaRef = useRef<number | null>(jornadaId);
  jornadaRef.current = jornadaId;

  const cargarJornadas = useCallback(async (): Promise<void> => {
    setErrorCarga(null);
    try {
      setJornadas(await attendanceApi.jornadas(fecha));
    } catch (err) {
      setErrorCarga(mensajeError(err, 'No se pudieron cargar las jornadas'));
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  const recargarPizarra = useCallback(async (): Promise<void> => {
    const id = jornadaRef.current;
    if (!id) {
      setPizarra([]);
      return;
    }
    const filas = await attendanceApi.pizarra(id);
    if (jornadaRef.current === id) setPizarra(filas);
  }, []);

  const cargarJornadasRef = useRef(cargarJornadas);
  cargarJornadasRef.current = cargarJornadas;

  useEffect(() => {
    setCargando(true);
    void cargarJornadas();
  }, [cargarJornadas]);

  useEffect(() => {
    if (!jornadaId) {
      setPizarra([]);
      return;
    }
    setCargandoPizarra(true);
    recargarPizarra()
      .catch((err) => notificar.error('No se pudo cargar la pizarra', mensajeError(err)))
      .finally(() => setCargandoPizarra(false));
  }, [jornadaId, recargarPizarra, notificar]);

  useEffect(() => {
    const quitar = [
      realtimeService.on<{ jornadaId?: number }>('asistencia.registrada', (e) => {
        if (e?.jornadaId === jornadaRef.current) void recargarPizarra();
      }),
      realtimeService.on('jornada.cerrada', () => void cargarJornadasRef.current()),
      realtimeService.on('jornada.abierta', () => void cargarJornadasRef.current()),
    ];
    return () => quitar.forEach((q) => q());
  }, [recargarPizarra]);

  // ---------- Navegación ----------

  function cambiarFecha(nueva: string): void {
    if (!FECHA_VALIDA.test(nueva)) return;
    setParams(nueva === hoy ? {} : { fecha: nueva });
  }

  function seleccionarJornada(id: number): void {
    setParams(fecha === hoy ? { jornada: String(id) } : { fecha, jornada: String(id) });
  }

  // ---------- Acciones ----------

  async function ejecutarApi(
    sol: SolicitudAccion,
    operacion: () => Promise<ResultadoAccion>,
    enDialogo = false,
  ): Promise<void> {
    setProcesandoId(sol.item.personaId);
    setErrorDialogo(null);
    try {
      const { texto, ubicacion, errorGeo } = await operacion();
      notificar.exito(texto, sol.item.nombreCompleto);
      avisarUbicacion(ubicacion, errorGeo);
      if (enDialogo) setDialogo(null);
    } catch (err) {
      const msg = mensajeError(err);
      if (enDialogo) setErrorDialogo(msg);
      else notificar.error('No se pudo registrar', msg);
    } finally {
      setProcesandoId(null);
      // Siempre refresca: otro dispositivo pudo haber registrado a la misma persona
      await recargarPizarra().catch(() => undefined);
    }
  }

  function avisarUbicacion(ubicacion?: ResumenUbicacion, errorGeo?: string | null): void {
    if (!ubicacion) return;
    const cfg = ESTADO_GEO[ubicacion.estado as EstadoGeografico];
    if (!cfg || ubicacion.estado === 'DENTRO_ZONA' || ubicacion.estado === 'SIN_GEOCERCA') return;
    const detalle =
      ubicacion.estado === 'NO_DISPONIBLE'
        ? (errorGeo ?? 'El registro se guardó sin coordenadas.')
        : [
            ubicacion.distanciaMetros
              ? `A ${Math.round(ubicacion.distanciaMetros)} m del perímetro`
              : null,
            ubicacion.precisionMetros != null
              ? `precisión ±${Math.round(ubicacion.precisionMetros)} m`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined;
    notificar.aviso(`${cfg.texto}${ubicacion.sede ? ` · ${ubicacion.sede}` : ''}`, detalle);
  }

  async function capturarUbicacionObligatoria(): Promise<GeoPayload> {
    const { geo, error } = await geoService.capturar();
    if (!geo) {
      throw new Error(
        `${error ?? 'No se pudo obtener la ubicación'}. La ubicación es obligatoria para marcar asistencia; ` +
          'active el permiso de ubicación del navegador e inténtelo nuevamente.',
      );
    }
    return geo;
  }

  function ejecutar(sol: SolicitudAccion): void {
    setErrorDialogo(null);
    switch (sol.accion) {
      case 'entrada':
      case 'salida':
        void ejecutarRapida(sol);
        break;
      case 'hora-manual':
      case 'ajustar':
        setSolicitud(sol);
        setDialogo('horaManual');
        break;
      default:
        setSolicitud(sol);
        setDialogo('motivo');
    }
  }

  async function ejecutarRapida(sol: SolicitudAccion): Promise<void> {
    await ejecutarApi(sol, async () => {
      const geo = await capturarUbicacionObligatoria();
      if (sol.accion === 'entrada') {
        const r = await attendanceApi.entrada(jornadaId!, sol.item.personaId, geo);
        return { texto: 'Entrada registrada', ubicacion: r?.ubicacion };
      }
      const r = await attendanceApi.salida(Number(sol.item.asistenciaId), geo);
      return { texto: 'Salida registrada', ubicacion: r?.ubicacion };
    });
  }

  const configMotivo = CONFIG_MOTIVO[solicitud?.accion ?? ''] ?? CONFIG_MOTIVO['falta-justificada'];

  async function confirmarMotivo(motivo: string): Promise<void> {
    const sol = solicitud;
    if (!sol) return;
    await ejecutarApi(
      sol,
      async () => {
        const asistenciaId = Number(sol.item.asistenciaId);
        // La observación no es un movimiento: no se solicita la ubicación
        if (sol.accion === 'observacion') {
          await attendanceApi.observacion(asistenciaId, motivo);
          return { texto: 'Observación guardada' };
        }
        switch (sol.accion) {
          case 'falta-justificada': {
            const r = await attendanceApi.faltaJustificada(
              jornadaId!,
              sol.item.personaId,
              motivo,
              null,
            );
            return { texto: 'Falta justificada registrada', ubicacion: r?.ubicacion };
          }
          case 'salida-anticipada': {
            const geo = await capturarUbicacionObligatoria();
            const r = await attendanceApi.salidaAnticipada(asistenciaId, motivo, geo);
            return { texto: 'Salida anticipada registrada', ubicacion: r?.ubicacion };
          }
          case 'anular':
            await attendanceApi.anular(asistenciaId, motivo, null);
            return { texto: 'Registro anulado' };
          default:
            return { texto: '' };
        }
      },
      true,
    );
  }

  async function confirmarHoraManual(res: HoraManualResult): Promise<void> {
    const sol = solicitud;
    if (!sol) return;
    await ejecutarApi(
      sol,
      async () => {
        if (sol.accion === 'hora-manual') {
          const geo = await capturarUbicacionObligatoria();
          const r = await attendanceApi.entradaManual(
            jornadaId!,
            sol.item.personaId,
            res.horaEntrada!,
            res.motivo,
            geo,
          );
          return { texto: 'Entrada manual registrada', ubicacion: r?.ubicacion };
        }
        const r = await attendanceApi.ajusteManual(
          Number(sol.item.asistenciaId),
          res,
          res.motivo,
          null,
        );
        return { texto: 'Horas corregidas', ubicacion: r?.ubicacion };
      },
      true,
    );
  }

  async function handleEscaneadoQr(
    contenido: string,
  ): Promise<{ accion: 'ENTRADA' | 'SALIDA'; nombreCompleto: string; detalle?: string }> {
    if (!jornadaId) throw new Error('No hay una jornada activa seleccionada');
    const geo = await capturarUbicacionObligatoria();
    const res = await attendanceApi.escanearQr(jornadaId, contenido, 'AUTO', geo);
    await recargarPizarra();
    avisarUbicacion(res.registro?.ubicacion);

    const accionTexto = res.accion === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada';
    notificar.exito(accionTexto, res.nombreCompleto);

    return {
      accion: res.accion,
      nombreCompleto: res.nombreCompleto,
      detalle: `${formatoFecha(new Date().toISOString(), 'HH:mm')} hrs · ${jornadaActual?.grupo ?? ''}`,
    };
  }

  function cerrarDialogos(): void {
    setDialogo(null);
    setErrorDialogo(null);
  }

  async function handleActualizar(): Promise<void> {
    setCargandoPizarra(true);
    try {
      await cargarJornadas();
      await recargarPizarra();
      notificar.exito('Datos actualizados', 'La información de asistencia está al día.');
    } catch (err) {
      notificar.error('Error al actualizar', mensajeError(err));
    } finally {
      setCargandoPizarra(false);
    }
  }

  const esHoy = fecha === hoy;

  return (
    <div className="r21-page r21-attendance-page">
      <div className="r21-attendance-header-row">
        <div className="header-titles-col">
          <h1 className="attendance-page-title">Asistencia</h1>
          <span className="attendance-page-subtitle">{formatoFechaTitulo(fecha)}</span>
        </div>

        <div className="header-controls-col">
          <button
            type="button"
            className="btn-actualizar-header"
            onClick={() => void handleActualizar()}
            disabled={cargando || cargandoPizarra}
            title="Refrescar información"
          >
            <i className={cx('pi pi-refresh', (cargando || cargandoPizarra) && 'pi-spin')} />
            <span>Actualizar</span>
          </button>

          <div className="fecha-nav-compact">
            <button
              type="button"
              className="btn-nav-fecha"
              onClick={() => cambiarFecha(sumarDias(fecha, -1))}
              aria-label="Día anterior"
              title="Día anterior"
            >
              <i className="pi pi-chevron-left" />
            </button>
            <input
              type="date"
              className="input-nav-fecha"
              value={fecha}
              onChange={(e) => cambiarFecha(e.target.value)}
              aria-label="Fecha de las jornadas"
            />
            <button
              type="button"
              className="btn-nav-fecha"
              onClick={() => cambiarFecha(sumarDias(fecha, 1))}
              aria-label="Día siguiente"
              title="Día siguiente"
            >
              <i className="pi pi-chevron-right" />
            </button>
            {!esHoy && (
              <button
                type="button"
                className="btn-hoy-badge"
                onClick={() => cambiarFecha(hoy)}
              >
                Hoy
              </button>
            )}
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="r21-card r21-card-body d-flex flex-column gap-3">
          <Skeleton width="40%" height="22px" />
          <Skeleton width="100%" height="56px" />
          <Skeleton width="100%" height="220px" />
        </div>
      ) : errorCarga ? (
        <div className="r21-card r21-card-body">
          <EmptyState
            mensaje="No se pudieron cargar las jornadas"
            descripcion={errorCarga}
            icono="pi pi-exclamation-circle"
          />
          <div className="text-center mt-3">
            <button
              type="button"
              className="btn btn-sm btn-r21-outline"
              onClick={() => void cargarJornadas()}
            >
              <i className="pi pi-refresh"></i> Reintentar
            </button>
          </div>
        </div>
      ) : jornadaActual ? (
        cargandoPizarra && pizarra.length === 0 ? (
          <div className="r21-card r21-card-body d-flex flex-column gap-3">
            <Skeleton width="100%" height="56px" />
            <Skeleton width="100%" height="220px" />
          </div>
        ) : (
          <AttendanceBoard
            jornada={jornadaActual}
            jornadas={jornadas}
            jornadaId={jornadaId}
            onSeleccionarJornada={seleccionarJornada}
            items={pizarra}
            procesandoId={procesandoId}
            puedeRegistrar={puedeRegistrar}
            puedeAjustar={puedeAjustar}
            puedeAnular={puedeAnular}
            onAccion={ejecutar}
            onAbrirScanner={() => setScannerVisible(true)}
            onAbrirCredenciales={(pId) => {
              setCredencialPersonaId(pId ?? null);
              setCredencialesVisible(true);
            }}
          />
        )
      ) : (
        <div className="r21-card">
          <div className="r21-card-body">
            <EmptyState
              mensaje={
                esHoy
                  ? 'No hay jornadas programadas para hoy'
                  : 'No hay jornadas programadas para esta fecha'
              }
              descripcion="Usa las flechas o el calendario para revisar otros días."
              icono="pi pi-calendar-times"
            />
          </div>
        </div>
      )}

      {/* Diálogo de motivo (justificada / salida anticipada / observación / anular) */}
      <MotivoDialog
        visible={dialogo === 'motivo'}
        titulo={configMotivo.titulo}
        etiqueta={configMotivo.etiqueta}
        ayuda={configMotivo.ayuda}
        textoBoton={configMotivo.boton}
        destructivo={configMotivo.destructivo}
        persona={solicitud?.item?.nombreCompleto ?? ''}
        valorInicial={solicitud?.accion === 'observacion' ? (solicitud.item.observacion ?? '') : ''}
        procesando={procesandoId !== null}
        error={errorDialogo}
        onConfirmado={(m) => void confirmarMotivo(m)}
        onCancelar={cerrarDialogos}
      />

      {/* Diálogo de hora manual (registro o corrección) */}
      <HoraManualDialog
        visible={dialogo === 'horaManual'}
        titulo={solicitud?.accion === 'ajustar' ? 'Corregir horas' : 'Registrar con hora manual'}
        modoAjuste={solicitud?.accion === 'ajustar'}
        persona={solicitud?.item?.nombreCompleto ?? ''}
        esHoy={jornadaActual?.fecha === hoy}
        entradaActual={formatoFecha(solicitud?.item?.fechaHoraEntrada, 'HH:mm')}
        salidaActual={formatoFecha(solicitud?.item?.fechaHoraSalida, 'HH:mm')}
        procesando={procesandoId !== null}
        error={errorDialogo}
        onConfirmado={(r) => void confirmarHoraManual(r)}
        onCancelar={cerrarDialogos}
      />

      {/* Escáner de asistencia por cámara y QR */}
      <QrScannerDialog
        visible={scannerVisible}
        jornada={`${jornadaActual?.grupo ?? ''} · ${formatoFechaTitulo(fecha)}`}
        onCerrar={() => setScannerVisible(false)}
        onEscaneado={handleEscaneadoQr}
      />

      {/* Visualizador / Impresor de credenciales QR */}
      <QrCardsDialog
        visible={credencialesVisible}
        grupoId={jornadaActual?.grupoId ?? null}
        grupo={jornadaActual?.grupo ?? ''}
        personaIdFiltro={credencialPersonaId}
        onCerrar={() => {
          setCredencialesVisible(false);
          setCredencialPersonaId(null);
        }}
      />
    </div>
  );
}
