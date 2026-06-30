import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Sparkles } from 'lucide-react';
import { authFetchJson } from '../config/api';
import { useRequireAuth } from '../hooks/useRequireAuth';
import './Notifications.css';

function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function Notifications() {
  const navigate = useNavigate();
  const requireAuth = useRequireAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    requireAuth();
  }, [requireAuth]);

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await authFetchJson('/notifications?page=1&limit=50', { timeoutMs: 12000 });
        setNotifications(data?.notifications || []);
      } catch (err) {
        setError(err.message || 'Impossible de charger les notifications.');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, []);

  useEffect(() => {
    if (loading || error || notifications.length === 0) return;

    const hasUnread = notifications.some((item) => !item.isRead);
    if (!hasUnread) return;

    const markRead = async () => {
      try {
        await authFetchJson('/notifications/mark-read', { method: 'POST' });
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
        window.dispatchEvent(new Event('notification:changed'));
      } catch {
        // Ignore failures here; the list still renders normally.
      }
    };

    markRead();
  }, [loading, error, notifications]);

  const handleMarkAllRead = async () => {
    if (markingRead) return;
    setMarkingRead(true);
    setError('');

    try {
      await authFetchJson('/notifications/mark-read', { method: 'POST' });
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      window.dispatchEvent(new Event('notification:changed'));
    } catch (err) {
      setError(err.message || 'Impossible de marquer les notifications comme lues.');
    } finally {
      setMarkingRead(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="container notifications-page">
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>Consultez l’historique des alertes liées à votre compte.</p>
        </div>
        <button
          className="notifications-mark-read-btn"
          type="button"
          onClick={handleMarkAllRead}
          disabled={markingRead || unreadCount === 0}
        >
          <CheckCircle2 size={16} />
          {unreadCount > 0 ? 'Marquer comme lues' : 'Toutes lues'}
        </button>
      </div>

      {error && <div className="notifications-error">{error}</div>}

      {loading ? (
        <div className="notifications-empty">Chargement des notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          <Sparkles size={36} />
          <p>Vous n’avez aucune notification pour le moment.</p>
          <button type="button" className="notifications-go-back" onClick={() => navigate(-1)}>
            Retour
          </button>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`notification-card ${notification.isRead ? 'notification-card--read' : 'notification-card--unread'}`}
            >
              <div className="notification-card-icon">
                <Bell size={20} />
              </div>
              <div className="notification-card-body">
                <div className="notification-card-top">
                  <strong>{notification.title}</strong>
                  <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                </div>
                <p>{notification.message}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
