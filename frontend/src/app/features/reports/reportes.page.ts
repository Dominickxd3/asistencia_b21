import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TuiIcon } from '@taiga-ui/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

type TipoReporte = 'ESTADO_GENERAL' | 'DETALLE_INDIVIDUAL' | 'JORNADA';

@Component({
  selector: 'app-reportes-page',
  imports: [FormsModule, PageHeaderComponent, EmptyStateComponent, TuiIcon],
  templateUrl: './reportes.page.html',
})
export class ReportesPageComponent implements OnInit {
  private readonly http = inject(HttpClient);

  tipo: TipoReporte = 'ESTADO_GENERAL';
  periodoRapido: 'Q1' | 'Q2' | 'MES' | 'PERSONALIZADO' = 'MES';
  desde = '';
  hasta = '';
  gruposDisponibles = signal<any[]>([]);
  gruposSeleccionados = signal<number[]>([]);
  personas = signal<any[]>([]);
  jornadas = signal<any[]>([]);
  personaId: number | null = null;
  jornadaId: number | null = null;
  generando = signal(false);
  mensaje = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const g = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups`));
    this.gruposDisponibles.set(g);
    this.aplicarPeriodo('MES');
    // Personas del primer grupo por defecto
    const p = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups/${g[0]?.id ?? 1}/members`));
    this.personas.set(p);
  }

  aplicarPeriodo(p: 'Q1' | 'Q2' | 'MES' | 'PERSONALIZADO'): void {
    this.periodoRapido = p;
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    this.desde = `${y}-${pad(m + 1)}-01`;
    if (p === 'Q1') this.hasta = `${y}-${pad(m + 1)}-15`;
    else if (p === 'Q2') {
      this.desde = `${y}-${pad(m + 1)}-16`;
      this.hasta = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    } else if (p === 'MES') {
      this.hasta = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    } else {
      this.desde = this.desde || `${y}-${pad(m + 1)}-01`;
      this.hasta = this.hasta || new Date(y, m + 1, 0).toISOString().slice(0, 10);
    }
  }

  toggleGrupo(id: number): void {
    const s = new Set(this.gruposSeleccionados());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.gruposSeleccionados.set([...s]);
  }

  async generar(): Promise<void> {
    this.mensaje.set(null);
    this.generando.set(true);
    try {
      const body: any = { tipo: this.tipo, desde: this.desde, hasta: this.hasta, grupoIds: this.gruposSeleccionados() };
      if (this.tipo === 'DETALLE_INDIVIDUAL') body.personaId = this.personaId;
      if (this.tipo === 'JORNADA') body.jornadaId = this.jornadaId;

      const blob = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/reports/generate`, body, { responseType: 'blob' }),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rimac21_${this.tipo.toLowerCase()}_${this.desde}_${this.hasta}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      this.mensaje.set('PDF generado y descargado');
    } catch (e: any) {
      this.mensaje.set(e?.error?.message ?? 'No se pudo generar el reporte');
    } finally {
      this.generando.set(false);
    }
  }
}
