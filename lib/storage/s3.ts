import "server-only";
import { AwsClient } from "aws4fetch";
import type { StorageBackend, PutResult, GetResult } from "./types";

export type S3Config = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string | null;
};

function objectUrl(cfg: S3Config, key: string): string {
  return `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

export function createS3Backend(cfg: S3Config): StorageBackend {
  const aws = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: cfg.region,
    service: "s3",
  });

  return {
    kind: "s3",

    async put(key, body, contentType): Promise<PutResult> {
      const url = objectUrl(cfg, key);
      const ab: ArrayBuffer = body instanceof Uint8Array
        ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
        : await new Response(body).arrayBuffer();
      const res = await aws.fetch(url, {
        method: "PUT",
        headers: { "Content-Type": contentType, "Content-Length": String(ab.byteLength) },
        body: ab,
      });
      if (!res.ok) throw new Error(`S3 PUT failed: ${res.status} ${res.statusText}`);
      return {
        key,
        size: ab.byteLength,
        etag: res.headers.get("etag") ?? undefined,
      };
    },

    async get(key): Promise<GetResult | null> {
      const url = objectUrl(cfg, key);
      const res = await aws.fetch(url, { method: "GET" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 GET failed: ${res.status} ${res.statusText}`);
      const size = Number(res.headers.get("content-length") ?? 0);
      return {
        stream: res.body as ReadableStream<Uint8Array>,
        size,
        contentType: res.headers.get("content-type") ?? undefined,
      };
    },

    async delete(key) {
      const url = objectUrl(cfg, key);
      const res = await aws.fetch(url, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        throw new Error(`S3 DELETE failed: ${res.status}`);
      }
    },

    publicUrl(key) {
      if (!cfg.publicUrl) return null;
      return `${cfg.publicUrl.replace(/\/$/, "")}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
    },

    async presignPut(opts) {
      const url = `${objectUrl(cfg, opts.key)}?X-Amz-Expires=${opts.expiresInSeconds ?? 60 * 5}`;
      const host = new URL(cfg.endpoint).host;
      const signed = await aws.sign(
        new Request(url, {
          method: "PUT",
          headers: {
            "Content-Type": opts.contentType,
            "Content-Length": String(opts.contentLength),
            Host: host,
          },
        }),
        { aws: { signQuery: true } },
      );
      return { url: signed.url };
    },
  };
}
