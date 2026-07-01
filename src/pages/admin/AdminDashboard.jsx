import { useCallback, useEffect, useState } from 'react';
import { authFetchJson, API_URL, clearAuthSession } from '../../config/api';
import './AdminDashboard.css';

/* ─── helpers ─────────────────────────────────────────── */
const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
const fmtDate = (d) => d ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—';

const STATUS_LABELS = { PENDING: 'En attente', APPROVED: 'Approuvé', REJECTED: 'Refusé' };
const STATUS_CLASS  = { PENDING: 'badge--pending', APPROVED: 'badge--approved', REJECTED: 'badge--rejected' };

function Badge({ status }) {
  return <span className={`admin-badge ${STATUS_CLASS[status] || ''}`}>{STATUS_LABELS[status] || status}</span>;
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`admin-stat-card ${accent ? 'admin-stat-card--accent' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/* ─── Screenshot modal ────────────────────────────────── */
function ScreenshotModal({ url, onClose }) {
  if (!url) return null;
  // Cloudinary URLs are already absolute (https://res.cloudinary.com/...)
  const fullUrl = url;
  const filename = url.split('/').pop().split('?')[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Capture du paiement</span>
          <div className="modal-actions">
            <a
              href={fullUrl}
              download={filename}
              className="admin-btn admin-btn--primary"
              target="_blank"
              rel="noreferrer"
            >
              ⬇ Télécharger
            </a>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <img src={fullUrl} alt="Capture de paiement" className="modal-img" />
        </div>
        <div className="modal-footer">
          <a href={fullUrl} target="_blank" rel="noreferrer" className="modal-link">
            Ouvrir en plein écran ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Main dashboard ──────────────────────────────────── */
export function AdminDashboard() {
  const [users, setUsers]           = useState([]);
  const [deposits, setDeposits]     = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [notice, setNotice]         = useState('');
  const [error, setError]           = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [activeTab, setActiveTab]   = useState('deposits');
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const pendingDeposits    = deposits.filter(d => d.status === 'PENDING');
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');
  const totalUsers         = users.length;
  const totalBalance       = users.reduce((s, u) => s + Number(u.wallet?.balance || 0), 0);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersData, withdrawalsData, depositsData] = await Promise.all([
        authFetchJson('/admin/users'),
        authFetchJson('/admin/withdrawals'),
        authFetchJson('/admin/deposit-requests'),
      ]);
      setUsers(usersData);
      setWithdrawals(withdrawalsData);
      setDeposits(depositsData);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(err.message || 'Impossible de charger les données administrateur.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Admin — WorldCupBet';
    loadAdminData();
    const id = window.setInterval(loadAdminData, 20000);
    return () => window.clearInterval(id);
  }, [loadAdminData]);

  function toast(msg, isError = false) {
    if (isError) setError(msg);
    else { setNotice(msg); setTimeout(() => setNotice(''), 4000); }
  }

  function handleLogout() {
    // clearAuthSession supprime TOUTES les clés et dispatche auth:changed
    // pour synchroniser immédiatement tous les composants abonnés (Navbar, etc.)
    clearAuthSession();
    // Redirection vers la page de connexion pour éviter l'état intermédiaire
    window.location.replace('/auth?mode=login');
  }

  async function handleDeposit(id, status) {
    setActionLoading(id + status);
    setError('');
    try {
      await authFetchJson(`/admin/deposit-requests/${id}`, { method: 'PATCH', body: { status } });
      toast(status === 'APPROVED' ? '✓ Dépôt approuvé et solde crédité.' : '✓ Dépôt refusé.');
      await loadAdminData();
    } catch (err) {
      toast(err.message || 'Erreur lors du traitement.', true);
    } finally {
      setActionLoading('');
    }
  }

  async function handleWithdrawal(id, status) {
    setActionLoading(id + status);
    setError('');
    try {
      await authFetchJson(`/admin/withdrawals/${id}`, { method: 'PATCH', body: { status } });
      toast(status === 'APPROVED' ? '✓ Retrait approuvé.' : '✓ Retrait refusé et fonds remboursés.');
      await loadAdminData();
    } catch (err) {
      toast(err.message || 'Erreur lors du traitement.', true);
    } finally {
      setActionLoading('');
    }
  }

  // Cloudinary URLs are already absolute (https://res.cloudinary.com/...)
  const buildScreenshotUrl = (url) => url || null;

  /* ─── TABS ──────────────────────────────────────────── */
  const TABS = [
    { id: 'deposits',    label: 'Dépôts',   badge: pendingDeposits.length    },
    { id: 'withdrawals', label: 'Retraits', badge: pendingWithdrawals.length  },
    { id: 'users',       label: 'Utilisateurs', badge: 0                      },
  ];

  return (
    <div className="admin-page">
      {/* TOP BAR */}
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <div className="admin-brand">
            <span className="admin-brand-icon">⚡</span>
            <span className="admin-brand-name">WorldCupBet Admin</span>
          </div>
          <h1 className="admin-title">Tableau de bord</h1>
          {lastRefreshedAt && (
            <div className="admin-subtitle">
              Actualisé à {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastRefreshedAt)}
            </div>
          )}
        </div>
        <div className="admin-topbar-actions">
          <button className="admin-btn admin-btn--outline" onClick={loadAdminData} disabled={loading}>
            {loading ? '⟳ Chargement...' : '⟳ Rafraîchir'}
          </button>
          <button className="admin-btn admin-btn--danger" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </div>

      <div className="admin-container">
        {/* BANNERS */}
        {error  && <div className="admin-banner admin-banner--error">{error}</div>}
        {notice && <div className="admin-banner admin-banner--success">{notice}</div>}

        {/* STAT CARDS */}
        <div className="admin-stats">
          <StatCard label="Utilisateurs" value={totalUsers} sub="Inscrits" />
          <StatCard label="Solde total" value={fmt(totalBalance)} sub="Toutes les wallets" accent />
          <StatCard label="Dépôts en attente" value={pendingDeposits.length} sub="À traiter" />
          <StatCard label="Retraits en attente" value={pendingWithdrawals.length} sub="À traiter" />
        </div>

        {/* TABS */}
        <div className="admin-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`admin-tab ${activeTab === tab.id ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.badge > 0 && <span className="tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* ── DEPOSITS TAB ────────────────────────────────── */}
        {activeTab === 'deposits' && (
          <div className="admin-panel">
            <div className="panel-header">
              <h2 className="panel-title">Demandes de dépôt</h2>
              <span className="panel-count">{deposits.length} total</span>
            </div>
            {deposits.length === 0 && !loading && (
              <div className="admin-empty">Aucune demande de dépôt.</div>
            )}
            <div className="admin-cards-list">
              {deposits.map(d => {
                const isPending = d.status === 'PENDING';
                const screenshotFull = buildScreenshotUrl(d.screenshotUrl);
                return (
                  <div key={d.id} className={`deposit-card ${!isPending ? 'deposit-card--settled' : ''}`}>
                    <div className="deposit-card-left">
                      {/* Screenshot thumbnail */}
                      <div className="screenshot-thumb-wrap">
                        {screenshotFull ? (
                          <button
                            className="screenshot-thumb"
                            onClick={() => setScreenshotUrl(d.screenshotUrl)}
                            title="Voir la capture"
                          >
                            <img src={screenshotFull} alt="Capture" />
                            <span className="thumb-overlay">👁 Voir</span>
                          </button>
                        ) : (
                          <div className="screenshot-thumb screenshot-thumb--empty">
                            <span>Pas de capture</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="deposit-card-body">
                      <div className="deposit-card-row">
                        <div>
                          <div className="deposit-card-user">{d.user?.username || d.user?.email || 'Utilisateur'}</div>
                          <div className="deposit-card-email">{d.user?.email}</div>
                        </div>
                        <Badge status={d.status} />
                      </div>

                      <div className="deposit-card-meta">
                        <div className="meta-item">
                          <span className="meta-label">Montant</span>
                          <span className="meta-value meta-value--amount">{fmt(d.amount)}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Méthode</span>
                          <span className="meta-value">{d.method || '—'}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Référence</span>
                          <span className="meta-value meta-value--mono">{d.reference || '—'}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Date</span>
                          <span className="meta-value">{fmtDate(d.createdAt)}</span>
                        </div>
                      </div>

                      {/* Capture action row */}
                      {screenshotFull && (
                        <div className="deposit-card-capture">
                          <button
                            className="admin-btn admin-btn--ghost"
                            onClick={() => setScreenshotUrl(d.screenshotUrl)}
                          >
                            👁 Voir la capture
                          </button>
                          <a
                            href={screenshotFull}
                            download={d.screenshotUrl?.split('/').pop()}
                            className="admin-btn admin-btn--ghost"
                            target="_blank"
                            rel="noreferrer"
                          >
                            ⬇ Télécharger
                          </a>
                        </div>
                      )}

                      {isPending && (
                        <div className="deposit-card-actions">
                          <button
                            className="admin-btn admin-btn--approve"
                            disabled={!!actionLoading}
                            onClick={() => handleDeposit(d.id, 'APPROVED')}
                          >
                            {actionLoading === d.id + 'APPROVED' ? '...' : '✓ Approuver'}
                          </button>
                          <button
                            className="admin-btn admin-btn--reject"
                            disabled={!!actionLoading}
                            onClick={() => handleDeposit(d.id, 'REJECTED')}
                          >
                            {actionLoading === d.id + 'REJECTED' ? '...' : '✕ Refuser'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── WITHDRAWALS TAB ─────────────────────────────── */}
        {activeTab === 'withdrawals' && (
          <div className="admin-panel">
            <div className="panel-header">
              <h2 className="panel-title">Demandes de retrait</h2>
              <span className="panel-count">{withdrawals.length} total</span>
            </div>
            {withdrawals.length === 0 && !loading && (
              <div className="admin-empty">Aucune demande de retrait.</div>
            )}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Montant</th>
                    <th>Méthode</th>
                    <th>Destination</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id} className={w.status !== 'PENDING' ? 'row--settled' : ''}>
                      <td>
                        <div className="table-user">{w.user?.username || 'N/A'}</div>
                        <div className="table-email">{w.user?.email}</div>
                      </td>
                      <td className="td-amount">{fmt(w.amount)}</td>
                      <td>{w.method || '—'}</td>
                      <td className="td-mono">
                        <div className="copy-wrapper">
                          <span className="copy-text" title={w.destination}>{w.destination || '—'}</span>
                          {w.destination && (
                            <button
                              className="copy-btn"
                              onClick={() => {
                                navigator.clipboard.writeText(w.destination);
                                toast('✓ Adresse copiée dans le presse-papier !');
                              }}
                              title="Copier"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{fmtDate(w.createdAt)}</td>
                      <td><Badge status={w.status} /></td>
                      <td>
                        {w.status === 'PENDING' ? (
                          <div className="table-actions">
                            <button
                              className="admin-btn admin-btn--approve admin-btn--sm"
                              disabled={!!actionLoading}
                              onClick={() => handleWithdrawal(w.id, 'APPROVED')}
                            >
                              {actionLoading === w.id + 'APPROVED' ? '...' : '✓'}
                            </button>
                            <button
                              className="admin-btn admin-btn--reject admin-btn--sm"
                              disabled={!!actionLoading}
                              onClick={() => handleWithdrawal(w.id, 'REJECTED')}
                            >
                              {actionLoading === w.id + 'REJECTED' ? '...' : '✕'}
                            </button>
                          </div>
                        ) : (
                          <span className="td-settled">{STATUS_LABELS[w.status]}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS TAB ───────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="admin-panel">
            <div className="panel-header">
              <h2 className="panel-title">Utilisateurs</h2>
              <span className="panel-count">{users.length} inscrits</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Paris</th>
                    <th>Solde</th>
                    <th>Inscrit le</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="table-user-name">{u.username || '—'}</td>
                      <td className="table-email">{u.email}</td>
                      <td>
                        <span className={`admin-badge ${u.role === 'ADMIN' ? 'badge--admin' : 'badge--user'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u._count?.bets ?? 0}</td>
                      <td className="td-amount">{fmt(u.wallet?.balance)}</td>
                      <td>{fmtDate(u.createdAt)}</td>
                      <td>
                        <span className={`admin-badge ${u.isActive ? 'badge--approved' : 'badge--rejected'}`}>
                          {u.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SCREENSHOT MODAL */}
      {screenshotUrl && (
        <ScreenshotModal url={screenshotUrl} onClose={() => setScreenshotUrl(null)} />
      )}
    </div>
  );
}

export default AdminDashboard;
