import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Trophy, XCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { authFetchJson, getAuthToken } from '../config/api';
import './MyBets.css';

const STATUS_LABELS = {
  PENDING: 'En attente',
  WON: 'Gagné',
  LOST: 'Perdu',
  CANCELLED: 'Annulé',
  REFUNDED: 'Remboursé',
};

const STATUS_ICONS = {
  PENDING: Clock,
  WON: Trophy,
  LOST: XCircle,
  CANCELLED: XCircle,
  REFUNDED: ArrowRight,
};

function formatAmount(amount) {
  return `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount || 0))}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function marketLabel(marketType, selection) {
  if (marketType === 'HOME_WIN') return 'Victoire domicile';
  if (marketType === 'AWAY_WIN') return 'Victoire extérieur';
  if (marketType === 'DRAW') return 'Match nul';
  if (marketType?.startsWith('OVER')) return `Plus de ${marketType.replace('OVER_', '').replace('_', ',')} buts`;
  if (marketType?.startsWith('UNDER')) return `Moins de ${marketType.replace('UNDER_', '').replace('_', ',')} buts`;
  if (marketType?.startsWith('DOUBLE_CHANCE')) return 'Double chance';
  if (marketType === 'CORRECT_SCORE') return `Score exact ${selection}`;
  return marketType || 'Pari';
}

export function MyBets() {
  const navigate = useNavigate();
  const [loadedItems, setLoadedItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideSettled, setHideSettled] = useState(false);
  const [selectedCount, setSelectedCount] = useState(50);
  const [visibleCount, setVisibleCount] = useState(50);
  const PAGE_FETCH_LIMIT = 50;
  const cancelledRef = useRef(false);

  const loadBets = useCallback(async (currentPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await authFetchJson(`/bets?page=${currentPage}&limit=${PAGE_FETCH_LIMIT}`, { timeoutMs: 12000 });
      if (!cancelledRef.current) {
        const pageItems = [
          ...((data?.coupons || []).map(coupon => ({ kind: 'coupon', placedAt: coupon.placedAt, item: coupon }))),
          ...((data?.bets || []).map(bet => ({ kind: 'single', placedAt: bet.placedAt, item: bet }))),
        ].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

        setLoadedItems((prevItems) => {
          const nextItems = currentPage === 1 ? pageItems : [...prevItems, ...pageItems];
          return nextItems;
        });

        setTotal(data?.total || 0);
        setPage(data?.page || currentPage);
        setPages(data?.pages || 1);

        if (currentPage === 1) {
          setVisibleCount(selectedCount);
        }

        return pageItems.length;
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err.message || 'Impossible de charger vos paris.');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
    return 0;
  }, [selectedCount]);

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/auth?mode=login', { replace: true });
      return;
    }

    cancelledRef.current = false;
    void Promise.resolve().then(() => loadBets(1));
    return () => {
      cancelledRef.current = true;
    };
  }, [navigate, loadBets]);

  const openBetDetails = (id) => navigate(`/bets/${id}`);

  const handleKeyDown = (event, id) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openBetDetails(id);
    }
  };

  const visibleItems = loadedItems
    .filter(({ item }) => {
      if (!hideSettled) return true;
      return item.status === 'PENDING';
    })
    .slice(0, visibleCount);

  return (
    <div className="container bets-page">
      <section className="bets-header">
        <div>
          <span className="bets-kicker">Tickets</span>
          <h1>Mes paris</h1>
          <p>{total} pari{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''} sur votre compte.</p>
        </div>
        <Link to="/">
          <Button variant="primary">Voir les matchs <ArrowRight size={16} /></Button>
        </Link>
      </section>
      <div className="bets-controls">
        <label className="bets-control">
          Afficher
          <select value={selectedCount} onChange={(e) => {
            const next = Number(e.target.value);
            setSelectedCount(next);
            setVisibleCount(next);
          }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          derniers
        </label>
        <label className="bets-control">
          <input type="checkbox" checked={hideSettled} onChange={(e) => setHideSettled(e.target.checked)} /> Masquer les paris réglés
        </label>
      </div>

      {error && <div className="bets-alert">{error}</div>}

      <Card noPadding>
        {loading && <div className="bets-empty">Chargement de vos tickets...</div>}

        {!loading && loadedItems.length === 0 && (
          <div className="bets-empty bets-empty--large">
            <Trophy size={36} />
            <strong>Aucun pari pour le moment.</strong>
            <span>Les tickets validés apparaîtront ici avec leur statut.</span>
            <Link to="/">
              <Button variant="primary">Parier maintenant</Button>
            </Link>
          </div>
        )}

        {!loading && loadedItems.length > 0 && visibleItems.length === 0 && (
          <div className="bets-empty bets-empty--large">
            <strong>Aucun pari ne correspond à ce filtre.</strong>
            <span>Désactivez le filtre ou cliquez sur Voir plus pour charger d'autres tickets.</span>
          </div>
        )}

        {!loading && visibleItems.length > 0 && (
          <>
            <div className="bets-list">
              {visibleItems.map(({ kind, item }) => {
              const StatusIcon = STATUS_ICONS[item.status] || Clock;
              if (kind === 'coupon') {
                const selections = Array.isArray(item.selections) ? item.selections : [];
                return (
                  <article
                    key={item.id}
                    className="bet-item bet-item--coupon bet-item--clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => openBetDetails(item.id)}
                    onKeyDown={(event) => handleKeyDown(event, item.id)}
                  >
                    <div className="bet-main">
                      <div className={`bet-status bet-status--${item.status.toLowerCase()}`}>
                        <StatusIcon size={16} />
                        {STATUS_LABELS[item.status] || item.status}
                      </div>
                      <h2>Coupon combiné ({item.selectionCount} matchs)</h2>
                      <p>Cote totale {Number(item.totalOdds).toFixed(2)} • {selections.length} sélection{selections.length > 1 ? 's' : ''}</p>
                      <span>{formatDate(item.placedAt)}</span>
                      <div className="bet-coupon-legs">
                        {selections.map((selection) => (
                          <div key={`${item.id}-${selection.oddsId}`} className="bet-coupon-leg">
                            <strong>{selection.homeTeam} vs {selection.awayTeam}</strong>
                            <span>{marketLabel(selection.marketType, selection.selectedOption)} • Cote {Number(selection.oddsAtPlacement).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bet-values">
                      <div>
                        <span>Mise</span>
                        <strong>{formatAmount(item.stakeAmount)}</strong>
                      </div>
                      <div>
                        <span>Gain potentiel</span>
                        <strong>{formatAmount(item.potentialWin)}</strong>
                      </div>
                    </div>
                  </article>
                );
              }

              const bet = item;
              return (
                <article
                  key={bet.id}
                  className="bet-item bet-item--clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => openBetDetails(bet.id)}
                  onKeyDown={(event) => handleKeyDown(event, bet.id)}
                >
                  <div className="bet-main">
                    <div className={`bet-status bet-status--${bet.status.toLowerCase()}`}>
                      <StatusIcon size={16} />
                      {STATUS_LABELS[bet.status] || bet.status}
                    </div>
                    <h2>{bet.match?.homeTeam} vs {bet.match?.awayTeam}</h2>
                    <p>{marketLabel(bet.marketType, bet.selectedOption)} • Cote {Number(bet.oddsAtPlacement).toFixed(2)}</p>
                    <span>{formatDate(bet.placedAt)}</span>
                  </div>
                  <div className="bet-values">
                    <div>
                      <span>Mise</span>
                      <strong>{formatAmount(bet.stakeAmount)}</strong>
                    </div>
                    <div>
                      <span>Gain potentiel</span>
                      <strong>{formatAmount(bet.potentialWin)}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
            {((visibleCount < loadedItems.filter(({ item }) => !hideSettled || item.status === 'PENDING').length) || page < pages) && (
              <div className="bets-footer">
                <Button variant="secondary" onClick={async () => {
                  const filteredLength = loadedItems.filter(({ item }) => !hideSettled || item.status === 'PENDING').length;
                  if (visibleCount < filteredLength) {
                    setVisibleCount((current) => Math.min(current + selectedCount, filteredLength));
                    return;
                  }
                  if (page < pages) {
                    const nextPage = page + 1;
                    const loadedCount = await loadBets(nextPage);
                    if (loadedCount > 0) {
                      setVisibleCount((current) => current + selectedCount);
                    }
                  }
                }}>
                  Voir plus
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
