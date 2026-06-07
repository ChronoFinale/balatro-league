// Disaster-recovery backup straight to an S3-compatible bucket (Railway
// object storage / MinIO). pg_dumps the database to a temp file, then
// uploads it as db-backups/db-<timestamp>.sql. Unlike a local dump, this
// survives Railway's ephemeral filesystem — it lives in the bucket.
//
// Restore (into a fresh/empty database):
//   aws s3 cp s3://<bucket>/db-backups/db-<ts>.sql . --endpoint-url <S3_ENDPOINT>
//   psql "$DATABASE_URL" -f db-<ts>.sql
//
// Requires `pg_dump` on PATH (Postgres client tools). Run it where pg_dump
// exists — your laptop (with the PUBLIC connection string) is easiest; on
// Railway the image needs postgresql-client installed.
//
// Env:
//   DATABASE_URL           the Postgres connection string to dump
//   S3_ENDPOINT            bucket endpoint URL (e.g. https://bucket-…up.railway.app)
//   S3_ACCESS_KEY_ID       bucket access key
//   S3_SECRET_ACCESS_KEY   bucket secret key
//   S3_BUCKET              bucket name
//   S3_REGION              optional, default "us-east-1"
//   S3_PREFIX              optional key prefix, default "db-backups"
//
// Usage:
//   npm run backup:bucket

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required (the Postgres connection string to dump).");
    process.exit(1);
  }
  const endpoint = requireEnv("S3_ENDPOINT");
  const accessKeyId = requireEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("S3_SECRET_ACCESS_KEY");
  const bucket = requireEnv("S3_BUCKET");
  const region = process.env.S3_REGION ?? "us-east-1";
  const prefix = (process.env.S3_PREFIX ?? "db-backups").replace(/\/+$/, "");

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = mkdtempSync(join(tmpdir(), "bl-backup-"));
  const file = join(dir, `db-${ts}.sql`);

  try {
    // --no-owner/--no-privileges keep the dump portable across Postgres roles.
    execFileSync("pg_dump", [dbUrl, "--no-owner", "--no-privileges", "-f", file], {
      stdio: "inherit",
    });
    const body = readFileSync(file);

    // forcePathStyle is required for MinIO / most S3-compatible stores
    // (bucket in the path, not the hostname).
    const s3 = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    const key = `${prefix}/db-${ts}.sql`;
    await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/sql" }),
    );
    console.log(`✅ Backup uploaded → s3://${bucket}/${key} (${(body.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(
      "Backup failed. If it's pg_dump: install the Postgres client tools and put pg_dump on PATH.\n" +
        "If it's the upload: check S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_BUCKET.",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await main();
