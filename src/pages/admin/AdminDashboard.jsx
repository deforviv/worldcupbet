import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { authFetchJson } from '../../config/api';
import './AdminDashboard.css';

function Stat({ label, value }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

export function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const totalUsers = users.length;
  const totalBalance = users.reduce((sum, user) => sum + Number(user.wallet?.balance || 0), 0);

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

    const intervalId = window.setInterval(loadAdminData, 15000);
    return () => window.clearInterval(intervalId);
  }, [loadAdminData]);

  function showNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 4000);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  async function approveDeposit(id) {
    setError('');
    try {
      await authFetchJson(`/admin/deposit-requests/${id}`, {
        method: 'PATCH',
        body: { status: 'APPROVED' },
      });
      showNotice('Dépôt approuvé.');
      await loadAdminData();
    } catch (err) {
      setError(err.message || 'Impossible d\'approuver le dépôt.');
    }
  }

  async function approveWithdrawal(id) {
    setError('');
    try {
      await authFetchJson(`/admin/withdrawals/${id}`, {
        method: 'PATCH',
        body: { status: 'APPROVED' },
      });
      showNotice('Retrait approuvé.');
      await loadAdminData();
    } catch (err) {
      setError(err.message || 'Impossible d\'approuver le retrait.');
    }
  }

  async function refuseDeposit(id) {
    setError('');
    try {
      await authFetchJson(`/admin/deposit-requests/${id}`, {
        method: 'PATCH',
        body: { status: 'REJECTED' },
      });
      showNotice('Dépôt refusé.');
      await loadAdminData();
    } catch (err) {
      setError(err.message || 'Impossible de refuser le dépôt.');
    }
  }

  async function refuseWithdrawal(id) {
    setError('');
    try {
      await authFetchJson(`/admin/withdrawals/${id}`, {
        method: 'PATCH',
        body: { status: 'REJECTED' },
      });
      showNotice('Retrait refusé.');
      await loadAdminData();
    } catch (err) {
      setError(err.message || 'Impossible de refuser le retrait.');
    }
  }

  function sendNotificationToUser(userId) {
    const msg = window.prompt('Message à envoyer à l\'utilisateur :');
    if (msg) window.alert(`Notification envoyée à l'utilisateur ${userId} (simulation) :\n${msg}`);
  }

  function addFundsToUser(userId) {
    const v = window.prompt('Montant à ajouter (€) :');
    const amount = Number(v);
    if (!Number.isFinite(amount) || amount <= 0) return window.alert('Montant invalide.');
    creditUser(userId, amount);
    window.alert(`Crédit de ${amount}€ effectué pour l'utilisateur ${userId} (simulation).`);
  }

  function banUser(id) {
    setUsers(us => us.filter(u => u.id !== id));
  }

  function creditUser(id, amount) {
    setUsers(us => us.map(u => u.id === id ? { ...u, balance: u.balance + amount } : u));
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <h1 className="admin-title">Tableau de bord Administrateur</h1>
          <div className="admin-subtitle">Espace de gestion — données connectées au backend</div>
        </div>
        <div className="admin-topbar-actions">
          <Button variant="outline" onClick={loadAdminData}>Rafraîchir</Button>
          <Button variant="outline" onClick={() => window.alert('Notifications envoyées (simulation)')}>Envoyer notification</Button>
          <Button onClick={handleLogout}>Se déconnecter</Button>
        </div>
      </div>

      <div className="container admin-container">
        {error && <div className="admin-banner admin-banner--error">{error}</div>}
        {notice && <div className="admin-banner admin-banner--success">{notice}</div>}
        {lastRefreshedAt && (
          <div className="admin-banner admin-banner--info">
            Dernière actualisation : {new Intl.DateTimeFormat('fr-FR', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
            }).format(lastRefreshedAt)}
          </div>
        )}
        <div className="admin-stats">
          <Card className="admin-stat-card"><Stat label="Utilisateurs" value={totalUsers} /></Card>
          <Card className="admin-stat-card"><Stat label="Solde total (€)" value={totalBalance.toFixed(2)} /></Card>
          <Card className="admin-stat-card"><Stat label="Dépôts en attente" value={deposits.filter(d => d.status === 'PENDING').length} /></Card>
        </div>

        <div className="admin-grids">
          <Card className="admin-panel">
            <h3>Utilisateurs</h3>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Id</th><th>Utilisateur</th><th>Email</th><th>Solde</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username || 'N/A'}</td>
                      <td>{u.email || 'N/A'}</td>
                      <td>{Number(u.wallet?.balance || 0).toFixed(2)} €</td>
                      <td className="admin-actions">
                        <Button variant="outline" onClick={() => addFundsToUser(u.id)}>Ajouter des fonds</Button>
                        <Button variant="outline" onClick={() => sendNotificationToUser(u.id)}>Envoyer une notification</Button>
                        <Button variant="outline" onClick={() => banUser(u.id)}>Bannir</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="admin-panel">
            <h3>Demandes de dépôt</h3>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Utilisateur</th><th>Montant</th><th>Capture</th><th>Statut</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {deposits.map(d => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>{d.user?.username || d.user?.email || 'N/A'}</td>
                      <td>{Number(d.amount || 0).toFixed(2)} €</td>
                      <td>{d.screenshotUrl ? <a href={d.screenshotUrl} target="_blank" rel="noreferrer">Voir</a> : '—'}</td>
                      <td>{d.status === 'PENDING' ? 'En attente' : d.status === 'APPROVED' ? 'Approuvé' : d.status === 'REJECTED' ? 'Refusé' : d.status}</td>
                      <td>
                        {d.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Button onClick={() => approveDeposit(d.id)}>Approuver</Button>
                            <Button variant="outline" onClick={() => refuseDeposit(d.id)}>Refuser</Button>
                          </div>
                        )}
                        {d.status === 'APPROVED' && <span>Approuvé</span>}
                        {d.status === 'REFUSED' && <span>Refusé</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="admin-panel">
            <h3>Demandes de retrait</h3>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Utilisateur</th><th>Montant</th><th>Statut</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id}>
                      <td>{w.id}</td>
                      <td>{w.user?.username || w.user?.email || 'N/A'}</td>
                      <td>{Number(w.amount || 0).toFixed(2)} €</td>
                      <td>{w.status === 'PENDING' ? 'En attente' : w.status === 'APPROVED' ? 'Approuvé' : w.status === 'REJECTED' ? 'Refusé' : w.status}</td>
                      <td>
                        {w.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Button onClick={() => approveWithdrawal(w.id)}>Approuver</Button>
                            <Button variant="outline" onClick={() => refuseWithdrawal(w.id)}>Refuser</Button>
                          </div>
                        )}
                        {w.status === 'APPROVED' && <span>Approuvé</span>}
                        {w.status === 'REFUSED' && <span>Refusé</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
