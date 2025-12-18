// Database package exports
export { getPrismaClient, disconnectPrisma } from './client';
export type { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
export type { Prisma };

// Re-export Prisma model types using type aliases
// These are type aliases that will be resolved at usage sites
// Users should import Prisma types directly: import type { Prisma } from '@sudam/database'
// Then use: Prisma.User, Prisma.UserInventory, etc.
// For convenience, we provide these type aliases (they may need to be used with Prisma namespace)
export type User = any; // Use Prisma.User at usage sites
export type UserInventory = any; // Use Prisma.UserInventory at usage sites
export type UserEquipment = any; // Use Prisma.UserEquipment at usage sites
export type UserMail = any; // Use Prisma.UserMail at usage sites
export type UserQuest = any; // Use Prisma.UserQuest at usage sites
export type UserMission = any; // Use Prisma.UserMission at usage sites
export type LiveGame = any; // Use Prisma.LiveGame at usage sites
export type Guild = any; // Use Prisma.Guild at usage sites
export type GuildMember = any; // Use Prisma.GuildMember at usage sites
export type GuildMessage = any; // Use Prisma.GuildMessage at usage sites
export type KeyValue = any; // Use Prisma.KeyValue at usage sites
export type HomeBoardPost = any; // Use Prisma.HomeBoardPost at usage sites
export type UserCredential = any; // Use Prisma.UserCredential at usage sites

