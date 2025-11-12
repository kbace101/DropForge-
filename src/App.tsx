import { useState } from 'react';
import { Navigation } from './components/Navigation';
import { Hero } from './components/Hero';
import { CreateCollection } from './components/CreateCollection';
import { MintNFT } from './components/MintNFT';
import { Collections } from './components/Collections';
import { Launchpad } from './components/Launchpad';
import { UserCollections } from './components/UserCollections';

function App() {
  const [activeTab, setActiveTab] = useState('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Hero onNavigate={setActiveTab} />;
      case 'collections':
        return <Collections />;
      case 'create':
        return <CreateCollection />;
      case 'mint':
        return <UserCollections />;
      case 'launchpad':
        return <Launchpad />;
      default:
        return <Hero onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      {renderContent()}
    </div>
  );
}

export default App;
