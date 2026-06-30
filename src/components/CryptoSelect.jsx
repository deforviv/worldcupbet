import { useState, useRef, useEffect } from 'react';
import './CryptoSelect.css';

export function CryptoSelect({ value, onChange, options = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const label = value || options[0] || '';
  function parse(opt) {
    const value = opt || '';
    const parenMatch = /^(\w+)\s*\(([^)]+)\)$/.exec(value);
    if (parenMatch) {
      return { token: parenMatch[1], chain: parenMatch[2] };
    }
    const parts = value.split(/\s+(.+)/);
    return { token: parts[0] || value, chain: parts[1] || '' };
  }
  function assetKey(tok) { return (tok || '').toLowerCase(); }

  return (
    <div className="crypto-select-dropdown" ref={ref}>
      <button
        type="button"
        className="crypto-selected"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {(() => {
          const p = parse(label);
          return (
            <>
              <span className={`crypto-logo logo-${assetKey(p.token)}`}>{p.token.startsWith('USDT') ? '₮' : p.token.startsWith('BTC') ? '฿' : p.token.startsWith('ETH') ? 'Ξ' : p.token[0]}</span>
              <span className="crypto-label">{p.token} {p.chain ? <small className="crypto-chain">{p.chain}</small> : null}</span>
            </>
          );
        })()}
        <span className="crypto-chevron">▾</span>
      </button>

      {open && (
        <div className="crypto-options" role="listbox">
          {options.map(opt => {
            const p = parse(opt);
            return (
              <button key={opt} type="button" role="option" className={`crypto-option ${opt === value ? 'active' : ''}`} onClick={() => { onChange(opt); setOpen(false); }}>
                <span className={`crypto-logo logo-${assetKey(p.token)}`}>{p.token.startsWith('USDT') ? '₮' : p.token.startsWith('BTC') ? '฿' : p.token.startsWith('ETH') ? 'Ξ' : p.token[0]}</span>
                <span className="crypto-label">{p.token} {p.chain ? <small className="crypto-chain">{p.chain}</small> : null}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CryptoSelect;
