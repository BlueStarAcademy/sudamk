/**
 * Header component
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '../../stores/auth-store';
import { InventoryModal } from '../inventory/inventory-modal';
import { ShopModal } from '../shop/shop-modal';
import { QuestModal } from '../quest/quest-modal';

export function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isQuestOpen, setIsQuestOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold">
          SUDAM
        </Link>
        
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <Link
                href="/profile"
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                {user?.nickname}
              </Link>
              <Link
                href="/lobby"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                로비
              </Link>
              <Link
                href="/guild"
                className="text-sm text-orange-600 hover:text-orange-700"
              >
                길드
              </Link>
              <button
                onClick={() => setIsInventoryOpen(true)}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                인벤토리
              </button>
              <button
                onClick={() => setIsShopOpen(true)}
                className="text-sm text-green-600 hover:text-green-700"
              >
                상점
              </button>
              <button
                onClick={() => setIsQuestOpen(true)}
                className="text-sm text-orange-600 hover:text-orange-700"
              >
                퀘스트
              </button>
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  관리자
                </Link>
              )}
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="text-sm text-green-600 hover:text-green-700"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
      />
      <ShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
      />
      <QuestModal
        isOpen={isQuestOpen}
        onClose={() => setIsQuestOpen(false)}
      />
    </header>
  );
}

