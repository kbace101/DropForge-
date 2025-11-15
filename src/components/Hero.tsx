import { motion } from 'framer-motion';
import { Sparkles, Coins, ImagePlus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Hero() {
  const features = [
    {
      icon: ImagePlus,
      title: 'Create NFT Collections',
      description: 'Launch your own NFT collection with customizable royalties and metadata',
      route: '/create',
    },
    {
      icon: Sparkles,
      title: 'Mint & Trade',
      description: 'Mint NFTs with decentralized storage on Walrus and trade on the marketplace',
      route: '/mint',
    },
    {
      icon: Coins,
      title: 'Launch Tokens',
      description: 'Create and manage your own tokens with full control over supply',
      route: '/launchpad',
    },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-cyan-50 to-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%),radial-gradient(circle_at_70%_60%,rgba(6,182,212,0.1),transparent_50%)]" />

      <div className="relative max-w-7xl mx-auto px-6 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-7xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent leading-tight">
            The Future of
            <br />
            Digital Assets
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Create, mint, and trade NFTs with decentralized storage on Walrus.
            <br />
            Launch your own tokens. All on Sui blockchain.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 mt-20"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <Link
                to={feature.route}
                className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all border border-gray-200 text-left block"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                <div className="mt-6 text-blue-600 font-medium group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                  Get Started →
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}