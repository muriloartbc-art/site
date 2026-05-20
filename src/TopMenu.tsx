import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface TopMenuProps {
  currentView: 'landing' | 'gallery' | 'editor' | 'catalogo' | 'video';
  onNavigate: (view: 'landing' | 'gallery' | 'catalogo' | 'video') => void;
}

export default function TopMenu({ currentView, onNavigate }: TopMenuProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigation = (view: 'landing' | 'gallery' | 'catalogo' | 'video') => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  const isActive = (view: string) => currentView === view;

  const navItems = [
    { label: 'Início', view: 'landing' as const },
    { label: 'Imagens', view: 'gallery' as const },
    { label: 'Catálogo', view: 'catalogo' as const },
    { label: 'Vídeo', view: 'video' as const },
  ];

  return (
    <>
      {/* Desktop Menu */}
      <nav className="top-menu">
        <div className="top-menu-container">
          {/* Logo */}
          <div className="menu-logo-wrap">
            <img src="/logo.png" alt="Luci Luci" className="menu-logo" />
          </div>

          {/* Desktop Nav */}
          <div className="menu-nav-desktop">
            {navItems.map(item => (
              <button
                key={item.view}
                className={`menu-link ${isActive(item.view) ? 'menu-link--active' : ''}`}
                onClick={() => handleNavigation(item.view)}
                aria-label={item.label}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="menu-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X size={24} strokeWidth={1.5} />
            ) : (
              <Menu size={24} strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Menu Divider */}
        <div className="top-menu-divider" />

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="menu-nav-mobile">
            {navItems.map(item => (
              <button
                key={item.view}
                className={`menu-link-mobile ${isActive(item.view) ? 'menu-link-mobile--active' : ''}`}
                onClick={() => handleNavigation(item.view)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Spacer to account for fixed menu */}
      <div className="top-menu-spacer" />
    </>
  );
}
