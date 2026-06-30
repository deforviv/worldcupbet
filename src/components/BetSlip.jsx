import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Trash2, TrendingUp, Trophy, Zap, ChevronUp, ChevronDown } from 'lucide-react';
import { authFetchJson, getAuthToken } from '../config/api';
import { computeCombinedOdds, computePotentialWin, isCouponMode } from '../utils/betSlipOdds';
import { useAuthSession } from '../hooks/useAuthSession';
import './BetSlip.css';

export function BetSlip({ bets = [], onRemoveBet, onClearAll, isOpen, onToggle }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthSession();
  const [stakes, setStakes] = useState({});
  const [couponStake, setCouponStake] = useState('');
  const [placing, setPlacing] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState(null);

  const walletBalance = Number(wallet?.balance || 0);
  const isCoupon = isCouponMode(bets);
  const combinedOdds = computeCombinedOdds(bets);
  const hasDuplicateMatch = new Set(bets.map(bet => bet.matchId)).size !== bets.length;

  useEffect(() => {
    let cancelled = false;

    async function loadWallet({ showLoading = false } = {}) {
      if (!isAuthenticated) {
        if (!cancelled) {
          setWallet(null);
          setWalletLoading(false);
        }
        return;
      }

      if (showLoading) {
        setWalletLoading(true);
      }
      try {
        const data = await authFetchJson('/wallet', { timeoutMs: 25000 });
        if (!cancelled) {
          setWallet(data?.wallet || null);
        }
      } catch {
        if (!cancelled) {
          setWallet(null);
        }
      } finally {
        if (!cancelled) {
          setWalletLoading(false);
        }
      }
    }

    const handleWalletChanged = () => loadWallet({ showLoading: false });
    const handleAuthChanged = () => loadWallet({ showLoading: true });

    loadWallet({ showLoading: true });
    window.addEventListener('wallet:changed', handleWalletChanged);
    window.addEventListener('auth:changed', handleAuthChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('wallet:changed', handleWalletChanged);
      window.removeEventListener('auth:changed', handleAuthChanged);
    };
  }, [isAuthenticated]);

  const updateStake = (betId, value) => {
    console.info('[BetSlip] updateStake', betId, value);
    setStakes(prev => ({ ...prev, [betId]: value }));
    setMessage('');
    setError('');
  };

  const updateCouponStake = (value) => {
    console.info('[BetSlip] updateCouponStake', value);
    setCouponStake(value);
    setMessage('');
    setError('');
  };

  const totalStake = isCoupon
    ? (parseFloat(couponStake) || 0)
    : Object.values(stakes).reduce((sum, s) => sum + (parseFloat(s) || 0), 0);

  const totalWinnings = isCoupon
    ? computePotentialWin(totalStake, combinedOdds)
    : bets.reduce((sum, bet) => {
        const stake = parseFloat(stakes[bet.id]) || 0;
        return sum + computePotentialWin(stake, Number(bet.odds));
      }, 0);

  const formatMoney = (amount) => `${new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount || 0))}`;

  const refreshWallet = async () => {
    const data = await authFetchJson('/wallet', { timeoutMs: 25000 });
    const nextWallet = data?.wallet || null;
    setWallet(nextWallet);
    return nextWallet;
  };

  const placeBets = async () => {
    console.info('[BetSlip] placeBets start', { isCoupon, stakes, couponStake, bets });
    if (!getAuthToken()) {
      navigate('/auth?mode=login');
      return;
    }

    const invalidBet = bets.find(bet => !bet.matchId || !bet.oddsId);
    if (invalidBet) {
      setError('Cette sélection doit être ouverte depuis une cote officielle du match.');
      return;
    }

    if (isCoupon && hasDuplicateMatch) {
      setError('Un coupon combiné accepte une seule sélection par match.');
      return;
    }

    const couponStakeAmount = Number(couponStake);
    const payload = isCoupon
    ? bets.map(bet => ({ matchId: bet.matchId, oddsId: bet.oddsId, stakeAmount: couponStakeAmount }))
    : bets.map(bet => ({ matchId: bet.matchId, oddsId: bet.oddsId, stakeAmount: Number(stakes[bet.id] || 0) }));

    console.info('[BetSlip] placeBets payload', payload, { totalStake, couponStakeAmount });
    if (isCoupon && (!Number.isFinite(couponStakeAmount) || couponStakeAmount < 1)) {
      setError('La mise minimum du coupon est de 1 EUR.');
      return;
    }

    if (!isCoupon && payload.some(item => !Number.isFinite(item.stakeAmount) || item.stakeAmount < 1)) {
      console.info('[BetSlip] invalid payload detected', payload);
      setError('La mise minimum est de 1 EUR pour chaque sélection.');
      return;
    }

    setPlacing(true);
    setError('');
    setMessage('');

    try {
      const latestWallet = await refreshWallet();
      const latestBalance = Number(latestWallet?.balance || 0);

      if (totalStake > latestBalance) {
        setError('Solde insuffisant pour valider ce ticket. Effectuez un dépôt puis réessayez.');
        return;
      }
      if (isCoupon) {
        await authFetchJson('/bets/coupon', {
          method: 'POST',
          body: {
            selections: payload.map(item => ({
              matchId: item.matchId,
              oddsId: item.oddsId,
            })),
            stakeAmount: couponStakeAmount,
          },
        });
      } else {
        for (const item of payload) {
          await authFetchJson('/bets', {
            method: 'POST',
            body: {
              matchId: item.matchId,
              oddsId: item.oddsId,
              stakeAmount: item.stakeAmount,
            },
          });
        }
      }

      setStakes({});
      setCouponStake('');
      const successMessage = isCoupon
        ? `Coupon combiné de ${payload.length} matchs validé — cote ${combinedOdds.toFixed(2)}.`
        : `${payload.length} pari validé.`;
      setMessage(successMessage);
      window.dispatchEvent(new Event('wallet:changed'));
      window.dispatchEvent(new Event('bets:changed'));
      if (onClearAll) {
        onClearAll();
      } else if (onRemoveBet) {
        bets.forEach(bet => onRemoveBet(bet.id));
      }
    } catch (err) {
      const fallback = err.message || 'Validation du ticket impossible.';
      if (err.name === 'AbortError' || /expiré/i.test(fallback)) {
        setError('La connexion a expiré. Vérifiez votre connexion et réessayez.');
      } else if (/solde insuffisant/i.test(fallback)) {
        setError('Solde insuffisant pour valider ce ticket. Effectuez un dépôt puis réessayez.');
      } else if (/fermés|commencé|verrouillées/i.test(fallback)) {
        setError(fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setPlacing(false);
    }
  };

  if (bets.length === 0 && !isOpen) return null;

  return (
    <div className={`betslip-container ${isOpen ? 'betslip-container--open' : ''}`}>
      {/* Toggle Header */}
      <button className="betslip-toggle-header" onClick={onToggle}>
        <div className="betslip-toggle-left">
          <Trophy size={18} className="betslip-trophy-icon" />
          <span className="betslip-toggle-title">Mon Ticket</span>
          {bets.length > 0 && (
            <span className="betslip-badge">{bets.length}</span>
          )}
        </div>
        <div className="betslip-toggle-right">
          {bets.length > 0 && (
            <span className="betslip-total-preview">
              <Zap size={14} /> Gains: {formatMoney(totalWinnings)}
            </span>
          )}
          {isOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </div>
      </button>

      {/* Bet List */}
      {isOpen && (
        <div className="betslip-body">
          {bets.length === 0 ? (
            <div className="betslip-empty">
              <TrendingUp size={32} className="betslip-empty-icon" />
              <p>Votre ticket est vide</p>
              <span>{message ? 'Votre ticket a bien été enregistré.' : 'Cliquez sur une cote pour commencer'}</span>
              {message && <strong className="betslip-success">{message}</strong>}
              {message && (
                <Link to="/bets" className="betslip-success-link">
                  Voir mes paris
                </Link>
              )}
            </div>
          ) : (
            <>
              {(error || message) && (
                <div className={`betslip-alert ${error ? 'betslip-alert--error' : 'betslip-alert--success'}`}>
                  {error || message}
                </div>
              )}

              <div className="betslip-mode-banner">
                <strong>{isCoupon ? 'Coupon combiné' : 'Pari simple'}</strong>
                {isCoupon && <span>{bets.length} matchs • Cote totale {combinedOdds.toFixed(2)}</span>}
              </div>

              <div className="betslip-list">
                {bets.map(bet => (
                  <div key={bet.id} className="betslip-item">
                    <div className="betslip-item-header">
                      <div className="betslip-item-info">
                        <span className="betslip-match">{bet.match}</span>
                        <span className="betslip-selection">{bet.label} — {bet.team}</span>
                      </div>
                      <div className="betslip-item-right">
                        <span className="betslip-odds">{Number(bet.odds).toFixed(2)}</span>
                        <button
                          className="betslip-remove"
                          onClick={() => onRemoveBet(bet.id)}
                          aria-label="Supprimer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {!isCoupon && (
                      <div className="betslip-stake-row">
                        <label>Mise (EUR)</label>
                        <input
                          type="number"
                          className="betslip-input"
                          placeholder="500"
                          min="100"
                          disabled={placing}
                          value={stakes[bet.id] || ''}
                          onChange={e => updateStake(bet.id, e.target.value)}
                        />
                        {stakes[bet.id] && (
                          <span className="betslip-win-preview">
                            = {formatMoney(computePotentialWin(parseFloat(stakes[bet.id]) || 0, Number(bet.odds)))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isCoupon && (
                <div className="betslip-coupon-stake">
                  <label>Mise du coupon (EUR)</label>
                  <input
                    type="number"
                    className="betslip-input"
                    placeholder="500"
                    min="100"
                    disabled={placing}
                    value={couponStake}
                    onChange={e => updateCouponStake(e.target.value)}
                  />
                </div>
              )}

              <div className="betslip-summary">
                <div className="betslip-summary-row">
                  <span>Solde disponible</span>
                  <strong>
                    {walletLoading && !wallet
                      ? 'Chargement...'
                      : wallet
                        ? formatMoney(walletBalance)
                        : '—'}
                  </strong>
                </div>
                {isCoupon && (
                  <div className="betslip-summary-row">
                    <span>Cote totale</span>
                    <strong>{combinedOdds.toFixed(2)}</strong>
                  </div>
                )}
                <div className="betslip-summary-row">
                  <span>{isCoupon ? 'Mise coupon' : 'Mise totale'}</span>
                  <strong>{formatMoney(totalStake)}</strong>
                </div>
                <div className="betslip-summary-row betslip-summary-row--winnings">
                  <span>Gains potentiels</span>
                  <strong className="betslip-winnings">{formatMoney(totalWinnings)}</strong>
                </div>
              </div>

              <button
                type="button"
                className="betslip-confirm-btn"
                onClick={placeBets}
                disabled={placing}
              >
                <Zap size={16} />
                {placing
                  ? 'Validation...'
                  : isCoupon
                    ? `Valider le coupon (${bets.length} matchs)`
                    : 'Valider mon pari'}
              </button>

              <button type="button" className="betslip-clear-btn" onClick={onClearAll} disabled={placing}>
                <Trash2 size={14} />
                Effacer tout
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
