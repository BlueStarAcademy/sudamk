/**
 * Credential repository
 * Handles user credentials (passwords, OAuth, etc.)
 */

import { getPrismaClient } from '@sudam/database';
import type { UserCredential } from '@sudam/database';

const prisma = getPrismaClient();

export class CredentialRepository {
  async findByUsername(username: string): Promise<UserCredential | null> {
    return prisma.userCredential.findUnique({
      where: { username },
      include: { user: true },
    });
  }

  async findByUserId(userId: string): Promise<UserCredential | null> {
    return prisma.userCredential.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async findByKakaoId(kakaoId: string): Promise<UserCredential | null> {
    return prisma.userCredential.findUnique({
      where: { kakaoId },
      include: { user: true },
    });
  }

  async create(data: {
    username: string;
    passwordHash: string;
    userId: string;
    kakaoId?: string;
  }): Promise<UserCredential> {
    return prisma.userCredential.create({
      data,
    });
  }

  async update(
    username: string,
    data: Partial<Pick<UserCredential, 'passwordHash' | 'emailVerified'>>
  ): Promise<UserCredential> {
    return prisma.userCredential.update({
      where: { username },
      data,
    });
  }

  async delete(username: string): Promise<void> {
    await prisma.userCredential.delete({
      where: { username },
    });
  }
}

export const credentialRepository = new CredentialRepository();

