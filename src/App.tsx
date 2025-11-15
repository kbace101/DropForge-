import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { Hero } from './components/Hero';
import { CreateCollection } from './components/CreateCollection';
import { Collections } from './components/Collections';
import { Launchpad } from './components/Launchpad';
import { UserCollections } from './components/UserCollections';
import { MintPage } from './pages/MintPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Navigation />
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/create" element={<CreateCollection />} />
          <Route path="/mint" element={<UserCollections />} />
          <Route path="/mint/:collectionId" element={<MintPage />} />
          <Route path="/launchpad" element={<Launchpad />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;