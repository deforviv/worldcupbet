import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Tabs } from '../components/Tabs';
import { ArrowUpRight, ArrowDownLeft, Bitcoin, CheckCircle, AlertCircle } from 'lucide-react';
import CryptoSelect from '../components/CryptoSelect';
import { authFetchJson, getAuthToken } from '../config/api';
import './Wallet.css';

const TABS = [
  { id: 'deposit', label: 'Dépôt' },
  { id: 'withdraw', label: 'Retrait' },
  { id: 'history', label: 'Historique' }
];

const TYPE_LABELS = {
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  BET_PLACED: 'Pari placé',
  BET_WIN: 'Gains',
  BET_REFUND: 'Remboursement',
};

const DEPOSIT_ADDRESSES = {
  'USDT TRC20/Tron': 'TG1ZibDCAnQcEEA6nwwbnNFutiZHHowamt',
  'USDT ERC20/Tether': '0xe00cC9E440112a2236c8E6aA43e604aB7Bd76B9E',
  BTC: 'bc1qmc64hrjp4re4lzhkknsc4f3jmmc8j5clpa32jl',
  ETH: '0xe00cC9E440112a2236c8E6aA43e604aB7Bd76B9E',
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

export function Wallet() {
  const location = useLocation();
  const navigate = useNavigate();
  const defaultTab = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    return TABS.some(item => item.id === tab) ? tab : 'deposit';
  }, [location.search]);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [depositMethod, setDepositMethod] = useState('CRYPTO');
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [depositReference, setDepositReference] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCrypto, setDepositCrypto] = useState('USDT TRC20/Tron');
  const [copied, setCopied] = useState(false);
  const [depositScreenshot, setDepositScreenshot] = useState(null);
  const screenshotInputRef = useRef(null);

  const [withdrawMethod, setWithdrawMethod] = useState('CRYPTO');
  const [withdrawDestination, setWithdrawDestination] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCrypto, setWithdrawCrypto] = useState('USDT (TRC20)');

  const wallet = walletData?.wallet;
  const transactions = walletData?.transactions || [];
  const HISTORY_LIMIT = 10;
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const historyFilters = [
    { id: 'ALL', label: 'Tous' },
    { id: 'DEPOSIT', label: 'Dépôts' },
    { id: 'WITHDRAWAL', label: 'Retraits' },
    { id: 'BET_WIN', label: 'Gains' },
    { id: 'BET_REFUND', label: 'Remboursements' },
  ];

  const filteredTransactions = useMemo(() => {
    if (historyFilter === 'ALL') return [...transactions];
    return transactions.filter((tx) => tx.type === historyFilter);
  }, [transactions, historyFilter]);

  const visibleTransactions = useMemo(() => {
    return showAllHistory ? filteredTransactions : filteredTransactions.slice(0, HISTORY_LIMIT);
  }, [filteredTransactions, showAllHistory]);

  const historyCanExpand = filteredTransactions.length > HISTORY_LIMIT;

  async function loadWallet() {
    setLoading(true);
    setError('');
    try {
      const data = await authFetchJson('/wallet', { timeoutMs: 25000 });
      setWalletData(data);
    } catch (err) {
      setError(err.message || 'Impossible de charger le portefeuille.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handleWalletChanged = () => {
      if (getAuthToken()) {
        loadWallet();
      }
    };

    const timer = getAuthToken() ? window.setTimeout(loadWallet, 0) : null;
    window.addEventListener('wallet:changed', handleWalletChanged);

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
      window.removeEventListener('wallet:changed', handleWalletChanged);
    };
  }, []);

  function changeTab(tab) {
    setActiveTab(tab);
    setNotice('');
    setError('');
    navigate(`/wallet?tab=${tab}`, { replace: true });
  }

  async function handleDeposit(e) {
    e.preventDefault();
    const amount = Number(depositAmount);
    const reference = depositReference.trim();

    if (!Number.isFinite(amount) || amount < 500) {
      setError('Le dépôt minimum est de 500 EUR.');
      return;
    }
    if (reference.length < 5) {
      setError('Saisissez une référence de transaction crypto valide.');
      return;
    }
    if (!depositScreenshot) {
      setError('Veuillez télécharger une capture d\'écran du paiement.');
      return;
    }

    setActionLoading(true);
    setError('');
    setNotice('');

    try {
      let result;
      const fd = new FormData();
      fd.append('amount', amount);
      fd.append('method', depositMethod);
      fd.append('reference', reference);
      fd.append('crypto', depositCrypto);
      fd.append('screenshot', depositScreenshot);

      result = await authFetchJson('/wallet/deposit', {
        method: 'POST',
        body: fd,
      });

      setNotice(result?.message || 'Votre demande de dépôt a été envoyée. Elle est en attente de validation.');
      setDepositAmount('');
      setDepositReference('');
      setDepositScreenshot(null);
      if (screenshotInputRef.current) {
        screenshotInputRef.current.value = '';
      }
      await loadWallet();
      window.dispatchEvent(new Event('wallet:changed'));
    } catch (err) {
      setError(err.message || 'Dépôt impossible pour le moment.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWithdraw(e) {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    const destination = withdrawDestination.trim();

    if (!Number.isFinite(amount) || amount < 1000) {
      setError('Le retrait minimum est de 1 000 EUR.');
      return;
    }
    if (destination.length < 5) {
      setError('Saisissez une destination valide pour le retrait.');
      return;
    }

    setActionLoading(true);
    setError('');
    setNotice('');

    try {
      await authFetchJson('/wallet/withdraw', {
        method: 'POST',
        body: { amount, method: withdrawMethod, destination },
      });
      setNotice('Demande de retrait enregistrée. Elle apparaît maintenant dans votre historique.');
      setWithdrawAmount('');
      setWithdrawDestination('');
      await loadWallet();
      window.dispatchEvent(new Event('wallet:changed'));
      setActiveTab('history');
      navigate('/wallet?tab=history', { replace: true });
    } catch (err) {
      setError(err.message || 'Retrait impossible pour le moment.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="container wallet-page">
      {(notice || error) && (
        <div className={`wallet-alert ${error ? 'wallet-alert--error' : 'wallet-alert--success'}`}>
          {error ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{error || notice}</span>
        </div>
      )}

      <div className="wallet-layout">
        {/* Balance Section */}
        <div className="wallet-sidebar">
          <Card className="balance-card">
            <span className="text-secondary font-medium">Solde Total</span>
            <h1 className="balance-amount">
              {loading ? '...' : formatAmount(wallet?.balance)}
            </h1>
            <div className="wallet-owner">
              <span>{wallet?.user?.username || 'Compte connecté'}</span>
              <small>{wallet?.user?.email}</small>
            </div>
            
            <div className="balance-actions">
              <Button fullWidth variant="primary" onClick={() => changeTab('deposit')}>
                <ArrowDownLeft size={16} /> Dépôt
              </Button>
              <Button fullWidth variant="outline" onClick={() => changeTab('withdraw')}>
                <ArrowUpRight size={16} /> Retrait
              </Button>
            </div>
          </Card>
        </div>

        {/* Main Section */}
        <div className="wallet-main">
          <Tabs tabs={TABS} activeTab={activeTab} onChange={changeTab} />

          {activeTab === 'deposit' && (
            <Card>
              <h2 className="wallet-section-title">Sélectionnez la Méthode de Dépôt</h2>
              <div className="deposit-methods" role="group" aria-label="Méthode de dépôt">
                <button
                  className={`method-btn ${depositMethod === 'CRYPTO' ? 'active' : ''}`}
                  onClick={() => setDepositMethod('CRYPTO')}
                >
                  <Bitcoin size={24} />
                  <span>Crypto (BTC/USDT)</span>
                </button>
              </div>

              <form className="deposit-form" onSubmit={handleDeposit}>
                <>
                  <label className="input-label">Sélectionnez la Cryptomonnaie</label>
                  <CryptoSelect
                    value={depositCrypto}
                    onChange={setDepositCrypto}
                    options={["USDT TRC20/Tron", "USDT ERC20/Tether", "BTC", "ETH"]}
                  />
                  <div className="input-group wallet-address-group">
                    <label className="input-label">Envoyez les fonds sur cette adresse</label>
                    <div className="wallet-address-input-row">
                      <input
                        className="input-field"
                        readOnly
                        value={DEPOSIT_ADDRESSES[depositCrypto] || ''}
                        aria-label={`Adresse de dépôt pour ${depositCrypto}`}
                      />
                      <Button
                        type="button"
                        variant="primary"
                        className={`btn-copy-address ${copied ? 'copied' : ''}`}
                        onClick={async () => {
                          const addr = DEPOSIT_ADDRESSES[depositCrypto] || '';
                          try {
                            await navigator.clipboard.writeText(addr || '');
                            setCopied(true);
                            setNotice('Adresse copiée.');
                            setTimeout(() => setNotice(''), 2200);
                            setTimeout(() => setCopied(false), 2000);
                          } catch (err) {
                            setNotice('Impossible de copier l\'adresse.');
                            setTimeout(() => setNotice(''), 2200);
                          }
                        }}
                      >
                        {copied ? 'Adresse copiée ✓' : "Copier l'adresse"}
                      </Button>
                    </div>
                    <Input
                      label="Référence de transaction"
                      type="text"
                      placeholder="Ex: TX123456789"
                      value={depositReference}
                      onChange={e => setDepositReference(e.target.value)}
                    />
                    <div className="input-group">
                      <label className="input-label">Capture du paiement (obligatoire)</label>
                      <input
                        ref={screenshotInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="input-field"
                        onChange={e => setDepositScreenshot(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                      />
                    </div>
                  </div>
                  <Input
                    label="Montant (EUR)"
                    type="number"
                    min="500"
                    placeholder="500"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                  />
                </>
                
                <div className="deposit-instruction">
                  Après envoi des fonds sur l'adresse, faites une capture d'écran puis cliquez sur le bouton dessous pour soumettre. Votre compte sera crédité en moins de 5 min.
                </div>
                <Button variant="primary" className="mt-4" disabled={actionLoading}>
                  {actionLoading ? 'Traitement...' : "Envoyer la capture du paiement"}
                </Button>
              </form>
            </Card>
          )}

          {activeTab === 'withdraw' && (
            <Card>
              <h2 className="wallet-section-title">Retirer des Fonds</h2>
              <form className="deposit-form" onSubmit={handleWithdraw}>
                <div className="deposit-methods deposit-methods--compact" role="group" aria-label="Méthode de retrait">
                  <button
                    type="button"
                    className={`method-btn ${withdrawMethod === 'CRYPTO' ? 'active' : ''}`}
                    onClick={() => setWithdrawMethod('CRYPTO')}
                  >
                    <Bitcoin size={22} />
                    <span>Crypto</span>
                  </button>
                </div>
                <label className="input-label">Sélectionnez la Cryptomonnaie</label>
                <CryptoSelect
                  value={withdrawCrypto}
                  onChange={setWithdrawCrypto}
                  options={["USDT (TRC20)", "USDT (ERC20)", "BTC", "ETH"]}
                />
                <Input
                  label="Montant à Retirer (EUR)"
                  type="number"
                  min="1000"
                  placeholder="1000"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                />
                <Input
                  label="Adresse portefeuille crypto"
                  placeholder="Adresse USDT / BTC"
                  value={withdrawDestination}
                  onChange={e => setWithdrawDestination(e.target.value)}
                />
                <Button variant="primary" className="mt-4" disabled={actionLoading}>
                  {actionLoading ? 'Traitement...' : 'Demander le Retrait'}
                </Button>
              </form>
            </Card>
          )}

          {activeTab === 'history' && (
            <Card noPadding>
              <div className="history-controls">
                <div className="history-filter-list" role="group" aria-label="Filtres d'historique">
                  {historyFilters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className={`history-filter-btn ${historyFilter === filter.id ? 'active' : ''}`}
                      onClick={() => {
                        setHistoryFilter(filter.id);
                        setShowAllHistory(false);
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="history-summary">
                  {filteredTransactions.length === 0 ? 'Aucun résultat' : `${filteredTransactions.length} transaction${filteredTransactions.length > 1 ? 's' : ''}`}
                  {historyCanExpand && !showAllHistory && ` — ${HISTORY_LIMIT} dernières affichées`}
                </div>
              </div>

              <div className="transaction-list">
                {loading && (
                  <div className="wallet-empty-state">Chargement de l'historique...</div>
                )}

                {!loading && transactions.length === 0 && (
                  <div className="wallet-empty-state">Aucune transaction pour le moment.</div>
                )}

                {!loading && visibleTransactions.map((tx) => {
                  const amount = Number(tx.amount || 0);
                  const isCredit = amount >= 0;
                  return (
                    <div key={tx.id} className="transaction-item">
                      <div className={`tx-icon ${isCredit ? 'tx-icon-green' : ''}`}>
                        {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div className="tx-body">
                        <div className="tx-main">
                          <div className="tx-title">{TYPE_LABELS[tx.type] || tx.type}</div>
                          <div className="tx-date">{formatDate(tx.createdAt)}</div>
                        </div>
                        <div className="tx-desc">
                          {tx.description || 'Portefeuille'}
                        </div>
                      </div>
                      <div className="tx-amount-col">
                        <div className={`amount ${isCredit ? 'positive' : ''}`}>{isCredit ? '+' : ''}{formatAmount(amount)}</div>
                        <div className="status">
                          <span className={`tx-badge ${tx.type === 'DEPOSIT' ? 'deposit' : tx.type === 'WITHDRAWAL' ? 'withdraw' : tx.type === 'BET_WIN' ? 'win' : tx.type === 'BET_REFUND' ? 'refund' : ''}`}>
                            {TYPE_LABELS[tx.type] || tx.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!loading && historyCanExpand && (
                  <div className="history-footer">
                    <button
                      type="button"
                      className="history-toggle-btn"
                      onClick={() => setShowAllHistory((current) => !current)}
                    >
                      {showAllHistory ? 'Réduire' : 'Voir plus'}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
