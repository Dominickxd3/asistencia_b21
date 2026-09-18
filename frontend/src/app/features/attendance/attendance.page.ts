import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AttendanceApiService } from './attendance-api.service';
import { GeoService } from '../../core/services/geo.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { AuthService } from '../../core/auth/auth.service';
import { JornadaItem, PizarraItem, PendienteItem } from './attendance.models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { AttendanceBoardComponent } from './attendance-board.component';
import { MotivoDialogComponent } from './motivo-dialog.component';
import { HoraManualDialogComponent, HoraManualResult } from './hora-manual-dialog.component';
import { CierreDialogComponent } from './cierre-dialog.component';
import { AccionFila, SolicitudAccion } from './member-row.component';

type DialogoActivo = 'motivo' | 'horaManual' | 'cierre' | null;

@Component({
  selector: 'app-attendance-page',
  imports: [
    FormsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    AttendanceBoardComponent,
    MotivoDialogComponent,
    HoraManualDialogComponent,
    CierreDialogComponent,
  ],
  templateUrl: './attendance.page.html',
})
export class AttendancePageComponent implements OnInit, OnDestroy {
  private readonly api = inject(AttendanceApiService);
  private readonly geo = inject(GeoService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);

  readonly jornadas = signal<JornadaItem[]>([]);
  readonly jornadaId = signal<number | null>(null);
  readonly pizarra = signal<PizarraItem[]>([]);
  readonly procesandoId = signal<number | null>(null);
  readonly cargando = signal(true);
  readonly mensaje = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  readonly dialogo = signal<DialogoActivo>(null);
  readonly solicitud = signal<SolicitudAccion | null>(null);
  readonly pendientesCierre = signal<PendienteItem[]>([]);

  readonly jornadaActual = computed(
    () => this.jornadas().find((j) => j.id === this.jornadaId()) ?? null,
  );
  readonly puedeAjustar = computed(() => this.auth.tienePermiso('attendance.update'));
  readonly puedeAnular = computed(() => this.auth.tienePermiso('attendance.cancel'));

  async ngOnInit(): Promise<void> {
    this.realtime.conectar();
    this.realtime.on('asistencia.registrada', (e: any) => {
      if (e?.jornadaId === this.jornadaId()) void this.recargarPizarra();
    });
    this.realtime.on('jornada.cerrada', (e: any) => {
      if (e?.jornadaId === this.jornadaId()) void this.cargarJornadas();
    });
    await this.cargarJornadas();
  }

  ngOnDestroy(): void {
    this.realtime.off('asistencia.registrada');
    this.realtime.off('jornada.cerrada');
  }

  async cargarJornadas(): Promise<void> {
    this.cargando.set(true);
    try {
      const jornadas = await this.api.jornadas();
      this.jornadas.set(jornadas);
      const abierta = jornadas.find((j) => j.estado === 'ABIERTA') ?? jornadas[0];
      const id = abierta?.id ?? null;
      this.jornadaId.set(id);
      if (id) await this.recargarPizarra();
    } catch {
      this.mensaje.set({ tipo: 'error', texto: 'No se pudieron cargar las jornadas' });
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarJornada(id: number): Promise<void> {
    this.jornadaId.set(id);
    await this.recargarPizarra();
  }

  async recargarPizarra(): Promise<void> {
    const id = this.jornadaId();
    if (!id) return;
    this.pizarra.set(await this.api.pizarra(id));
  }

  /** Punto único de entrada de acciones de fila */
  async ejecutar(sol: SolicitudAccion): Promise<void> {
    switch (sol.accion) {
      case 'entrada':
      case 'salida':
        await this.ejecutarRapida(sol);
        break;
      case 'hora-manual':
      case 'ajustar':
        this.solicitud.set(sol);
        this.dialogo.set('horaManual');
        break;
      case 'falta-justificada':
      case 'salida-anticipada':
      case 'observacion':
      case 'anular':
        this.solicitud.set(sol);
        this.dialogo.set('motivo');
        break;
    }
  }

  private async ejecutarRapida(sol: SolicitudAccion): Promise<void> {
    await this.ejecutarApi(sol.item.personaId, async () => {
      const geo = await this.geo.capturar();
      if (sol.accion === 'entrada') {
        await this.api.entrada(this.jornadaId()!, sol.item.personaId, geo);
        return 'Entrada registrada';
      }
      await this.api.salida(Number(sol.item.asistenciaId), geo);
      return 'Salida registrada';
    });
  }

  // ---------- Diálogos ----------

  configMotivo(): { titulo: string; etiqueta: string; boton: string; destructivo: boolean } {
    const mapa: Record<string, any> = {
      'falta-justificada': { titulo: 'Falta justificada', etiqueta: 'Motivo de la falta *', boton: 'Registrar', destructivo: false },
      'salida-anticipada': { titulo: 'Salida anticipada', etiqueta: 'Motivo de la salida *', boton: 'Registrar', destructivo: false },
      observacion: { titulo: 'Observación', etiqueta: 'Observación *', boton: 'Guardar', destructivo: false },
      anular: { titulo: 'Anular registro', etiqueta: 'Motivo de la anulación *', boton: 'Anular', destructivo: true },
    };
    return mapa[this.solicitud()?.accion ?? ''] ?? mapa['falta-justificada'];
  }

  async confirmarMotivo(motivo: string): Promise<void> {
    const sol = this.solicitud();
    if (!sol) return;
    await this.ejecutarApi(sol.item.personaId, async () => {
      const geo = await this.geo.capturar();
      const asistenciaId = Number(sol.item.asistenciaId);
      switch (sol.accion) {
        case 'falta-justificada':
          await this.api.faltaJustificada(this.jornadaId()!, sol.item.personaId, motivo, geo);
          return 'Falta justificada registrada';
        case 'salida-anticipada':
          await this.api.salidaAnticipada(asistenciaId, motivo, geo);
          return 'Salida anticipada registrada';
        case 'observacion':
          await this.api.observacion(asistenciaId, motivo);
          return 'Observación guardada';
        case 'anular':
          await this.api.anular(asistenciaId, motivo, geo);
          return 'Registro anulado';
        default:
          return '';
      }
    }, true);
  }

  async confirmarHoraManual(res: HoraManualResult): Promise<void> {
    const sol = this.solicitud();
    if (!sol) return;
    await this.ejecutarApi(sol.item.personaId, async () => {
      const geo = await this.geo.capturar();
      if (sol.accion === 'hora-manual') {
        await this.api.entradaManual(this.jornadaId()!, sol.item.personaId, res.horaEntrada!, res.motivo, geo);
        return 'Entrada manual registrada';
      }
      await this.api.ajusteManual(Number(sol.item.asistenciaId), res, res.motivo, geo);
      return 'Horario ajustado';
    }, true);
  }

  // ---------- Cierre de jornada ----------

  async intentarCierre(): Promise<void> {
    const id = this.jornadaId();
    if (!id) return;
    this.pendientesCierre.set(await this.api.pendientes(id));
    this.dialogo.set('cierre');
  }

  async confirmarCierre(): Promise<void> {
    const id = this.jornadaId();
    if (!id) return;
    try {
      const resultado = (await this.api.cerrarJornada(id, true)) as { convertidas?: number };
      this.dialogo.set(null);
      this.mensaje.set({
        tipo: 'ok',
        texto: `Jornada cerrada${resultado.convertidas ? ` — ${resultado.convertidas} falta(s) injustificada(s)` : ''}`,
      });
      await this.cargarJornadas();
    } catch (err: any) {
      this.mensaje.set({ tipo: 'error', texto: err?.error?.message ?? 'No se pudo cerrar' });
    }
  }

  // ---------- Utilidades ----------

  private async ejecutarApi(
    personaId: number,
    operacion: () => Promise<string>,
    cerrarDialogo = false,
  ): Promise<void> {
    this.procesandoId.set(personaId);
    this.mensaje.set(null);
    try {
      const texto = await operacion();
      this.mensaje.set({ tipo: 'ok', texto });
      if (cerrarDialogo) this.dialogo.set(null);
      await this.recargarPizarra();
    } catch (err: any) {
      const detalle = err?.error?.message;
      this.mensaje.set({
        tipo: 'error',
        texto: typeof detalle === 'string' ? detalle : 'No se pudo completar la operación',
      });
    } finally {
      this.procesandoId.set(null);
    }
  }

  cerrarDialogos(): void {
    this.dialogo.set(null);
  }
}
