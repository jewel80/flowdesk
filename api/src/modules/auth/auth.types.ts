import { Role } from '@prisma/client';

/** Shape of the JWT payload we sign. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
  name: string;
}

/** The authenticated principal attached to every authorized request. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
  name: string;
}
