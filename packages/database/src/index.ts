// Database package exports
export { getPrismaClient, disconnectPrisma } from './client.js';
export type { PrismaClient } from './generated';

// Re-export Prisma types (will be available after prisma generate)
export type {
  User,
  UserInventory,
  UserEquipment,
  UserMail,
  UserQuest,
  UserMission,
  LiveGame,
  Guild,
  GuildMember,
  GuildMessage,
  KeyValue,
  HomeBoardPost,
} from './generated';

