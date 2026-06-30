import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card } from '../components/Card';
import { Tabs } from '../components/Tabs';
import { BetSlip } from '../components/BetSlip';
import { getFlagUrl, normalizeTeamName } from '../utils/flags';
import { fetchJsonWithRetry } from '../config/api';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useBetSlip } from '../hooks/useBetSlip';
import './MatchDetail.css';

const TABS = [
  { id: '1x2', label: '1X2 (Vainqueur)' },
  { id: 'dc', label: 'Double Chance' },
  { id: 'ou', label: 'Plus/Moins' },
  { id: 'score', label: 'Score Exact' }
];

const MARKET_LABELS = {
  HOME_WIN: 'Domicile',
  DRAW: 'Nul',
  AWAY_WIN: 'Extérieur',
  OVER_1_5: 'Plus de 1.5',
  OVER_2_5: 'Plus de 2.5',
  OVER_3_5: 'Plus de 3.5',
  UNDER_1_5: 'Moins de 1.5',
  UNDER_2_5: 'Moins de 2.5',
  UNDER_3_5: 'Moins de 3.5',
  DOUBLE_CHANCE_1X: '1X',
  DOUBLE_CHANCE_X2: 'X2',
  DOUBLE_CHANCE_12: '12',
};

function formatDateTime(kickoffTime) {
  const date = new Date(kickoffTime);
  return {
    date: date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getStatusLabel(status) {
  const normalized = status?.toUpperCase();
  if (normalized === 'LIVE') return 'EN DIRECT';
  if (normalized === 'FINISHED') return 'TERMINÉ';
  if (normalized === 'POSTPONED') return 'REPORTÉ';
  if (normalized === 'CANCELLED') return 'ANNULÉ';
  return 'À VENIR';
}

function getOddsValue(odds) {
  const value = Number(odds);
  return Number.isFinite(value) ? value : null;
}

function mapMatchData(data) {
  const { date, time } = formatDateTime(data.kickoffTime);
  const odds = Array.isArray(data.odds) ? data.odds : [];

  let status = data.status?.toUpperCase();
  const kickoffTime = data.kickoffTime;
  if (status === 'SCHEDULED' && kickoffTime && new Date(kickoffTime) <= new Date()) {
    status = 'LIVE';
  }

  return {
    id: data.id,
    teamA: normalizeTeamName(data.homeTeam),
    teamB: normalizeTeamName(data.awayTeam),
    flagA: data.homeTeamCode,
    flagB: data.awayTeamCode,
    time,
    date,
    kickoffTime,
    competition: data.competition || 'Coupe du Monde',
    status,
    scoreA: data.homeScore,
    scoreB: data.awayScore,
    odds,
  };
}

function isBettingOpen(match) {
  if (!match) return false;
  if (match.status !== 'SCHEDULED') return false;
  if (!match.kickoffTime) return true;
  return new Date(match.kickoffTime) > new Date();
}

function MarketButton({ label, odds, disabled, selected, onClick }) {
  const value = getOddsValue(odds);

  return (
    <button
      className={`odds-btn ${selected ? 'odds-btn--selected' : ''}`}
      disabled={disabled || !value}
      onClick={onClick}
    >
      <span className="odds-label">{label}</span>
      <span className="odds-value">{value ? value.toFixed(2) : '-.--'}</span>
    </button>
  );
}

function EmptyMarket() {
  return (
    <div className="market-empty">
      Les cotes de ce marché ne sont pas encore disponibles pour ce match.
    </div>
  );
}

export function MatchDetail() {
  const { id } = useParams();
  const requireAuth = useRequireAuth();
  const { bets: selectedBets, addBet, removeBet, clearAll } = useBetSlip();
  const [activeTab, setActiveTab] = useState('1x2');
  const [betSlipOpen, setBetSlipOpen] = useState(false);

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch real match data from the backend
  useEffect(() => {
    const fetchMatch = async () => {
      setLoading(true);
      setError('');
      setBetSlipOpen(false);

      try {
        const data = await fetchJsonWithRetry(`/matches/${id}`, { timeoutMs: 12000, cacheMs: 0 });
        setMatch(mapMatchData(data));
      } catch (err) {
        console.error(err);
        try {
          const data = await fetchJsonWithRetry('/matches?limit=200', { timeoutMs: 12000, cacheMs: 0 });
          const fallbackMatch = Array.isArray(data?.matches)
            ? data.matches.find(item => item.id === id)
            : null;

          if (fallbackMatch) {
            setMatch(mapMatchData(fallbackMatch));
            setError('');
          } else {
            setError('Impossible de charger les informations de ce match.');
          }
        } catch (fallbackErr) {
          console.error(fallbackErr);
          setError('Impossible de charger les informations de ce match.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchMatch();
  }, [id]);

  const handleOddsClick = (oddsRecord, label, market) => {
    if (!match) return;
    const oddsValue = getOddsValue(oddsRecord.odds);
    if (!oddsValue || !isBettingOpen(match)) return;

    requireAuth(() => {
      addBet({
        id: oddsRecord.id,
        matchId: match.id,
        oddsId: oddsRecord.id,
        label: market,
        team: label,
        odds: oddsValue,
        match: `${match.teamA} vs ${match.teamB}`,
      });
      setBetSlipOpen(true);
    });
  };

  const findOdd = (marketType, selection) => (
    match?.odds.find(o => o.marketType === marketType && (!selection || o.selection === selection))
  );

  const renderOdds = (items, columnsClass) => {
    const availableItems = items.filter(item => item.oddsRecord);
    if (availableItems.length === 0) return <EmptyMarket />;

    return (
      <div className={`odds-grid ${columnsClass}`}>
        {availableItems.map(item => (
          <MarketButton
            key={`${item.oddsRecord.marketType}-${item.oddsRecord.selection}-${item.label}`}
            label={item.label}
            odds={item.oddsRecord.odds}
            selected={selectedBets.some(bet => bet.oddsId === item.oddsRecord.id)}
            disabled={!isBettingOpen(match)}
            onClick={() => handleOddsClick(item.oddsRecord, item.label, item.market)}
          />
        ))}
      </div>
    );
  };

  const bettingClosed = match && !isBettingOpen(match);

  if (loading) {
    return (
      <div className="container match-detail-page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <Loader2 size={48} className="animate-spin" style={{ color: 'var(--brand-primary)' }} />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container match-detail-page" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h2>{error || 'Match introuvable'}</h2>
        <Link to="/" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>Retour à l'accueil</Link>
      </div>
    );
  }

  return (
    <div className="container match-detail-page">
      <div className="match-detail-back">
        <Link to="/" className="back-link">
          <ArrowLeft size={20} />
          <span>Retour aux Matchs</span>
        </Link>
      </div>

      <div className="match-detail-layout">
        <div className="match-detail-main">
          {/* Header */}
          <Card className="match-detail-header text-center">
            <span className="text-secondary font-semibold text-sm">{match.competition} • {match.date} à {match.time}</span>
            <div className="match-detail-teams">
              <div className="detail-team">
                <img src={getFlagUrl(match.flagA)} alt={match.teamA} className="detail-flag-img" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <h2 className="detail-team-name">{match.teamA}</h2>
              </div>
              <div className="detail-vs">
                {match.status === 'FINISHED' ? (
                  <span className="detail-score" style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-primary)' }}>
                    {match.scoreA ?? 0} - {match.scoreB ?? 0}
                  </span>
                ) : (
                  'VS'
                )}
                <span className={`match-detail-status match-detail-status--${match.status?.toLowerCase()}`}>
                  {getStatusLabel(match.status)}
                </span>
              </div>
              <div className="detail-team">
                <img src={getFlagUrl(match.flagB)} alt={match.teamB} className="detail-flag-img" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <h2 className="detail-team-name">{match.teamB}</h2>
              </div>
            </div>
          </Card>

          {/* Markets */}
          <div className="match-markets">
            <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
            
            {activeTab === '1x2' && (
              <div className="market-group">
                <h3 className="market-title">Vainqueur du Match (1X2)</h3>
                {renderOdds([
                  { label: match.teamA, market: 'Vainqueur', oddsRecord: findOdd('HOME_WIN', 'HOME') },
                  { label: 'Nul', market: 'Vainqueur', oddsRecord: findOdd('DRAW', 'DRAW') },
                  { label: match.teamB, market: 'Vainqueur', oddsRecord: findOdd('AWAY_WIN', 'AWAY') },
                ], 'odds-3-cols')}
              </div>
            )}

            {activeTab === 'dc' && (
              <div className="market-group">
                <h3 className="market-title">Double Chance</h3>
                {renderOdds([
                  { label: `${match.teamA} ou Nul`, market: 'Double Chance', oddsRecord: findOdd('DOUBLE_CHANCE_1X', '1X') },
                  { label: 'Nul ou ' + match.teamB, market: 'Double Chance', oddsRecord: findOdd('DOUBLE_CHANCE_X2', 'X2') },
                  { label: `${match.teamA} ou ${match.teamB}`, market: 'Double Chance', oddsRecord: findOdd('DOUBLE_CHANCE_12', '12') },
                ], 'odds-3-cols')}
              </div>
            )}

            {activeTab === 'ou' && (
              <div className="market-group">
                <h3 className="market-title">Plus/Moins de Buts</h3>
                {renderOdds([
                  'OVER_1_5', 'UNDER_1_5',
                  'OVER_2_5', 'UNDER_2_5',
                  'OVER_3_5', 'UNDER_3_5',
                ].map(type => ({
                  label: MARKET_LABELS[type],
                  market: 'Total Buts',
                  oddsRecord: findOdd(type),
                })), 'odds-2-cols')}
              </div>
            )}

            {activeTab === 'score' && (
              <div className="market-group">
                <h3 className="market-title">Score Exact</h3>
                {renderOdds(
                  match.odds
                    .filter(o => o.marketType === 'CORRECT_SCORE')
                    .map(o => ({
                      label: o.selection,
                      market: 'Score Exact',
                      oddsRecord: o,
                    })),
                  'odds-2-cols'
                )}
              </div>
            )}

            {bettingClosed && (
              <div className="market-notice">
                Les paris sont fermés pour ce match. Les informations affichées proviennent des données officielles du site.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="match-detail-sidebar">
          <BetSlip 
            bets={selectedBets}
            isOpen={betSlipOpen}
            onToggle={() => setBetSlipOpen(open => !open)}
            onRemoveBet={removeBet}
            onClearAll={clearAll}
          />
        </div>
      </div>
    </div>
  );
}
