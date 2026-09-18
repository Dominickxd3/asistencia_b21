import { Component, computed, input } from '@angular/core';
import { TuiBadge } from '@taiga-ui/kit';

type BadgeAppearance = 'positive' | 'warning' | 'negative' | 'neutral';

interface EstadoConfig {
  appearance: BadgeAppearance;
  texto: string;
  styleClass: string;
}

const MAPA_ESTADOS: Record<string, EstadoConfig> = {
  PROGRAMADA: { appearance: 'neutral', texto: 'Programada', styleClass: 'tag-programada' },
  ABIERTA: { appearance: 'positive', texto: 'Abierta', styleClass: 'tag-activa' },
  CERRADA: { appearance: 'neutral', texto: 'Cerrada', styleClass: 'tag-programada' },
  CANCELADA: { appearance: 'negative', texto: 'Cancelada', styleClass: 'tag-obligatoria' },
  PENDIENTE: { appearance: 'warning', texto: 'Pendiente', styleClass: 'tag-pendiente' },
  PRESENTE: { appearance: 'positive', texto: 'Presente', styleClass: 'tag-activa' },
  FINALIZADO: { appearance: 'neutral', texto: 'Finalizado', styleClass: 'tag-programada' },
  FALTA_JUSTIFICADA: { appearance: 'warning', texto: 'Falta justificada', styleClass: 'tag-pendiente' },
  FALTA_INJUSTIFICADA: { appearance: 'negative', texto: 'Falta', styleClass: 'tag-obligatoria' },
  SALIDA_ANTICIPADA: { appearance: 'warning', texto: 'Salida anticipada', styleClass: 'tag-pendiente' },
  ANULADO: { appearance: 'neutral', texto: 'Anulado', styleClass: 'tag-programada' },
  OBLIGATORIA: { appearance: 'negative', texto: 'Obligatoria', styleClass: 'tag-obligatoria' },
  VOLUNTARIA: { appearance: 'neutral', texto: 'Voluntaria', styleClass: 'tag-voluntaria' },
};

@Component({
  selector: 'app-status-badge',
  imports: [TuiBadge],
  template: `
    <span tuiBadge size="s" [appearance]="config().appearance" [class]="config().styleClass">
      {{ config().texto }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly estado = input.required<string>();

  protected readonly config = computed(() => {
    const key = (this.estado() || '').toUpperCase();
    return MAPA_ESTADOS[key] ?? {
      appearance: 'neutral' as BadgeAppearance,
      texto: this.estado(),
      styleClass: 'tag-programada',
    };
  });
}
