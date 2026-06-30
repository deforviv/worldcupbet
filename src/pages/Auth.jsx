import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, ChevronLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { API_URL, authFetchJson, setAuthSession } from '../config/api';

async function primeWalletSession() {
  try {
    await authFetchJson('/wallet', { timeoutMs: 25000 });
    window.dispatchEvent(new Event('wallet:changed'));
  } catch {
    // Wallet priming is best-effort; betting also credits the welcome bonus server-side.
  }
}
import './Auth.css';

/* ─────────────────────────────────────────────────────────────
   PASSWORD STRENGTH ENGINE
───────────────────────────────────────────────────────────── */
function calcStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6)  score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const levels = [
    { label: '',        color: '' },
    { label: 'Faible', color: '#ef4444' },
    { label: 'Moyen',  color: '#f59e0b' },
    { label: 'Bon',    color: '#3b82f6' },
    { label: 'Fort',   color: '#10b981' },
    { label: 'Excellent', color: '#10b981' },
  ];
  return { score, ...levels[score] };
}

/* ─────────────────────────────────────────────────────────────
   AUTH PAGE
───────────────────────────────────────────────────────────── */
export function Auth() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [isLogin, setIsLogin]   = useState(true);
  const [step, setStep]         = useState('form'); // 'form' | 'verify'

  // Form state
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [errors, setErrors]     = useState({});
  const [verifyNotice, setVerifyNotice] = useState('');
  const [loading, setLoading]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const strength = calcStrength(password);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(location.search);
      const mode = params.get('mode') || location.state?.mode;
      setIsLogin(mode !== 'register');
      setStep('form');
      setErrors({});
      setPassword('');
      setConfirmPassword('');
      setVerificationCode('');
      setAcceptedTerms(false);
      setVerifyNotice('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.search, location.state]);

  /* ── Validation ── */
  function validate() {
    const e = {};
    if (!isLogin && name.trim().length < 2)
      e.name = 'Le nom doit contenir au moins 2 caractères.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = 'Adresse e-mail invalide.';
    if (isLogin && password.length < 1)
      e.password = 'Mot de passe requis.';
    if (!isLogin && (password.length < 6 || password.length > 12))
      e.password = 'Le mot de passe doit contenir entre 6 et 12 caractères.';
    if (!isLogin && confirmPassword !== password)
      e.confirmPassword = 'Les mots de passe ne correspondent pas.';
    if (!isLogin && !acceptedTerms)
      e.acceptedTerms = 'Vous devez accepter les conditions.';
    return e;
  }

  function getApiError(data, fallback) {
    if (data?.details) {
      const fieldErrors = {};
      Object.entries(data.details).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          fieldErrors[key] = value[0];
        }
      });
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
        return null;
      }
    }

    return data?.error || fallback;
  }

  /* ── Submit ── */
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        // Frontend-only admin shortcut (no backend): credentials for admin
        const ADMIN_EMAIL = 'admin@worldcupbet.local';
        const ADMIN_PASSWORD = 'Admin@1234';
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
          // Create a local admin session and redirect to admin dashboard
          setAuthSession({ accessToken: 'local-admin-token', user: { id: 'admin', username: 'Administrator', email, role: 'ADMIN' } });
          await primeWalletSession();
          navigate('/admin');
          return;
        }
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Identifiants incorrects.');
        setAuthSession(data);
        await primeWalletSession();
        navigate('/profile');
      } else {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            confirmPassword,
            acceptedTerms,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const message = getApiError(data, 'Inscription impossible.');
          if (!message) return;
          throw new Error(message);
        }
        // Show email verification step
        setPassword('');
        setConfirmPassword('');
        setStep('verify');
      }
    } catch (err) {
      setErrors({ global: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(verificationCode)) {
      setErrors({ global: 'Saisissez le code à 6 chiffres reçu par e-mail.' });
      return;
    }

    setErrors({});
    setVerifyNotice('');
    setVerifying(true);

    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Code de confirmation invalide.');

      setAuthSession(data);
      await primeWalletSession();
      navigate('/profile');
    } catch (err) {
      setErrors({ global: err.message });
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendCode() {
    setErrors({});
    setVerifyNotice('');
    setResending(true);

    try {
      const res = await fetch(`${API_URL}/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Renvoi impossible.');
      setVerifyNotice('Un nouveau code vient d’être envoyé par e-mail.');
    } catch (err) {
      setErrors({ global: err.message });
    } finally {
      setResending(false);
    }
  }

  /* ── Email Verification Step ── */
  if (step === 'verify') {
    return (
      <div className="auth-layout">
        <LeftShowcase />
        <div className="auth-form-section">
          <div className="auth-form-wrapper">
            <div className="auth-verify-icon">
              <Mail size={40} />
            </div>
            <h2 className="auth-form-title">Vérifiez votre adresse e-mail</h2>
            <p className="auth-form-subtitle">
              Un code de confirmation a été envoyé à<br />
              <strong>{email}</strong>
            </p>
            {errors.global && (
              <div className="auth-error-banner">{errors.global}</div>
            )}
            {verifyNotice && (
              <div className="auth-success-banner">{verifyNotice}</div>
            )}
            <div className="auth-verify-steps">
              <div className="auth-verify-step">
                <CheckCircle size={18} className="step-check" />
                <span>Ouvrez votre boîte mail</span>
              </div>
              <div className="auth-verify-step">
                <CheckCircle size={18} className="step-check" />
                <span>Récupérez le code de confirmation</span>
              </div>
              <div className="auth-verify-step">
                <CheckCircle size={18} className="step-check" />
                <span>Revenez vous connecter</span>
              </div>
            </div>
            <form className="auth-form" onSubmit={handleVerifyCode}>
              <div className="input-group">
                <Mail size={18} className="input-icon" />
                <input
                  type="text"
                  className="auth-input auth-code-input"
                  placeholder="Code à 6 chiffres"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
              <button className="auth-submit-btn" type="submit" disabled={verifying}>
                {verifying
                  ? <span className="auth-spinner" />
                  : <>
                      <span>Valider mon compte</span>
                      <ArrowRight size={18} />
                    </>
                }
              </button>
            </form>
            <p className="auth-resend">
              Vous n'avez pas reçu d'e-mail ?{' '}
              <button className="auth-resend-btn" onClick={handleResendCode} disabled={resending}>
                {resending ? 'Envoi...' : 'Renvoyer'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <LeftShowcase />

      {/* RIGHT: Form */}
      <div className="auth-form-section">
        <div className="auth-form-wrapper">

          <Link to="/" className="auth-back-link">
            <ChevronLeft size={18} /> Retour à l'accueil
          </Link>

          <div className="auth-form-header">
            <h2 className="auth-form-title">{isLogin ? 'Bon retour 👋' : 'Créer un Compte'}</h2>
            <p className="auth-form-subtitle">
              {isLogin
                ? 'Accédez à votre tableau de bord VIP.'
                : 'Inscription rapide par e-mail — 100% gratuite.'}
            </p>
          </div>

          {errors.global && (
            <div className="auth-error-banner">{errors.global}</div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {!isLogin && (
              <div className={`input-group ${errors.name ? 'input-group--error' : ''}`}>
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Nom Complet"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                />
                {errors.name && <span className="input-error">{errors.name}</span>}
              </div>
            )}

            <div className={`input-group ${errors.email ? 'input-group--error' : ''}`}>
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                className="auth-input"
                placeholder="Adresse E-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
              {errors.email && <span className="input-error">{errors.email}</span>}
            </div>

            <div className={`input-group ${errors.password ? 'input-group--error' : ''}`}>
              <Lock size={18} className="input-icon" />
              <input
                type={showPwd ? 'text' : 'password'}
                className="auth-input auth-input--with-toggle"
                placeholder={isLogin ? 'Mot de passe' : 'Mot de passe (6 à 12 caractères)'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                maxLength={isLogin ? undefined : 12}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="input-pwd-toggle"
                onClick={() => setShowPwd(p => !p)}
                aria-label="Afficher le mot de passe"
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              {errors.password && <span className="input-error">{errors.password}</span>}
            </div>

            {!isLogin && (
              <div className={`input-group ${errors.confirmPassword ? 'input-group--error' : ''}`}>
                <Lock size={18} className="input-icon" />
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  className="auth-input auth-input--with-toggle"
                  placeholder="Confirmer mot de passe"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  maxLength={12}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="input-pwd-toggle"
                  onClick={() => setShowConfirmPwd(p => !p)}
                  aria-label="Afficher la confirmation du mot de passe"
                >
                  {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {errors.confirmPassword && <span className="input-error">{errors.confirmPassword}</span>}
              </div>
            )}

            {/* Password Strength Meter (register only) */}
            {!isLogin && password.length > 0 && (
              <div className="pwd-strength">
                <div className="pwd-strength-bars">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className="pwd-bar"
                      style={{
                        background: i <= strength.score ? strength.color : 'var(--border-color)',
                        transition: 'background 0.3s ease',
                      }}
                    />
                  ))}
                </div>
                <span className="pwd-strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}

            {!isLogin && (
              <label className={`auth-terms ${errors.acceptedTerms ? 'auth-terms--error' : ''}`}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                />
                <span>
                  J'accepte les conditions d'utilisation et la politique de confidentialité.
                </span>
                {errors.acceptedTerms && <span className="input-error">{errors.acceptedTerms}</span>}
              </label>
            )}

            {isLogin && (
              <div className="auth-forgot">
                <button type="button">Mot de passe oublié ?</button>
              </div>
            )}

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading
                ? <span className="auth-spinner" />
                : <>
                    <span>{isLogin ? 'Se Connecter' : 'Créer mon compte'}</span>
                    <ArrowRight size={18} />
                  </>
              }
            </button>
          </form>

          <div className="auth-footer">
            <span>
              {isLogin ? "Vous n'avez pas de compte ?" : 'Déjà inscrit ?'}
            </span>
            <button
              className="auth-switch-text"
              onClick={() => {
                setErrors({});
                setIsLogin(p => !p);
                setPassword('');
                setConfirmPassword('');
                setAcceptedTerms(false);
              }}
            >
              {isLogin ? "S'inscrire maintenant" : 'Se connecter'}
            </button>
          </div>

          <div className="auth-trust-footer">
            <span>🔞 +18</span>
            <span className="dot">•</span>
            <span>Jeu Responsable</span>
            <span className="dot">•</span>
            <span>🔒 SSL</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Extracted left panel for reuse */
function LeftShowcase() {
  return (
    <div className="auth-showcase">
      <div className="auth-showcase-overlay" />
      <div className="auth-showcase-content">
        <h1 className="showcase-title">
          Pariez sur les <span className="text-gradient">Champions</span><br />du Monde
        </h1>
        <p className="showcase-subtitle">
          Rejoignez +50 000 parieurs gagnants. Profitez des cotes les plus élevées du marché et d'un bonus exclusif de bienvenue de 50 000 EUR.
        </p>
        <div className="showcase-features">
          <div className="feature-item">
            <CheckCircle size={20} className="feature-icon" />
            <span>Retraits instantanés 24/7</span>
          </div>
          <div className="feature-item">
            <CheckCircle size={20} className="feature-icon" />
            <span>Cotes WorldCup boostées x2</span>
          </div>
          <div className="feature-item">
            <CheckCircle size={20} className="feature-icon" />
            <span>Paiement Crypto</span>
          </div>
        </div>
      </div>
    </div>
  );
}
