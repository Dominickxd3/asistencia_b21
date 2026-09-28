import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router';
import { Menu } from 'primereact/menu';
import { Avatar } from 'primereact/avatar';
import type { MenuItem as PrimeMenuItem } from 'primereact/menuitem';
import { useAuth } from '../../core/auth/auth.service';
import type { PerfilUsuario } from '../../core/models/api.models';
import { cx } from '../../shared/utils/format';
import { MENU, ROL_SIDEBAR_NOMBRE, type MenuItem } from '../menu.config';
import { CambiarMiContrasena } from '../../features/auth/CambiarMiContrasena';

const PRIORIDAD_ROLES = [
  'ADMIN_SISTEMA',
  'JEFE_INSTRUCCION',
  'SUBJEFE_INSTRUCCION',
  'ADJUNTO_INSTRUCCION',
  'ENCARGADO_GRUPO',
];

function cargoPrincipal(p: PerfilUsuario): string {
  if (p.roles.length === 0) return '';
  const top = p.roles
    .map((r) => r.codigo)
    .sort((a, b) => PRIORIDAD_ROLES.indexOf(a) - PRIORIDAD_ROLES.indexOf(b))[0];
  return ROL_SIDEBAR_NOMBRE[top] ?? top;
}

function obtenerIniciales(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'B';
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

interface Props {
  isDesktop?: boolean;
  colapsado?: boolean;
  onToggleColapsado?: () => void;
  onCerrar: () => void;
  onSalir: () => void;
}

export function AppSidebar({
  isDesktop = true,
  colapsado = false,
  onToggleColapsado,
  onCerrar,
  onSalir,
}: Props) {
  const { perfil, tienePermiso } = useAuth();
  const userMenuRef = useRef<Menu>(null);
  const isFirstRender = useRef(true);
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);

  const cerrarMenuUsuario = (e?: React.SyntheticEvent) => {
    try {
      const evt = (e ?? { currentTarget: null }) as unknown as React.SyntheticEvent;
      userMenuRef.current?.hide(evt);
    } catch {
      // safe fallback
    }
  };

  // Cerrar menú emergente solo si cambia el modo colapsado (no al montar inicialmente)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    cerrarMenuUsuario();
  }, [colapsado]);

  // Cerrar menú al redimensionar ventana
  useEffect(() => {
    const handleResize = () => cerrarMenuUsuario();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const visibles = MENU.filter((m) => !m.permiso || tienePermiso(m.permiso));
  const bloques: { seccion: string; items: MenuItem[] }[] = [];
  for (const item of visibles) {
    const seccion = item.seccion ?? '';
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && ultimo.seccion === seccion) {
      ultimo.items.push(item);
    } else {
      bloques.push({ seccion, items: [item] });
    }
  }

  function handleLogoClick(e: React.MouseEvent) {
    cerrarMenuUsuario(e);
    if (isDesktop && onToggleColapsado) {
      onToggleColapsado();
    } else {
      onCerrar();
    }
  }

  // El nombre y el cargo ya se ven en el botón del perfil; el menú solo ofrece acciones
  const userMenuItems: PrimeMenuItem[] = [
    {
      label: 'Cambiar mi contraseña',
      icon: 'pi pi-key',
      command: () => setCambiandoContrasena(true),
    },
    { separator: true },
    {
      label: 'Cerrar sesión',
      icon: 'pi pi-sign-out',
      className: 'r21-menu-item-danger',
      command: onSalir,
    },
  ];

  return (
    <aside
      className={cx('r21-sidebar', isDesktop && 'desktop-sidebar', colapsado && 'collapsed')}
      aria-label="Menú principal"
    >
      {/* Cabecera del Sidebar con Logo como botón para contraer/expandir */}
      <div className="r21-sidebar-brand">
        <button
          type="button"
          className="r21-sidebar-brand-btn"
          onClick={handleLogoClick}
          aria-label={colapsado ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          title={colapsado ? 'Clic para expandir menú' : 'Clic para contraer menú'}
        >
          <img
            src="/assets/brand/logo-192.png"
            alt="Escudo Oficial Bomberos Rímac 21"
            className="brand-logo"
          />
          {!colapsado && (
            <div className="brand-info">
              <span className="org-name">
                Cía. de Bomberos
                <br />
                Rímac N.º 21
              </span>
              <span className="org-unit">Área de Instrucción</span>
            </div>
          )}
        </button>
      </div>

      {/* Navegación */}
      <nav className="r21-nav" aria-label="Navegación principal">
        {bloques.map((bloque, i) => (
          <Fragment key={i}>
            {bloque.seccion && (
              <div
                className="nav-section-title"
                title={colapsado ? bloque.seccion : undefined}
              >
                <span>{bloque.seccion}</span>
              </div>
            )}
            {bloque.items.map((item) => (
              <NavLink
                key={item.ruta}
                to={item.ruta}
                className="r21-nav-link"
                onClick={() => {
                  cerrarMenuUsuario();
                  onCerrar();
                }}
                title={colapsado ? item.etiqueta : undefined}
              >
                <i className={item.icono}></i>
                {!colapsado && <span>{item.etiqueta}</span>}
              </NavLink>
            ))}
          </Fragment>
        ))}
      </nav>

      {/* Pie con Menú Popover de Usuario */}
      {perfil && (
        <div className="r21-sidebar-footer">
          <Menu
            model={userMenuItems}
            popup
            ref={userMenuRef}
            id={isDesktop ? 'sidebar_user_menu_desktop' : 'sidebar_user_menu_mobile'}
            className={cx(
              'r21-user-popup-menu',
              colapsado ? 'menu-collapsed-mode' : 'menu-expanded-mode',
            )}
          />

          <button
            type="button"
            className="r21-user-trigger-btn"
            onClick={(e) => {
              e.stopPropagation();
              userMenuRef.current?.toggle(e);
            }}
            aria-haspopup="true"
            aria-controls={isDesktop ? 'sidebar_user_menu_desktop' : 'sidebar_user_menu_mobile'}
            title={
              colapsado
                ? `${perfil.persona.nombreCompleto} (${cargoPrincipal(perfil)})`
                : 'Opciones de usuario'
            }
          >
            <Avatar
              label={obtenerIniciales(perfil.persona.nombreCompleto)}
              shape="circle"
              className="user-avatar"
            />
            {!colapsado && (
              <>
                <div className="user-profile-text">
                  <div className="user-name" title={perfil.persona.nombreCompleto}>
                    {perfil.persona.nombreCompleto}
                  </div>
                  <div className="user-role">{cargoPrincipal(perfil)}</div>
                </div>
                <i className="pi pi-ellipsis-v menu-more-icon" />
              </>
            )}
          </button>
        </div>
      )}
      {/* Portal: la barra lateral puede tener transformaciones que confinan un position: fixed */}
      {cambiandoContrasena &&
        createPortal(<CambiarMiContrasena onCerrar={() => setCambiandoContrasena(false)} />, document.body)}
    </aside>
  );
}
