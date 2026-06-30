import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFlagUrl, normalizeTeamName } from '../utils/flags';
import { fetchJsonWithRetry } from '../config/api';
import './SearchModal.css';

export function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJsonWithRetry('/matches?limit=200', {
        timeoutMs: 12000,
        cacheMs: 120000,
      });
      const allMatches = Array.isArray(data?.matches) ? data.matches : [];
      const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.id, item])).values());
      setMatches(uniqueMatches);
    } catch (err) {
      console.error('Search fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      if (matches.length === 0) {
        fetchMatches();
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [isOpen, matches.length, fetchMatches]);

  useEffect(() => {
    if (isOpen) return;
    const timer = window.setTimeout(() => {
      setQuery('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter matches based on query
  const filteredMatches = matches.filter((m) => {
    const q = query.toLowerCase();
    const home = (m.homeTeam || '').toLowerCase();
    const away = (m.awayTeam || '').toLowerCase();
    const comp = (m.competition || '').toLowerCase();
    return home.includes(q) || away.includes(q) || comp.includes(q);
  });

  const handleResultClick = (id) => {
    onClose();
    navigate(`/match/${id}`);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter' || filteredMatches.length === 0) return;
    e.preventDefault();
    handleResultClick(filteredMatches[0].id);
  };

  return (
    <div className="search-overlay">
      <div className="search-backdrop" onClick={onClose} />
      <div className="search-modal">
        <div className="search-header">
          <div className="search-input-wrapper">
            <Search size={22} className="search-icon-inside" />
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Rechercher une équipe, un pays, une compétition..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <button className="search-close-btn" onClick={onClose} aria-label="Fermer">
            <X size={24} />
          </button>
        </div>

        <div className="search-results">
          {query.length === 0 ? (
            <div className="search-empty-state">
              <Search size={48} strokeWidth={1} />
              <p>Que cherchez-vous ?</p>
              <span>Tapez le nom d'une équipe comme "France" ou "Brésil"</span>
            </div>
          ) : loading ? (
            <div className="search-loading">Recherche en cours...</div>
          ) : filteredMatches.length > 0 ? (
            <div className="search-results-list">
              <h3 className="search-results-title">Résultats ({filteredMatches.length})</h3>
              {filteredMatches.slice(0, 10).map((match) => (
                <button
                  type="button"
                  key={match.id} 
                  className="search-result-item"
                  onClick={() => handleResultClick(match.id)}
                >
                  <div className="search-result-teams">
                    <div className="search-team">
                      <img src={getFlagUrl(match.homeTeamCode)} alt={normalizeTeamName(match.homeTeam)} />
                      <span>{normalizeTeamName(match.homeTeam)}</span>
                    </div>
                    <span className="search-vs">VS</span>
                    <div className="search-team">
                      <img src={getFlagUrl(match.awayTeamCode)} alt={normalizeTeamName(match.awayTeam)} />
                      <span>{normalizeTeamName(match.awayTeam)}</span>
                    </div>
                  </div>
                  <div className="search-result-meta">
                    <span className="search-competition">{match.competition}</span>
                    <ArrowRight size={16} className="search-go-icon" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="search-empty-state">
              <Calendar size={48} strokeWidth={1} />
              <p>Aucun match trouvé</p>
              <span>Essayez un autre terme de recherche.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
