import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { UsersRepository } from './users.repository';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) { }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  /** Returns users without sensitive fields (e.g. for the demo login picker). */
  async listPublic(): Promise<PublicUser[]> {
    const users = await this.usersRepository.findMany({
      orderBy: { role: 'asc' },
    });
    return users.map(({ id, name, email, role }) => ({
      id,
      name,
      email,
      role,
    }));
  }
}
