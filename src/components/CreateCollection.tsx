import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useNetworkVariable } from '../config/sui';
import { uploadToWalrus } from '../config/walrus';
import { Loader2, CheckCircle2, Upload, Image as ImageIcon } from 'lucide-react';

export function CreateCollection() {
  const account = useCurrentAccount();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxSupply: '',
    royaltyBps: '',
    mintPrice: '',
  });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [collectionId, setCollectionId] = useState<string>('');

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable('dropforgePackageId');
  const registryId = useNetworkVariable('dropforgeRegistryId');

  // Handle multiple images
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(files);

    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
  };

  const handleUploadAllToWalrus = async (): Promise<string> => {
    setIsUploading(true);
    try {
      // Upload all images to Walrus
      const blobUrls: string[] = [];
      for (const file of images) {
        const blobId = await uploadToWalrus(file);
        blobUrls.push(`https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`);
      }

      // Create JSON manifest with all URLs
      const manifest = JSON.stringify(blobUrls, null, 2);
      const manifestBlobId = await uploadToWalrus(new File([manifest], 'manifest.json', { type: 'application/json' }));
      return `https://aggregator.walrus-testnet.walrus.space/v1/${manifestBlobId}`;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return alert('Connect wallet');
    if (!registryId) return alert('Registry not loaded');

    if (!images.length) return alert('Upload at least 1 image');

    setIsCreating(true);
    setSuccess(false);

    try {
      // Step 1: Upload all images + generate base URI
      const baseUri = await handleUploadAllToWalrus();

      // Step 2: Create collection
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::dropforge::create_collection`,
        arguments: [
          tx.object(registryId),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(formData.name))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(formData.description))),
          tx.pure.u64(BigInt(formData.maxSupply)),
          tx.pure.u16(Number(formData.royaltyBps)),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(baseUri))),
          tx.pure.u64(BigInt(formData.mintPrice)),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({ digest: result.digest });
            setSuccess(true);
            // You could extract collectionId from events if needed
            alert(`Collection created! Base URI: ${baseUri}`);
            setFormData({ name: '', description: '', maxSupply: '', royaltyBps: '', mintPrice: '' });
            setImages([]);
            setPreviews([]);
            setTimeout(() => setSuccess(false), 3000);
          },
          onError: (err) => {
            console.error(err);
            alert('Failed to create collection: ' + (err.message || 'Try again'));
          },
        }
      );
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 pb-20 bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl p-10"
        >
          <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Create Collection
          </h2>
          <p className="text-gray-600 mb-8">
            Upload images and automatically create NFT collection
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Images
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="w-full"
              />
              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {previews.map((src, i) => (
                    <img key={i} src={src} className="w-24 h-24 object-cover rounded-lg" />
                  ))}
                </div>
              )}
            </div>

            {/* Rest of the form: Name, Description, Max Supply, Royalty, Mint Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Collection Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label>Max Supply</label>
                <input
                  type="number"
                  required
                  value={formData.maxSupply}
                  onChange={(e) => setFormData({ ...formData, maxSupply: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label>Royalty BPS</label>
                <input
                  type="number"
                  required
                  max={10000}
                  value={formData.royaltyBps}
                  onChange={(e) => setFormData({ ...formData, royaltyBps: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            <div>
              <label>Mint Price (MIST)</label>
              <input
                type="number"
                required
                value={formData.mintPrice}
                onChange={(e) => setFormData({ ...formData, mintPrice: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating || isUploading || !images.length}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              {isCreating || isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Collection...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Collection Created!
                </>
              ) : (
                'Upload & Create Collection'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
