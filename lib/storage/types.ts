export type PutResult = { key: string; size: number; etag?: string };
export type GetResult = { stream: ReadableStream<Uint8Array>; size: number; contentType?: string };

export interface StorageBackend {
  readonly kind: "local" | "s3";
  put(key: string, body: ReadableStream<Uint8Array> | Uint8Array, contentType: string): Promise<PutResult>;
  get(key: string): Promise<GetResult | null>;
  delete(key: string): Promise<void>;

  /**
   * Ensure a directory exists at this key. No-op for object stores that
   * don't model directories (S3/R2 use prefixes implicitly).
   */
  mkdir?(key: string): Promise<void>;

  /** Public URL for a stored object, if the backend can serve it directly. */
  publicUrl?(key: string): string | null;

  /**
   * Generate a presigned PUT URL for direct browser uploads. Returns null when
   * the backend can only accept server-side uploads (e.g. local FS).
   */
  presignPut?(opts: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds?: number;
  }): Promise<{ url: string } | null>;
}
