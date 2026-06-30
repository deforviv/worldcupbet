import { Trophy, Shield, Clock, Users } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: Users,  value: '127 450+', label: 'Parieurs Actifs' },
  { icon: Clock,  value: '< 24h',    label: 'Délai de Paiement' },
  { icon: Shield, value: '100%',     label: 'Sécurisé & Licencié' },
  { icon: Trophy, value: '50%',      label: 'Remboursement Garanti' },
];

export function TrustBar() {
  return (
    <div className="trust-bar">
      {TRUST_ITEMS.map((item) => (
        <div key={item.label} className="trust-item">
          <item.icon size={20} className="trust-icon" />
          <div className="trust-text">
            <span className="trust-value">{item.value}</span>
            <span className="trust-label">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
