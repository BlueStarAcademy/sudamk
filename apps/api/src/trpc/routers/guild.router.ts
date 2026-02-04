/**
 * Guild tRPC router
 */

import { z } from 'zod';
import { router, nicknameProcedure } from '../router.js';
import { guildRepository } from '../../repositories/index.js';
import { AppError, handleUnknownError } from '../../utils/errors.js';

export const guildRouter = router({
  // Get guild by ID
  getById: nicknameProcedure
    .input(z.object({ guildId: z.string() }))
    .query(async ({ input }) => {
      try {
        const guild = await guildRepository.findById(input.guildId);
        if (!guild) {
          throw AppError.guildNotFound(input.guildId);
        }

        return {
          id: guild.id,
          name: guild.name,
          description: guild.description,
          emblem: guild.emblem,
          level: guild.level,
          experience: guild.experience.toString(),
          gold: guild.gold.toString(),
          leader: {
            id: guild.leader.id,
            nickname: guild.leader.nickname,
          },
          memberCount: guild.members.length,
          members: guild.members.map((m) => ({
            userId: m.userId,
            role: m.role,
            contributionTotal: m.contributionTotal.toString(),
            joinDate: m.joinDate,
            user: {
              id: m.user.id,
              nickname: m.user.nickname,
            },
          })),
        };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Get my guild
  getMyGuild: nicknameProcedure.query(async ({ ctx }) => {
    const guild = await guildRepository.findByMemberId(ctx.user.id);
    if (!guild) {
      return null;
    }

    return {
      id: guild.id,
      name: guild.name,
      description: guild.description,
      emblem: guild.emblem,
      level: guild.level,
      experience: guild.experience.toString(),
      gold: guild.gold.toString(),
      leader: {
        id: guild.leader.id,
        nickname: guild.leader.nickname,
      },
      memberCount: guild.members.length,
      members: guild.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        contributionTotal: m.contributionTotal.toString(),
        joinDate: m.joinDate,
        user: {
          id: m.user.id,
          nickname: m.user.nickname,
        },
      })),
    };
  }),

  // Create guild
  create: nicknameProcedure
    .input(
      z.object({
        name: z.string().min(2).max(20),
        description: z.string().max(200).optional(),
        emblem: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if user already has a guild
        const existingGuild = await guildRepository.findByLeaderId(ctx.user.id);
        if (existingGuild) {
          throw AppError.validationError('User already has a guild');
        }

        // Check if name is taken
        const nameTaken = await guildRepository.findByName(input.name);
        if (nameTaken) {
          throw AppError.validationError('Guild name already taken');
        }

        const guild = await guildRepository.create({
        id: crypto.randomUUID(),
        name: input.name,
        leaderId: ctx.user.id,
        description: input.description,
        emblem: input.emblem,
      });

      // Add leader as member
      await guildRepository.addMember(guild.id, ctx.user.id, 'leader');

        return {
          id: guild.id,
          name: guild.name,
        };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Join guild
  join: nicknameProcedure
    .input(z.object({ guildId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await guildRepository.addMember(input.guildId, ctx.user.id);
      return { success: true };
    }),

  // Leave guild
  leave: nicknameProcedure
    .input(z.object({ guildId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await guildRepository.removeMember(input.guildId, ctx.user.id);
      return { success: true };
    }),

  // Get guild messages
  getMessages: nicknameProcedure
    .input(
      z.object({
        guildId: z.string(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const messages = await guildRepository.getMessages(input.guildId, input.limit);
      return messages.map((msg) => ({
        id: msg.id,
        authorId: msg.authorId,
        content: msg.content,
        createdAt: msg.createdAt,
      }));
    }),

  // Send guild message
  sendMessage: nicknameProcedure
    .input(
      z.object({
        guildId: z.string(),
        content: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const message = await guildRepository.addMessage(
        input.guildId,
        ctx.user.id,
        input.content
      );

      return {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
      };
    }),
});

