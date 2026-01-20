
import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './components/Home';
import Test from './components/Test';
import Result from './components/Result';
import History from './components/History';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isTestPage = location.pathname.includes('/test');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">
              SpeakLevel AI
            </span>
          </Link>
          {!isTestPage && (
            <nav className="flex items-center space-x-6">
              <Link to="/" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">Home</Link>
              <Link to="/history" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">History</Link>
              <Link to="/test" className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm">
                Take Test
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col">
        {children}
      </main>

      {!isTestPage && (
        <footer className="bg-white border-t border-slate-200 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-slate-500 text-sm">© 2024 SpeakLevel AI. All rights reserved.</p>
            <p className="text-slate-400 text-xs mt-1">Powered by Gemini AI Studio</p>
          </div>
        </footer>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/test" element={<Test />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
