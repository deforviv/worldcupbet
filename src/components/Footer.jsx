import { Link } from 'react-router-dom';
import { Trophy, Shield, Heart } from 'lucide-react';
import './Footer.css';

const PAYMENT_METHODS = [
  { name: 'Orange Money', abbr: 'OM' },
  { name: 'Wave',         abbr: 'WV' },
  { name: 'Moov Money',   abbr: 'MM' },
  { name: 'Visa',         abbr: 'VISA' },
  { name: 'Mastercard',   abbr: 'MC' },
  { name: 'USDT',         abbr: 'USDT' },
];

const FacebookIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>;
const InstagramIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>;
const TwitterIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5 5 12 5 12c.5.4 1.4.3 2 .1-2.3-1.5-3-4-3-4 .5.5 1.5.7 2.2.5C4 6.5 6 4 6 4c3.2 3.8 8 6 13 6 0-1.5 1-3 3-3z"></path></svg>;

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="container footer-top-inner">

          {/* Brand */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <Trophy size={22} />
              <span>WorldCupBet</span>
            </Link>
            <p className="footer-tagline">
              La plateforme de paris sportifs de référence pour la Coupe du Monde 2026.
              Paris sécurisés, cotes compétitives, remboursement garanti.
            </p>
            <div className="footer-socials">
              <a href="#" aria-label="Facebook"  className="social-btn"><FacebookIcon /></a>
              <a href="#" aria-label="Instagram" className="social-btn"><InstagramIcon /></a>
              <a href="#" aria-label="Twitter"   className="social-btn"><TwitterIcon /></a>
            </div>
          </div>

          {/* Navigation */}
          <div className="footer-nav-group">
            <h4 className="footer-nav-title">Paris</h4>
            <ul className="footer-nav-list">
              <li><Link to="/">Matchs du Jour</Link></li>
              <li><Link to="/">À Venir</Link></li>
              <li><Link to="/">Résultats</Link></li>
              <li><Link to="/">Cotes Boostées</Link></li>
            </ul>
          </div>

          <div className="footer-nav-group">
            <h4 className="footer-nav-title">Compte</h4>
            <ul className="footer-nav-list">
              <li><Link to="/auth">Se Connecter</Link></li>
              <li><Link to="/auth">S'inscrire</Link></li>
              <li><Link to="/wallet">Portefeuille</Link></li>
              <li><Link to="/">Promotions</Link></li>
            </ul>
          </div>

          <div className="footer-nav-group">
            <h4 className="footer-nav-title">Aide</h4>
            <ul className="footer-nav-list">
              <li><a href="#">Centre d'aide</a></li>
              <li><a href="#">Conditions d'utilisation</a></li>
              <li><a href="#">Politique de Confidentialité</a></li>
              <li><a href="#">Nous contacter</a></li>
            </ul>
          </div>

        </div>
      </div>

      {/* Payment methods */}
      <div className="footer-payments">
        <div className="container footer-payments-inner">
          <span className="footer-payments-label">Méthodes de paiement acceptées :</span>
          <div className="payment-logos">
            {PAYMENT_METHODS.map((m) => (
              <span key={m.abbr} className="payment-chip" title={m.name}>{m.abbr}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <div className="footer-legal">
            <span className="badge-18">18+</span>
            <Shield size={14} />
            <span>Jeu responsable — Interdits aux mineurs</span>
          </div>
          <p className="footer-copy">
            © {new Date().getFullYear()} WorldCupBet. Tous droits réservés.
            Licencié et réglementé. Pariez responsablement.
          </p>
          <a href="#" className="footer-responsible">
            <Heart size={13} /> Aide au jeu responsable
          </a>
        </div>
      </div>
    </footer>
  );
}
