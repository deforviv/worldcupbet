import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Dashboard } from './pages/Dashboard';
import { MatchDetail } from './pages/MatchDetail';
import { Wallet } from './pages/Wallet';
import { Auth } from './pages/Auth';
import AdminDashboard from './pages/admin/AdminDashboard';
import { Profile } from './pages/Profile';
import { Notifications } from './pages/Notifications';
import { MyBets } from './pages/MyBets';
import { BetDetail } from './pages/BetDetail';
import './index.css';
import './App.css';
import './components/Footer.css';

// Component to handle layout wrapper
function Layout({ children }) {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';
  const isAdminPage = location.pathname.startsWith('/admin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-layout">
      {!isAuthPage && (
        <Navbar menuOpen={mobileMenuOpen} onMenuToggle={setMobileMenuOpen} />
      )}
      <main>{children}</main>
      {!isAuthPage && <Footer />}
      {!isAuthPage && <ScrollToTop />}
      {!isAuthPage && (
        <MobileBottomNav isOpen={mobileMenuOpen} onMenuOpen={() => setMobileMenuOpen(prev => !prev)} />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/bets" element={<MyBets />} />
          <Route path="/bets/:id" element={<BetDetail />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
