import { AuthenticatedUser } from '../../modules/auth/auth.types';

// Augment Express' Request so `request.user` is strongly typed everywhere.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
