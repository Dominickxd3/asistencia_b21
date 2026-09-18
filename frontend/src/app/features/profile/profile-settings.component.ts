import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-profile-settings',
  imports: [FormsModule, PageHeaderComponent, TuiButton, TuiIcon],
  template: `
    <app-page-header titulo="Configuración personal" descripcion="Actualiza la información visible de tu perfil." />

    <section class="profile-settings-card">
      <div class="photo-column">
        <div class="profile-photo">
          @if (fotoVistaPrevia()) {
            <img [src]="fotoVistaPrevia()" alt="Foto de perfil" />
          } @else {
            <span>{{ iniciales() }}</span>
          }
        </div>
        <label tuiButton appearance="outline" size="s" class="photo-picker">
          <tui-icon icon="@tui.camera" />
          Elegir foto
          <input type="file" accept="image/jpeg,image/png,image/webp" (change)="seleccionarFoto($event)" />
        </label>
        <small>JPG, PNG o WEBP · máximo 3 MB</small>
      </div>

      <form class="profile-form" (ngSubmit)="guardar()">
        <div class="field-grid">
          <label class="field full">
            <span>Nombres</span>
            <input name="nombres" [(ngModel)]="form.nombres" maxlength="100" required />
          </label>
          <label class="field">
            <span>Apellido paterno</span>
            <input name="apellidoPaterno" [(ngModel)]="form.apellidoPaterno" maxlength="80" required />
          </label>
          <label class="field">
            <span>Apellido materno</span>
            <input name="apellidoMaterno" [(ngModel)]="form.apellidoMaterno" maxlength="80" />
          </label>
          <label class="field full">
            <span>Correo</span>
            <input name="correo" type="email" [(ngModel)]="form.correo" maxlength="150" autocomplete="email" />
          </label>
        </div>

        @if (mensaje()) {
          <div class="form-message" [class.error]="esError()">
            <tui-icon [icon]="esError() ? '@tui.circle-alert' : '@tui.circle-check'" />
            {{ mensaje() }}
          </div>
        }

        <div class="form-actions">
          <button tuiButton type="submit" size="m" [disabled]="guardando() || !form.nombres.trim() || !form.apellidoPaterno.trim()">
            <tui-icon icon="@tui.save" />
            {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </section>
  `,
  styles: [`
    .profile-settings-card { display: grid; grid-template-columns: 220px minmax(0, 560px); gap: 40px; max-width: 860px; padding: 28px; background: #fff; border: 1px solid var(--r21-border); border-radius: var(--r21-radius-lg); box-shadow: var(--r21-shadow-card); }
    .photo-column { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-right: 32px; border-right: 1px solid var(--r21-border-subtle); }
    .profile-photo { display: grid; width: 132px; height: 132px; place-items: center; overflow: hidden; border: 4px solid #fff; border-radius: 50%; background: #303941; box-shadow: 0 0 0 1px var(--r21-border), 0 8px 24px rgba(16,24,40,.12); color: #fff; font-size: 34px; font-weight: 750; }
    .profile-photo img { width: 100%; height: 100%; object-fit: cover; }
    .photo-picker { position: relative; cursor: pointer; }
    .photo-picker input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .photo-column small { color: var(--r21-text-muted); font-size: 10.5px; text-align: center; }
    .profile-form { display: flex; flex-direction: column; gap: 20px; }
    .field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .field { display: flex; flex-direction: column; gap: 7px; }
    .field.full { grid-column: 1 / -1; }
    .field span { color: var(--r21-text-primary); font-size: 12px; font-weight: 650; }
    .field input { width: 100%; height: 42px; padding: 0 12px; border: 1px solid var(--r21-border); border-radius: var(--r21-radius-sm); background: #fff; color: var(--r21-text-primary); transition: border-color var(--r21-transition-fast), box-shadow var(--r21-transition-fast); }
    .field input:focus { border-color: var(--r21-red); box-shadow: 0 0 0 3px var(--r21-red-light); outline: none; }
    .form-message { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--r21-radius-sm); background: var(--r21-green-bg); color: var(--r21-green); font-size: 12px; }
    .form-message.error { background: var(--r21-red-light); color: var(--r21-red); }
    .form-actions { display: flex; justify-content: flex-end; padding-top: 4px; }
    @media (max-width: 720px) { .profile-settings-card { grid-template-columns: 1fr; gap: 24px; padding: 20px; } .photo-column { padding: 0 0 24px; border-right: 0; border-bottom: 1px solid var(--r21-border-subtle); } .field-grid { grid-template-columns: 1fr; } .field.full { grid-column: auto; } }
  `],
})
export class ProfileSettingsComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly apiOrigin = environment.apiUrl.replace(/\/api\/?$/, '');
  private objectUrl: string | null = null;
  private foto: File | null = null;

  readonly guardando = signal(false);
  readonly mensaje = signal<string | null>(null);
  readonly esError = signal(false);
  readonly fotoLocal = signal<string | null>(null);
  readonly perfil = this.auth.perfil;
  readonly fotoVistaPrevia = computed(() => this.fotoLocal() || (this.perfil()?.persona.fotoUrl ? `${this.apiOrigin}${this.perfil()!.persona.fotoUrl}` : null));
  readonly iniciales = computed(() => {
    const p = this.perfil()?.persona;
    return `${p?.nombres?.[0] ?? ''}${p?.apellidoPaterno?.[0] ?? ''}`.toUpperCase() || 'U';
  });

  form = {
    nombres: this.perfil()?.persona.nombres ?? '',
    apellidoPaterno: this.perfil()?.persona.apellidoPaterno ?? '',
    apellidoMaterno: this.perfil()?.persona.apellidoMaterno ?? '',
    correo: this.perfil()?.persona.correo ?? '',
  };

  seleccionarFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    this.mensaje.set(null);
    if (!archivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) || archivo.size > 3 * 1024 * 1024) {
      this.esError.set(true);
      this.mensaje.set('Selecciona una imagen JPG, PNG o WEBP de hasta 3 MB.');
      input.value = '';
      return;
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(archivo);
    this.foto = archivo;
    this.fotoLocal.set(this.objectUrl);
  }

  async guardar(): Promise<void> {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.mensaje.set(null);
    const datos = new FormData();
    datos.set('nombres', this.form.nombres.trim());
    datos.set('apellidoPaterno', this.form.apellidoPaterno.trim());
    datos.set('apellidoMaterno', this.form.apellidoMaterno.trim());
    datos.set('correo', this.form.correo.trim());
    if (this.foto) datos.set('foto', this.foto);
    try {
      await this.auth.actualizarPerfil(datos);
      this.foto = null;
      this.esError.set(false);
      this.mensaje.set('Tu perfil se actualizó correctamente.');
    } catch (error: any) {
      this.esError.set(true);
      this.mensaje.set(error?.error?.message ?? 'No se pudo actualizar el perfil.');
    } finally {
      this.guardando.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
