import { useState, useEffect } from 'react';
import { useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Loader2, CheckCircle2, Copy } from 'lucide-react';
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
  if (Array.isArray(value)) return new TextDecoder().decode(new Uint8Array(value as number[]));
  return null;
}

export function MintNFT({ collectionId }: { collectionId: string }) {
  const packageId = useNetworkVariable('dropforgePackageId');
  const [nfts, setNFTs] = useState<NFTItem[]>([]);
  const [isMinting, setIsMinting] = useState(false);
  const [successIndex, setSuccessIndex] = useState<number | null>(null);

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const mintPageUrl = `${window.location.origin}/mint/${collectionId}`;

  useEffect(() => {
    if (!collectionId) return;

    const fetchNFTs = async () => {
      try {
        const collectionObj = await suiClient.getObject({ id: collectionId });

        // Use helper to safely get base_uri
        const baseUriMoveValue = getField(collectionObj?.data?.content, 'base_uri');
        const baseUri = decodeMoveValue(baseUriMoveValue);

        if (!baseUri) return;

        const manifestRes = await fetch(baseUri);
        const imageUrls: string[] = await manifestRes.json();

        const nftsPrepared: NFTItem[] = imageUrls.map((url, idx) => ({
          name: `NFT #${idx + 1}`,
          description: `Auto-generated NFT #${idx + 1}`,
          imageUrl: url,
          minted: false, // TODO: check on-chain mint status
        }));

        setNFTs(nftsPrepared);
      } catch (err) {
        console.error('Failed to fetch NFTs:', err);
      }
    };

    fetchNFTs();
  }, [collectionId, suiClient]);

  const handleMint = async (idx: number) => {
    setIsMinting(true);
    setSuccessIndex(null);

    try {
      const nft = nfts[idx];
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [1_000_000_000]); // replace with real mint price

      tx.moveCall({
        target: `${packageId}::dropforge::mint_nft`,
        arguments: [
          tx.object(collectionId),
          tx.pure.string(nft.name),
          tx.pure.string(nft.description),
          tx.pure.string(nft.imageUrl),
          coin,
          tx.pure.address('0xRECIPIENT_ADDRESS_HERE'),
        ],
      });

      signAndExecute({ transaction: tx }, {
        onSuccess: async (res) => {
          await suiClient.waitForTransaction({ digest: res.digest });
          const newNFTs = [...nfts];
          newNFTs[idx].minted = true;
          setNFTs(newNFTs);
          setSuccessIndex(idx);
          setTimeout(() => setSuccessIndex(null), 3000);
        },
        onError: (err) => alert('Mint failed: ' + err.message),
      });
    } catch (err) {
      console.error(err);
      alert('Error minting NFT');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center">
        <QRCodeSVG value={mintPageUrl} size={128} />
        <button
          onClick={() => navigator.clipboard.writeText(mintPageUrl)}
          className="mt-3 px-4 py-2 bg-cyan-500 text-white rounded-xl"
        >
          <Copy className="w-4 h-4" /> Copy Mint URL
        </button>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        {nfts.map((nft, idx) => (
          <div key={idx} className="bg-gray-50 rounded-xl p-4 flex flex-col items-center">
            <img src={nft.imageUrl} className="h-48 w-full object-cover rounded-lg mb-4" />
            <h3 className="font-medium mb-1">{nft.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{nft.description}</p>

            {!nft.minted ? (
              <button
                disabled={isMinting}
                onClick={() => handleMint(idx)}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-2 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {isMinting && successIndex !== idx ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : successIndex === idx ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  'Mint'
                )}
              </button>
            ) : (
              <span className="text-green-600 font-semibold">Minted ✅</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
