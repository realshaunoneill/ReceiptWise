/**
 * The receipts Blob store's token, passed explicitly on every receipts Blob call.
 *
 * @vercel/blob >= 2.3 prefers OIDC plus BLOB_STORE_ID over BLOB_READ_WRITE_TOKEN when no token is
 * passed, and this project has OIDC on. Connecting any store to the project the usual way sets
 * BLOB_STORE_ID, which would silently send receipts to that store instead. Passing the token
 * keeps receipts in their own store whatever else is connected.
 */
export function receiptsBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}
