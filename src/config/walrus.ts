// const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
// const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

export async function uploadToWalrus(file: File | Blob): Promise<string> {
  const endpoint = `https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5`;

  const res = await fetch(endpoint, {
    method: "PUT",
    body: file,
  });

  const text = await res.text();
  console.log("Walrus response:", text);

  if (!res.ok) {
    throw new Error(`Upload failed: ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON returned from Walrus");
  }

  // Correct path
  const blobId =
    data?.newlyCreated?.blobObject?.blobId ||
    data?.blobObject?.blobId ||
    data?.blobId;

  if (!blobId) {
    throw new Error("blobId missing in Walrus response");
  }

  return blobId;
}

export function getWalrusUrl(blobId: string): string {
  return `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;
}



































// // Simple Walrus HTTP client — no WAL tokens required.

// const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
// const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

// export async function uploadToWalrus(
//   file: File | Blob,
//   epochs: number = 5
// ): Promise<{ blobId: string; objectId: string }> {
//   const endpoint = `${PUBLISHER_URL}/v1/blobs?epochs=${epochs}`;

//   const res = await fetch(endpoint, {
//     method: "PUT",
//     body: file,
//   });

//   if (!res.ok) {
//     const errorText = await res.text();
//     throw new Error(`Upload failed: ${errorText}`);
//   }

//   const data = await res.json();
//   return {
//     blobId: data.blobObject.blobId,
//     objectId: data.blobObject.objectId,
//   };
// }

// export async function fetchFromWalrus(blobId: string): Promise<Blob> {
//   const res = await fetch(`${AGGREGATOR_URL}/v1/blobs/${blobId}`);
//   if (!res.ok) {
//     throw new Error(`Failed to fetch blob: ${res.statusText}`);
//   }
//   return await res.blob();
// }

// export async function getTextFromWalrus(blobId: string): Promise<string> {
//   const blob = await fetchFromWalrus(blobId);
//   return await blob.text();
// }
