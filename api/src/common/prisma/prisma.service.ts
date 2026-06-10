import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Database access with read/write splitting.
 *
 * Uses **composition** rather than `extends PrismaClient` on purpose:
 * PrismaClient returns a Proxy from its constructor, so a subclass `this` is the
 * unproxied target and a `reader` getter returning `this` would not expose the
 * model delegates. Holding explicit clients avoids that pitfall and makes the
 * read-vs-write intent obvious at every call site:
 *
 *   - `prisma.primary`  → all writes (create/update/delete) and transactions.
 *   - `prisma.reader`   → all reads (find/count/aggregate/groupBy).
 *
 * `reader` round-robins across replicas configured via `DATABASE_REPLICA_URLS`,
 * and transparently falls back to the primary when none are configured — so the
 * app stays self-contained with a single Postgres in local/Docker development.
 *
 * Consistency note: replicas are eventually consistent (replication lag). When a
 * read must observe a just-committed write, read via `primary` or within the same
 * transaction (see InvoicesService.generateForRequest).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Primary (read-write) connection. Receives every write and transaction. */
  readonly primary: PrismaClient;

  private readonly replicas: PrismaClient[];
  private replicaCursor = 0;

  constructor(config: ConfigService) {
    // Primary uses DATABASE_URL (the default datasource in schema.prisma).
    this.primary = new PrismaClient();

    const replicaUrls = config.get<string[]>('database.replicaUrls') ?? [];
    this.replicas = replicaUrls.map(
      (url) => new PrismaClient({ datasources: { db: { url } } }),
    );
  }

  /**
   * A connection for read-only queries. Round-robins across replicas; falls back
   * to the primary when none are configured.
   */
  get reader(): PrismaClient {
    if (this.replicas.length === 0) {
      return this.primary;
    }
    const client = this.replicas[this.replicaCursor % this.replicas.length];
    this.replicaCursor += 1;
    return client;
  }

  async onModuleInit(): Promise<void> {
    await this.primary.$connect();
    await Promise.all(this.replicas.map((replica) => replica.$connect()));

    this.logger.log(
      this.replicas.length > 0
        ? `Connected to PostgreSQL (1 primary + ${this.replicas.length} read replica(s))`
        : 'Connected to PostgreSQL (1 primary; no replicas configured, reads use primary)',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.primary.$disconnect();
    await Promise.all(this.replicas.map((replica) => replica.$disconnect()));
  }
}
