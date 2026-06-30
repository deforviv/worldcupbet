import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Trophy, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { authFetchJson, getAuthToken } from '../config/api';
import './BetDetail.css';

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

export function BetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [betData, setBetData] = useState(null);

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/auth?mode=login', { replace: true });
      return;
    }

    let cancelled = false;
    async function loadDetail() {
      setLoading(true);
      setError('');
      try {
        const data = await authFetchJson(`/bets/${id}`, { timeoutMs: 12000 });
        if (!cancelled) {
          setBetData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Impossible de charger les détails du pari.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail();
    return () => { cancelled = true; };
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="container bets-page">
        <div className="bets-empty">Chargement des détails...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container bets-page">
        <div className="bets-alert">{error}</div>
        <Button variant="secondary" onClick={() => navigate('/bets')}>
          Retour aux paris
        </Button>
      </div>
    );
  }

  if (!betData) {
    return null;
  }

  const { type } = betData;
  const isCoupon = type === 'coupon';
  const result = isCoupon ? betData.coupon.status : betData.bet.status;
  const StatusIcon = STATUS_ICONS[result] || Clock;
  const stakeAmount = isCoupon ? betData.coupon.stakeAmount : betData.bet.stakeAmount;
  const potentialWin = isCoupon ? betData.coupon.potentialWin : betData.bet.potentialWin;
  const placedAt = isCoupon ? betData.coupon.placedAt : betData.bet.placedAt;
  const selectedItems = isCoupon ? betData.coupon.selections : [betData.bet];
  const refundAmount = result === 'LOST' ? Number(stakeAmount) / 2 : 0;
  const payoutAmount = result === 'WON' ? Number(potentialWin) : result === 'LOST' ? refundAmount : 0;

  return (
    <div className="container bets-page">
      <section className="bets-header bets-header--detail">
        <div>
          <button className="bets-back-btn" type="button" onClick={() => navigate('/bets')}>
            <ArrowLeft size={16} /> Retour aux paris
          </button>
          <h1>Détails du pari</h1>
          <p>Statut : <strong>{STATUS_LABELS[result] || result}</strong></p>
        </div>
      </section>

      <Card noPadding>
        <div className="bet-detail-card">
          <div className="bet-detail-summary">
            <div className={`bet-status-header bet-status-header--${result.toLowerCase()}`}>
              <StatusIcon size={18} /> {STATUS_LABELS[result] || result}
            </div>
            <div className="bet-detail-row">
              <span>Mise</span>
              <strong>{formatAmount(stakeAmount)}</strong>
            </div>
            <div className="bet-detail-row">
              <span>Gain potentiel</span>
              <strong>{formatAmount(potentialWin)}</strong>
            </div>
            {result === 'LOST' && (
              <div className="bet-detail-row bet-detail-refund">
                <span>Remboursement (50%)</span>
                <strong>{formatAmount(refundAmount)}</strong>
              </div>
            )}
            {result === 'WON' && (
              <div className="bet-detail-row bet-detail-payout">
                <span>Montant gagné</span>
                <strong>{formatAmount(payoutAmount)}</strong>
              </div>
            )}
            <div className="bet-detail-row">
              <span>Date du placement</span>
              <strong>{formatDate(placedAt)}</strong>
            </div>
          </div>

          <div className="bet-detail-selection-list">
            <h2>{isCoupon ? 'Sélections du coupon' : 'Sélection'}</h2>
            {selectedItems.map((selection, index) => {
              const homeTeam = selection.homeTeam || selection.match?.homeTeam;
              const awayTeam = selection.awayTeam || selection.match?.awayTeam;
              const marketType = selection.marketType || selection.marketType;
              return (
                <div key={`${selection.oddsId || index}-${selection.matchId || ''}`} className="bet-detail-selection">
                  <div className="bet-detail-selection-teams">
                    <strong>{homeTeam} vs {awayTeam}</strong>
                    <span>{formatDate(selection.kickoffTime || selection.match?.kickoffTime)}</span>
                  </div>
                  <div>
                    <span>{marketLabel(marketType, selection.selectedOption)}</span>
                    <strong>Cote {Number(selection.oddsAtPlacement).toFixed(2)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
