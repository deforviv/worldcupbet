import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CreditCard,
  Gift,
  HelpCircle,
  Lock,
  ShieldCheck,
  Ticket,
  User,
  Wallet,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { authFetchJson, getAuthToken, getStoredUser } from '../config/api';
import './Profile.css';

const DEFAULT_PREFS = {
  emailAlerts: true,
  smsAlerts: false,
  oddsFormat: 'decimal',
  dailyLimit: '10000',
  weeklyLimit: '50000',
};

function formatAmount(amount) {
  return `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount || 0))}`;
}

function readPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('accountPrefs') || '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function Profile() {
  const navigate = useNavigate();
  const storedUser = getStoredUser();
  const [user, setUser] = useState(storedUser || null);
  const [wallet, setWallet] = useState(null);
  const [bets, setBets] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingBets, setLoadingBets] = useState(true);
  const [error, setError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [profileForm, setProfileForm] = useState({
    username: storedUser?.username || '',
    email: storedUser?.email || '',
  });
  const [prefs, setPrefs] = useState(readPrefs);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/auth?mode=login', { replace: true });
      return;
    }

    let cancelled = false;

    const syncStoredUser = () => {
      const currentStoredUser = getStoredUser();
      if (currentStoredUser && !cancelled) {
        setUser(currentStoredUser);
        setProfileForm({
          username: currentStoredUser.username || '',
          email: currentStoredUser.email || '',
        });
      }
    };

    async function refreshWallet() {
      setLoadingWallet(true);
      try {
        const walletData = await authFetchJson('/wallet', { timeoutMs: 25000 });
        if (!cancelled) {
          setWallet(walletData?.wallet || null);
        }
      } catch (err) {
        if (!cancelled) {
          if (err.status === 401) {
            navigate('/auth?mode=login', { replace: true });
            return;
          }
          const errMsg = err?.message || 'Impossible de charger le portefeuille.';
          // eslint-disable-next-line no-console
          console.error('[Profile] refreshWallet error', err);
          setError(errMsg);
        }
      } finally {
        if (!cancelled) {
          setLoadingWallet(false);
        }
      }
    }

    async function refreshBets() {
      setLoadingBets(true);
      try {
        const betsData = await authFetchJson('/bets?limit=50');
        if (!cancelled) {
          setBets(betsData?.bets || []);
          setCoupons(betsData?.coupons || []);
        }
      } catch (err) {
        if (!cancelled) {
          if (err.status === 401) {
            navigate('/auth?mode=login', { replace: true });
            return;
          }
          setError('Impossible de charger les paris.');
        }
      } finally {
        if (!cancelled) {
          setLoadingBets(false);
        }
      }
    }

    async function loadProfile() {
      setLoadingProfile(true);
      setError('');

      try {
        const meData = await authFetchJson('/auth/me', { cacheMs: 0 });
        if (!cancelled) {
          const fetchedUser = meData?.user || null;
          if (fetchedUser) {
            setUser(fetchedUser);
            setProfileForm({
              username: fetchedUser.username || '',
              email: fetchedUser.email || '',
            });
            localStorage.setItem('user', JSON.stringify(fetchedUser));
            window.dispatchEvent(new Event('auth:changed'));
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (err.status === 401) {
            navigate('/auth?mode=login', { replace: true });
            return;
          }
          setError(err.message || 'Impossible de charger le profil.');
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    syncStoredUser();
    loadProfile();
    refreshWallet();
    refreshBets();

    window.addEventListener('wallet:changed', refreshWallet);
    window.addEventListener('bets:changed', refreshBets);
    window.addEventListener('auth:changed', syncStoredUser);

    return () => {
      cancelled = true;
      window.removeEventListener('wallet:changed', refreshWallet);
      window.removeEventListener('bets:changed', refreshBets);
      window.removeEventListener('auth:changed', syncStoredUser);
    };
  }, [navigate]);

  const openBets = useMemo(() => {
    const pendingBets = bets.filter(bet => bet.status === 'PENDING').length;
    const pendingCoupons = coupons.filter(coupon => coupon.status === 'PENDING').length;
    return pendingBets + pendingCoupons;
  }, [bets, coupons]);

  const updateProfileForm = (key, value) => {
    setProfileForm(prev => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileError('');
    setProfileNotice('');

    try {
      const payload = {};
      if (profileForm.username.trim() && profileForm.username.trim() !== user.username) {
        payload.username = profileForm.username.trim();
      }
      if (profileForm.email.trim() && profileForm.email.trim() !== user.email) {
        payload.email = profileForm.email.trim();
      }

      if (Object.keys(payload).length === 0) {
        setProfileNotice('Aucune modification détectée.');
        setProfileSaving(false);
        return;
      }

      const data = await authFetchJson('/auth/me', {
        method: 'PATCH',
        body: payload,
      });
      const updatedUser = data?.user;
      if (updatedUser) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('auth:changed'));
        setUser(updatedUser);
        setProfileForm({
          username: updatedUser.username || '',
          email: updatedUser.email || '',
        });
        setProfileNotice('Profil mis à jour avec succès.');
      }
    } catch (err) {
      setProfileError(err.message || 'Impossible de mettre à jour le profil.');
    } finally {
      setProfileSaving(false);
    }
  };

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem('accountPrefs', JSON.stringify(next));
    setSaved('Préférences enregistrées.');
    window.setTimeout(() => setSaved(''), 1800);
  }

  return (
    <div className="container profile-page">
      <section className="profile-header">
        <div>
          <span className="profile-kicker">Espace joueur</span>
          <h1>Bonjour, {user?.username || 'parieur'}.</h1>
          <p>Gérez votre compte, votre portefeuille, vos paris et vos protections de jeu au même endroit.</p>
        </div>
        <div className="profile-header-actions">
          <Link to="/wallet?tab=deposit">
            <Button variant="primary"><CreditCard size={16} /> Dépôt</Button>
          </Link>
          <Link to="/bets">
            <Button variant="outline"><Ticket size={16} /> Mes paris</Button>
          </Link>
        </div>
      </section>

      {error && <div className="profile-alert">{error}</div>}

      <section className="profile-stats">
        <Card className="profile-stat-card">
          <Wallet size={22} />
          <span>Solde disponible</span>
          <strong>{loadingWallet ? '...' : formatAmount(wallet?.balance)}</strong>
        </Card>
        <Card className="profile-stat-card">
          <Ticket size={22} />
          <span>Paris en cours</span>
          <strong>{loadingBets ? '...' : openBets}</strong>
        </Card>
        <Card className="profile-stat-card">
          <ShieldCheck size={22} />
          <span>Compte validé</span>
          <strong>{user?.emailVerified ? 'Oui' : 'Non'}</strong>
        </Card>
        <Card className="profile-stat-card">
          <Gift size={22} />
          <span>Statut VIP</span>
          <strong>Standard</strong>
        </Card>
      </section>

      <section className="profile-grid">
        <Card className="profile-panel">
          <div className="profile-panel-title">
            <User size={20} />
            <h2>Informations du profil</h2>
          </div>
          <div className="profile-info-list">
            <div className="profile-edit-row">
              <label>Nom utilisateur</label>
              <Input
                value={profileForm.username}
                onChange={e => updateProfileForm('username', e.target.value)}
                placeholder="Nom d'utilisateur"
              />
            </div>
            <div className="profile-edit-row">
              <label>E-mail</label>
              <Input
                value={profileForm.email}
                onChange={e => updateProfileForm('email', e.target.value)}
                placeholder="email@example.com"
                type="email"
              />
            </div>
            <div>
              <span>Rôle</span>
              <strong>{user?.role || 'USER'}</strong>
            </div>
          </div>
          {(profileError || profileNotice) && (
            <div className={`profile-alert ${profileError ? 'profile-alert--error' : 'profile-alert--success'}`}>
              {profileError || profileNotice}
            </div>
          )}
          <Button variant="primary" onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </Card>

        <Card className="profile-panel" id="settings">
          <div className="profile-panel-title">
            <Bell size={20} />
            <h2>Paramètres</h2>
          </div>
          <div className="profile-settings">
            <label className="profile-toggle">
              <input
                type="checkbox"
                checked={prefs.emailAlerts}
                onChange={e => updatePref('emailAlerts', e.target.checked)}
              />
              <span>Alertes e-mail pour les tickets et paiements</span>
            </label>
            <label className="profile-toggle">
              <input
                type="checkbox"
                checked={prefs.smsAlerts}
                onChange={e => updatePref('smsAlerts', e.target.checked)}
              />
              <span>Alertes SMS (Crypto)</span>
            </label>
            <label className="profile-select-row">
              <span>Format des cotes</span>
              <select
                value={prefs.oddsFormat}
                onChange={e => updatePref('oddsFormat', e.target.value)}
              >
                <option value="decimal">Décimal</option>
                <option value="fractional">Fractionnaire</option>
                <option value="american">Américain</option>
              </select>
            </label>
            {saved && <div className="profile-save-note">{saved}</div>}
          </div>
        </Card>

        <Card className="profile-panel" id="responsible">
          <div className="profile-panel-title">
            <ShieldCheck size={20} />
            <h2>Jeu responsable</h2>
          </div>
          <div className="profile-limit-form">
            <div className="profile-info-list">
              <div>
                <span>Limite journalière (EUR)</span>
                <strong>10 000</strong>
              </div>
              <div>
                <span>Limite hebdomadaire (EUR)</span>
                <strong>50 000</strong>
              </div>
            </div>
            <p>Valeurs affichées à titre indicatif seulement ; elles ne sont pas appliquées au profil.</p>
          </div>
        </Card>

        <Card className="profile-panel" id="support">
          <div className="profile-panel-title">
            <HelpCircle size={20} />
            <h2>Support & sécurité</h2>
          </div>
          <div className="profile-action-list">
            <Link to="/wallet?tab=history"><CreditCard size={18} /> Paiements et transactions</Link>
            <Link to="/bets"><Ticket size={18} /> Tickets et résultats</Link>
            <a href="mailto:deforkoss@gmail.com"><HelpCircle size={18} /> Contacter le support</a>
            <span><Lock size={18} /> Connexion sécurisée par e-mail validé</span>
          </div>
        </Card>
      </section>
    </div>
  );
}
