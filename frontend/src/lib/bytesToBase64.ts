const CHUNK_SIZE = 0x8000;

/** Base64 of raw bytes. Chunked so a large file doesn't overflow `String.fromCharCode`'s argument limit. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}
