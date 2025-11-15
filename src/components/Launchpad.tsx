import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useNetworkVariable } from '../config/sui';
import { uploadToWalrus, getWalrusUrl } from '../config/walrus';
import { Loader2, CheckCircle2, Rocket, Upload, AlertCircle } from 'lucide-react';

export function Launchpad() {
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    decimals: '9',
    initialSupply: '1000000000',
    iconUrl: '',
  });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable('dropforgePackageId');

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadIcon = async () => {
    if (!iconFile) return;

    setIsUploading(true);
    setError(null);
    try {
      const blobId = await uploadToWalrus(iconFile);
      const iconUrl = getWalrusUrl(blobId);
      setFormData({ ...formData, iconUrl });
      alert('Icon uploaded to Walrus successfully!');
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError('Failed to upload icon to Walrus');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.iconUrl) {
      setError('Please upload an icon first');
      return;
    }

    if (!formData.name || !formData.symbol || !formData.initialSupply) {
      setError('All fields are required');
      return;
    }

    const decimals = parseInt(formData.decimals);
    if (isNaN(decimals) || decimals < 0 || decimals > 18) {
      setError('Decimals must be 0–18');
      return;
    }

    const supply = BigInt(formData.initialSupply);
    if (supply <= 0n) {
      setError('Initial supply must be > 0');
      return;
    }

    setIsLaunching(true);
    setSuccess(false);
    setError(null);

    try {
      const tx = new Transaction();

      // Calculate actual supply based on decimals
      const actualSupply = supply * (10n ** BigInt(decimals));

      // Call launch_token - custom balance-based token
      tx.moveCall({
        target: `${packageId}::dropforge::launch_token`,
        arguments: [
          tx.pure.string(formData.name),         // name
          tx.pure.string(formData.symbol),       // symbol
          tx.pure.u8(decimals),                  // decimals
          tx.pure.string(formData.iconUrl),      // icon_url
          tx.pure.u64(actualSupply.toString()),  // initial_supply
          tx.pure.u64('0'),                      // max_supply (0 = unlimited)
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('Transaction successful:', result.digest);
            await suiClient.waitForTransaction({ digest: result.digest });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 5000);
            // Reset form
            setFormData({
              name: '',
              symbol: '',
              decimals: '9',
              initialSupply: '1000000000',
              iconUrl: '',
            });
            setIconFile(null);
            setIconPreview('');
          },
          onError: (err: any) => {
            console.error('Launch failed:', err);
            setError(err.message || 'Transaction failed');
          },
        }
      );
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Unexpected error');
    } finally {
      setIsLaunching(false);
    }
  };

  const displaySupply = () => {
    const supply = formData.initialSupply;
    const decimals = parseInt(formData.decimals) || 0;
    if (!supply || isNaN(Number(supply))) return '—';
    const num = Number(supply);
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' (base units)';
  };

  return (
    <div className="min-h-screen pt-32 pb-20 bg-gradient-to-br from-cyan-50 via-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full mb-6">
            <Rocket className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            Token Launchpad
          </h2>
          <p className="text-xl text-gray-600">
            Launch your own token on Sui blockchain
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-xl p-10"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* === ICON UPLOAD === */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token Icon <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-cyan-500 transition-colors">
                {iconPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={iconPreview}
                      alt="Icon preview"
                      className="w-32 h-32 rounded-full mx-auto object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIconFile(null);
                        setIconPreview('');
                        setFormData({ ...formData, iconUrl: '' });
                      }}
                      className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                      <Upload className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-2">Click to upload icon</p>
                    <p className="text-sm text-gray-400">PNG, JPG • 512x512 recommended</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleIconChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {iconFile && !formData.iconUrl && (
                <button
                  type="button"
                  onClick={handleUploadIcon}
                  disabled={isUploading}
                  className="mt-4 w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading to Walrus...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload to Walrus
                    </>
                  )}
                </button>
              )}

              {formData.iconUrl && (
                <div className="mt-4 p-4 bg-green-50 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-800">Icon uploaded to Walrus</p>
                </div>
              )}
            </div>

            {/* === TOKEN INFO === */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all outline-none"
                  placeholder="My Awesome Token"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbol <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all outline-none"
                  placeholder="MAT"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decimals (0–18)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="18"
                  value={formData.decimals}
                  onChange={(e) => setFormData({ ...formData, decimals: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all outline-none"
                  placeholder="9"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Standard: 9 (like SUI), 6 (like USDC), or 18 (like ETH)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Supply <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.initialSupply}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, initialSupply: val });
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all outline-none"
                  placeholder="1000000000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {displaySupply()}
                </p>
              </div>
            </div>

            {/* === ERROR MESSAGE === */}
            {error && (
              <div className="p-4 bg-red-50 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* === SUCCESS MESSAGE === */}
            {success && (
              <div className="p-4 bg-green-50 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800">
                  Token launched successfully! Check your wallet for the initial supply.
                </p>
              </div>
            )}

            {/* === LAUNCH BUTTON === */}
            <button
              type="submit"
              disabled={isLaunching || !formData.iconUrl}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-4 rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Launching Token...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Token Launched!
                </>
              ) : (
                <>
                  <Rocket className="w-6 h-6" />
                  Launch Token
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* === STATS === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12 grid md:grid-cols-3 gap-6"
        >
          {[
            { label: 'Storage', value: 'Walrus' },
            { label: 'Network', value: 'Sui Testnet' },
            { label: 'Launch Cost', value: 'Gas Only' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-lg text-center">
              <p className="text-gray-500 text-sm mb-2">{stat.label}</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                {stat.value}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}