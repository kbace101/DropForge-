import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useNetworkVariable } from '../config/sui';
import { uploadToWalrus, getWalrusUrl } from '../config/walrus';
import { Loader2, CheckCircle2, Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';

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
  const [uploadProgress, setUploadProgress] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string>('');

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable('dropforgePackageId');
  const registryId = useNetworkVariable('dropforgeRegistryId');

  // Handle multiple images
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(files);
    setError('');

    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
  };

  const handleUploadAllToWalrus = async (): Promise<string> => {
    setIsUploading(true);
    setError('');
    
    try {
      setUploadProgress('Uploading images to Walrus...');
      
      // Upload all images to Walrus
      const blobUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        setUploadProgress(`Uploading image ${i + 1}/${images.length}...`);
        
        try {
          const blobId = await uploadToWalrus(file);
          console.log(`Image ${i + 1} uploaded, blob ID:`, blobId);
          
          const walrusUrl = getWalrusUrl(blobId);
          blobUrls.push(walrusUrl);
          
          // Verify the image is accessible
          const verifyRes = await fetch(walrusUrl, { method: 'HEAD' });
          if (!verifyRes.ok) {
            throw new Error(`Image ${i + 1} upload verification failed`);
          }
        } catch (err) {
          console.error(`Failed to upload image ${i + 1}:`, err);
          throw new Error(`Failed to upload image ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      console.log('All images uploaded:', blobUrls);
      setUploadProgress('Creating manifest...');

      // Create JSON manifest with all URLs
      const manifest = JSON.stringify(blobUrls, null, 2);
      console.log('Manifest JSON:', manifest);
      
      const manifestBlob = new Blob([manifest], { type: 'application/json' });
      const manifestFile = new File([manifestBlob], 'manifest.json', { type: 'application/json' });
      
      console.log('Uploading manifest to Walrus...');
      const manifestBlobId = await uploadToWalrus(manifestFile);
      console.log('Manifest uploaded, blob ID:', manifestBlobId);
      
      const manifestUrl = getWalrusUrl(manifestBlobId);
      console.log('Manifest URL:', manifestUrl);
      
      // Verify the manifest is accessible
      setUploadProgress('Verifying manifest...');
      const verifyManifest = await fetch(manifestUrl);
      if (!verifyManifest.ok) {
        throw new Error('Manifest upload verification failed - manifest not accessible');
      }
      
      const verifiedManifest = await verifyManifest.json();
      console.log('Verified manifest content:', verifiedManifest);
      
      if (!Array.isArray(verifiedManifest) || verifiedManifest.length !== blobUrls.length) {
        throw new Error('Manifest verification failed - content mismatch');
      }
      
      setUploadProgress('All uploads verified!');
      
      // Return just the blob ID (not the full URL)
      return manifestBlobId;
    } catch (err) {
      console.error('Upload error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      setError('Please connect your wallet');
      return;
    }
    if (!registryId) {
      setError('Registry not loaded');
      return;
    }
    if (!images.length) {
      setError('Please upload at least 1 image');
      return;
    }

    setIsCreating(true);
    setSuccess(false);
    setError('');

    try {
      // Step 1: Upload all images + generate manifest blob ID
      const manifestBlobId = await handleUploadAllToWalrus();
      console.log('Using manifest blob ID for collection:', manifestBlobId);

      // Step 2: Create collection with blob ID (not full URL)
      setUploadProgress('Creating collection on-chain...');
      
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::dropforge::create_collection`,
        arguments: [
          tx.object(registryId),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(formData.name))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(formData.description))),
          tx.pure.u64(BigInt(formData.maxSupply)),
          tx.pure.u16(Number(formData.royaltyBps)),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(manifestBlobId))), // Store blob ID only
          tx.pure.u64(BigInt(formData.mintPrice)),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('Transaction success:', result);
            await suiClient.waitForTransaction({ digest: result.digest });
            
            setSuccess(true);
            setUploadProgress('Collection created successfully!');
            
            // Reset form
            setFormData({ name: '', description: '', maxSupply: '', royaltyBps: '', mintPrice: '' });
            setImages([]);
            setPreviews([]);
            
            setTimeout(() => {
              setSuccess(false);
              setUploadProgress('');
            }, 5000);
          },
          onError: (err) => {
            console.error('Transaction error:', err);
            setError('Failed to create collection: ' + (err.message || 'Transaction failed'));
          },
        }
      );
    } catch (err: any) {
      console.error('Creation error:', err);
      if (!error) { // Only set if not already set by upload error
        setError('Error: ' + (err.message || 'Unknown error'));
      }
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

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-blue-800 font-medium">{uploadProgress}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Images
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600">Click to upload images</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {images.length > 0 ? `${images.length} image(s) selected` : 'PNG, JPG up to 10MB each'}
                  </p>
                </label>
              </div>
              
              {previews.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mt-4">
                  {previews.map((src, i) => (
                    <div key={i} className="relative aspect-square">
                      <img 
                        src={src} 
                        className="w-full h-full object-cover rounded-lg border-2 border-gray-200" 
                        alt={`Preview ${i + 1}`}
                      />
                      <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        #{i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Collection Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My NFT Collection"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A collection of divine artistry..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Supply</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.maxSupply}
                  onChange={(e) => setFormData({ ...formData, maxSupply: e.target.value })}
                  placeholder="100"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Royalty (BPS)
                  <span className="text-xs text-gray-500 ml-1">(500 = 5%)</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="10000"
                  value={formData.royaltyBps}
                  onChange={(e) => setFormData({ ...formData, royaltyBps: e.target.value })}
                  placeholder="500"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mint Price (MIST)
                <span className="text-xs text-gray-500 ml-1">(1 SUI = 1,000,000,000 MIST)</span>
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.mintPrice}
                onChange={(e) => setFormData({ ...formData, mintPrice: e.target.value })}
                placeholder="1000000000"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating || isUploading || !images.length}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating || isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {uploadProgress || 'Creating Collection...'}
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Collection Created!
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload & Create Collection
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}