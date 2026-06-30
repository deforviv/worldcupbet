import { Gift, Percent, Zap, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Promotions.css';

const PROMOS = [
  {
    id: 1,
    icon: Gift,
    tag: 'Nouveaux membres',
    title: 'Bonus de Bienvenue',
    description: 'Votre 1er dépôt est doublé jusqu\'à 50 000 EUR. Commencez à gagner dès aujourd\'hui.',
    cta: 'Récupérer le bonus',
    color: 'brand',
    image: '/promo-bonus.png',
  },
  {
    id: 2,
    icon: Percent,
    tag: 'Garanti',
    title: 'Remboursement 50%',
    description: 'Sur chaque pari perdant, WorldCupBet vous rembourse systématiquement 50% de votre mise.',
    cta: 'En savoir plus',
    color: 'gold',
    image: '/promo-refund.png',
  },
  {
    id: 3,
    icon: Zap,
    tag: 'VIP',
    title: 'Cotes Boostées',
    description: 'Accédez chaque jour à des cotes exclusives boostées sur les grands matchs de la Coupe du Monde.',
    cta: 'Voir les boosts',
    color: 'blue',
    image: '/promo-boost.png',
  },
];

export function Promotions() {
  return (
    <section className="promos-section">
      <div className="section-header">
        <h2 className="section-title">Promotions &amp; Bonus</h2>
        <Link to="/auth" className="section-link">Toutes les offres →</Link>
      </div>
      <div className="promos-grid">
        {PROMOS.map((promo) => {
          const Icon = promo.icon;
          return (
        <Link
              key={promo.id}
              to="/auth"
              className={`promo-card promo-card--${promo.color}`}
              style={{ backgroundImage: `url(${promo.image})` }}
            >
              {/* Dark overlay for readability */}
              <div className={`promo-overlay promo-overlay--${promo.color}`} />

              {/* Watermark icon */}
              <div className="promo-watermark">
                <Icon strokeWidth={1} />
              </div>
              
              <div className="promo-content">
                <div className="promo-card-top">
                  <span className="promo-tag">{promo.tag}</span>
                  <div className={`promo-icon-wrap promo-icon-wrap--${promo.color}`}>
                    <Icon size={24} strokeWidth={2.5} />
                  </div>
                </div>
                
                <h3 className="promo-title">{promo.title}</h3>
                <p className="promo-desc">{promo.description}</p>
                
                <div className={`promo-cta promo-cta--${promo.color}`}>
                  <span>{promo.cta}</span>
                  <ChevronRight size={18} strokeWidth={3} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
