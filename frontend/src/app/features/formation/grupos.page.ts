import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-grupos-page',
  imports: [PageHeaderComponent, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <app-page-header titulo="Grupos" subtitulo="Cohortes por etapa y periodo" />
    @if (grupos().length === 0) {
      <div class="r21-card"><div class="r21-card-body">
        <app-empty-state mensaje="No hay grupos registrados" icono="bi-collection" />
      </div></div>
    } @else {
      <div class="row g-3">
        @for (g of grupos(); track g.id) {
          <div class="col-12 col-md-6 col-lg-4">
            <div class="r21-card h-100">
              <div class="r21-card-header">
                <h2 style="font-size:13.5px">{{ g.nombre }}</h2>
                <app-status-badge [estado]="g.estado === 'ACTIVO' ? 'OK' : 'NEUTRO'" />
              </div>
              <div class="r21-card-body small">
                <div class="mb-1"><span class="text-muted">Etapa:</span> {{ g.etapa }}</div>
                <div class="mb-1"><span class="text-muted">Periodo:</span> {{ g.periodo }}</div>
                <div class="mb-1"><span class="text-muted">Inicio:</span> {{ g.fechaInicio }}</div>
                <div class="mb-1"><span class="text-muted">Integrantes:</span> <strong>{{ g.totalIntegrantes }}</strong></div>
                <div><span class="text-muted">Encargado:</span> {{ g.encargado?.nombre ?? 'Sin asignar' }}</div>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class GruposPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly grupos = signal<any[]>([]);

  async ngOnInit(): Promise<void> {
    this.grupos.set(await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups`)));
  }
}
