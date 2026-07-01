import { Link, useNavigate } from 'react-router-dom';
import {
  Wallet,
  Bell,
  Search,
  Trophy,
  ChevronDown,
  User,
  Sun,
  Moon,
  Menu,
  X,
  Radio,
  LogOut,
  Ticket,
  Gift,
  ShieldCheck,
  Settings,
  HelpCircle,
  CreditCard,
  History,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchModal } from './SearchModal';
import { authFetchJson } from '../config/api';
import { useAuthSession } from '../hooks/useAuthSession';
import { useWalletData } from '../hooks/useWalletData';
import { useMatchesData } from '../hooks/useMatchesData';
import './Navbar.css';

const ACCOUNT_LINKS = [
  { to: '/profile', label: 'Profil', meta: 'Compte, sécurité, limites', icon: User },
  { to: '/notifications', label: 'Notifications', meta: 'Alertes de compte', icon: Bell },
  { to: '/profile#settings', label: 'Paramètres', meta: 'Préférences du compte', icon: Settings },
  { to: '/wallet?tab=deposit', label: 'Dépôt', meta: 'Crypto', icon: CreditCard },
  { to: '/wallet?tab=withdraw', label: 'Retrait', meta: 'Demandes et destinations', icon: Wallet },
  { to: '/wallet?tab=history', label: 'Historique', meta: 'Transactions du portefeuille', icon: History },
  { to: '/bets', label: 'Mes paris', meta: 'Tickets ouverts et réglés', icon: Ticket },
  { to: '/#promotions', label: 'Bonus & VIP', meta: 'Offres et récompenses', icon: Gift },
  { to: '/profile#responsible', label: 'Jeu responsable', meta: 'Limites et protection', icon: ShieldCheck },
  { to: '/profile#support', label: 'Aide 24/7', meta: 'Support compte et paiements', icon: HelpCircle },
];

function formatBalance(wallet) {
  if (!wallet) return 'Solde';
  const amount = Number(wallet.balance || 0);
  return `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)}`;
}

function getInitials(user) {
  const source = user?.username || user?.email || 'U';
  return source
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'U';
}

export function Navbar() {
  const navigate = useNavigate();
  const profileMenuRef = useRef(null);
  const { token, user, isAuthenticated, logout } = useAuthSession();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return savedTheme === 'dark' || (!savedTheme && prefersDark);
  });
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { walletData } = useWalletData();
  const walletSummary = walletData?.wallet;
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { upcoming } = useMatchesData();

  const displayName = useMemo(() => {
    if (!user) return 'Mon compte';
    return user.username || user.email?.split('@')[0] || 'Mon compte';
  }, [user]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const timer = setInterval(() => setReferenceTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const liveCount = useMemo(() => {
    if (!Array.isArray(upcoming)) return 0;
    return upcoming.filter(m => {
      const kickoff = new Date(m.kickoffTime).getTime();
      return m.status === 'LIVE' || (m.status === 'SCHEDULED' && kickoff <= referenceTime);
    }).length;
  }, [upcoming, referenceTime]);

  useEffect(() => {
    let cancelled = false;


  }, [isAuthenticated, token]);

  useEffect(() => {
    let cancelled = false;

    async function fetchNotificationCount() {
      if (!isAuthenticated) {
        setUnreadNotifications(0);
        return;
      }

      try {
        const data = await authFetchJson('/notifications/count', { timeoutMs: 10000 });
        if (!cancelled) {
          setUnreadNotifications(data?.count || 0);
        }
      } catch {
        if (!cancelled) {
          setUnreadNotifications(0);
        }
      }
    }

    fetchNotificationCount();
    window.addEventListener('notification:changed', fetchNotificationCount);

    return () => {
      cancelled = true;
      window.removeEventListener('notification:changed', fetchNotificationCount);
    };
  }, [isAuthenticated, token]);

  const handleNotificationsClick = async () => {
    if (!isAuthenticated) return;
    navigate('/notifications');
  };

  const closeOnOutsideClick = (event) => {
    if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
      setProfileOpen(false);
    }
  };

  useEffect(() => {
    if (!profileOpen) return undefined;

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [profileOpen]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const closeMenus = () => {
    setMenuOpen(false);
    setProfileOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeMenus();
    navigate('/');
  };

  const handleNavClick = (e, targetId) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      if (targetId === 'root') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        closeMenus();
        return;
      }
      const el = document.getElementById(targetId);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
    closeMenus();
  };

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const renderAccountLink = (item, className = 'account-menu-link') => {
    const Icon = item.icon;
    return (
      <Link key={item.label} to={item.to} className={className} onClick={closeMenus}>
        <Icon size={18} />
        <span>
          <strong>{item.label}</strong>
          <small>{item.meta}</small>
        </span>
      </Link>
    );
  };

  return (
    <>
      <header className="navbar">
        <div className="container navbar-container">

          <div className="navbar-left">
            <Link to="/" className="navbar-logo" onClick={(e) => handleNavClick(e, 'root')}>
              <Trophy size={24} className="text-brand" />
              <span>WorldCupBet</span>
            </Link>
            <nav className="navbar-nav">
              <Link to="/" className="nav-link active" onClick={(e) => handleNavClick(e, 'sports')}>Sports</Link>
              <Link to="/#sports" className="nav-link nav-link--live" onClick={(e) => handleNavClick(e, 'sports')}>
                <Radio size={13} />
                En Direct
                {liveCount > 0 && (
                  <span className="live-count-badge">{liveCount}</span>
                )}
              </Link>
              <Link to="/#promotions" className="nav-link" onClick={(e) => handleNavClick(e, 'promotions')}>Promotions</Link>
              <Link to="/#promotions" className="nav-link text-gold" onClick={(e) => handleNavClick(e, 'promotions')}>VIP</Link>
            </nav>
          </div>

          <div className="navbar-right">
            {/* Icône Thème et Recherche : visibles sur desktop, Bell visible partout */}
            <div className="navbar-icons">
              <button className="icon-btn theme-toggle-btn desktop-only" aria-label="Changer de thème" onClick={toggleTheme}>
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button className="icon-btn desktop-only" aria-label="Recherche" onClick={() => setIsSearchOpen(true)}>
                <Search size={20} />
              </button>

              {isAuthenticated && (
                <button className="icon-btn notification-btn" aria-label="Notifications" onClick={handleNotificationsClick}>
                  <Bell size={20} />
                  {unreadNotifications > 0 && (
                    <span className="notification-badge">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </button>
              )}
            </div>

            {isAuthenticated ? (
              <>
                <div className="navbar-finance">
                  <Link to="/wallet" className="navbar-wallet">
                    <Wallet size={16} />
                    <span className="navbar-balance">{formatBalance(walletSummary)}</span>
                  </Link>
                  <Link to="/wallet?tab=deposit" onClick={closeMenus}>
                    <button className="navbar-deposit-btn">Dépôt</button>
                  </Link>
                </div>
                <div className="navbar-profile-wrap" ref={profileMenuRef}>
                  <button
                    className={`navbar-profile-modern ${profileOpen ? 'navbar-profile-modern--open' : ''}`}
                    onClick={() => setProfileOpen(open => !open)}
                    aria-haspopup="menu"
                    aria-expanded={profileOpen}
                  >
                    <div className="profile-avatar" aria-hidden="true">
                      <span>{getInitials(user)}</span>
                    </div>
                    <span className="navbar-profile-name">{displayName}</span>
                    <ChevronDown size={16} className="text-secondary" />
                  </button>

                  {profileOpen && (
                    <div className="account-menu" role="menu">
                      <div className="account-menu-header">
                        <div className="profile-avatar profile-avatar--large">
                          <span>{getInitials(user)}</span>
                        </div>
                        <div>
                          <strong>{displayName}</strong>
                          <span>{user?.email}</span>
                        </div>
                      </div>

                      <Link to="/wallet" className="account-menu-balance" onClick={closeMenus}>
                        <Wallet size={18} />
                        <span>
                          <small>Solde disponible</small>
                          <strong>{formatBalance(walletSummary)}</strong>
                        </span>
                      </Link>

                      <div className="account-menu-grid">
                        {ACCOUNT_LINKS.map(item => renderAccountLink(item))}
                      </div>

                      <button className="account-menu-link account-menu-logout" onClick={handleLogout}>
                        <LogOut size={18} />
                        <span>
                          <strong>Déconnexion</strong>
                          <small>Fermer la session</small>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="navbar-auth">
                <Link to="/auth" className="navbar-login-btn">Se connecter</Link>
                <Link to="/auth?mode=register" className="navbar-register-btn">S'inscrire</Link>
              </div>
            )}

            {/* Hamburger — visible seulement sur mobile/tablet */}
            <button
              className="navbar-hamburger"
              aria-label="Menu"
              onClick={() => setMenuOpen(o => !o)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Render the modal overlay if requested */}
        <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      </header>

      {/* ── Mobile Drawer ── */}
      <div className={`mobile-drawer ${menuOpen ? 'mobile-drawer--open' : ''}`}>
        <nav className="mobile-nav">
          <Link to="/" className="mobile-nav-link" onClick={(e) => handleNavClick(e, 'sports')}>
            Sports
          </Link>
          <Link to="/#sports" className="mobile-nav-link mobile-nav-link--live" onClick={(e) => handleNavClick(e, 'sports')}>
            <Radio size={16} />
            En Direct
            {liveCount > 0 && <span className="live-count-badge">{liveCount}</span>}
          </Link>
          <Link to="/#promotions" className="mobile-nav-link" onClick={(e) => handleNavClick(e, 'promotions')}>
            Promotions
          </Link>
          <Link to="/#promotions" className="mobile-nav-link mobile-nav-link--vip" onClick={(e) => handleNavClick(e, 'promotions')}>
            <Gift size={16} />
            VIP
          </Link>
        </nav>

        {isAuthenticated ? (
          <div className="mobile-account">
            <Link to="/profile" className="mobile-account-card" onClick={closeMenus}>
              <div className="profile-avatar profile-avatar--large">
                <span>{getInitials(user)}</span>
              </div>
              <span>
                <strong>{displayName}</strong>
                <small>{formatBalance(walletSummary)}</small>
              </span>
            </Link>
            <div className="mobile-account-links">
              {ACCOUNT_LINKS.map(item => renderAccountLink(item, 'mobile-account-link'))}
            </div>
            <button className="mobile-auth-login mobile-logout-btn" onClick={handleLogout}>
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
        ) : (
          <div className="mobile-drawer-auth">
            <Link to="/auth" className="mobile-auth-login" onClick={closeMenus}>Se connecter</Link>
            <Link to="/auth?mode=register" className="mobile-auth-register" onClick={closeMenus}>S'inscrire</Link>
          </div>
        )}

        <div className="mobile-drawer-footer">
          <button className="icon-btn theme-toggle-btn" onClick={toggleTheme}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            <span>{isDark ? 'Mode Clair' : 'Mode Sombre'}</span>
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div className="mobile-backdrop" onClick={() => setMenuOpen(false)} />
      )}
    </>
  );
}
