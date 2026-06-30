import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, Clock } from 'lucide-react';
import { getFlagUrl, getFlagCode, normalizeTeamName } from '../utils/flags';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useMatchesData } from '../hooks/useMatchesData';
import './FeaturedOdds.css';

function useCountdown(kickoffTime) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    function calc() {
      const diff = new Date(kickoffTime).getTime() - Date.now();
      if (diff <= 0) { setCountdown('EN COURS'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [kickoffTime]);

  return countdown;
}

function stableMarketsCount(matchId) {
  if (!matchId) return 120;
  const seed = String(matchId).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 120 + (seed % 30);
}

function FeaturedCard({ match, onAddBet }) {
  const requireAuth = useRequireAuth();
  const navigate = useNavigate();
  const countdown = useCountdown(match.rawKickoffTime);
  const [selected, setSelected] = useState(null);

  const isLive = match.status === 'live';

  return (
    <div className="featured-odds-card">
      {/* Glow accent bar */}
      <div className="featured-accent-bar" />

      <div className="featured-header">
        <div className="featured-badge-group">
          <span className="featured-zap-badge"><Zap size={12} /> PRONO DU JOUR</span>
          <span className="featured-competition">{match.competition}</span>
        </div>
        <div className={`featured-timer ${isLive ? 'featured-timer--live' : ''}`}>
          {isLive
            ? <><span className="live-pulse" />EN DIRECT</>
            : <><Clock size={13} />{countdown}</>
          }
        </div>
      </div>

      <div className="featured-teams">
        <div className="featured-team">
          <img
            src={getFlagUrl(match.teamA.flag)}
            alt={match.teamA.name}
            className="featured-flag"
          />
          <span className="featured-team-name">{match.teamA.name}</span>
        </div>
        <div className="featured-vs-block">
          <span className="featured-vs">VS</span>
          <span className="featured-kickoff">{match.time}</span>
        </div>
        <div className="featured-team featured-team--right">
          <img
            src={getFlagUrl(match.teamB.flag)}
            alt={match.teamB.name}
            className="featured-flag"
          />
          <span className="featured-team-name">{match.teamB.name}</span>
        </div>
      </div>

      <div className="featured-odds-row">
        {[
          { key: '1', label: '1', value: match.teamA.odds, oddsId: match.teamA.oddsId, sublabel: match.teamA.name },
          { key: 'X', label: 'X', value: match.drawOdds, oddsId: match.drawOddsId, sublabel: 'Match Nul' },
          { key: '2', label: '2', value: match.teamB.odds, oddsId: match.teamB.oddsId, sublabel: match.teamB.name },
        ].map(o => (
          <button
            key={o.key}
            className={`featured-odds-btn ${selected === o.key ? 'featured-odds-btn--selected' : ''}`}
            disabled={isLive || !o.value || !o.oddsId}
            onClick={() => requireAuth(() => {
              if (isLive) return;
              setSelected(p => p === o.key ? null : o.key);
              if (onAddBet) {
                onAddBet({
                  id: o.oddsId,
                  matchId: match.id,
                  oddsId: o.oddsId,
                  match: `${match.teamA.name} vs ${match.teamB.name}`,
                  label: o.label,
                  team: o.sublabel,
                  odds: Number(o.value),
                });
              }
            })}
          >
            <span className="fob-sublabel">{o.sublabel}</span>
            <span className="fob-label">{o.label}</span>
            <span className="fob-value">{o.value ? Number(o.value).toFixed(2) : '-.--'}</span>
            {selected === o.key && <span className="fob-check">✓</span>}
          </button>
        ))}
      </div>

      <div className="featured-footer">
        <span className="featured-markets"><TrendingUp size={13} /> +{match.markets} marchés disponibles</span>
        <button
          className="featured-cta-btn"
          onClick={() => requireAuth(() => navigate(`/match/${match.id}`))}
        >
          Voir tous les marchés →
        </button>
      </div>
    </div>
  );
}

export function FeaturedOdds({ onAddBet }) {
  const { upcoming } = useMatchesData();

  const matches = useMemo(() => {
    if (!Array.isArray(upcoming) || upcoming.length === 0) return [];

    const ELITE = ['Germany', 'Spain', 'Brazil', 'England', 'Argentina', 'France', 'Portugal', 'Netherlands', 'Italy', 'Belgium'];
    const now = new Date();

    const scored = upcoming.map(m => {
      let score = 0;
      const homeElite = ELITE.some(e => m.homeTeam?.includes(e));
      const awayElite = ELITE.some(e => m.awayTeam?.includes(e));
      if (homeElite && awayElite) score += 1000;
      else if (homeElite || awayElite) score += 500;
      const hoursUntil = (new Date(m.kickoffTime) - now) / 3600000;
      score -= hoursUntil;
      return { ...m, score };
    });

    const topPicks = scored.sort((a, b) => b.score - a.score).slice(0, 2);

    return topPicks.map((featured) => {
      const homeOddsRecord = featured.odds?.find(o => o.marketType === 'HOME_WIN');
      const drawOddsRecord = featured.odds?.find(o => o.marketType === 'DRAW');
      const awayOddsRecord = featured.odds?.find(o => o.marketType === 'AWAY_WIN');

      return {
        id: featured.id,
        teamA: {
          name: normalizeTeamName(featured.homeTeam),
          flag: getFlagCode(featured.homeTeamCode),
          odds: homeOddsRecord?.odds,
          oddsId: homeOddsRecord?.id,
        },
        teamB: {
          name: normalizeTeamName(featured.awayTeam),
          flag: getFlagCode(featured.awayTeamCode),
          odds: awayOddsRecord?.odds,
          oddsId: awayOddsRecord?.id,
        },
        drawOdds: drawOddsRecord?.odds,
        drawOddsId: drawOddsRecord?.id,
        time: new Date(featured.kickoffTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        rawKickoffTime: featured.kickoffTime,
        competition: featured.competition,
        status: featured.status?.toLowerCase(),
        markets: stableMarketsCount(featured.id),
      };
    });
  }, [upcoming]);

  if (!matches || matches.length === 0) return null;

  return (
    <section className="featured-odds-section">
      <div className="featured-section-header">
        <div className="featured-section-title-group">
          <Zap size={20} className="featured-section-icon" />
          <h2 className="featured-section-title">Cotes Vedettes</h2>
          <span className="featured-section-subtitle">— Pronos du Jour</span>
        </div>
        <div className="featured-section-hint">Cotes mises à jour en temps réel</div>
      </div>
      <div className="featured-odds-container">
        {matches.map(m => <FeaturedCard key={m.id} match={m} onAddBet={onAddBet} />)}
      </div>
    </section>
  );
}
