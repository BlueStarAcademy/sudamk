/**
 * User repository
 * Handles all user-related database operations
 */

import { getPrismaClient } from '@sudam/database';
import type { User } from '@sudam/database';

const prisma = () => getPrismaClient();

export class UserRepository {
  /**
   * Find user by ID with optional includes
   * 최적화: 필요한 데이터만 로드 (기본적으로는 기본 정보만)
   */
  async findById(id: string, options?: {
    includeInventory?: boolean;
    includeEquipment?: boolean;
    includeMail?: boolean;
    includeQuests?: boolean;
    includeMissions?: boolean;
  }): Promise<User | null> {
    const include: any = {};
    
    if (options?.includeInventory) include.inventory = true;
    if (options?.includeEquipment) include.equipment = true;
    if (options?.includeMail) include.mail = true;
    if (options?.includeQuests) include.quests = true;
    if (options?.includeMissions) include.missions = true;

    return prisma().user.findUnique({
      where: { id },
      ...(Object.keys(include).length > 0 ? { include } : {}),
    });
  }

  async findByNickname(nickname: string): Promise<User | null> {
    return prisma().user.findUnique({
      where: { nickname },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma().user.findUnique({
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
    return prisma().user.create({
      data,
    });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return prisma().user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma().user.delete({
      where: { id },
    });
  }

  async list(options?: {
    skip?: number;
    take?: number;
    orderBy?: { [key: string]: 'asc' | 'desc' };
  }): Promise<User[]> {
    return prisma().user.findMany({
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
    });
  }
}

export const userRepository = new UserRepository();

