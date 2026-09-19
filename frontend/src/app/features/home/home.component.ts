import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CalendarModule } from 'primeng/calendar';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { environment } from '../../../environments/environment';
import { DashboardHoy } from '../../core/models/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { DailySummaryComponent } from './daily-summary.component';
import { AttentionPanelComponent } from './attention-panel.component';
import { RecentActivityComponent } from './recent-activity.component';
import { TodaySessionsComponent } from './today-sessions.component';

@Component({
  selector: 'app-home',
  imports: [
    TuiButton,
    TuiIcon,
    TuiSkeleton,
    FormsModule,
    CalendarModule,
    DailySummaryComponent,
    TodaySessionsComponent,
    AttentionPanelComponent,
    RecentActivityComponent,
  ],
  template: `
    <header class="home-header">
      <div class="home-header-copy">
        <span class="home-eyebrow">Panel operativo</span>
        <h1>Hola, {{ nombreUsuario() }}</h1>
        <p>{{ textoPeriodo() }}</p>
      </div>
      <div class="calendar-wrapper">
        <p-calendar 
          [(ngModel)]="rangeDates" 
          selectionMode="range" 
          [readonlyInput]="true"
          [maxDate]="hoyMaximo"
          dateFormat="dd/mm/yy"
          [showIcon]="true"
          iconDisplay="input"
          icon="pi pi-calendar"
          placeholder="Seleccionar fecha o rango"
          (onSelect)="alSeleccionarFecha($event)"
          (onClose)="alCerrarCalendario()" />
      </div>
    </header>

    <!-- ESTADO 1: CARGANDO (SKELETONS DE ALTA FIDELIDAD) -->
    @if (cargando()) {
      <div class="home-page-container">
        <!-- Skeleton Resumen Diario -->
        <div class="skeleton-summary-box">
          <div tuiSkeleton class="skeleton-block summary"></div>
        </div>

        <!-- Skeleton Grid 2 Columnas -->
        <div class="home-columns-grid">
          <div class="column-left">
            <div tuiSkeleton class="skeleton-block heading"></div>
            <div tuiSkeleton class="skeleton-block panel"></div>
          </div>
          <div class="column-right">
            <div tuiSkeleton class="skeleton-block attention"></div>
            <div tuiSkeleton class="skeleton-block activity"></div>
          </div>
        </div>

        <!-- Skeleton Deck Inferior -->
      </div>
    }

    <!-- ESTADO 2: ERROR DE CARGA CON BOTÓN REINTENTAR -->
    @else if (errorCarga()) {
      <div class="r21-card error-card-box">
        <div class="error-circle-icon">
          <tui-icon icon="@tui.circle-alert" />
        </div>
        <div class="error-text-content">
          <h3 class="error-heading">No se pudo cargar la información operativa</h3>
          <p class="error-paragraph">Ocurrió un inconveniente al conectar con el servidor. Verifica tu conexión e intenta nuevamente.</p>
        </div>
        <button tuiButton size="s" appearance="outline" iconStart="@tui.refresh-cw" (click)="cargar()">
          Reintentar
        </button>
      </div>
    }

    <!-- ESTADO 3: PANTALLA OPERATIVA PRINCIPAL -->
    @else if (datos(); as d) {
      <div class="home-page-container">
        <!-- BLOQUE ESTADO DE HOY (DailySummary) -->
        <app-daily-summary
          [resumen]="d.resumen"
          [modoMes]="esModoRango()"
        />

        <!-- GRILLA OPERATIVA (Izquierda 62%, Derecha 38%) -->
        <div class="home-columns-grid">
          <!-- COLUMNA IZQUIERDA: Jornadas de hoy -->
          <div class="column-left">
            <app-today-sessions [jornadas]="d.jornadas" [modoMes]="esModoRango()" />
          </div>

          <!-- COLUMNA DERECHA: Requieren atención y Actividad reciente -->
          <div class="column-right">
            <!-- Requieren atención -->
            <app-attention-panel [items]="d.requierenAtencion" />

            <!-- Actividad reciente -->
            <app-recent-activity [actividad]="d.actividad" />
          </div>
        </div>

        <!-- SECCIÓN INFERIOR: Métricas y Estado por Grupos de Formación -->
      </div>
    }
  `,
  styles: [`
    .home-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      width: 100%;
      padding: 2px 0 4px;
    }

    .home-header-copy { min-width: 0; }

    .home-eyebrow {
      display: block;
      margin-bottom: 6px;
      color: var(--r21-red);
      font-size: 10.5px;
      font-weight: 750;
      letter-spacing: .09em;
      text-transform: uppercase;
    }

    .home-header h1 {
      margin: 0;
      color: var(--r21-text-primary);
      font-size: clamp(24px, 2vw, 30px);
      font-weight: 720;
      letter-spacing: -.025em;
      line-height: 1.1;
    }

    .home-header p {
      margin: 6px 0 0;
      color: var(--r21-text-secondary);
      font-size: 12.5px;
    }

    .calendar-wrapper {
      display: flex;
      align-items: center;
    }

    @media (max-width: 620px) {
      .home-header { align-items: flex-start; flex-direction: column; gap: 14px; }
      .calendar-wrapper { width: 100%; }
      .calendar-wrapper :deep(.p-calendar) { width: 100%; }
      .calendar-wrapper :deep(.p-inputtext) { width: 100%; }
    }

    .home-page-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 100%;
    }

    .home-columns-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
      align-items: start;
    }

    .column-left {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }

    .column-right {
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-width: 0;
    }

    @media (min-width: 992px) {
      .home-columns-grid {
        grid-template-columns: 62% 38%;
      }
    }

    .skeleton-summary-box {
      width: 100%;
    }

    .skeleton-block { width: 100%; border-radius: var(--r21-radius-md); }
    .skeleton-block.summary { height: 80px; }
    .skeleton-block.heading { height: 48px; margin-bottom: 12px; }
    .skeleton-block.panel { height: 280px; }
    .skeleton-block.attention { height: 150px; margin-bottom: 12px; }
    .skeleton-block.activity { height: 240px; }

    .error-card-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 20px;
      gap: 14px;

      .error-circle-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background-color: var(--r21-red-light);
        display: flex;
        align-items: center;
        justify-content: center;

        i {
          font-size: 22px;
          color: var(--r21-red);
        }
      }

      .error-heading {
        font-size: 15px;
        font-weight: 700;
        color: var(--r21-text-primary);
        margin: 0;
      }

      .error-paragraph {
        font-size: 13px;
        color: var(--r21-text-secondary);
        margin: 4px 0 0;
        max-width: 440px;
      }
    }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly hoyMaximo = new Date();
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  protected readonly realtime = inject(RealtimeService);

  readonly datos = signal<DashboardHoy | null>(null);
  readonly cargando = signal(true);
  readonly errorCarga = signal(false);

  rangeDates: (Date | null)[] = [new Date()];
  private inicioSeleccionIso: string | null = this.toIsoDate(new Date());
  private refrescoPendiente: ReturnType<typeof setTimeout> | null = null;

  readonly hoyIso = new Date().toLocaleDateString('sv-SE');

  readonly nombreUsuario = computed(() =>
    this.auth.perfil()?.persona.nombres?.split(' ')[0] || 'Carlos',
  );

  readonly esModoRango = computed(() => {
    const d = this.datos();
    return d?.periodo === 'rango' || d?.periodo === 'mes';
  });

  readonly textoPeriodo = computed(() => {
    const d = this.datos();
    if (!d) return 'Cargando información operativa...';
    if ((d.periodo === 'rango' || d.periodo === 'mes') && d.fechaFin && d.fecha !== d.fechaFin) {
      return `Consolidado del periodo ${this.formatearFechaCorta(d.fecha)} al ${this.formatearFechaCorta(d.fechaFin)}.`;
    }
    if (d.fecha === this.hoyIso) {
      return 'Revisa el estado de la formación del día.';
    }
    return `Estado de la formación para el ${this.formatearFechaLarga(d.fecha)}.`;
  });

  private wsUnbinds: Array<() => void> = [];

  ngOnInit(): void {
    this.cargar();
    this.realtime.conectar();
    this.wsUnbinds.push(
      this.realtime.on('dashboard.actualizar', () => this.programarRefresco()),
      this.realtime.on('asistencia.registrada', () => this.programarRefresco()),
      this.realtime.on('jornada.abierta', () => this.programarRefresco()),
      this.realtime.on('jornada.cerrada', () => this.programarRefresco()),
    );
  }

  ngOnDestroy(): void {
    this.wsUnbinds.forEach((u) => u());
    this.wsUnbinds = [];
    if (this.refrescoPendiente) clearTimeout(this.refrescoPendiente);
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
      void this.cargar();
      return;
    }

    if (this.inicioSeleccionIso !== seleccionIso) {
      const inicio = new Date(`${this.inicioSeleccionIso}T00:00:00`);
      this.rangeDates = inicio <= fecha ? [inicio, fecha] : [fecha, inicio];
      this.inicioSeleccionIso = null;
      void this.cargar();
    }
  }

  alCerrarCalendario(): void {
    // Si cerró habiendo elegido sólo un día o ambos días iguales, normalizamos
    if (this.rangeDates && this.rangeDates[0]) {
      if (this.rangeDates[1] && this.toIsoDate(this.rangeDates[0]) === this.toIsoDate(this.rangeDates[1])) {
        this.rangeDates = [this.rangeDates[0]];
      }
    }
    if (this.rangeDates?.[0]) void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(false);
    try {
      const params: Record<string, string> = {};

      if (this.rangeDates && this.rangeDates.length > 0 && this.rangeDates[0]) {
        const d0 = this.toIsoDate(this.rangeDates[0]);
        const d1 = this.rangeDates[1] ? this.toIsoDate(this.rangeDates[1]) : null;

        if (d1 && d0 !== d1) {
          const dMin = d0 < d1 ? d0 : d1;
          const dMax = d0 < d1 ? d1 : d0;
          params['desde'] = dMin;
          params['hasta'] = dMax;
        } else {
          params['fecha'] = d0;
        }
      } else {
        params['fecha'] = this.hoyIso;
      }

      const data = await this.http
        .get<DashboardHoy>(`${environment.apiUrl}/dashboard/today`, { params })
        .toPromise();
      this.datos.set(data ?? null);
    } catch {
      this.datos.set(null);
      this.errorCarga.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  private programarRefresco(): void {
    if (this.refrescoPendiente) return;
    this.refrescoPendiente = setTimeout(() => {
      this.refrescoPendiente = null;
      this.cargar();
    }, 400);
  }

  private toIsoDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatearFechaCorta(fechaIso: string): string {
    const [year, month, day] = fechaIso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(date);
  }

  private formatearFechaLarga(fechaIso: string): string {
    const [year, month, day] = fechaIso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    }).format(date);
  }
}
