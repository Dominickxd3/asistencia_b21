import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { environment } from '../../../environments/environment';
import { DashboardHoy, JornadaHoy } from '../../core/models/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { DateSelectorComponent } from './date-selector.component';
import { DailySummaryComponent } from './daily-summary.component';
import { GroupSelectorComponent } from './group-selector.component';
import { SessionPanelComponent } from './session-panel.component';
import { AttentionPanelComponent } from './attention-panel.component';
import { RecentActivityComponent } from './recent-activity.component';
import { GroupMetricsDeckComponent } from './group-metrics-deck.component';

@Component({
  selector: 'app-home',
  imports: [
    SkeletonModule,
    ButtonModule,
    PageHeaderComponent,
    DateSelectorComponent,
    DailySummaryComponent,
    GroupSelectorComponent,
    SessionPanelComponent,
    AttentionPanelComponent,
    RecentActivityComponent,
    GroupMetricsDeckComponent,
  ],
  template: `
    <!-- CABECERA INSTITUCIONAL CON SELECTOR DE FECHA -->
    <app-page-header
      titulo="Inicio"
      [descripcion]="saludoUsuario()"
    >
      <app-date-selector
        [fechaIso]="fechaActual()"
        (fechaSeleccionada)="onFechaSeleccionada($event)"
      />
    </app-page-header>

    <!-- ESTADO 1: CARGANDO (SKELETONS DE ALTA FIDELIDAD) -->
    @if (cargando()) {
      <div class="home-page-container">
        <!-- Skeleton Resumen Diario -->
        <div class="skeleton-summary-box">
          <p-skeleton width="100%" height="80px" borderRadius="8px" />
        </div>

        <!-- Skeleton Grid 2 Columnas -->
        <div class="home-columns-grid">
          <div class="column-left">
            <p-skeleton width="100%" height="48px" borderRadius="8px" styleClass="mb-3" />
            <p-skeleton width="100%" height="280px" borderRadius="8px" />
          </div>
          <div class="column-right">
            <p-skeleton width="100%" height="150px" borderRadius="8px" styleClass="mb-3" />
            <p-skeleton width="100%" height="240px" borderRadius="8px" />
          </div>
        </div>

        <!-- Skeleton Deck Inferior -->
        <div class="skeleton-deck-box">
          <p-skeleton width="100%" height="200px" borderRadius="8px" />
        </div>
      </div>
    }

    <!-- ESTADO 2: ERROR DE CARGA CON BOTÓN REINTENTAR -->
    @else if (errorCarga()) {
      <div class="r21-card error-card-box">
        <div class="error-circle-icon">
          <i class="pi pi-exclamation-circle"></i>
        </div>
        <div class="error-text-content">
          <h3 class="error-heading">No se pudo cargar la información operativa</h3>
          <p class="error-paragraph">Ocurrió un inconveniente al conectar con el servidor. Verifica tu conexión e intenta nuevamente.</p>
        </div>
        <button
          pButton
          label="Reintentar"
          icon="pi pi-refresh"
          class="p-button-sm p-button-outlined"
          (click)="cargar()"
        ></button>
      </div>
    }

    <!-- ESTADO 3: PANTALLA OPERATIVA PRINCIPAL -->
    @else if (datos(); as d) {
      <div class="home-page-container">
        <!-- BLOQUE ESTADO DE HOY (DailySummary) -->
        <app-daily-summary [resumen]="d.resumen" />

        <!-- GRILLA OPERATIVA (Izquierda 62%, Derecha 38%) -->
        <div class="home-columns-grid">
          <!-- COLUMNA IZQUIERDA: Jornadas de hoy -->
          <div class="column-left">
            <div class="left-section-title-row">
              <h2 class="section-heading">Jornadas de hoy</h2>
            </div>

            <!-- Selector de Grupos -->
            <app-group-selector
              [grupoActivo]="grupoActivo()"
              (grupoCambiado)="grupoActivo.set($event)"
            />

            <!-- Panel de la Jornada del Grupo Seleccionado -->
            <app-session-panel
              [jornada]="jornadaSeleccionada()"
              [grupoId]="grupoActivo()"
              [incidencias]="incidenciasGrupo()"
            />
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
        <app-group-metrics-deck [jornadas]="d.jornadas" />
      </div>
    }
  `,
  styles: [`
    .home-page-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 100%;
      max-width: 1440px;
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

    .left-section-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .section-heading {
        font-size: 18px;
        font-weight: 650;
        color: var(--r21-text-primary);
        margin: 0;
      }
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
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  protected readonly realtime = inject(RealtimeService);

  readonly datos = signal<DashboardHoy | null>(null);
  readonly cargando = signal(true);
  readonly errorCarga = signal(false);

  readonly fechaActual = signal<string>(new Date().toISOString().slice(0, 10));
  readonly grupoActivo = signal<string>('postulantes');

  readonly saludoUsuario = computed(() => {
    const nombre = this.auth.perfil()?.persona.nombres || 'Carlos Quispe';
    return `Bienvenido, ${nombre}`;
  });

  readonly jornadaSeleccionada = computed<JornadaHoy | null>(() => {
    const list = this.datos()?.jornadas ?? [];
    if (list.length === 0) return null;
    const g = this.grupoActivo();
    if (g === 'postulantes') {
      return list.find((j) => (j.etapa || '').toUpperCase().includes('POSTULANTE') || (j.grupo || '').toUpperCase().includes('POSTULANTE')) ?? list[0] ?? null;
    }
    if (g === 'aspirantes') {
      return list.find((j) => (j.etapa || '').toUpperCase().includes('COMPA') || (j.grupo || '').toUpperCase().includes('COMPA') || (j.grupo || '').toUpperCase().includes('ASPIRANTE')) ?? list[1] ?? null;
    }
    if (g === 'esbas') {
      return list.find((j) => (j.etapa || '').toUpperCase().includes('ESBAS') || (j.grupo || '').toUpperCase().includes('ESBAS') || (j.etapa || '').toUpperCase().includes('CURSO')) ?? list[2] ?? null;
    }
    return list[0] ?? null;
  });

  readonly incidenciasGrupo = computed(() => {
    const atencion = this.datos()?.requierenAtencion ?? [];
    const j = this.jornadaSeleccionada();
    if (!j) return atencion;
    const gNombre = j.grupo.toLowerCase();
    return atencion.filter((a) => a.jornadaId === j.jornadaId || a.descripcion.toLowerCase().includes(gNombre));
  });

  private refrescoPendiente: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.cargar();
    this.realtime.conectar();
    this.realtime.on('dashboard.actualizar', () => this.programarRefresco());
    this.realtime.on('asistencia.registrada', () => this.programarRefresco());
  }

  ngOnDestroy(): void {
    this.realtime.off('dashboard.actualizar');
    this.realtime.off('asistencia.registrada');
    if (this.refrescoPendiente) clearTimeout(this.refrescoPendiente);
  }

  onFechaSeleccionada(nuevaFechaIso: string): void {
    this.fechaActual.set(nuevaFechaIso);
    this.cargar(nuevaFechaIso);
  }

  async cargar(fechaParam?: string): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(false);
    try {
      const fecha = fechaParam || this.fechaActual();
      // Si se pasa fecha se consulta con query param o endpoint estándar
      const data = await this.http
        .get<DashboardHoy>(`${environment.apiUrl}/dashboard/today`, {
          params: { fecha },
        })
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
}
