/**
 * Guild tRPC router
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../router.js';
import { guildRepository } from '../../repositories/index.js';

export const guildRouter = router({
  // Get guild by ID
  getById: protectedProcedure
    .input(z.object({ guildId: z.string() }))
    .query(async ({ input }) => {
      const guild = await guildRepository.findById(input.guildId);
      if (!guild) {
        throw new Error('Guild not found');
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

  // Get my guild
  getMyGuild: protectedProcedure.query(async ({ ctx }) => {
    // Find guild where user is a member
    // This is a simplified version - in production, you'd query GuildMember
    const userGuilds = await guildRepository.findById(''); // TODO: Implement proper query
    
    return null; // Placeholder
  }),

  // Create guild
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(20),
        description: z.string().max(200).optional(),
        emblem: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user already has a guild
      const existingGuild = await guildRepository.findByLeaderId(ctx.user.id);
      if (existingGuild) {
        throw new Error('User already has a guild');
      }

      // Check if name is taken
      const nameTaken = await guildRepository.findByName(input.name);
      if (nameTaken) {
        throw new Error('Guild name already taken');
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
    }),

  // Join guild
  join: protectedProcedure
    .input(z.object({ guildId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await guildRepository.addMember(input.guildId, ctx.user.id);
      return { success: true };
    }),

  // Leave guild
  leave: protectedProcedure
    .input(z.object({ guildId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await guildRepository.removeMember(input.guildId, ctx.user.id);
      return { success: true };
    }),

  // Get guild messages
  getMessages: protectedProcedure
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
  sendMessage: protectedProcedure
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

