/**
 * Quest modal component
 * 퀘스트 모달 컴포넌트
 */

'use client';

import { useState } from 'react';
import { trpc } from '../../lib/trpc/utils';

interface QuestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuestModal({ isOpen, onClose }: QuestModalProps) {
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed' | 'available'>('active');

  const { data: activeQuests } = trpc.quest.getActive.useQuery(undefined, { enabled: isOpen });
  const { data: completedQuests } = trpc.quest.getCompleted.useQuery(undefined, { enabled: isOpen });
  const { data: availableQuests } = trpc.quest.getAvailable.useQuery(undefined, { enabled: isOpen });

  const acceptQuestMutation = trpc.quest.accept.useMutation();
  const completeQuestMutation = trpc.quest.complete.useMutation();

  if (!isOpen) return null;

  const handleAcceptQuest = (questId: string) => {
    acceptQuestMutation.mutate({ questId });
  };

  const handleCompleteQuest = (questId: string) => {
    completeQuestMutation.mutate({ questId });
  };

  const getQuests = () => {
    switch (selectedTab) {
      case 'active':
        return activeQuests || [];
      case 'completed':
        return completedQuests || [];
      case 'available':
        return availableQuests || [];
      default:
        return [];
    }
  };

  const quests = getQuests();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">퀘스트</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b">
            <button
              onClick={() => setSelectedTab('active')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'active'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              진행 중 ({activeQuests?.length || 0})
            </button>
            <button
              onClick={() => setSelectedTab('available')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'available'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              수락 가능 ({availableQuests?.length || 0})
            </button>
            <button
              onClick={() => setSelectedTab('completed')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'completed'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              완료됨 ({completedQuests?.length || 0})
            </button>
          </div>

          {/* Quest list */}
          {quests.length > 0 ? (
            <div className="space-y-4">
              {quests.map((quest: any) => (
                <div
                  key={quest.id}
                  className="border border-gray-200 rounded p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold">{quest.name}</h3>
                    {quest.rewardGold && (
                      <span className="text-sm text-yellow-600 font-medium">
                        보상: {quest.rewardGold} 골드
                      </span>
                    )}
                    {quest.rewardDiamonds && (
                      <span className="text-sm text-blue-600 font-medium">
                        보상: {quest.rewardDiamonds} 다이아
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{quest.description}</p>
                  
                  {selectedTab === 'active' && quest.progress !== undefined && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>진행도</span>
                        <span>{quest.progress} / {quest.target}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(quest.progress / quest.target) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {selectedTab === 'available' && (
                      <button
                        onClick={() => handleAcceptQuest(quest.id)}
                        disabled={acceptQuestMutation.isPending}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                      >
                        수락
                      </button>
                    )}
                    {selectedTab === 'active' && quest.progress >= quest.target && (
                      <button
                        onClick={() => handleCompleteQuest(quest.id)}
                        disabled={completeQuestMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                      >
                        완료
                      </button>
                    )}
                    {selectedTab === 'completed' && (
                      <span className="text-sm text-green-600 font-medium">완료됨</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              {selectedTab === 'active' ? '진행 중인 퀘스트가 없습니다.' :
               selectedTab === 'available' ? '수락 가능한 퀘스트가 없습니다.' :
               '완료된 퀘스트가 없습니다.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

