import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="r21-login">
      <div class="r21-login-card">
        <div class="logo-wrap">
          <img src="assets/brand/logo.svg" alt="Escudo Rímac 21" />
        </div>
        <h1>Compañía de Bomberos Voluntarios Rímac N.º 21</h1>
        <div class="sub">Sistema del Área de Instrucción</div>

        <form (ngSubmit)="ingresar()">
          <div class="mb-3">
            <label class="form-label fw-semibold" for="usuario">Usuario</label>
            <input
              id="usuario"
              class="form-control"
              name="usuario"
              [(ngModel)]="usuario"
              autocomplete="username"
              required
            />
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold" for="clave">Contraseña</label>
            <input
              id="clave"
              type="password"
              class="form-control"
              name="clave"
              [(ngModel)]="clave"
              autocomplete="current-password"
              required
            />
          </div>

          @if (error()) {
            <div class="alert alert-danger py-2 small" role="alert">
              <i class="bi bi-exclamation-circle"></i> {{ error() }}
            </div>
          }

          <button class="btn btn-r21 w-100" type="submit" [disabled]="cargando()">
            @if (cargando()) {
              <span class="spinner-border spinner-border-sm me-1"></span> Ingresando...
            } @else {
              Ingresar
            }
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  usuario = '';
  clave = '';
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  async ingresar(): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.usuario.trim(), this.clave);
      await this.router.navigate(['/inicio']);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'No se pudo iniciar sesión');
    } finally {
      this.cargando.set(false);
    }
  }
}
