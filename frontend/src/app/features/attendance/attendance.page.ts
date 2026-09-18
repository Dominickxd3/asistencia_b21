import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AttendanceApiService } from './attendance-api.service';
import { GeoService } from '../../core/services/geo.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  JornadaItem,
  PizarraItem,
  PendienteItem,
  SolicitudAccion,
  HoraManualResult,
} from './attendance.models';
import { AttendanceMemberRowComponent } from './attendance-member-row.component';
import { MotivoDialogComponent } from './motivo-dialog.component';
import { HoraManualDialogComponent } from './hora-manual-dialog.component';
import { CierreDialogComponent } from './cierre-dialog.component';

type DialogoActivo = 'motivo' | 'horaManual' | 'cierre' | null;

@Component({
  selector: 'app-attendance-page',
  standalone: true,
  imports: [
    FormsModule,
    ToastModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    ConfirmDialogModule,
    AttendanceMemberRowComponent,
    MotivoDialogComponent,
    HoraManualDialogComponent,
    CierreDialogComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './attendance.page.html',
  styleUrl: './attendance.page.scss',
})
export class AttendancePageComponent implements OnInit, OnDestroy {
  private readonly api = inject(AttendanceApiService);
  private readonly geo = inject(GeoService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);

  readonly jornadas = signal<JornadaItem[]>([]);
  readonly jornadaId = signal<number | null>(null);
  readonly pizarra = signal<PizarraItem[]>([]);
  readonly filtroBusqueda = signal<string>('');
  readonly procesandoId = signal<number | null>(null);
  readonly cargando = signal(true);

  readonly dialogo = signal<DialogoActivo>(null);
  readonly solicitud = signal<SolicitudAccion | null>(null);
  readonly pendientesCierre = signal<PendienteItem[]>([]);

  readonly jornadaActual = computed<JornadaItem | null>(() => {
    return this.jornadas().find((j) => j.id === this.jornadaId()) ?? null;
  });

  readonly puedeAjustar = computed(() => this.auth.tienePermiso('attendance.update'));
  readonly puedeAnular = computed(() => this.auth.tienePermiso('attendance.cancel'));

  readonly totalIntegrantes = computed(() => this.pizarra().length);

  readonly presentesCount = computed(() => {
    return this.pizarra().filter(
      (item) => item.estado === 'PRESENTE' || item.estado === 'FINALIZADO',
    ).length;
  });

  readonly pendientesCount = computed(() => {
    return this.pizarra().filter(
      (item) => !item.estado || item.estado === 'PENDIENTE',
    ).length;
  });

  /**
   * Orden automático estricto requerido:
   * 1. PENDIENTES
   * 2. PRESENTES
   * 3. INCIDENCIAS (FALTA_JUSTIFICADA, SALIDA_ANTICIPADA, FALTA_INJUSTIFICADA)
   * 4. FINALIZADOS / ANULADOS
   * Y dentro de cada categoría, orden alfabético por nombre.
   */
  readonly itemsOrdenadosYFiltrados = computed(() => {
    const q = this.filtroBusqueda().trim().toLowerCase();
    let lista = this.pizarra();

    if (q) {
      lista = lista.filter((item) => item.nombreCompleto.toLowerCase().includes(q));
    }

    return [...lista].sort((a, b) => {
      const pA = this.obtenerPrioridadEstado(a.estado);
      const pB = this.obtenerPrioridadEstado(b.estado);
      if (pA !== pB) return pA - pB;
      return a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' });
    });
  });

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
      const activa = jornadas.find((j) => j.estado === 'ABIERTA') ?? jornadas[0];
      const id = activa?.id ?? null;
      this.jornadaId.set(id);
      if (id) await this.recargarPizarra();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error de conexión',
        detail: 'No se pudieron consultar las jornadas operativas',
      });
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
    try {
      const items = await this.api.pizarra(id);
      this.pizarra.set(items);
    } catch {
      // Manejo en tiempo real silencioso
    }
  }

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
    const jId = this.jornadaId();
    if (!jId) return;

    this.procesandoId.set(sol.item.personaId);
    try {
      const geo = await this.geo.capturar();
      if (sol.accion === 'entrada') {
        await this.api.entrada(jId, sol.item.personaId, geo);
        this.messageService.add({
          severity: 'success',
          summary: 'Entrada registrada',
          detail: `${sol.item.nombreCompleto}`,
          life: 2500,
        });
        // Si había filtro activo, se limpia para el siguiente registro rápido
        if (this.filtroBusqueda()) {
          this.filtroBusqueda.set('');
        }
      } else {
        await this.api.salida(Number(sol.item.asistenciaId), geo);
        this.messageService.add({
          severity: 'info',
          summary: 'Salida registrada',
          detail: `${sol.item.nombreCompleto}`,
          life: 2500,
        });
      }
      await this.recargarPizarra();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo registrar',
        detail: err?.error?.message ?? 'Ocurrió un error al registrar la asistencia',
      });
    } finally {
      this.procesandoId.set(null);
    }
  }

  configMotivo(): { titulo: string; etiqueta: string; boton: string; destructivo: boolean } {
    const sol = this.solicitud();
    switch (sol?.accion) {
      case 'falta-justificada':
        return {
          titulo: 'Falta justificada',
          etiqueta: 'Motivo de la inasistencia *',
          boton: 'Registrar falta',
          destructivo: false,
        };
      case 'salida-anticipada':
        return {
          titulo: 'Salida anticipada',
          etiqueta: 'Motivo de salida anticipada *',
          boton: 'Registrar salida',
          destructivo: false,
        };
      case 'observacion':
        return {
          titulo: 'Agregar observación',
          etiqueta: 'Detalle u observación reglamentaria *',
          boton: 'Guardar observación',
          destructivo: false,
        };
      case 'anular':
        return {
          titulo: 'Anular registro',
          etiqueta: 'Motivo de anulación (auditoría obligatoria) *',
          boton: 'Anular registro',
          destructivo: true,
        };
      default:
        return {
          titulo: 'Motivo',
          etiqueta: 'Motivo *',
          boton: 'Confirmar',
          destructivo: false,
        };
    }
  }

  async confirmarMotivo(motivo: string): Promise<void> {
    const sol = this.solicitud();
    const jId = this.jornadaId();
    if (!sol || !jId) return;

    this.procesandoId.set(sol.item.personaId);
    try {
      const geo = await this.geo.capturar();
      const asistenciaId = Number(sol.item.asistenciaId);

      switch (sol.accion) {
        case 'falta-justificada':
          await this.api.faltaJustificada(jId, sol.item.personaId, motivo, geo);
          this.messageService.add({
            severity: 'warn',
            summary: 'Falta justificada',
            detail: `${sol.item.nombreCompleto}`,
            life: 2500,
          });
          break;
        case 'salida-anticipada':
          await this.api.salidaAnticipada(asistenciaId, motivo, geo);
          this.messageService.add({
            severity: 'warn',
            summary: 'Salida anticipada',
            detail: `${sol.item.nombreCompleto}`,
            life: 2500,
          });
          break;
        case 'observacion':
          await this.api.observacion(asistenciaId, motivo);
          this.messageService.add({
            severity: 'info',
            summary: 'Observación guardada',
            detail: `${sol.item.nombreCompleto}`,
            life: 2500,
          });
          break;
        case 'anular':
          await this.api.anular(asistenciaId, motivo, geo);
          this.messageService.add({
            severity: 'secondary',
            summary: 'Registro anulado',
            detail: `${sol.item.nombreCompleto}`,
            life: 2500,
          });
          break;
      }
      this.dialogo.set(null);
      await this.recargarPizarra();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err?.error?.message ?? 'No se pudo completar la operación',
      });
    } finally {
      this.procesandoId.set(null);
    }
  }

  async confirmarHoraManual(res: HoraManualResult): Promise<void> {
    const sol = this.solicitud();
    const jId = this.jornadaId();
    if (!sol || !jId) return;

    this.procesandoId.set(sol.item.personaId);
    try {
      const geo = await this.geo.capturar();
      if (sol.accion === 'hora-manual') {
        await this.api.entradaManual(jId, sol.item.personaId, res.horaEntrada!, res.motivo, geo);
        this.messageService.add({
          severity: 'success',
          summary: 'Entrada manual registrada',
          detail: `${sol.item.nombreCompleto} (${res.horaEntrada})`,
          life: 2500,
        });
      } else {
        await this.api.ajusteManual(Number(sol.item.asistenciaId), res, res.motivo, geo);
        this.messageService.add({
          severity: 'info',
          summary: 'Horario modificado',
          detail: `${sol.item.nombreCompleto}`,
          life: 2500,
        });
      }
      this.dialogo.set(null);
      await this.recargarPizarra();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err?.error?.message ?? 'No se pudo registrar la hora manual',
      });
    } finally {
      this.procesandoId.set(null);
    }
  }

  async intentarCierre(): Promise<void> {
    const id = this.jornadaId();
    if (!id) return;
    try {
      const pends = await this.api.pendientes(id);
      this.pendientesCierre.set(pends);
      this.dialogo.set('cierre');
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron consultar los efectivos pendientes para el cierre',
      });
    }
  }

  async confirmarCierre(): Promise<void> {
    const id = this.jornadaId();
    if (!id) return;
    try {
      const resultado = (await this.api.cerrarJornada(id, true)) as { convertidas?: number };
      this.dialogo.set(null);
      this.messageService.add({
        severity: 'success',
        summary: 'Jornada cerrada',
        detail: `Concluida exitosamente${resultado?.convertidas ? ` (${resultado.convertidas} faltas)` : ''}`,
        life: 3000,
      });
      await this.cargarJornadas();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al cerrar',
        detail: err?.error?.message ?? 'No se pudo cerrar la jornada',
      });
    }
  }

  private obtenerPrioridadEstado(estado: string | null): number {
    if (!estado || estado === 'PENDIENTE') return 1;
    if (estado === 'PRESENTE') return 2;
    if (
      estado === 'FALTA_JUSTIFICADA' ||
      estado === 'SALIDA_ANTICIPADA' ||
      estado === 'FALTA_INJUSTIFICADA'
    )
      return 3;
    if (estado === 'FINALIZADO' || estado === 'ANULADO') return 4;
    return 5;
  }

  formatearHorario(j: JornadaItem): string {
    if (j.inicioProgramada && j.finProgramada) {
      const hi = new Date(j.inicioProgramada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
      const hf = new Date(j.finProgramada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${hi} — ${hf}`;
    }
    return '19:00 — 22:00';
  }

  formatearEstadoJornada(estado: string): { texto: string; cssClass: string } {
    const e = (estado || '').toUpperCase();
    if (e === 'ABIERTA') return { texto: 'Estado: En curso', cssClass: 'status-en-curso' };
    if (e === 'CERRADA' || e === 'FINALIZADA') return { texto: 'Estado: Finalizada', cssClass: 'status-cerrada' };
    return { texto: 'Estado: Programada', cssClass: 'status-programada' };
  }
}
