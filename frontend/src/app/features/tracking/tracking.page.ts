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
export type VistaRanking = 'asistencia' | 'faltas' | 'horas';
export type ModoRanking = 'integrantes' | 'grupos';
export type ColumnaOrden = 'nombre' | 'asistencia' | 'fJustificadas' | 'fInjustificadas' | 'salidas' | 'horas';

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

export interface ItemRanking {
  posicion: number;
  id?: number;
  titulo: string;
  subtitulo: string;
  valorTexto: string;
  porcentajeBarra: number;
  claseColor: 'color-ok' | 'color-danger' | 'color-blue';
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

  // 1. Estados de Filtros Principales (Nivel 1)
  readonly grupos = signal<Grupo[]>([]);
  readonly grupoId = signal<number | null>(null);
  readonly filtroActivo = signal<FiltroDinamico>('todos');
  readonly busqueda = signal('');

  // Rango de fechas con Calendario idéntico al de inicio
  rangeDates: Date[] = [];
  private inicioSeleccionIso: string | null = null;
  desde = '';
  hasta = '';

  // 2. Estados del Bloque de Rankings (Nivel 2)
  readonly vistaActiva = signal<VistaRanking>('asistencia');
  readonly modoActivo = signal<ModoRanking>('integrantes');
  readonly resumenesGrupos = signal<Array<{ grupo: Grupo; resumen: Resumen }>>([]);
  readonly cargandoGrupos = signal(false);

  // 3. Datos de Integrantes y Estado General
  readonly filas = signal<Fila[]>([]);
  readonly resumen = signal<Resumen | null>(null);
  readonly jornadasEsperadas = signal(0);
  readonly cargando = signal(false);
  readonly error = signal('');

  // Ordenamiento interactivo de la grilla (Nivel 3)
  readonly columnaOrden = signal<ColumnaOrden>('nombre');
  readonly ordenAsc = signal(true);

  // Detalle lateral (Drawer)
  readonly detalle = signal<Detalle | null>(null);
  readonly cargandoDetalle = signal(false);

  // Conteo de integrantes por categoría para el combo box
  readonly integrantesBueno = computed(() => this.filas().filter(f => f.porcentajeAsistencia >= 80));
  readonly integrantesConFaltas = computed(() => this.filas().filter(f => f.faltasInjustificadas > 0));
  readonly integrantesEnRiesgo = computed(() => this.filas().filter(f => f.porcentajeAsistencia < 80));

  // ------------------------------------------------------------
  // COMPUTADOS DE RANKINGS (TOP 5 POR INTEGRANTES)
  // ------------------------------------------------------------
  readonly top5Asistencia = computed<ItemRanking[]>(() => {
    const sorted = [...this.filas()]
      .sort((a, b) => b.porcentajeAsistencia - a.porcentajeAsistencia || b.asistencias - a.asistencias || a.nombreCompleto.localeCompare(b.nombreCompleto))
      .slice(0, 5);

    return sorted.map((f, i) => ({
      posicion: i + 1,
      id: f.personaId,
      titulo: f.nombreCompleto,
      subtitulo: `DNI ${f.dni || 'S/D'} · ${f.asistencias} de ${f.jornadasAplicables} asistencias`,
      valorTexto: `${f.porcentajeAsistencia}%`,
      porcentajeBarra: Math.min(100, Math.max(0, f.porcentajeAsistencia)),
      claseColor: 'color-ok',
    }));
  });

  readonly top5Faltas = computed<ItemRanking[]>(() => {
    const list = this.filas().filter(f => f.faltasInjustificadas > 0);
    const sorted = [...list]
      .sort((a, b) => b.faltasInjustificadas - a.faltasInjustificadas || a.porcentajeAsistencia - b.porcentajeAsistencia)
      .slice(0, 5);

    const maxVal = sorted.length ? Math.max(...sorted.map(s => s.faltasInjustificadas)) : 1;

    return sorted.map((f, i) => ({
      posicion: i + 1,
      id: f.personaId,
      titulo: f.nombreCompleto,
      subtitulo: `DNI ${f.dni || 'S/D'} · Asistencia: ${f.porcentajeAsistencia}%`,
      valorTexto: `${f.faltasInjustificadas} ${f.faltasInjustificadas === 1 ? 'falta' : 'faltas'}`,
      porcentajeBarra: Math.min(100, Math.round((f.faltasInjustificadas / maxVal) * 100)),
      claseColor: 'color-danger',
    }));
  });

  readonly top5Horas = computed<ItemRanking[]>(() => {
    const list = this.filas().filter(f => f.horasAdicionales > 0);
    const sorted = [...list]
      .sort((a, b) => b.horasAdicionales - a.horasAdicionales || a.nombreCompleto.localeCompare(b.nombreCompleto))
      .slice(0, 5);

    const maxVal = sorted.length ? Math.max(...sorted.map(s => s.horasAdicionales)) : 1;

    return sorted.map((f, i) => ({
      posicion: i + 1,
      id: f.personaId,
      titulo: f.nombreCompleto,
      subtitulo: `DNI ${f.dni || 'S/D'} · Asistencia obligatoria: ${f.porcentajeAsistencia}%`,
      valorTexto: `${f.horasAdicionales} h`,
      porcentajeBarra: Math.min(100, Math.round((f.horasAdicionales / maxVal) * 100)),
      claseColor: 'color-blue',
    }));
  });

  // ------------------------------------------------------------
  // COMPUTADOS DE RANKINGS (POR GRUPOS)
  // ------------------------------------------------------------
  readonly rankingGrupos = computed<ItemRanking[]>(() => {
    const vista = this.vistaActiva();
    const list = this.resumenesGrupos();
    if (!list.length) return [];

    if (vista === 'asistencia') {
      // REGLA INSTITUCIONAL OBLIGATORIA:
      // No incluir ESBAS en comparación de cumplimiento obligatorio porque su asistencia es voluntaria.
      const aplicables = list.filter(g => {
        const etapa = (g.grupo.etapa || '').toUpperCase();
        const nombre = (g.grupo.nombre || '').toUpperCase();
        return !etapa.includes('ESBAS') && !nombre.includes('ESBAS') && !etapa.includes('BÁSICA');
      });

      const sorted = [...aplicables].sort((a, b) => b.resumen.asistenciaGrupo - a.resumen.asistenciaGrupo);
      return sorted.map((g, i) => ({
        posicion: i + 1,
        id: g.grupo.id,
        titulo: g.grupo.nombre,
        subtitulo: `Etapa: ${g.grupo.etapa} · ${g.resumen.jornadasObligatorias} jornadas obligatorias`,
        valorTexto: `${g.resumen.asistenciaGrupo}%`,
        porcentajeBarra: Math.min(100, Math.max(0, g.resumen.asistenciaGrupo)),
        claseColor: 'color-ok',
      }));
    }

    if (vista === 'faltas') {
      // Faltas injustificadas acumuladas por grupo
      const sorted = [...list].sort((a, b) => b.resumen.faltasInjustificadas - a.resumen.faltasInjustificadas);
      const maxVal = sorted.length ? Math.max(...sorted.map(s => s.resumen.faltasInjustificadas), 1) : 1;

      return sorted.map((g, i) => ({
        posicion: i + 1,
        id: g.grupo.id,
        titulo: g.grupo.nombre,
        subtitulo: `Etapa: ${g.grupo.etapa}`,
        valorTexto: `${g.resumen.faltasInjustificadas} faltas`,
        porcentajeBarra: Math.min(100, Math.round((g.resumen.faltasInjustificadas / maxVal) * 100)),
        claseColor: 'color-danger',
      }));
    }

    // Horas voluntarias acumuladas por grupo (aplica para todos los grupos)
    const sorted = [...list].sort((a, b) => b.resumen.horasAdicionales - a.resumen.horasAdicionales);
    const maxVal = sorted.length ? Math.max(...sorted.map(s => s.resumen.horasAdicionales), 1) : 1;

    return sorted.map((g, i) => ({
      posicion: i + 1,
      id: g.grupo.id,
      titulo: g.grupo.nombre,
      subtitulo: `Etapa: ${g.grupo.etapa}`,
      valorTexto: `${g.resumen.horasAdicionales} h`,
      porcentajeBarra: Math.min(100, Math.round((g.resumen.horasAdicionales / maxVal) * 100)),
      claseColor: 'color-blue',
    }));
  });

  // Ranking activo a mostrar en pantalla
  readonly itemsRankingActivo = computed<ItemRanking[]>(() => {
    if (this.modoActivo() === 'grupos') {
      return this.rankingGrupos();
    }
    const vista = this.vistaActiva();
    if (vista === 'asistencia') return this.top5Asistencia();
    if (vista === 'faltas') return this.top5Faltas();
    return this.top5Horas();
  });

  // Título del bloque de ranking
  readonly tituloRanking = computed<string>(() => {
    const modo = this.modoActivo();
    const vista = this.vistaActiva();

    if (modo === 'grupos') {
      if (vista === 'asistencia') return 'Comparación de Cumplimiento por Grupos';
      if (vista === 'faltas') return 'Faltas Injustificadas por Grupos';
      return 'Mayor Acumulación de Horas Voluntarias por Grupos';
    }

    if (vista === 'asistencia') return 'Top 5 mayor cumplimiento';
    if (vista === 'faltas') return 'Top 5 con más faltas injustificadas';
    return 'Top 5 mayor participación voluntaria';
  });

  // ------------------------------------------------------------
  // GRILLA DETALLADA INFERIOR (FILTRADA Y ORDENADA)
  // ------------------------------------------------------------
  readonly filasFiltradas = computed<Fila[]>(() => {
    let list = this.filas();
    const f = this.filtroActivo();

    // Filtro por categoría
    if (f === 'bueno') {
      list = list.filter(item => item.porcentajeAsistencia >= 80);
    } else if (f === 'con_faltas') {
      list = list.filter(item => item.faltasInjustificadas > 0);
    } else if (f === 'en_riesgo') {
      list = list.filter(item => item.porcentajeAsistencia < 80);
    }

    // Buscador
    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      list = list.filter(item =>
        item.nombreCompleto.toLowerCase().includes(q) ||
        (item.dni && item.dni.includes(q))
      );
    }

    // Ordenamiento interactivo por columna
    const col = this.columnaOrden();
    const asc = this.ordenAsc();

    return [...list].sort((a, b) => {
      let diff = 0;
      switch (col) {
        case 'nombre':
          diff = a.nombreCompleto.localeCompare(b.nombreCompleto);
          break;
        case 'asistencia':
          diff = a.porcentajeAsistencia - b.porcentajeAsistencia;
          break;
        case 'fJustificadas':
          diff = a.faltasJustificadas - b.faltasJustificadas;
          break;
        case 'fInjustificadas':
          diff = a.faltasInjustificadas - b.faltasInjustificadas;
          break;
        case 'salidas':
          diff = a.salidasAnticipadas - b.salidasAnticipadas;
          break;
        case 'horas':
          diff = a.horasAdicionales - b.horasAdicionales;
          break;
      }
      return asc ? diff : -diff;
    });
  });

  async ngOnInit(): Promise<void> {
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
        void this.cargarComparativaGrupos();
      }
    } catch {
      this.error.set('No fue posible cargar los grupos de formación.');
    }
  }

  cambiarGrupo(value: number) {
    this.grupoId.set(Number(value));
    void this.cargar();
  }

  setVista(vista: VistaRanking) {
    this.vistaActiva.set(vista);
  }

  setModo(modo: ModoRanking) {
    this.modoActivo.set(modo);
    if (modo === 'grupos' && !this.resumenesGrupos().length) {
      void this.cargarComparativaGrupos();
    }
  }

  ordenar(columna: ColumnaOrden) {
    if (this.columnaOrden() === columna) {
      this.ordenAsc.update(v => !v);
    } else {
      this.columnaOrden.set(columna);
      this.ordenAsc.set(columna === 'nombre');
    }
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
      void this.cargarComparativaGrupos();
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
      void this.cargarComparativaGrupos();
    }
  }

  alCerrarCalendario(): void {
    if (this.rangeDates && this.rangeDates[0]) {
      const d1 = this.rangeDates[0];
      const d2 = this.rangeDates[1] || d1;
      this.desde = this.toIsoDate(d1);
      this.hasta = this.toIsoDate(d2);
      void this.cargar();
      void this.cargarComparativaGrupos();
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
    const params = new HttpParams()
      .set('grupoId', grupoId)
      .set('desde', this.desde)
      .set('hasta', this.hasta)
      .set('orden', 'nombre');
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

  async cargarComparativaGrupos() {
    if (!this.desde || !this.hasta || !this.grupos().length) return;
    this.cargandoGrupos.set(true);
    try {
      const requests = this.grupos().map(g =>
        firstValueFrom(this.http.get<Respuesta>(`${environment.apiUrl}/tracking`, {
          params: new HttpParams().set('grupoId', g.id).set('desde', this.desde).set('hasta', this.hasta).set('orden', 'nombre')
        }))
      );
      const results = await Promise.all(requests);
      this.resumenesGrupos.set(results.map(r => ({ grupo: r.grupo, resumen: r.resumen })));
    } catch {
      this.resumenesGrupos.set([]);
    } finally {
      this.cargandoGrupos.set(false);
    }
  }

  async abrirDetalle(personaId?: number) {
    if (!personaId) return;
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
