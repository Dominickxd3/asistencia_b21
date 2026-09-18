import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

interface TrackingRow {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  asistencias: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  salidasAnticipadas: number;
  horas: number;
}

@Component({
  selector: 'app-tracking-page',
  imports: [FormsModule, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './tracking.page.html',
})
export class TrackingPageComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly grupos = signal<{ id: number; nombre: string; etapa: string }[]>([]);
  readonly grupoId = signal<number | null>(null);
  readonly orden = signal('faltas_injustificadas');
  readonly filas = signal<TrackingRow[]>([]);
  readonly jornadasEsperadas = signal(0);
  readonly cargando = signal(false);

  desde = '';
  hasta = '';

  async ngOnInit(): Promise<void> {
    const g = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups`));
    this.grupos.set(g.map((x) => ({ id: x.id, nombre: x.nombre, etapa: x.etapa })));
    const ahora = new Date();
    this.desde = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`;
    this.hasta = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString().slice(0, 10);
    if (this.grupos().length) {
      this.grupoId.set(this.grupos()[0].id);
      await this.cargar();
    }
  }

  async cargar(): Promise<void> {
    if (!this.grupoId()) return;
    this.cargando.set(true);
    try {
      const r = await firstValueFrom(
        this.http.get<any>(
          `${environment.apiUrl}/tracking?grupoId=${this.grupoId()}&desde=${this.desde}&hasta=${this.hasta}&orden=${this.orden()}`,
        ),
      );
      this.filas.set(r.integrantes);
      this.jornadasEsperadas.set(r.jornadasEsperadas);
    } finally {
      this.cargando.set(false);
    }
  }
}
