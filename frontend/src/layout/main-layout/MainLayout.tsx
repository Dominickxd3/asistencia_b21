import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Sidebar } from 'primereact/sidebar';
import { authService } from '../../core/auth/auth.service';
import { realtimeService } from '../../core/services/realtime.service';
import { AppSidebar } from '../sidebar/AppSidebar';

export function MainLayout() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [colapsado, setColapsado] = useState<boolean>(() => {
    return localStorage.getItem('r21_sidebar_collapsed') === 'true';
  });
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function toggleColapsado() {
    setColapsado((prev) => {
      const next = !prev;
      localStorage.setItem('r21_sidebar_collapsed', String(next));
      return next;
    });
  }

  // Canal en vivo mientras haya sesión; se cierra al salir del layout
  useEffect(() => {
    realtimeService.conectar();
    return () => realtimeService.desconectar();
  }, []);

  // Cada navegación vuelve al inicio de la página
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  async function cerrarSesion(): Promise<void> {
    realtimeService.desconectar();
    try {
      await authService.logout();
    } finally {
      navigate('/login');
    }
  }

  return (
    <>
      {/* Barra superior compacta (exclusiva para móvil y tablet) */}
      <header className="r21-mobile-bar" aria-label="Cabecera móvil">
        <div className="mobile-brand">
          <img src="/assets/brand/logo.png" alt="Escudo Rímac 21" />
          <span>Rímac 21 · Instrucción</span>
        </div>
        <button
          type="button"
          className="btn-toggle-menu"
          onClick={() => setDrawerVisible(true)}
          aria-label="Abrir menú de navegación"
        >
          <i className="pi pi-bars"></i>
        </button>
      </header>

      {/* Drawer móvil con Sidebar de PrimeReact */}
      <Sidebar
        visible={drawerVisible}
        onHide={() => setDrawerVisible(false)}
        baseZIndex={1050}
        showCloseIcon
        className="r21-mobile-drawer"
      >
        {drawerVisible && (
          <AppSidebar
            isDesktop={false}
            onCerrar={() => setDrawerVisible(false)}
            onSalir={cerrarSesion}
          />
        )}
      </Sidebar>

      {/* Layout principal */}
      <div className={`r21-layout ${colapsado ? 'sidebar-collapsed' : ''}`}>
        {/* Sidebar Desktop colapsable por click en el logo */}
        <AppSidebar
          isDesktop
          colapsado={colapsado}
          onToggleColapsado={toggleColapsado}
          onCerrar={() => setDrawerVisible(false)}
          onSalir={cerrarSesion}
        />

        {/* Área de Contenido Principal (Fluida) */}
        <div className="r21-main-area">
          <main className="r21-content">
            <div className="r21-page">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
