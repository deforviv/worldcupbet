import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Trophy, Ticket, BookOpen, User } from 'lucide-react';
import { useBetSlip } from '../hooks/useBetSlip';
import { useAuthSession } from '../hooks/useAuthSession';
import { useState } from 'react';
import './MobileBottomNav.css';

export function MobileBottomNav({ onMenuOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { bets } = useBetSlip();
  const { isAuthenticated } = useAuthSession();
  const betCount = bets.length;

  const handleCouponClick = (e) => {
    e.preventDefault();
    // Fire custom event to open betslip on dashboard page
    window.dispatchEvent(new CustomEvent('openBetSlip'));
    // If not on dashboard, navigate there first
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => window.dispatchEvent(new CustomEvent('openBetSlip')), 300);
    }
  };

  const handleCompteClick = () => {
    if (isAuthenticated) {
      navigate('/profile');
    } else {
      navigate('/auth');
    }
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="Navigation mobile">
      {/* Menu */}
      <button
        className="mobile-bottom-nav__item"
        onClick={onMenuOpen}
        aria-label="Menu principal"
      >
        <Menu size={22} />
        <span>Menu</span>
      </button>

      {/* Sports */}
      <Link
        to="/"
        className={`mobile-bottom-nav__item ${isActive('/') ? 'mobile-bottom-nav__item--active' : ''}`}
        aria-label="Sports"
        onClick={(e) => {
          if (location.pathname === '/') {
            e.preventDefault();
            const el = document.getElementById('sports');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      >
        <Trophy size={22} />
        <span>Sports</span>
      </Link>

      {/* Coupon / BetSlip */}
      <button
        className={`mobile-bottom-nav__item mobile-bottom-nav__item--coupon ${betCount > 0 ? 'mobile-bottom-nav__item--has-bets' : ''}`}
        onClick={handleCouponClick}
        aria-label={`Coupon${betCount > 0 ? ` (${betCount})` : ''}`}
      >
        <div className="mobile-bottom-nav__coupon-icon">
          <BookOpen size={22} />
          {betCount > 0 && (
            <span className="mobile-bottom-nav__badge">{betCount > 9 ? '9+' : betCount}</span>
          )}
        </div>
        <span>Coupon</span>
      </button>

      {/* Mes Paris */}
      <Link
        to="/bets"
        className={`mobile-bottom-nav__item ${isActive('/bets') ? 'mobile-bottom-nav__item--active' : ''}`}
        aria-label="Mes paris"
      >
        <Ticket size={22} />
        <span>Mes paris</span>
      </Link>

      {/* Compte */}
      <button
        className={`mobile-bottom-nav__item ${isActive('/profile') || isActive('/auth') ? 'mobile-bottom-nav__item--active' : ''}`}
        onClick={handleCompteClick}
        aria-label="Mon compte"
      >
        <User size={22} />
        <span>Compte</span>
      </button>
    </nav>
  );
}
