import { motion } from 'framer-motion';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useNetworkVariable } from '../config/sui';
import { Loader2, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

type CollectionData = {
  objectId: string;
  name: string;
  description: string;
  maxSupply: number;
  mintedCount: number;
  mintPrice: string;
  previewImage?: string;
};

export function MintPage() {
  const registryId = useNetworkVariable('dropforgeRegistryId');
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to decode u8 vector to string
  const decodeU8Vector = (vec: number[] | undefined): string => {
    if (!vec) return '';
    return new TextDecoder().decode(new Uint8Array(vec));
  };

  useEffect(() => {
    if (!account?.address || !registryId) return;

    const fetchCollections = async () => {
      try {
        setIsLoading(true);
        
        // Fetch the registry object
        const registryObj = await suiClient.getObject({
          id: registryId,
          options: { showContent: true },
        });

        console.log('Registry Object:', registryObj);

        const registryContent = (registryObj?.data?.content as any)?.fields;
        if (!registryContent) {
          console.error('No registry content found');
          setIsLoading(false);
          return;
        }

        // Get user_collections table
        const userCollectionsTableId = registryContent.user_collections?.fields?.id?.id;
        
        console.log('User Collections Table ID:', userCollectionsTableId);
        
        if (!userCollectionsTableId) {
          console.log('No user collections table found');
          setIsLoading(false);
          return;
        }

        // Fetch the dynamic fields of the table
        const dynamicFields = await suiClient.getDynamicFields({
          parentId: userCollectionsTableId,
        });

        console.log('Dynamic Fields Response:', dynamicFields);

        // Find the field for current user
        const userField = dynamicFields.data.find(
          (field: any) => {
            const nameValue = field.name?.value;
            return nameValue === account.address || nameValue?.toLowerCase() === account.address.toLowerCase();
          }
        );

        console.log('User Field Found:', userField);

        if (!userField) {
          console.log('No collections found for user address:', account.address);
          setIsLoading(false);
          return;
        }

        // Fetch the user's collections
        const userCollectionsObj = await suiClient.getObject({
          id: userField.objectId,
          options: { showContent: true },
        });

        console.log('User Collections Object:', userCollectionsObj);

        const userCollectionsContent = (userCollectionsObj?.data?.content as any)?.fields;
        let collectionIds = userCollectionsContent?.value;

        // Handle if value is wrapped
        if (!Array.isArray(collectionIds)) {
          collectionIds = collectionIds?.fields?.value || collectionIds?.value || [];
        }

        console.log('Collection IDs:', collectionIds);

        if (!collectionIds || !Array.isArray(collectionIds) || collectionIds.length === 0) {
          console.log('No collection IDs found');
          setIsLoading(false);
          return;
        }

        // Fetch each collection
        const collectionPromises = collectionIds.map(async (collectionId) => {
          try {
            const collectionObj = await suiClient.getObject({
              id: collectionId,
              options: { showContent: true },
            });

            const content = (collectionObj?.data?.content as any)?.fields;
            if (!content) return null;

            const baseUri = decodeU8Vector(content.base_uri);
            let previewImage = '';

            // Fetch first image from manifest
            if (baseUri) {
              try {
                let manifestUrl = baseUri;
                if (!manifestUrl.startsWith('http')) {
                  manifestUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${manifestUrl}`;
                }
                const manifestRes = await fetch(manifestUrl);
                if (manifestRes.ok) {
                  const imageUrls: string[] = await manifestRes.json();
                  if (imageUrls.length > 0) {
                    previewImage = imageUrls[0];
                  }
                }
              } catch (err) {
                console.error('Failed to fetch manifest:', err);
              }
            }

            return {
              objectId: collectionId,
              name: decodeU8Vector(content.name),
              description: decodeU8Vector(content.description),
              maxSupply: Number(content.max_supply),
              mintedCount: Number(content.minted_count),
              mintPrice: String(content.mint_price),
              previewImage: previewImage || undefined,
            } as CollectionData;
          } catch (err) {
            console.error(`Failed to fetch collection ${collectionId}:`, err);
            return null;
          }
        });

        const resolvedCollections = (await Promise.all(collectionPromises)).filter(
          (c): c is CollectionData => c !== null
        );

        console.log('Resolved Collections:', resolvedCollections);
        setCollections(resolvedCollections);
      } catch (err) {
        console.error('Error fetching collections:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, [account, suiClient, registryId]);

  return (
    <div className="min-h-screen pt-32 pb-20 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Mint NFTs
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Select a collection to mint NFTs
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg mb-4">You haven't created any collections yet.</p>
              <Link
                to="/create"
                className="inline-block bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Create Your First Collection
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {collections.map((collection, index) => (
                <motion.div
                  key={collection.objectId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all border border-gray-200"
                >
                  {/* Preview Image */}
                  <div className="aspect-square bg-gradient-to-br from-blue-400 to-cyan-400 relative overflow-hidden">
                    {collection.previewImage ? (
                      <img
                        src={collection.previewImage}
                        alt={collection.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-6xl font-bold opacity-20">
                          {collection.name.charAt(0)}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-white/20 backdrop-blur-md rounded-lg p-3">
                        <p className="text-white font-bold text-lg">{collection.name}</p>
                        <p className="text-white/80 text-sm">
                          {collection.mintedCount} / {collection.maxSupply} minted
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Collection Details */}
                  <div className="p-6">
                    <p className="text-gray-600 mb-4 text-sm leading-relaxed line-clamp-2">
                      {collection.description}
                    </p>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Mint Price:</span>
                        <span className="font-medium">
                          {(Number(collection.mintPrice) / 1_000_000_000).toFixed(2)} SUI
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${(collection.mintedCount / collection.maxSupply) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Mint Button */}
                    <Link
                      to={`/mint/${collection.objectId}`}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-3 rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View & Mint NFTs
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}