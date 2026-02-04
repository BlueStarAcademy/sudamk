/**
 * Quest tRPC router
 */

import { z } from 'zod';
import { router, nicknameProcedure } from '../router.js';
import { getPrismaClient } from '@sudam/database';
import { userRepository } from '../../repositories/index.js';
import { AppError, handleUnknownError } from '../../utils/errors.js';

const prisma = getPrismaClient();

export const questRouter = router({
  // Get active quests
  getActive: nicknameProcedure.query(async ({ ctx }) => {
    const quests = await prisma.quest.findMany({
      where: {
        userId: ctx.user.id,
        status: 'active',
      },
      include: {
        template: true,
      },
    });

    return quests.map((quest) => ({
      id: quest.id,
      name: quest.template.name,
      description: quest.template.description || '',
      progress: quest.progress,
      target: quest.template.target,
      rewardGold: quest.template.rewardGold ? Number(quest.template.rewardGold) : null,
      rewardDiamonds: quest.template.rewardDiamonds ? Number(quest.template.rewardDiamonds) : null,
    }));
  }),

  // Get completed quests
  getCompleted: nicknameProcedure.query(async ({ ctx }) => {
    const quests = await prisma.quest.findMany({
      where: {
        userId: ctx.user.id,
        status: 'completed',
      },
      include: {
        template: true,
      },
      take: 50,
      orderBy: { completedAt: 'desc' },
    });

    return quests.map((quest) => ({
      id: quest.id,
      name: quest.template.name,
      description: quest.template.description || '',
      progress: quest.progress,
      target: quest.template.target,
      rewardGold: quest.template.rewardGold ? Number(quest.template.rewardGold) : null,
      rewardDiamonds: quest.template.rewardDiamonds ? Number(quest.template.rewardDiamonds) : null,
      completedAt: quest.completedAt,
    }));
  }),

  // Get available quests
  getAvailable: nicknameProcedure.query(async ({ ctx }) => {
    // Get quest templates that user hasn't accepted yet
    const activeQuestTemplateIds = await prisma.quest.findMany({
      where: {
        userId: ctx.user.id,
        status: { in: ['active', 'completed'] },
      },
      select: { templateId: true },
    });

    const templateIds = activeQuestTemplateIds.map((q) => q.templateId);

    const templates = await prisma.questTemplate.findMany({
      where: {
        id: { notIn: templateIds },
        isActive: true,
      },
      take: 20,
    });

    return templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description || '',
      target: template.target,
      rewardGold: template.rewardGold ? Number(template.rewardGold) : null,
      rewardDiamonds: template.rewardDiamonds ? Number(template.rewardDiamonds) : null,
    }));
  }),

  // Accept quest
  accept: nicknameProcedure
    .input(
      z.object({
        questId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if quest template exists
        const template = await prisma.questTemplate.findUnique({
          where: { id: input.questId },
        });

        if (!template || !template.isActive) {
          throw AppError.validationError('Quest not available');
        }

        // Check if user already has this quest
        const existingQuest = await prisma.quest.findFirst({
          where: {
            userId: ctx.user.id,
            templateId: input.questId,
            status: { in: ['active', 'completed'] },
          },
        });

        if (existingQuest) {
          throw AppError.validationError('Quest already accepted');
        }

      // Create quest
      await prisma.quest.create({
        data: {
          userId: ctx.user.id,
          templateId: input.questId,
          status: 'active',
          progress: 0,
        },
      });

        return { success: true };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Complete quest
  complete: nicknameProcedure
    .input(
      z.object({
        questId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const quest = await prisma.quest.findUnique({
          where: { id: input.questId },
          include: { template: true },
        });

        if (!quest || quest.userId !== ctx.user.id) {
          throw AppError.notFound('Quest', input.questId);
        }

        if (quest.status !== 'active') {
          throw AppError.validationError('Quest not active');
        }

        if (quest.progress < quest.template.target) {
          throw AppError.validationError('Quest not completed');
        }

      // Update quest status
      await prisma.quest.update({
        where: { id: input.questId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

        // Give rewards
        const user = await userRepository.findById(ctx.user.id);
        if (!user) {
          throw AppError.userNotFound(ctx.user.id);
        }

      const updates: any = {};
      if (quest.template.rewardGold) {
        updates.gold = user.gold + Number(quest.template.rewardGold);
      }
      if (quest.template.rewardDiamonds) {
        updates.diamonds = user.diamonds + Number(quest.template.rewardDiamonds);
      }

        if (Object.keys(updates).length > 0) {
          await userRepository.update(user.id, updates);
        }

        return { success: true };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),
});

