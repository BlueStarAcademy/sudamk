/**
 * Arena page
 * 게임 모드별 아레나 페이지
 */

'use client';

import { useState } from 'react';
import { AuthGuard } from '../../components/auth/auth-guard';
import { GameModeCard } from '../../components/game/game-mode-card';
import { STRATEGIC_MODES, PLAYFUL_MODES, type GameModeConfig } from '@sudam/game-logic';

export default function ArenaPage() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'strategic' | 'playful'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allModes: GameModeConfig[] = [...STRATEGIC_MODES, ...PLAYFUL_MODES];

  const filteredModes = allModes.filter((mode) => {
    const matchesCategory =
      selectedCategory === 'all' || mode.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      mode.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mode.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <AuthGuard>
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">게임 아레나</h1>
          <p className="text-gray-600">
            다양한 게임 모드를 선택하여 플레이하세요
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="게임 모드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedCategory('strategic')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === 'strategic'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              전략 모드
            </button>
            <button
              onClick={() => setSelectedCategory('playful')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === 'playful'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              재미 모드
            </button>
          </div>
        </div>

        {/* Game Mode Grid */}
        {filteredModes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModes.map((mode) => (
              <GameModeCard key={mode.mode} config={mode} />
            ))}
          </div>
        )}

        {/* Stats Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {STRATEGIC_MODES.length}
            </div>
            <div className="text-gray-600">전략 모드</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {PLAYFUL_MODES.length}
            </div>
            <div className="text-gray-600">재미 모드</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-gray-600 mb-2">
              {allModes.length}
            </div>
            <div className="text-gray-600">전체 모드</div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

