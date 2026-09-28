// Orden de estilos (debe ir antes que App, que importa los estilos de cada componente):
// Bootstrap → PrimeIcons → tema PrimeReact → overrides Rímac 21 → componentes
import 'bootstrap/dist/css/bootstrap.min.css';
import 'primeicons/primeicons.css';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import './styles.scss';

import { StrictMode } from 'react';
import { addLocale, locale } from 'primereact/api';
import { createRoot } from 'react-dom/client';
import { authService } from './core/auth/auth.service';
import { App } from './App';

// Calendario y componentes PrimeReact en español
addLocale('es', {
  firstDayOfWeek: 1,
  dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  monthNamesShort: [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ],
  today: 'Hoy',
  clear: 'Limpiar',
  emptyMessage: 'Sin resultados',
  emptyFilterMessage: 'Sin coincidencias',
});
locale('es');

// Tras un despliegue, una pestaña abierta con la versión anterior pide páginas que ya
// no existen: se recarga una vez para tomar la versión nueva.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  if (sessionStorage.getItem('r21_recarga_version') === '1') return;
  sessionStorage.setItem('r21_recarga_version', '1');
  window.location.reload();
});
// La marca se retira pasado un rato: si el error se repitiera enseguida, no hay bucle de recargas
window.addEventListener('load', () =>
  setTimeout(() => sessionStorage.removeItem('r21_recarga_version'), 10_000),
);

// Restaurar sesión (cookie HttpOnly) antes de pintar la app
void authService.intentarRestaurar().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
