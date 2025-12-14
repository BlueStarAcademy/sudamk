/**
 * User integration tests
 * 사용자 관련 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient } from '@sudam/database';
import { userRepository, credentialRepository } from '../../repositories/index.js';
import { hashPassword } from '../../auth/password.js';

const prisma = getPrismaClient();

describe('User Integration Tests', () => {
  const testUserId = 'test-user-' + Date.now();
  const testUsername = 'testuser' + Date.now();
  const testNickname = '테스트유저' + Date.now();

  beforeAll(async () => {
    // Clean up any existing test data
    try {
      await prisma.user.deleteMany({
        where: {
          id: { startsWith: 'test-user-' },
        },
      });
    } catch (error) {
      // Ignore errors
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.userCredential.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.delete({
        where: { id: testUserId },
      });
    } catch (error) {
      // Ignore errors
    }
    await prisma.$disconnect();
  });

  describe('User Creation', () => {
    it('should create a user successfully', async () => {
      const user = await userRepository.create({
        id: testUserId,
        nickname: testNickname,
        username: testUsername,
        email: 'test@example.com',
        isAdmin: false,
      });

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.nickname).toBe(testNickname);
      expect(user.username).toBe(testUsername);
    });

    it('should not create duplicate nickname', async () => {
      await expect(
        userRepository.create({
          id: 'test-user-duplicate',
          nickname: testNickname, // Same nickname
          username: 'different-username',
        })
      ).rejects.toThrow();
    });
  });

  describe('User Retrieval', () => {
    it('should find user by ID', async () => {
      const user = await userRepository.findById(testUserId);
      expect(user).toBeDefined();
      expect(user?.id).toBe(testUserId);
    });

    it('should find user by nickname', async () => {
      const user = await userRepository.findByNickname(testNickname);
      expect(user).toBeDefined();
      expect(user?.nickname).toBe(testNickname);
    });

    it('should return null for non-existent user', async () => {
      const user = await userRepository.findById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('User Update', () => {
    it('should update user successfully', async () => {
      const updatedUser = await userRepository.update(testUserId, {
        strategyLevel: 5,
        playfulLevel: 3,
      });

      expect(updatedUser.strategyLevel).toBe(5);
      expect(updatedUser.playfulLevel).toBe(3);
    });
  });

  describe('User with Credentials', () => {
    it('should create user with credentials', async () => {
      const userId = 'test-user-cred-' + Date.now();
      const passwordHash = await hashPassword('testpassword123');

      // Create user
      await userRepository.create({
        id: userId,
        nickname: 'testcred' + Date.now(),
        username: 'testcred' + Date.now(),
      });

      // Create credentials
      await credentialRepository.create({
        username: 'testcred' + Date.now(),
        passwordHash,
        userId,
      });

      const credential = await credentialRepository.findByUserId(userId);
      expect(credential).toBeDefined();
      expect(credential?.userId).toBe(userId);

      // Cleanup
      await prisma.userCredential.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    });
  });
});

