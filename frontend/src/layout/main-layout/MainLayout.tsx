import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Sidebar } from 'primereact/sidebar';
import { authService } from '../../core/auth/auth.service';
import { inactividad, useAvisoInactividad, type MotivoCierre } from '../../core/auth/inactividad';
import { Modal } from '../../shared/components/Modal';
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

  // Cierre automático tras 5 minutos sin uso (y cuando otra pestaña cierra sesión)
  const segundosAviso = useAvisoInactividad();
  useEffect(() => {
    inactividad.iniciar((motivo) => void salir(motivo));
    return () => inactividad.detener();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada navegación vuelve al inicio de la página
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  async function salir(motivo?: MotivoCierre): Promise<void> {
    inactividad.detener();
    if (motivo !== 'otra-pestana') inactividad.anunciarCierre();
    realtimeService.desconectar();
    try {
      await authService.logout();
    } catch {
      // La sesión ya pudo haber expirado en el servidor
    } finally {
      navigate(motivo ? `/login?motivo=${motivo}` : '/login', { replace: true });
    }
  }

  const cerrarSesion = () => salir();

  return (
    <>
      {/* Barra superior compacta (exclusiva para móvil y tablet) */}
      <header className="r21-mobile-bar" aria-label="Cabecera móvil">
        <div className="mobile-brand">
          <img src="/assets/brand/logo-192.png" alt="Escudo Rímac 21" />
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

      <Modal
        titulo="¿Sigue ahí?"
        visible={segundosAviso !== null}
        onCerrar={() => inactividad.continuar()}
        acciones={
          <>
            <button type="button" className="btn btn-sm btn-r21-ghost" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
            <button type="button" className="btn btn-sm btn-r21" onClick={() => inactividad.continuar()}>
              Seguir conectado
            </button>
          </>
        }
      >
        <p className="mb-0">
          Por seguridad, su sesión se cerrará en <strong>{segundosAviso} segundos</strong> porque no ha usado el
          sistema en los últimos minutos.
        </p>
      </Modal>
    </>
  );
}
