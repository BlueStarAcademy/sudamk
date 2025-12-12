/**
 * Guild page
 * 길드 페이지
 */

'use client';

import { trpc } from '../../lib/trpc/utils';
import { AuthGuard } from '../../components/auth/auth-guard';
import { useState } from 'react';
import Link from 'next/link';

export default function GuildPage() {
  const [guildId, setGuildId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [guildName, setGuildName] = useState('');
  const [guildDescription, setGuildDescription] = useState('');

  const { data: myGuild } = trpc.guild.getMyGuild.useQuery();
  const { data: guild } = trpc.guild.getById.useQuery(
    { guildId },
    { enabled: !!guildId }
  );
  const { data: messages } = trpc.guild.getMessages.useQuery(
    { guildId: guildId || myGuild?.id || '', limit: 50 },
    { enabled: !!(guildId || myGuild?.id) }
  );

  const createGuildMutation = trpc.guild.create.useMutation({
    onSuccess: () => {
      setShowCreateForm(false);
      setGuildName('');
      setGuildDescription('');
    },
  });

  const joinGuildMutation = trpc.guild.join.useMutation();
  const sendMessageMutation = trpc.guild.sendMessage.useMutation();
  const [messageContent, setMessageContent] = useState('');

  const handleSendMessage = () => {
    if (!messageContent.trim() || !(guildId || myGuild?.id)) return;
    sendMessageMutation.mutate(
      {
        guildId: guildId || myGuild?.id || '',
        content: messageContent,
      },
      {
        onSuccess: () => {
          setMessageContent('');
        },
      }
    );
  };

  return (
    <AuthGuard>
      <div className="container mx-auto p-8 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">길드</h1>
          {!myGuild && !showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              길드 만들기
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">새 길드 만들기</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  길드 이름
                </label>
                <input
                  type="text"
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  설명 (선택사항)
                </label>
                <textarea
                  value={guildDescription}
                  onChange={(e) => setGuildDescription(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  rows={3}
                  maxLength={200}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    createGuildMutation.mutate({
                      name: guildName,
                      description: guildDescription || undefined,
                    });
                  }}
                  disabled={!guildName || createGuildMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  생성
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setGuildName('');
                    setGuildDescription('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {guild && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Guild info */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-2">{guild.name}</h2>
                {guild.description && (
                  <p className="text-gray-600 mb-4">{guild.description}</p>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">레벨</span>
                    <span className="font-semibold">{guild.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">멤버 수</span>
                    <span className="font-semibold">{guild.memberCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">골드</span>
                    <span className="font-semibold">{guild.gold}</span>
                  </div>
                </div>
              </div>

              {/* Members list */}
              <div className="bg-white rounded-lg shadow-md p-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">멤버</h3>
                <div className="space-y-2">
                  {guild.members.map((member) => (
                    <div
                      key={member.userId}
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm">
                        {member.user.nickname}
                        {member.role === 'leader' && ' 👑'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">길드 채팅</h3>
                <div className="border border-gray-200 rounded p-4 h-96 overflow-y-auto mb-4">
                  {messages && messages.length > 0 ? (
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <div key={msg.id} className="text-sm">
                          <span className="font-medium">{msg.authorId}</span>:{' '}
                          {msg.content}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500">
                      메시지가 없습니다.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2"
                    placeholder="메시지 입력..."
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageContent.trim() || sendMessageMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!guild && !myGuild && !showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 mb-4">가입한 길드가 없습니다.</p>
            <p className="text-sm text-gray-400">
              길드 ID를 입력하여 가입하거나 새 길드를 만드세요.
            </p>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

