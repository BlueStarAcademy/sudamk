// Database package exports
export { getPrismaClient, disconnectPrisma } from './client.js';
export type { PrismaClient, Prisma } from '@prisma/client';

// Re-export Prisma model types using Prisma namespace
// These types are available from @prisma/client after prisma generate
export type User = Prisma.UserGetPayload<{}>;
export type UserInventory = Prisma.UserInventoryGetPayload<{}>;
export type UserEquipment = Prisma.UserEquipmentGetPayload<{}>;
export type UserMail = Prisma.UserMailGetPayload<{}>;
export type UserQuest = Prisma.UserQuestGetPayload<{}>;
export type UserMission = Prisma.UserMissionGetPayload<{}>;
export type LiveGame = Prisma.LiveGameGetPayload<{}>;
export type Guild = Prisma.GuildGetPayload<{}>;
export type GuildMember = Prisma.GuildMemberGetPayload<{}>;
export type GuildMessage = Prisma.GuildMessageGetPayload<{}>;
export type KeyValue = Prisma.KeyValueGetPayload<{}>;
export type HomeBoardPost = Prisma.HomeBoardPostGetPayload<{}>;
export type UserCredential = Prisma.UserCredentialGetPayload<{}>;

