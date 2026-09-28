# Frontend — Rímac 21

React 19 + TypeScript + PrimeReact 10 (tema `lara-light-blue`) + SCSS, empaquetado con Vite.

```powershell
npm install
npm start          # http://localhost:4200 (API en http://localhost:3000/api)
npm run build      # compila a dist/ (API en /api, WebSocket en /realtime)
npm run typecheck
```

## Estructura

```
src/
├── main.tsx              orden de estilos + restauración de sesión antes de pintar
├── App.tsx               rutas y guards por permiso
├── core/                 auth (token en memoria + refresh por cookie), http, realtime, geo
├── layout/               sidebar, drawer móvil y layout principal
├── shared/               PageHeader, EmptyState, Modal, StatusBadge, utilidades
├── features/             una carpeta por módulo (home, attendance, formation, ...)
└── styles/               tokens, tipografía, overrides de PrimeReact y utilidades
```

Los estilos de cada componente viven junto a él (`*.scss`) y se anidan bajo la clase
raíz del componente para no filtrarse a otros.
