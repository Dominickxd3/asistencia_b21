import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TuiIcon } from '@taiga-ui/core';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type Periodo = 'mes' | 'primera' | 'segunda' | 'personalizado';
export type FiltroEstado = 'todos' | 'en_regla' | 'en_riesgo' | 'con_faltas' | 'con_adicionales' | 'asistencias' | 'faltas_justificadas' | 'salidas_anticipadas';

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

export interface DonutSlice {
  id: FiltroEstado;
  label: string;
  count: number;
  porcentaje: number;
  color: string;
  bgLight: string;
  dashArray: string;
  dashOffset: number;
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

  // Estados interactivos
  readonly busqueda = signal('');
  readonly filtroEstado = signal<FiltroEstado>('todos');
  readonly hoveredSegment = signal<string | null>(null);

  desde = '';
  hasta = '';

  // Computados
  readonly grupoActual = computed(() => this.grupos().find(g => g.id === this.grupoId()) ?? null);

  readonly totalIntegrantes = computed(() => this.filas().length);

  readonly totalAsistencias = computed(() => this.filas().reduce((sum, f) => sum + f.asistencias, 0));

  readonly totalJornadasAplicables = computed(() => this.filas().reduce((sum, f) => sum + f.jornadasAplicables, 0));

  readonly integrantesEnRegla = computed(() => this.filas().filter(f => f.porcentajeAsistencia >= 80));

  readonly integrantesEnRiesgo = computed(() => this.filas().filter(f => f.porcentajeAsistencia < 80));

  readonly integrantesConFaltas = computed(() => this.filas().filter(f => f.faltasInjustificadas > 0));

  readonly integrantesConAdicionales = computed(() => this.filas().filter(f => f.horasAdicionales > 0));

  readonly pctEnRegla = computed(() => {
    const total = this.totalIntegrantes();
    return total ? Math.round((this.integrantesEnRegla().length / total) * 100) : 0;
  });

  readonly pctEnRiesgo = computed(() => {
    const total = this.totalIntegrantes();
    return total ? Math.round((this.integrantesEnRiesgo().length / total) * 100) : 0;
  });

  readonly promedioHorasAdicionales = computed(() => {
    const total = this.totalIntegrantes();
    const horas = this.resumen()?.horasAdicionales ?? 0;
    return total ? (Math.round((horas / total) * 10) / 10).toFixed(1) : '0.0';
  });

  readonly gaugeStatus = computed(() => {
    const pct = this.resumen()?.asistenciaGrupo ?? 0;
    if (pct >= 80) return { label: 'Meta Cumplida', badgeClass: 'badge--ok', desc: 'Por encima del umbral institucional (80%)', color: '#14804A' };
    if (pct >= 60) return { label: 'En Observación', badgeClass: 'badge--warning', desc: 'Requiere seguimiento preventivo', color: '#B76E00' };
    return { label: 'Nivel Crítico', badgeClass: 'badge--danger', desc: 'Debajo del 60% de asistencia global', color: '#C8102E' };
  });

  readonly donutSlices = computed<DonutSlice[]>(() => {
    const r = this.resumen();
    if (!r) return [];

    const asist = this.totalAsistencias();
    const fi = r.faltasInjustificadas;
    const fj = r.faltasJustificadas;
    const sa = r.salidasAnticipadas;
    const totalEventos = asist + fi + fj + sa;

    const raw = [
      { id: 'asistencias' as FiltroEstado, label: 'Asistencias', count: asist, color: '#14804A', bgLight: '#E7F6ED' },
      { id: 'con_faltas' as FiltroEstado, label: 'Faltas Injustificadas', count: fi, color: '#C8102E', bgLight: '#FBECEE' },
      { id: 'faltas_justificadas' as FiltroEstado, label: 'Faltas Justificadas', count: fj, color: '#B76E00', bgLight: '#FEF6E7' },
      { id: 'salidas_anticipadas' as FiltroEstado, label: 'Salidas Anticipadas', count: sa, color: '#7A5AF8', bgLight: '#F4EBFF' },
    ];

    let currentOffset = 25; // 12 o'clock in standard SVG ring
    return raw.map(item => {
      const pct = totalEventos > 0 ? (item.count / totalEventos) * 100 : 0;
      const roundedPct = Math.round(pct * 10) / 10;
      const dash = `${pct} ${Math.max(0, 100 - pct)}`;
      const sliceOffset = currentOffset;
      currentOffset -= pct;
      return {
        id: item.id,
        label: item.label,
        count: item.count,
        porcentaje: roundedPct,
        color: item.color,
        bgLight: item.bgLight,
        dashArray: dash,
        dashOffset: sliceOffset,
      };
    });
  });

  readonly filasFiltradas = computed(() => {
    let list = this.filas();
    const filtro = this.filtroEstado();

    if (filtro === 'en_regla') {
      list = list.filter(f => f.porcentajeAsistencia >= 80);
    } else if (filtro === 'en_riesgo') {
      list = list.filter(f => f.porcentajeAsistencia < 80);
    } else if (filtro === 'con_faltas') {
      list = list.filter(f => f.faltasInjustificadas > 0);
    } else if (filtro === 'con_adicionales') {
      list = list.filter(f => f.horasAdicionales > 0);
    } else if (filtro === 'asistencias') {
      list = list.filter(f => f.asistencias > 0);
    } else if (filtro === 'faltas_justificadas') {
      list = list.filter(f => f.faltasJustificadas > 0);
    } else if (filtro === 'salidas_anticipadas') {
      list = list.filter(f => f.salidasAnticipadas > 0);
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

  setFiltro(tipo: FiltroEstado) {
    if (this.filtroEstado() === tipo) {
      this.filtroEstado.set('todos');
    } else {
      this.filtroEstado.set(tipo);
    }
  }

  setHoveredSegment(id: string | null) {
    this.hoveredSegment.set(id);
  }

  limpiarFiltros() {
    this.filtroEstado.set('todos');
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

  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'NA';
    const parts = nombre.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  obtenerColorAvatar(nombre: string): { bg: string; color: string } {
    const palette = [
      { bg: '#FEE4E2', color: '#B42318' },
      { bg: '#FEF0C7', color: '#B54708' },
      { bg: '#D1FADF', color: '#027A48' },
      { bg: '#D1E9FF', color: '#175CD3' },
      { bg: '#E0EAFF', color: '#3538CD' },
      { bg: '#F4EBFF', color: '#6941C6' },
      { bg: '#ECEFF3', color: '#344054' },
    ];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = (hash << 5) - hash + nombre.charCodeAt(i);
    }
    const idx = Math.abs(hash) % palette.length;
    return palette[idx];
  }

  obtenerClaseAsistencia(pct: number): string {
    if (pct >= 80) return 'progress-fill--high';
    if (pct >= 60) return 'progress-fill--mid';
    return 'progress-fill--low';
  }

  private fechaLocal(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
