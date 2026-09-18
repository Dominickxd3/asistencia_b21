import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

interface Miembro {
  id: number;
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  fechaIngreso: string;
  estado: string;
}

@Component({
  selector: 'app-mi-grupo',
  imports: [PageHeaderComponent, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      titulo="Mi grupo"
      [subtitulo]="grupo() ? grupo().nombre + ' — ' + grupo().etapa?.nombre : 'Sin asignación activa'"
    />

    @if (cargando()) {
      <div class="r21-card r21-card-body p-4 text-center text-muted">Cargando…</div>
    } @else if (grupo(); as g) {
      <div class="r21-card">
        <div class="r21-card-header">
          <h2>Integrantes ({{ miembros().length }})</h2>
        </div>
        <div class="r21-card-body pt-1 pb-1">
          @if (miembros().length === 0) {
            <app-empty-state mensaje="Este grupo aún no tiene integrantes" icono="@tui.users" />
          }
          @for (m of miembros(); track m.id) {
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom" style="border-color: var(--r21-borde)">
              <div>
                <div class="fw-semibold" style="font-size: 13.5px">{{ m.nombreCompleto }}</div>
                <div class="small text-muted">
                  {{ m.dni ?? 'Sin DNI' }} · desde {{ m.fechaIngreso }}
                </div>
              </div>
              <app-status-badge [estado]="m.estado" />
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="r21-card">
        <div class="r21-card-body">
          <app-empty-state
            mensaje="No eres encargado activo de ningún grupo en este momento"
            icono="@tui.user-x"
          />
        </div>
      </div>
    }
  `,
})
export class MiGrupoComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly grupo = signal<any>(null);
  readonly miembros = signal<Miembro[]>([]);
  readonly cargando = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      const grupo = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/groups/mi-grupo`),
      );
      this.grupo.set(grupo);
      if (grupo?.id) {
        const miembros = await firstValueFrom(
          this.http.get<Miembro[]>(`${environment.apiUrl}/groups/${grupo.id}/members`),
        );
        this.miembros.set(miembros);
      }
    } finally {
      this.cargando.set(false);
    }
  }
}
