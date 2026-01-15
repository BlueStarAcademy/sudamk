/**
 * Guild repository
 * Handles all guild-related database operations
 */

import { getPrismaClient } from '@sudam/database';
import type { Guild, GuildMember, GuildMessage } from '@sudam/database';

const prisma = () => getPrismaClient();

export class GuildRepository {
  async findById(id: string): Promise<Guild | null> {
    return prisma().guild.findUnique({
      where: { id },
      include: {
        leader: true,
        members: {
          include: { user: true },
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findByName(name: string): Promise<Guild | null> {
    return prisma().guild.findUnique({
      where: { name },
    });
  }

  async findByLeaderId(leaderId: string): Promise<Guild | null> {
    return prisma().guild.findUnique({
      where: { leaderId },
    });
  }

  async findByMemberId(userId: string): Promise<Guild | null> {
    const member = await prisma().guildMember.findFirst({
      where: { userId },
      include: {
        guild: {
          include: {
            leader: true,
            members: {
              include: { user: true },
            },
          },
        },
      },
    });

    return member?.guild || null;
  }

  async create(data: {
    id: string;
    name: string;
    leaderId: string;
    description?: string;
    emblem?: string;
    settings?: any;
  }): Promise<Guild> {
    return prisma().guild.create({
      data,
    });
  }

  async update(id: string, data: Partial<Guild>): Promise<Guild> {
    return prisma().guild.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma().guild.delete({
      where: { id },
    });
  }

  async addMember(guildId: string, userId: string, role?: string): Promise<GuildMember> {
    return prisma().guildMember.create({
      data: {
        guildId,
        userId,
        role: role ?? 'member',
      },
    });
  }

  async removeMember(guildId: string, userId: string): Promise<void> {
    await prisma().guildMember.delete({
      where: {
        guildId_userId: { guildId, userId },
      },
    });
  }

  async updateMemberRole(guildId: string, userId: string, role: string): Promise<GuildMember> {
    return prisma().guildMember.update({
      where: {
        guildId_userId: { guildId, userId },
      },
      data: { role },
    });
  }

  async addMessage(guildId: string, authorId: string, content: string): Promise<GuildMessage> {
    return prisma().guildMessage.create({
      data: {
        guildId,
        authorId,
        content,
      },
    });
  }

  async getMessages(guildId: string, limit = 50): Promise<GuildMessage[]> {
    return prisma().guildMessage.findMany({
      where: { guildId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const guildRepository = new GuildRepository();

