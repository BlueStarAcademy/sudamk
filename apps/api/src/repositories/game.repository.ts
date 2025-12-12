/**
 * Game repository
 * Handles all game-related database operations
 */

import { getPrismaClient } from '@sudam/database';
import type { LiveGame } from '@sudam/database';

const prisma = getPrismaClient();

export class GameRepository {
  async findById(id: string): Promise<LiveGame | null> {
    return prisma.liveGame.findUnique({
      where: { id },
    });
  }

  async findActive(): Promise<LiveGame[]> {
    return prisma.liveGame.findMany({
      where: { isEnded: false },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(data: {
    id: string;
    status: string;
    category?: string;
    data: any;
  }): Promise<LiveGame> {
    return prisma.liveGame.create({
      data: {
        ...data,
        isEnded: false,
      },
    });
  }

  async update(id: string, data: Partial<LiveGame>): Promise<LiveGame> {
    return prisma.liveGame.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.liveGame.delete({
      where: { id },
    });
  }

  async markAsEnded(id: string): Promise<LiveGame> {
    return prisma.liveGame.update({
      where: { id },
      data: { isEnded: true },
    });
  }
}

export const gameRepository = new GameRepository();

