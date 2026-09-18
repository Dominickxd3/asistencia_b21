import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-historial-page',
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header titulo="Historial de formación" subtitulo="Toda la trayectoria de etapas, nunca duplicada" />
    <div class="r21-card">
      <div class="r21-card-body p-0 table-responsive">
        @if (filas().length === 0) {
          <app-empty-state mensaje="Sin historial aún" icono="bi-clock-history" />
        } @else {
          <table class="table table-sm table-hover align-middle mb-0">
            <thead class="table-light">
              <tr><th>Persona</th><th>Etapa</th><th>Grupo</th><th>Desde</th><th>Hasta</th><th>Estado</th></tr>
            </thead>
            <tbody>
              @for (h of filas(); track h.id) {
                <tr>
                  <td class="fw-semibold">{{ h.persona }}</td>
                  <td>{{ h.etapa }}</td>
                  <td>{{ h.grupo }}</td>
                  <td>{{ h.fechaInicio }}</td>
                  <td>{{ h.fechaFin ?? '—' }}</td>
                  <td>
                    <span class="r21-badge" [class.ok]="h.estado === 'ACTIVO'" [class.neutro]="h.estado !== 'ACTIVO'">{{ h.estado }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class HistorialPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly filas = signal<any[]>([]);

  async ngOnInit(): Promise<void> {
    this.filas.set(await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/formation/historial`)));
  }
}
