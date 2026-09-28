import { useSyncExternalStore } from 'react';
import { authService } from './auth.service';

/** Sin actividad durante este tiempo, la sesión se cierra (igual que en el servidor) */
export const INACTIVIDAD_MS = 5 * 60 * 1000;
/** Antes del cierre se avisa con esta anticipación */
const AVISO_MS = 60 * 1000;
/**
 * Mientras se usa la app, la sesión se renueva con esta frecuencia. Debe ser menor
 * que la vida de la sesión en el servidor (inactividad + 1 min) para no perderla.
 */
const RENOVAR_MS = 3 * 60 * 1000;

const CLAVE_ACTIVIDAD = 'r21_ultima_actividad';
const CLAVE_RENOVACION = 'r21_ultima_renovacion';
const CLAVE_CIERRE = 'r21_cierre_sesion';

export type MotivoCierre = 'inactividad' | 'otra-pestana';

const EVENTOS: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove', 'scroll'];

function leer(clave: string): number {
  try {
    return Number(localStorage.getItem(clave)) || 0;
  } catch {
    return 0;
  }
}

function escribir(clave: string, valor: number): void {
  try {
    localStorage.setItem(clave, String(valor));
  } catch {
    // Almacenamiento bloqueado: el control sigue funcionando en esta pestaña
  }
}

/**
 * Vigila la actividad del usuario. La última actividad se comparte entre pestañas
 * (localStorage), así usar una pestaña mantiene viva la sesión en las demás, y un
 * cierre en una pestaña cierra todas.
 */
class Inactividad {
  private ultimaLocal = Date.now();
  private ultimaRenovacion = Date.now();
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private alCerrar: ((motivo: MotivoCierre) => void) | null = null;
  private segundosRestantes: number | null = null;
  private readonly oyentes = new Set<() => void>();

  private readonly registrar = () => {
    const ahora = Date.now();
    // Escribir como mucho cada 10 s: mousemove dispara cientos de eventos
    if (ahora - this.ultimaLocal < 10_000 && this.segundosRestantes === null) return;
    this.ultimaLocal = ahora;
    escribir(CLAVE_ACTIVIDAD, ahora);
    if (this.segundosRestantes !== null) this.revisar();
  };

  private readonly alCambiarOtraPestana = (e: StorageEvent) => {
    if (e.key === CLAVE_CIERRE && e.newValue) this.alCerrar?.('otra-pestana');
    if (e.key === CLAVE_ACTIVIDAD) this.revisar();
  };

  /** Marca actividad explícita (p. ej. cada lectura del escáner QR, que no toca la pantalla) */
  marcar(): void {
    this.ultimaLocal = 0;
    this.registrar();
  }

  iniciar(alCerrar: (motivo: MotivoCierre) => void): void {
    this.detener();
    this.alCerrar = alCerrar;
    this.ultimaLocal = Date.now();
    this.ultimaRenovacion = Date.now();
    escribir(CLAVE_ACTIVIDAD, this.ultimaLocal);
    for (const ev of EVENTOS) window.addEventListener(ev, this.registrar, { passive: true, capture: true });
    window.addEventListener('storage', this.alCambiarOtraPestana);
    this.temporizador = setInterval(() => this.revisar(), 1000);
  }

  detener(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    for (const ev of EVENTOS) window.removeEventListener(ev, this.registrar, { capture: true });
    window.removeEventListener('storage', this.alCambiarOtraPestana);
    this.cambiarAviso(null);
  }

  /** Cierre por inactividad o por salir: avisa a las demás pestañas */
  anunciarCierre(): void {
    escribir(CLAVE_CIERRE, Date.now());
  }

  /** «Seguir conectado» en el aviso */
  continuar(): void {
    this.marcar();
    void this.renovar();
  }

  get restante(): number | null {
    return this.segundosRestantes;
  }

  readonly suscribir = (oyente: () => void): (() => void) => {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  };

  private revisar(): void {
    const ultima = Math.max(this.ultimaLocal, leer(CLAVE_ACTIVIDAD));
    const inactivo = Date.now() - ultima;

    if (inactivo >= INACTIVIDAD_MS) {
      const cerrar = this.alCerrar;
      this.detener();
      cerrar?.('inactividad');
      return;
    }
    this.cambiarAviso(inactivo >= INACTIVIDAD_MS - AVISO_MS ? Math.ceil((INACTIVIDAD_MS - inactivo) / 1000) : null);

    // Renovar solo si hubo actividad desde la última renovación (propia o de otra pestaña)
    const renovadaEnOtra = leer(CLAVE_RENOVACION);
    const ultimaRenovacion = Math.max(this.ultimaRenovacion, renovadaEnOtra);
    if (ultima > ultimaRenovacion && Date.now() - ultimaRenovacion >= RENOVAR_MS) {
      void this.renovar();
    }
  }

  private async renovar(): Promise<void> {
    this.ultimaRenovacion = Date.now();
    escribir(CLAVE_RENOVACION, this.ultimaRenovacion);
    await authService.renovar();
  }

  private cambiarAviso(valor: number | null): void {
    if (this.segundosRestantes === valor) return;
    this.segundosRestantes = valor;
    this.oyentes.forEach((o) => o());
  }
}

export const inactividad = new Inactividad();

/** Segundos que faltan para el cierre (null si no hay aviso) */
export function useAvisoInactividad(): number | null {
  return useSyncExternalStore(inactividad.suscribir, () => inactividad.restante);
}
