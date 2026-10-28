import type { User } from "./store";
import {
  createUserIfEmailAvailable,
  findUserByEmail,
} from "./store";

/**
 * Persistence contract for account identity operations.
 *
 * Implementations must normalize email addresses consistently and ensure
 * createIfEmailAvailable is race-safe. A PostgreSQL implementation must rely
 * on a database unique constraint, not a read-then-insert check alone.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | undefined>;
  createIfEmailAvailable(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User | undefined>;
}

/**
 * Transitional adapter over the existing JSON store. It preserves current
 * persistence while allowing callers to depend on an asynchronous contract.
 * This adapter is single-process only; it is not safe for multiple app replicas.
 */
export class JsonUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | undefined> {
    return findUserByEmail(email.trim().toLowerCase());
  }

  async createIfEmailAvailable(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User | undefined> {
    return createUserIfEmailAvailable({
      ...data,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
    });
  }
}

export const userRepository: UserRepository = new JsonUserRepository();
