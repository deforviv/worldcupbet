import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { HeroSlider } from '../components/HeroSlider';
import { TrustBar } from '../components/TrustBar';
import { Promotions } from '../components/Promotions';
import { FeaturedOdds } from '../components/FeaturedOdds';
import { BetSlip } from '../components/BetSlip';
import { ShieldCheck, TrendingUp, Flame, Loader2, ArrowRight, Info, Clock } from 'lucide-react';
import { getFlagUrl, getFlagCode, normalizeTeamName } from '../utils/flags';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useBetSlip } from '../hooks/useBetSlip';
import { useMatchesData, refreshMatches } from '../hooks/useMatchesData';
import '../components/TrustBar.css';
import '../components/Promotions.css';
import '../components/BetSlip.css';
import './Dashboard.css';

/* ─────────────────────────────────────────────────────────────
   HELPERS & DATA MAPPING
───────────────────────────────────────────────────────────── */
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  const yesterday = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === tomorrow.toDateString()) return "Demain";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function stableMarketsCount(match) {
  const seed = `${match.id || ''}-${match.kickoffTime || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return 120 + (Math.abs(hash) % 31);
}

function formatCountdown(rawKickoffTime, now) {
  const diff = new Date(rawKickoffTime).getTime() - now;
  if (diff <= 0) return '';

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `dans ${d}j ${h % 24}h`;
  }
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ─────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  if (status === 'live') {
    return (
      <span className="match-status-live">
        <span className="live-dot" /> EN DIRECT
      </span>
    );
  }
  return <span className="match-status-upcoming">À VENIR</span>;
}

function MatchCountdown({ rawKickoffTime, status, currentTime }) {
  const countdown = formatCountdown(rawKickoffTime, currentTime);
  if (status === 'live' || !countdown) return null;
  return (
    <div className="match-countdown">
      <Clock size={12} />
      <span>{countdown}</span>
    </div>
  );
}

function OddsButton({ label, value, onSelect, canSelect = true, selected = false }) {
  const requireAuth = useRequireAuth();
  const numericValue = Number(value);
  const hasValue = Number.isFinite(numericValue) && numericValue > 0;
  const isEnabled = hasValue && canSelect;
  const displayValue = hasValue ? numericValue.toFixed(2) : '-.--';

  const handleClick = () => {
    if (!isEnabled) return;
    requireAuth(() => {
      if (onSelect) onSelect(!selected);
    });
  };

  return (
    <button
      className={`odds-pill ${selected ? 'odds-pill--selected' : ''}`}
      disabled={!isEnabled}
      onClick={handleClick}
    >
      <span className="odds-pill-label">{label}</span>
      <span className="odds-pill-value">{displayValue}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
export function Dashboard() {
  const requireAuth = useRequireAuth();
  const navigate = useNavigate();
  const { upcoming, results, loading: matchesLoading, error: matchesError } = useMatchesData();
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // ── BetSlip State (shared across pages) ────────────────────
  const { bets: betSlipBets, addBet, removeBet, clearAll } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);

  const handleAddBet = (bet) => {
    addBet({
      id: bet.oddsId,
      matchId: bet.matchId,
      oddsId: bet.oddsId,
      label: bet.label,
      team: bet.team,
      odds: bet.odds,
      match: bet.match,
    });
    setBetSlipOpen(true);
  };

  const openMatchOptions = (matchId) => {
    requireAuth(() => {
      navigate(`/match/${matchId}`);
    });
  };

  // Time-based instant transition state
  const [activeTab, setActiveTab] = useState('today');
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Track time once for all countdowns to avoid per-card timers
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { formattedUpcoming, formattedFinished } = useMemo(() => {
    const safeUpcoming = Array.isArray(upcoming) ? upcoming : [];
    const safeResults = Array.isArray(results) ? results : [];

    const ELITE = ['Germany', 'Spain', 'Brazil', 'England', 'Argentina', 'France', 'Portugal', 'Netherlands', 'Italy', 'Belgium'];
    const now = new Date();

    const scored = safeUpcoming.map(m => {
      let score = 0;
      const homeElite = ELITE.some(e => m.homeTeam?.includes(e));
      const awayElite = ELITE.some(e => m.awayTeam?.includes(e));
      if (homeElite && awayElite) score += 1000;
      else if (homeElite || awayElite) score += 500;
      const hoursUntil = (new Date(m.kickoffTime) - now) / 3600000;
      score -= hoursUntil;
      return { id: m.id, score };
    });

    const topPicksIds = scored.sort((a, b) => b.score - a.score).slice(0, 2).map(m => m.id);

    const formattedUpcoming = safeUpcoming.map((match) => {
      const homeOddsRecord = match.odds?.find(o => o.marketType === 'HOME_WIN');
      const drawOddsRecord = match.odds?.find(o => o.marketType === 'DRAW');
      const awayOddsRecord = match.odds?.find(o => o.marketType === 'AWAY_WIN');

      return {
        id: match.id,
        teamA: {
          name: normalizeTeamName(match.homeTeam),
          flag: getFlagCode(match.homeTeamCode),
          odds: homeOddsRecord?.odds,
          oddsId: homeOddsRecord?.id,
        },
        teamB: {
          name: normalizeTeamName(match.awayTeam),
          flag: getFlagCode(match.awayTeamCode),
          odds: awayOddsRecord?.odds,
          oddsId: awayOddsRecord?.id,
        },
        drawOdds: drawOddsRecord?.odds,
        drawOddsId: drawOddsRecord?.id,
        time: formatTime(match.kickoffTime),
        date: formatDate(match.kickoffTime),
        rawKickoffTime: match.kickoffTime,
        competition: match.competition,
        status: match.status.toLowerCase(),
        markets: stableMarketsCount(match),
        featured: topPicksIds.includes(match.id),
      };
    });

    const formattedFinished = safeResults.map(match => ({
      id: match.id,
      teamA: { name: normalizeTeamName(match.homeTeam), flag: getFlagCode(match.homeTeamCode), score: match.homeScore ?? 0 },
      teamB: { name: normalizeTeamName(match.awayTeam), flag: getFlagCode(match.awayTeamCode), score: match.awayScore ?? 0 },
      date: formatDate(match.kickoffTime),
      competition: match.competition,
      rawKickoffTime: match.kickoffTime,
    }));

    return { formattedUpcoming, formattedFinished };
  }, [upcoming, results]);

  const loading = matchesLoading;
  const fetchError = Boolean(matchesError && formattedUpcoming.length === 0 && formattedFinished.length === 0);

  // ─── Instant Transition Logic ──────────────────────────────
  const { dynamicUpcoming, dynamicFinished } = useMemo(() => {
    const upcomingMatches = [];
    const finishedMatches = [...formattedFinished];

    formattedUpcoming.forEach(match => {
      const kickoffMs = new Date(match.rawKickoffTime).getTime();
      let computedStatus = match.status;

      if (computedStatus !== 'finished' && currentTime >= kickoffMs) {
        computedStatus = 'live';
      }

      if (computedStatus === 'finished') {
        if (!finishedMatches.find(m => m.id === match.id)) {
          finishedMatches.unshift({
            id: match.id,
            teamA: { name: match.teamA.name, flag: match.teamA.flag, score: match.teamA.score ?? 0 },
            teamB: { name: match.teamB.name, flag: match.teamB.flag, score: match.teamB.score ?? 0 },
            date: match.date,
            competition: match.competition,
            rawKickoffTime: match.rawKickoffTime,
          });
        }
      } else {
        upcomingMatches.push({ ...match, status: computedStatus });
      }
    });

    finishedMatches.sort((a, b) => new Date(b.rawKickoffTime).getTime() - new Date(a.rawKickoffTime).getTime());

    return { dynamicUpcoming: upcomingMatches, dynamicFinished: finishedMatches };
  }, [formattedUpcoming, formattedFinished, currentTime]);

  const tabCounts = useMemo(() => dynamicUpcoming.reduce((counts, match) => {
    if (match.status === 'live') counts.live += 1;
    else if (match.date === "Aujourd'hui") counts.today += 1;
    else if (match.date === "Demain") counts.tomorrow += 1;
    else counts.upcoming += 1;
    return counts;
  }, { live: 0, today: 0, tomorrow: 0, upcoming: 0 }), [dynamicUpcoming]);

  const activeTabCount = tabCounts[activeTab] || 0;
  const nextAvailableTab = useMemo(() => ['live', 'today', 'tomorrow', 'upcoming']
    .find(tab => tabCounts[tab] > 0), [tabCounts]);

  const selectTab = (tab) => {
    setHasUserSelectedTab(true);
    setActiveTab(tab);
  };

  useEffect(() => {
    if (hasUserSelectedTab || loading || dynamicUpcoming.length === 0 || activeTabCount > 0) return;
    if (!nextAvailableTab) return;

    const timer = window.setTimeout(() => setActiveTab(nextAvailableTab), 0);
    return () => window.clearTimeout(timer);
  }, [
    hasUserSelectedTab,
    loading,
    activeTab,
    dynamicUpcoming.length,
    activeTabCount,
    nextAvailableTab,
  ]);

  // ─── Filter Logic ──────────────────────────────────────────
  const filteredUpcoming = dynamicUpcoming.filter((match) => {
    if (activeTab === 'live') return match.status === 'live';
    if (activeTab === 'today') return match.date === "Aujourd'hui" && match.status !== 'live';
    if (activeTab === 'tomorrow') return match.date === "Demain" && match.status !== 'live';
    if (activeTab === 'upcoming') return match.date !== "Aujourd'hui" && match.date !== "Demain" && match.status !== 'live';
    return true;
  });

  const emptyMatchesMessage = {
    live: 'Aucun match en Cours pour le moment.',
    today: "Aucun match prévu aujourd'hui.",
    tomorrow: 'Aucun match prévu demain.',
    upcoming: 'Aucun match à venir pour cette période.',
  }[activeTab] || 'Aucun match prévu pour cette période.';

  // ─── Pagination Logic ──────────────────────────────────────
  const totalPages = Math.ceil(dynamicFinished.length / itemsPerPage);
  const paginatedResults = dynamicFinished.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="container dashboard-page">

      {/* Hero slider */}
      <HeroSlider />

      {/* Trust bar */}
      <TrustBar />

      {/* Promo banner */}
      <div className="promo-banner-full">
        <ShieldCheck size={22} strokeWidth={2.5} />
        <span>OBTENEZ TOUJOURS 50% DE VOTRE MISE EN CAS DE PERTE SUR WORLDCUPBET</span>
      </div>

      {/* Main heading */}
      <div className="dashboard-header">
        <h1 className="dashboard-title-brand">
          PARIEZ SUR LES GRANDES RENCONTRES DE LA COUPE DU MONDE 2026
        </h1>
      </div>

      {/* ── Cotes Vedettes ──────────────────────────────────── */}
      <FeaturedOdds onAddBet={handleAddBet} />

      {/* ── Upcoming / Live matches ─────────────────────────── */}
      <div className="matches-section-header" id="sports">
        <div className="matches-section-title">
          <h2>Matchs du Jour</h2>
          <span className="matches-count">{filteredUpcoming.length} rencontres</span>
        </div>
        
        <div className="matches-tabs-wrapper">
          <div className="filter-hint">
            <span>Sélectionnez une période <span className="swipe-hint">(Glissez ↔)</span></span>
            <ArrowRight size={16} className="filter-hint-icon" />
          </div>
          <div className="matches-tabs">
            <button 
              className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
              onClick={() => selectTab('live')}
            >
              En cours
            </button>
            <button 
              className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => selectTab('today')}
            >
              Aujourd'hui
            </button>
            <button 
              className={`tab-btn ${activeTab === 'tomorrow' ? 'active' : ''}`}
              onClick={() => selectTab('tomorrow')}
            >
              Demain
            </button>
            <button 
              className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => selectTab('upcoming')}
            >
              À venir
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        /* ── Skeleton Loader ── */
        <div className="matches-skeleton-grid">
          {[1,2,3].map(i => (
            <div key={i} className="match-card-skeleton">
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-teams">
                <div className="skeleton-team">
                  <div className="skeleton-flag" />
                  <div className="skeleton-line" />
                </div>
                <div className="skeleton-vs" />
                <div className="skeleton-team">
                  <div className="skeleton-flag" />
                  <div className="skeleton-line" />
                </div>
              </div>
              <div className="skeleton-odds">
                <div className="skeleton-pill" />
                <div className="skeleton-pill" />
                <div className="skeleton-pill" />
              </div>
            </div>
          ))}
        </div>
      ) : fetchError ? (
        /* ── Error State ── */
        <div className="matches-error-card">
          <div className="matches-error-icon">⚡</div>
          <h3 className="matches-error-title">Connexion au serveur interrompue</h3>
          <p className="matches-error-desc">
            Le serveur de données est en cours de démarrage ou temporairement indisponible.<br />
            Les matchs seront chargés automatiquement dès que la connexion est rétablie.
          </p>
          <button
            className="matches-retry-btn"
            onClick={() => refreshMatches(true)}
          >
            <Loader2 size={16} />
            Réessayer maintenant
          </button>
        </div>
      ) : filteredUpcoming.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          {emptyMatchesMessage}
        </div>
      ) : (
        <div className="matches-grid">
          {filteredUpcoming.map((match) => (
            <Card key={match.id} className={`match-card ${match.featured ? 'match-card--featured' : ''}`}>

              <div className="match-card-header">
                <div className="match-card-meta">
                  {match.featured && (
                    <span className="featured-badge"><Flame size={11} /> Vedette</span>
                  )}
                  <span className="match-competition">{match.competition}</span>
                </div>
                <div className="match-card-header-right">
                  <MatchCountdown rawKickoffTime={match.rawKickoffTime} status={match.status} currentTime={currentTime} />
                  <StatusBadge status={match.status} />
                </div>
              </div>

              <div className="match-teams">
                <div className="match-team">
                  <img src={getFlagUrl(match.teamA.flag)} alt={match.teamA.name} className="team-flag-img" />
                  <span className="team-name">{match.teamA.name}</span>
                </div>
                <div className="match-center">
                  <span className="match-vs-time">{match.time}</span>
                  <span className="match-vs">VS</span>
                  <span className="match-date">{match.date}</span>
                </div>
                <div className="match-team">
                  <img src={getFlagUrl(match.teamB.flag)} alt={match.teamB.name} className="team-flag-img" />
                  <span className="team-name">{match.teamB.name}</span>
                </div>
              </div>

              {match.status !== 'live' ? (
                <>
                  <div className="match-odds-row">
                    <OddsButton
                      label="1"
                      value={match.teamA.odds}
                      canSelect={Boolean(match.teamA.oddsId)}
                      selected={betSlipBets.some(bet => bet.matchId === match.id && bet.label === '1')}
                      onSelect={(selected) => {
                        if (selected) {
                          handleAddBet({
                            id: `${match.id}-1`,
                            matchId: match.id,
                            oddsId: match.teamA.oddsId,
                            match: `${match.teamA.name} vs ${match.teamB.name}`,
                            label: '1',
                            team: match.teamA.name,
                            odds: Number(match.teamA.odds),
                          });
                          return;
                        }
                        removeBet(`${match.id}-1`);
                      }}
                    />
                    <OddsButton
                      label="X"
                      value={match.drawOdds}
                      canSelect={Boolean(match.drawOddsId)}
                      selected={betSlipBets.some(bet => bet.matchId === match.id && bet.label === 'X')}
                      onSelect={(selected) => {
                        if (selected) {
                          handleAddBet({
                            id: `${match.id}-X`,
                            matchId: match.id,
                            oddsId: match.drawOddsId,
                            match: `${match.teamA.name} vs ${match.teamB.name}`,
                            label: 'X',
                            team: 'Match Nul',
                            odds: Number(match.drawOdds),
                          });
                          return;
                        }
                        removeBet(`${match.id}-X`);
                      }}
                    />
                    <OddsButton
                      label="2"
                      value={match.teamB.odds}
                      canSelect={Boolean(match.teamB.oddsId)}
                      selected={betSlipBets.some(bet => bet.matchId === match.id && bet.label === '2')}
                      onSelect={(selected) => {
                        if (selected) {
                          handleAddBet({
                            id: `${match.id}-2`,
                            matchId: match.id,
                            oddsId: match.teamB.oddsId,
                            match: `${match.teamA.name} vs ${match.teamB.name}`,
                            label: '2',
                            team: match.teamB.name,
                            odds: Number(match.teamB.odds),
                          });
                          return;
                        }
                        removeBet(`${match.id}-2`);
                      }}
                    />
                  </div>

                  <div className="match-card-footer">
                    <span className="match-markets-info">
                      <TrendingUp size={14} />
                      +{match.markets} marchés
                    </span>
                    <Button variant="primary" className="match-bet-btn" onClick={() => openMatchOptions(match.id)}>
                      Parier sur plus d'options
                    </Button>
                  </div>
                </>
              ) : (
                <div className="live-match-notice">
                  <Info size={24} className="live-notice-icon" />
                  <span>Les résultats définitifs seront affichés à la fin du match.<br/>Les paris sont temporairement suspendus.</span>
                </div>
              )}

            </Card>
          ))}
        </div>
      )}


      {/* ── Promotions ──────────────────────────────────────── */}
      <div style={{ marginTop: 'var(--space-12)' }} id="promotions">
        <Promotions />
      </div>

      {/* ── Résultats (finished matches with scores) ─────────── */}
      <section className="results-section">
        <div className="matches-section-title">
          <h2>Résultats Récents</h2>
          <span className="matches-count">{dynamicFinished.length} matchs terminés</span>
        </div>

        {loading ? null : dynamicFinished.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Aucun résultat récent.
          </div>
        ) : (
          <>
            <div className="results-grid">
              {paginatedResults.map((match) => (
                <Card key={match.id} className="result-card">
                  <div className="result-header">
                    <span className="match-competition">{match.competition}</span>
                    <span className="result-badge">TERMINÉ</span>
                  </div>
                  <div className="result-teams">
                    <div className="result-team">
                      <img src={getFlagUrl(match.teamA.flag)} alt={match.teamA.name} className="team-flag-img-small" />
                      <span className="result-team-name">{match.teamA.name}</span>
                    </div>
                    <div className="result-score">
                      <span className={match.teamA.score > match.teamB.score ? 'score-winner' : 'score-loser'}>
                        {match.teamA.score}
                      </span>
                      <span className="score-dash">—</span>
                      <span className={match.teamB.score > match.teamA.score ? 'score-winner' : 'score-loser'}>
                        {match.teamB.score}
                      </span>
                    </div>
                    <div className="result-team result-team--right">
                      <img src={getFlagUrl(match.teamB.flag)} alt={match.teamB.name} className="team-flag-img-small" />
                      <span className="result-team-name">{match.teamB.name}</span>
                    </div>
                  </div>
                  <div className="result-date">{match.date}</div>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <button 
                  className="pagination-btn" 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Précédent
                </button>
                
                <div className="pagination-numbers">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx + 1}
                      className={`pagination-number ${currentPage === idx + 1 ? 'active' : ''}`}
                      onClick={() => handlePageChange(idx + 1)}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>

                <button 
                  className="pagination-btn" 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Floating BetSlip */}
      <BetSlip
        bets={betSlipBets}
        isOpen={betSlipOpen}
        onToggle={() => setBetSlipOpen(o => !o)}
        onRemoveBet={removeBet}
        onClearAll={clearAll}
      />

    </div>
  );
}
