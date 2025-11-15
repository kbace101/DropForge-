import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Loader2, CheckCircle2, Copy, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNetworkVariable } from '../config/sui';

type MoveValue =
  | string
  | number
  | boolean
  | MoveValue[]
  | { fields: { [key: string]: MoveValue }; type: string }
  | { [key: string]: MoveValue }
  | { id: string }
  | any;

type NFTItem = {
  name: string;
  description: string;
  imageUrl: string;
  minted: boolean;
};

type CollectionInfo = {
  name: string;
  description: string;
  maxSupply: number;
  mintedCount: number;
  mintPrice: string;
};

// Helper to safely get a field from a MoveValue object
function getField(obj: MoveValue | undefined, fieldName: string): MoveValue | undefined {
  if (typeof obj === 'object' && obj !== null && 'fields' in obj) {
    const fieldsObj = (obj as { fields: { [key: string]: MoveValue } }).fields;
    return fieldsObj[fieldName];
  }
  return undefined;
}

// Helper to decode u8 vector or string field
function decodeMoveValue(value: MoveValue | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    try {
      return new TextDecoder().decode(new Uint8Array(value as number[]));
    } catch {
      return null;
    }
  }
  return null;
}

export function MintNFT({ collectionId }: { collectionId: string }) {
  const packageId = useNetworkVariable('dropforgePackageId');
  const account = useCurrentAccount();
  const [nfts, setNFTs] = useState<NFTItem[]>([]);
  const [collectionInfo, setCollectionInfo] = useState<CollectionInfo | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintingIndex, setMintingIndex] = useState<number | null>(null);
  const [successIndex, setSuccessIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const mintPageUrl = `${window.location.origin}/mint/${collectionId}`;

  useEffect(() => {
    if (!collectionId) return;

    const fetchNFTs = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const collectionObj = await suiClient.getObject({ 
          id: collectionId,
          options: { showContent: true }
        });

        console.log('Collection Object:', collectionObj);

        if (!collectionObj?.data?.content) {
          setError('Collection not found');
          setIsLoading(false);
          return;
        }

        const content = (collectionObj.data.content as any)?.fields;
        console.log('Collection Content:', content);

        // Extract collection info
        const name = decodeMoveValue(content.name) || 'Unnamed Collection';
        const description = decodeMoveValue(content.description) || '';
        const maxSupply = Number(content.max_supply) || 0;
        const mintedCount = Number(content.minted_count) || 0;
        const mintPrice = String(content.mint_price || '0');

        setCollectionInfo({
          name,
          description,
          maxSupply,
          mintedCount,
          mintPrice,
        });

        // Get base_uri
        const baseUriMoveValue = content.base_uri;
        let baseUri = decodeMoveValue(baseUriMoveValue);

        console.log('Base URI:', baseUri);

        if (!baseUri) {
          setError('No NFT manifest found for this collection');
          setIsLoading(false);
          return;
        }

        // If baseUri is just a blob ID, convert it to full URL
        if (!baseUri.startsWith('http')) {
          baseUri = `https://aggregator.walrus-testnet.walrus.space/v1/${baseUri}`;
        }

        // Fetch the manifest
        const manifestRes = await fetch(baseUri);
        if (!manifestRes.ok) {
          throw new Error(`Failed to fetch NFT manifest: ${manifestRes.status} ${manifestRes.statusText}`);
        }

        const imageUrls: string[] = await manifestRes.json();
        console.log('Image URLs:', imageUrls);

        if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
          setError('No NFTs found in collection manifest');
          setIsLoading(false);
          return;
        }

        const nftsPrepared: NFTItem[] = imageUrls.map((url, idx) => ({
          name: `${name} #${idx + 1}`,
          description: `${description} - NFT #${idx + 1}`,
          imageUrl: url,
          minted: idx < mintedCount, // Mark as minted if index is less than minted count
        }));

        console.log('Prepared NFTs:', nftsPrepared);
        setNFTs(nftsPrepared);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch NFTs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load NFTs');
        setIsLoading(false);
      }
    };

    fetchNFTs();
  }, [collectionId, suiClient]);

  const handleMint = async (idx: number) => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    setIsMinting(true);
    setMintingIndex(idx);
    setSuccessIndex(null);

    try {
      const nft = nfts[idx];
      const tx = new Transaction();
      
      // Split coins for mint price
      const mintPriceAmount = collectionInfo?.mintPrice || '1000000000';
      const [coin] = tx.splitCoins(tx.gas, [mintPriceAmount]);

      tx.moveCall({
        target: `${packageId}::dropforge::mint_nft`,
        arguments: [
          tx.object(collectionId),
          tx.pure.string(nft.name),
          tx.pure.string(nft.description),
          tx.pure.string(nft.imageUrl),
          coin,
          tx.pure.address(account.address), // Use current user's address as recipient
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (res) => {
            console.log('Mint success:', res);
            await suiClient.waitForTransaction({ digest: res.digest });
            
            const newNFTs = [...nfts];
            newNFTs[idx].minted = true;
            setNFTs(newNFTs);
            setSuccessIndex(idx);
            
            // Update collection info
            if (collectionInfo) {
              setCollectionInfo({
                ...collectionInfo,
                mintedCount: collectionInfo.mintedCount + 1,
              });
            }
            
            setTimeout(() => setSuccessIndex(null), 3000);
          },
          onError: (err) => {
            console.error('Mint error:', err);
            alert('Mint failed: ' + err.message);
          },
        }
      );
    } catch (err) {
      console.error(err);
      alert('Error minting NFT');
    } finally {
      setIsMinting(false);
      setMintingIndex(null);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mintPageUrl);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Collection</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-20 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Collection Header */}
        {collectionInfo && (
          <div className="mb-12 text-center">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {collectionInfo.name}
            </h1>
            <p className="text-xl text-gray-600 mb-6">{collectionInfo.description}</p>
            <div className="flex items-center justify-center gap-8 text-lg">
              <div>
                <span className="text-gray-500">Minted:</span>{' '}
                <span className="font-bold text-gray-900">
                  {collectionInfo.mintedCount} / {collectionInfo.maxSupply}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Price:</span>{' '}
                <span className="font-bold text-gray-900">
                  {(Number(collectionInfo.mintPrice) / 1_000_000_000).toFixed(2)} SUI
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="max-w-2xl mx-auto mt-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${(collectionInfo.mintedCount / collectionInfo.maxSupply) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* QR Code and Share */}
        <div className="flex flex-col items-center mb-12">
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <QRCodeSVG value={mintPageUrl} size={160} />
          </div>
          <button
            onClick={copyToClipboard}
            className="mt-4 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Mint URL
          </button>
        </div>

        {/* NFT Grid */}
        {nfts.length > 0 ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {nfts.map((nft, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all border border-gray-200"
              >
                <div className="aspect-square bg-gradient-to-br from-blue-100 to-cyan-100 relative">
                  <img
                    src={nft.imageUrl}
                    alt={nft.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="24"%3ENo Image%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>

                <div className="p-5">
                  <h3 className="font-bold text-lg mb-2 text-gray-900">{nft.name}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{nft.description}</p>

                  {!nft.minted ? (
                    <button
                      disabled={isMinting}
                      onClick={() => handleMint(idx)}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mintingIndex === idx ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Minting...
                        </>
                      ) : successIndex === idx ? (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Minted!
                        </>
                      ) : (
                        'Mint NFT'
                      )}
                    </button>
                  ) : (
                    <div className="w-full bg-green-100 text-green-700 py-3 rounded-xl font-semibold text-center">
                      Already Minted ✅
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No NFTs available in this collection</p>
          </div>
        )}
      </div>
    </div>
  );
}