import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Data-access boundary for users. Services depend on this, never on Prisma
 * directly, keeping persistence details swappable and easy to mock in tests.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // All user lookups are reads → routed to a replica (falls back to primary).
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.reader.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.reader.user.findUnique({ where: { id } });
  }

  findMany(args?: Prisma.UserFindManyArgs): Promise<User[]> {
    return this.prisma.reader.user.findMany(args);
  }
}
