import { ConnectButton } from '@mysten/dapp-kit';
import { Rocket } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function Navigation() {
  const location = useLocation();

  const tabs = [
    { id: '/', label: 'Home' },
    { id: '/collections', label: 'Collections' },
    { id: '/create', label: 'Create' },
    { id: '/mint', label: 'Mint' },
    { id: '/launchpad', label: 'Launchpad' },
  ];

  // Check if current path matches the tab
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              DropForge
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 bg-gray-100 rounded-full p-1">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.id}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive(tab.id)
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <ConnectButton className="!bg-gradient-to-r !from-blue-500 !to-cyan-500 !text-white !rounded-full !px-6 !py-2.5 !font-medium hover:!shadow-lg !transition-all" />
        </div>
      </div>
    </nav>
  );
}