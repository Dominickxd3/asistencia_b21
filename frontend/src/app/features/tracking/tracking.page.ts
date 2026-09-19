import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TuiIcon } from '@taiga-ui/core';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type Periodo = 'mes' | 'primera' | 'segunda' | 'personalizado';

export interface Grupo {
  id: number;
  nombre: string;
  etapa: string;
}

export interface Fila {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  jornadasAplicables: number;
  asistencias: number;
  porcentajeAsistencia: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  salidasAnticipadas: number;
  horasAdicionales: number;
}

export interface Resumen {
  jornadasObligatorias: number;
  asistenciaGrupo: number;
  faltasInjustificadas: number;
  faltasJustificadas: number;
  salidasAnticipadas: number;
  horasAdicionales: number;
}

export interface Respuesta {
  grupo: Grupo;
  jornadasEsperadas: number;
  resumen: Resumen;
  integrantes: Fila[];
}

export interface Historia {
  jornadaId: number;
  fecha: string;
  tipo: string;
  estado: string;
  entrada: string | null;
  salida: string | null;
  incidencia: string | null;
  horasAdicionales: number;
}

export interface Detalle {
  grupo: Grupo;
  desde: string;
  hasta: string;
  integrante: Fila;
  historial: Historia[];
}

@Component({
  selector: 'app-tracking-page',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, TuiIcon, SlicePipe],
  templateUrl: './tracking.page.html',
  styleUrl: './tracking.page.css',
})
export class TrackingPageComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly grupos = signal<Grupo[]>([]);
  readonly grupoId = signal<number | null>(null);
  readonly orden = signal('faltas_injustificadas');
  readonly periodo = signal<Periodo>('mes');
  readonly filas = signal<Fila[]>([]);
  readonly resumen = signal<Resumen | null>(null);
  readonly jornadasEsperadas = signal(0);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly detalle = signal<Detalle | null>(null);
  readonly cargandoDetalle = signal(false);

  // Filtros simples
  readonly busqueda = signal('');
  readonly soloConFaltas = signal(false);
  readonly soloEnRiesgo = signal(false);

  desde = '';
  hasta = '';

  // 1. ¿Cómo va el cumplimiento obligatorio del grupo?
  readonly asistenciaGrupo = computed(() => this.resumen()?.asistenciaGrupo ?? 0);
  readonly metaAsistencia = 80.0;
  readonly brechaMeta = computed(() => {
    const diff = Math.round((this.asistenciaGrupo() - this.metaAsistencia) * 10) / 10;
    return diff;
  });
  readonly totalJornadasEsperadas = computed(() => this.jornadasEsperadas());
  readonly totalAsistencias = computed(() => this.filas().reduce((sum, f) => sum + f.asistencias, 0));
  readonly totalAplicables = computed(() => this.filas().reduce((sum, f) => sum + f.jornadasAplicables, 0));

  // 2. ¿Cuántas faltas injustificadas existen?
  readonly totalFaltasInjustificadas = computed(() => this.resumen()?.faltasInjustificadas ?? 0);
  readonly totalFaltasJustificadas = computed(() => this.resumen()?.faltasJustificadas ?? 0);
  readonly totalSalidasAnticipadas = computed(() => this.resumen()?.salidasAnticipadas ?? 0);

  // 3. ¿Quiénes concentran esas faltas?
  readonly concentranFaltas = computed(() => {
    return this.filas()
      .filter(f => f.faltasInjustificadas > 0)
      .sort((a, b) => b.faltasInjustificadas - a.faltasInjustificadas || a.porcentajeAsistencia - b.porcentajeAsistencia);
  });

  // 4. ¿Cómo viene la distribución de asistencia? (Gráfico de barra sobrio y minimalista)
  readonly distribucionVisual = computed(() => {
    const total = this.totalAplicables();
    if (!total) return { asistencias: 0, faltasInjust: 0, faltasJust: 0, sinRegistro: 0 };
    const asist = this.totalAsistencias();
    const fi = this.totalFaltasInjustificadas();
    const fj = this.totalFaltasJustificadas();
    const resto = Math.max(0, total - asist - fi - fj);
    return {
      asistencias: Math.round((asist / total) * 100),
      faltasInjust: Math.round((fi / total) * 100),
      faltasJust: Math.round((fj / total) * 100),
      sinRegistro: Math.round((resto / total) * 100),
    };
  });

  // 5. ¿Cuántas horas voluntarias se están realizando?
  readonly totalHorasVoluntarias = computed(() => this.resumen()?.horasAdicionales ?? 0);
  readonly integrantesConHoras = computed(() => this.filas().filter(f => f.horasAdicionales > 0));
  readonly promedioHorasVoluntarias = computed(() => {
    const n = this.filas().length;
    return n ? (Math.round((this.totalHorasVoluntarias() / n) * 10) / 10).toFixed(1) : '0.0';
  });

  // 6. ¿Quién requiere que revise su detalle? (Prioritarios con faltas injustificadas o asistencia < 80%)
  readonly casosPrioritarios = computed(() => {
    return this.filas()
      .filter(f => f.faltasInjustificadas > 0 || f.porcentajeAsistencia < 80)
      .sort((a, b) => b.faltasInjustificadas - a.faltasInjustificadas || a.porcentajeAsistencia - b.porcentajeAsistencia);
  });

  // Integrantes filtrados para la grilla
  readonly filasFiltradas = computed(() => {
    let list = this.filas();

    if (this.soloConFaltas()) {
      list = list.filter(f => f.faltasInjustificadas > 0);
    }
    if (this.soloEnRiesgo()) {
      list = list.filter(f => f.porcentajeAsistencia < 80);
    }

    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      list = list.filter(f =>
        f.nombreCompleto.toLowerCase().includes(q) ||
        (f.dni && f.dni.includes(q))
      );
    }

    return list;
  });

  async ngOnInit(): Promise<void> {
    this.aplicarPeriodo('mes', false);
    try {
      const grupos = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups`));
      this.grupos.set(grupos.map(x => ({ id: Number(x.id), nombre: x.nombre, etapa: x.etapa })));
      if (this.grupos().length) {
        this.grupoId.set(this.grupos()[0].id);
        await this.cargar();
      }
    } catch {
      this.error.set('No fue posible cargar los grupos de formación.');
    }
  }

  cambiarGrupo(value: number) {
    this.grupoId.set(Number(value));
    void this.cargar();
  }

  cambiarOrden(value: string) {
    this.orden.set(value);
    void this.cargar();
  }

  aplicarPeriodo(periodo: Periodo, recargar = true) {
    this.periodo.set(periodo);
    if (periodo !== 'personalizado') {
      const hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth(), ultimo = new Date(y, m + 1, 0).getDate();
      this.desde = this.fechaLocal(new Date(y, m, periodo === 'segunda' ? 16 : 1));
      this.hasta = this.fechaLocal(new Date(y, m, periodo === 'primera' ? 15 : ultimo));
    }
    if (recargar) void this.cargar();
  }

  fechasPersonalizadas() {
    this.periodo.set('personalizado');
    if (this.desde && this.hasta && this.desde <= this.hasta) void this.cargar();
  }

  toggleSoloConFaltas() {
    this.soloConFaltas.update(v => !v);
    if (this.soloConFaltas()) this.soloEnRiesgo.set(false);
  }

  toggleSoloEnRiesgo() {
    this.soloEnRiesgo.update(v => !v);
    if (this.soloEnRiesgo()) this.soloConFaltas.set(false);
  }

  limpiarFiltros() {
    this.soloConFaltas.set(false);
    this.soloEnRiesgo.set(false);
    this.busqueda.set('');
  }

  async cargar() {
    const grupoId = this.grupoId();
    if (!grupoId || !this.desde || !this.hasta) return;
    if (this.desde > this.hasta) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    const params = new HttpParams()
      .set('grupoId', grupoId)
      .set('desde', this.desde)
      .set('hasta', this.hasta)
      .set('orden', this.orden());
    try {
      const r = await firstValueFrom(this.http.get<Respuesta>(`${environment.apiUrl}/tracking`, { params }));
      this.filas.set(r.integrantes);
      this.resumen.set(r.resumen);
      this.jornadasEsperadas.set(r.jornadasEsperadas);
    } catch {
      this.filas.set([]);
      this.resumen.set(null);
      this.error.set('No fue posible cargar el seguimiento para este periodo.');
    } finally {
      this.cargando.set(false);
    }
  }

  async abrirDetalle(personaId: number) {
    const grupoId = this.grupoId();
    if (!grupoId) return;
    this.detalle.set(null);
    this.cargandoDetalle.set(true);
    const params = new HttpParams()
      .set('grupoId', grupoId)
      .set('personaId', personaId)
      .set('desde', this.desde)
      .set('hasta', this.hasta);
    try {
      this.detalle.set(await firstValueFrom(this.http.get<Detalle>(`${environment.apiUrl}/tracking/detail`, { params })));
    } catch {
      this.error.set('No fue posible cargar el detalle del integrante.');
    } finally {
      this.cargandoDetalle.set(false);
    }
  }

  cerrarDetalle() {
    this.detalle.set(null);
    this.cargandoDetalle.set(false);
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape() {
    if (this.detalle() || this.cargandoDetalle()) this.cerrarDetalle();
  }

  etiquetaEstado(e: string) {
    return e.toLowerCase().replaceAll('_', ' ');
  }

  claseEstado(e: string) {
    if (['PRESENTE', 'FINALIZADO'].includes(e)) return 'status--ok';
    if (e === 'FALTA_JUSTIFICADA') return 'status--info';
    if (['FALTA_INJUSTIFICADA', 'SIN_REGISTRO'].includes(e)) return 'status--danger';
    return 'status--warning';
  }

  private fechaLocal(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
