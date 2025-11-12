import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useNetworkVariable } from "../config/sui";
import { MintNFT } from "./MintNFT";
import { Loader2 } from "lucide-react";
import type { SuiObjectResponse } from "@mysten/sui/client";

type CollectionItem = {
  id: string;
  name: string;
  description: string;
};

export function UserCollections() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const registryId = useNetworkVariable("dropforgeRegistryId");

  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

useEffect(() => {
  if (!account?.address || !registryId) return;

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const registryObj: SuiObjectResponse = await suiClient.getObject({
        id: registryId,
        options: { showContent: true },
      });

      const registryData = registryObj.data;
      console.log('Registry object response:', registryObj);

      if (!registryData || registryData.content?.dataType !== 'moveObject') {
        console.error('Invalid registry object');
        setLoading(false);
        return;
      }

      // 🔹 Extract user_collections table ID
      const userCollectionsTableId = (registryData.content as any).fields.user_collections.fields.id.id;
      console.log('User collections table id:', userCollectionsTableId);

      // 🔹 Try to get the user’s collections entry
      let userCollectionsObj: SuiObjectResponse | null = null;
      try {
        userCollectionsObj = await suiClient.getDynamicFieldObject({
          parentId: userCollectionsTableId,
          name: { type: 'address', value: account.address },
        });
      } catch (err: any) {
        console.warn('User has no entry yet in user_collections table');
        setCollections([]);
        setLoading(false);
        return; // Exit early — nothing to show yet
      }

      const userVecData = userCollectionsObj?.data;
      if (!userVecData || userVecData.content?.dataType !== 'moveObject') {
        console.warn('No collections found for this user.');
        setCollections([]);
        setLoading(false);
        return;
      }

      const fields: any = (userVecData.content as any).fields;
      const vecValue = fields.value || [];
      const userCollectionIds: string[] = [];

      for (const colId of vecValue) {
        if (colId.fields?.id) userCollectionIds.push(colId.fields.id);
      }

      // 🔹 Fetch each collection object
      const collectionsFetched: CollectionItem[] = [];
      for (const colId of userCollectionIds) {
        const colObj = await suiClient.getObject({
          id: colId,
          options: { showContent: true },
        });

        const colData = colObj.data;
        if (colData?.content?.dataType === 'moveObject') {
          const fields: any = (colData.content as any).fields;
          const name =
            typeof fields?.name === 'string'
              ? fields.name
              : fields?.name
              ? new TextDecoder().decode(new Uint8Array(fields.name))
              : 'Unnamed';
          const description =
            typeof fields?.description === 'string'
              ? fields.description
              : fields?.description
              ? new TextDecoder().decode(new Uint8Array(fields.description))
              : '';

          collectionsFetched.push({ id: colId, name, description });
        }
      }

      setCollections(collectionsFetched);
    } catch (err) {
      console.error('Failed to fetch user collections:', err);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  fetchCollections();
}, [account?.address, registryId, suiClient]);


  if (loading)
    return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" />;

  return (
    <div className="min-h-screen pt-32 pb-20 bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Your Collections
        </h2>

        {collections.length === 0 ? (
          <p className="text-gray-600">You haven’t created any collections yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {collections.map((col) => (
              <motion.div
                key={col.id}
                whileHover={{ scale: 1.05 }}
                className="bg-white rounded-xl shadow-md p-6 cursor-pointer"
                onClick={() => setSelectedCollection(col.id)}
              >
                <h3 className="font-semibold text-lg mb-2">{col.name}</h3>
                <p className="text-gray-500 mb-4">{col.description}</p>
                <p className="text-sm text-gray-400 break-all">ID: {col.id}</p>
              </motion.div>
            ))}
          </div>
        )}

        {selectedCollection && (
          <div className="mt-12">
            <MintNFT collectionId={selectedCollection} />
          </div>
        )}
      </div>
    </div>
  );
}
