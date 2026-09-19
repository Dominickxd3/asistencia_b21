import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarModule } from 'primeng/calendar';
import { firstValueFrom } from 'rxjs';
import { TuiIcon } from '@taiga-ui/core';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

export type FiltroDinamico = 'todos' | 'bueno' | 'con_faltas' | 'en_riesgo';

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
  imports: [FormsModule, CalendarModule, PageHeaderComponent, TuiIcon, SlicePipe],
  templateUrl: './tracking.page.html',
  styleUrl: './tracking.page.css',
})
export class TrackingPageComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly grupos = signal<Grupo[]>([]);
  readonly grupoId = signal<number | null>(null);
  readonly filas = signal<Fila[]>([]);
  readonly resumen = signal<Resumen | null>(null);
  readonly jornadasEsperadas = signal(0);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly detalle = signal<Detalle | null>(null);
  readonly cargandoDetalle = signal(false);

  // 3 Opciones dinámicas (Predeterminado: 'todos')
  readonly filtroActivo = signal<FiltroDinamico>('todos');
  readonly busqueda = signal('');

  // Rango de fechas con Calendario idéntico al inicio
  rangeDates: Date[] = [];
  private inicioSeleccionIso: string | null = null;
  desde = '';
  hasta = '';

  // 1. ¿Cómo va el cumplimiento obligatorio del grupo?
  readonly asistenciaGrupo = computed(() => this.resumen()?.asistenciaGrupo ?? 0);
  readonly metaAsistencia = 80.0;
  readonly brechaMeta = computed(() => {
    return Math.round((this.asistenciaGrupo() - this.metaAsistencia) * 10) / 10;
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

  // 4. ¿Cómo viene la distribución de asistencia?
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

  // 6. ¿Quién requiere que revise su detalle?
  readonly casosPrioritarios = computed(() => {
    return this.filas()
      .filter(f => f.faltasInjustificadas > 0 || f.porcentajeAsistencia < 80)
      .sort((a, b) => b.faltasInjustificadas - a.faltasInjustificadas || a.porcentajeAsistencia - b.porcentajeAsistencia);
  });

  // Integrantes con rendimiento Bueno (≥ 80%)
  readonly integrantesBueno = computed(() => {
    return this.filas().filter(f => f.porcentajeAsistencia >= 80);
  });

  // Lista filtrada para la grilla
  readonly filasFiltradas = computed(() => {
    let list = this.filas();
    const f = this.filtroActivo();

    if (f === 'bueno') {
      list = list.filter(item => item.porcentajeAsistencia >= 80);
    } else if (f === 'con_faltas') {
      list = list.filter(item => item.faltasInjustificadas > 0);
    } else if (f === 'en_riesgo') {
      list = list.filter(item => item.porcentajeAsistencia < 80);
    }

    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      list = list.filter(item =>
        item.nombreCompleto.toLowerCase().includes(q) ||
        (item.dni && item.dni.includes(q))
      );
    }

    return list;
  });

  async ngOnInit(): Promise<void> {
    // Inicializar fechas con el mes actual
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    this.rangeDates = [primerDia, ultimoDia];
    this.desde = this.toIsoDate(primerDia);
    this.hasta = this.toIsoDate(ultimoDia);

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

  alSeleccionarFecha(fecha: Date): void {
    const seleccionIso = this.toIsoDate(fecha);

    if (this.inicioSeleccionIso === seleccionIso && !this.rangeDates?.[1]) {
      this.rangeDates = [];
      this.inicioSeleccionIso = null;
      return;
    }

    if (!this.inicioSeleccionIso || !this.rangeDates?.[0]) {
      this.rangeDates = [fecha];
      this.inicioSeleccionIso = seleccionIso;
      this.desde = seleccionIso;
      this.hasta = seleccionIso;
      void this.cargar();
      return;
    }

    if (this.inicioSeleccionIso !== seleccionIso) {
      const inicio = new Date(`${this.inicioSeleccionIso}T00:00:00`);
      const d1 = inicio <= fecha ? inicio : fecha;
      const d2 = inicio <= fecha ? fecha : inicio;
      this.rangeDates = [d1, d2];
      this.desde = this.toIsoDate(d1);
      this.hasta = this.toIsoDate(d2);
      this.inicioSeleccionIso = null;
      void this.cargar();
    }
  }

  alCerrarCalendario(): void {
    if (this.rangeDates && this.rangeDates[0]) {
      const d1 = this.rangeDates[0];
      const d2 = this.rangeDates[1] || d1;
      this.desde = this.toIsoDate(d1);
      this.hasta = this.toIsoDate(d2);
      void this.cargar();
    }
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
    // Orden por defecto: nombre alfabético para visualización limpia
    const orden = this.filtroActivo() === 'con_faltas' ? 'faltas_injustificadas' : 'nombre';
    const params = new HttpParams()
      .set('grupoId', grupoId)
      .set('desde', this.desde)
      .set('hasta', this.hasta)
      .set('orden', orden);
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

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
