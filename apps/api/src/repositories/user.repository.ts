/**
 * User repository
 * Handles all user-related database operations
 */

import { getPrismaClient } from '@sudam/database';
import type { User } from '@sudam/database';

const prisma = getPrismaClient();

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        inventory: true,
        equipment: true,
        mail: true,
        quests: true,
        missions: true,
      },
    });
  }

  async findByNickname(nickname: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { nickname },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: {
    id: string;
    nickname: string;
    username?: string;
    email?: string;
    isAdmin?: boolean;
  }): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  async list(options?: {
    skip?: number;
    take?: number;
    orderBy?: { [key: string]: 'asc' | 'desc' };
  }): Promise<User[]> {
    return prisma.user.findMany({
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
    });
  }
}

export const userRepository = new UserRepository();

