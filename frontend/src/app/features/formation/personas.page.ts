import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';

interface PersonaRow {
  id: number;
  dni: string | null;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  estado: string;
}

@Component({
  selector: 'app-personas-page',
  imports: [FormsModule, PageHeaderComponent, EmptyStateComponent, ModalComponent],
  templateUrl: './personas.page.html',
})
export class PersonasPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);

  readonly personas = signal<PersonaRow[]>([]);
  readonly busqueda = signal('');
  readonly cargando = signal(false);
  readonly historial = signal<any[]>([]);
  readonly historialDe = signal<PersonaRow | null>(null);
  readonly promoviendo = signal<PersonaRow | null>(null);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  readonly gruposDestino = signal<any[]>([]);

  form = { dni: '', nombres: '', apellidoPaterno: '', apellidoMaterno: '' };

  async ngOnInit(): Promise<void> {
    await this.cargar();
    const g = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups`));
    this.gruposDestino.set(g.filter((x) => x.estado === 'ACTIVO'));
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const q = this.busqueda() ? `?q=${encodeURIComponent(this.busqueda())}` : '';
      const r = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/persons${q}`));
      this.personas.set(r.items);
    } finally {
      this.cargando.set(false);
    }
  }

  async crear(): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/persons`, this.form));
      this.ok.set('Persona registrada');
      this.form = { dni: '', nombres: '', apellidoPaterno: '', apellidoMaterno: '' };
      await this.cargar();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo registrar');
    }
  }

  async verHistorial(p: PersonaRow): Promise<void> {
    this.historialDe.set(p);
    this.historial.set(await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/formation/personas/${p.id}/historial`)));
  }

  async promover(destino: string): Promise<void> {
    const p = this.promoviendo();
    if (!p) return;
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/formation/promote`, {
          personaId: p.id,
          etapaDestino: destino,
        }),
      );
      this.ok.set(`${p.apellidoPaterno} promovido a ${destino}`);
      this.promoviendo.set(null);
      this.historialDe.set(null);
      await this.cargar();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo promover');
    }
  }
}
