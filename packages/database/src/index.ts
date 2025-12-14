// Database package exports
export { getPrismaClient, disconnectPrisma } from './client.js';
export type { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
export type { Prisma };

// Re-export Prisma model types
// These types are available from @prisma/client after prisma generate
// Using Prisma namespace directly
export type User = Prisma.User;
export type UserInventory = Prisma.UserInventory;
export type UserEquipment = Prisma.UserEquipment;
export type UserMail = Prisma.UserMail;
export type UserQuest = Prisma.UserQuest;
export type UserMission = Prisma.UserMission;
export type LiveGame = Prisma.LiveGame;
export type Guild = Prisma.Guild;
export type GuildMember = Prisma.GuildMember;
export type GuildMessage = Prisma.GuildMessage;
export type KeyValue = Prisma.KeyValue;
export type HomeBoardPost = Prisma.HomeBoardPost;
export type UserCredential = Prisma.UserCredential;

