
import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage, ServerAction, GameMode, UserWithStatus } from '../../types.js';
import { GAME_CHAT_MESSAGES, GAME_CHAT_EMOJIS, ADMIN_USER_ID, ADMIN_NICKNAME } from '../../constants/index.js';
import { containsProfanity } from '../../profanity.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { userMeetsGuildFeatureLevelRequirement } from '../../shared/constants/guildConstants.js';
import {
    arenaGameRoomChatBodyClass,
    arenaGameRoomChatIconToggleClass,
    arenaGameRoomChatInputClass,
    arenaGameRoomChatTabActiveClass,
    arenaGameRoomChatTabBarClass,
    arenaGameRoomChatTabInactiveClass,
    arenaGameRoomPanelTitleClass,
    arenaGameRoomQuickChatEmojiBtnClass,
    arenaGameRoomQuickChatPhraseBtnClass,
    arenaGameRoomQuickChatPopoverClass,
} from '../game/arenaGameRoomStyles.js';

interface ChatWindowProps {
    messages: ChatMessage[];
    onAction: (a: ServerAction) => void;
    mode: GameMode | 'global' | 'strategic' | 'playful' | 'singleplayer' | 'tower' | 'tournament';
    onViewUser?: (userId: string) => void; // Optional for profile view
    locationPrefix?: string;
    /** 홈 하단 패널 등: 강제 min-height 제거, 메시지 없을 때 세로 스크롤 영역 숨김 */
    compactHome?: boolean;
    /** 네이티브 챔피언십: 하단 독과 비슷한 글자 크기 + 본문은 스크롤 유지 (compactHome과 달리 overflow-y-auto) */
    compactTournamentMobile?: boolean;
    /** 퀵메뉴 채팅 모달: 인게임 대국실과 같은 슬레이트·스카이 톤 UI */
    arenaPremium?: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
    messages,
    onAction,
    mode,
    onViewUser,
    locationPrefix,
    compactHome = false,
    compactTournamentMobile = false,
    arenaPremium = false,
}) => {
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const quickChatRef = useRef<HTMLDivElement>(null);
    const [chatInput, setChatInput] = useState('');
    const [showQuickChat, setShowQuickChat] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [activeTab, setActiveTab] = useState<'global' | 'guild'>('global');
    const [guildMessages, setGuildMessages] = useState<any[]>([]);
    const { currentUserWithStatus, handlers, allUsers, guilds } = useAppContext();

    // 길드 채팅 메시지 로드
    useEffect(() => {
        if (currentUserWithStatus?.guildId && guilds[currentUserWithStatus.guildId]) {
            const guild = guilds[currentUserWithStatus.guildId];
            if (guild.chatHistory) {
                setGuildMessages(guild.chatHistory);
            }
        } else {
            setGuildMessages([]);
        }
    }, [currentUserWithStatus?.guildId, guilds]);

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages, guildMessages, activeTab]);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => {
                setCooldown(prev => Math.max(0, prev - 1));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (quickChatRef.current && !quickChatRef.current.contains(event.target as Node)) {
                setShowQuickChat(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getLocationPrefix = () => {
        if (locationPrefix && locationPrefix.trim().length > 0) {
            return locationPrefix;
        }
        switch (mode) {
            case 'strategic':
                return '[전략바둑]';
            case 'playful':
                return '[놀이바둑]';
            case 'global':
                return '[홈]';
            default:
                // 허용된 위치만 반환
                if (mode === 'singleplayer') return '[싱글플레이]';
                if (mode === 'tower') return '[도전의탑]';
                if (mode === 'tournament') return '[챔피언십]';
                // 알 수 없는 모드는 기본값으로 [홈] 반환
                return '[홈]';
        }
    };

    const handleSend = (message: { text?: string, emoji?: string }) => {
        if (cooldown > 0) return;
        
        if (activeTab === 'guild') {
            // 길드 채팅 전송
            handlers.handleAction({ type: 'SEND_GUILD_CHAT_MESSAGE', payload: { content: message.text || '' } });
        } else {
            // 전체 채팅 전송
            const channel = (mode === 'strategic' || mode === 'playful') ? mode : 'global';
            const payload = { channel, ...message, location: getLocationPrefix() };
            onAction({ type: 'SEND_CHAT_MESSAGE', payload });
        }
        setShowQuickChat(false);
        setChatInput('');
        setCooldown(5);
    };
    
    const handleSendTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        if (containsProfanity(chatInput)) {
            alert("부적절한 단어가 포함되어 있어 메시지를 전송할 수 없습니다.");
            setChatInput('');
            return;
        }
        handleSend({ text: chatInput });
    };

    if (!currentUserWithStatus) {
        return null;
    }
    
    const handleUserClick = (userId: string) => {
        if (currentUserWithStatus.isAdmin && userId !== currentUserWithStatus.id) {
            handlers.openModerationModal(userId);
        } else if (userId !== currentUserWithStatus.id) {
            const viewUserHandler = onViewUser || handlers.openViewingUser;
            viewUserHandler(userId);
        }
    };

    const isBanned = (currentUserWithStatus.chatBanUntil ?? 0) > Date.now();
    const banTimeLeft = isBanned ? Math.ceil((currentUserWithStatus.chatBanUntil! - Date.now()) / 1000 / 60) : 0;
    const isInputDisabled = isBanned || cooldown > 0;
    const placeholderText = isBanned 
        ? `채팅 금지 중 (${banTimeLeft}분 남음)` 
        : isInputDisabled
            ? `(${cooldown}초)`
            : "[메시지 입력]";

    const hasGuild = !!currentUserWithStatus?.guildId;
    const guildChatUnlocked = userMeetsGuildFeatureLevelRequirement(currentUserWithStatus);
    const hasGuildChatAccess = hasGuild && guildChatUnlocked;
    const activeMessages = activeTab === 'guild' ? guildMessages : messages;

    useEffect(() => {
        if (!hasGuildChatAccess && activeTab === 'guild') setActiveTab('global');
    }, [hasGuildChatAccess, activeTab]);
    const compactUi = compactHome || compactTournamentMobile;
    const compactMsg = compactUi ? 'text-[11px] leading-snug' : 'text-xs';
    const compactEmpty = compactUi ? 'text-[11px] leading-snug' : 'text-sm';

    const rootClass = arenaPremium
        ? 'flex h-full min-h-0 flex-col text-slate-100 p-0'
        : `flex h-full flex-col text-on-panel ${compactHome || compactTournamentMobile ? 'min-h-0 p-1' : 'min-h-[220px] p-4 sm:min-h-0'}`;

    const tabBarClass = arenaPremium
        ? `${arenaGameRoomChatTabBarClass} ${compactUi ? 'mb-1.5' : 'mb-2'}`
        : `flex flex-shrink-0 rounded-lg bg-gray-900/70 ${compactUi ? 'mb-1 p-0.5' : 'mb-2 p-1'}`;

    const tabBtnBase = compactUi ? 'py-1 text-[12px]' : 'py-1.5 text-sm';
    const globalTabClass = arenaPremium
        ? `${activeTab === 'global' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass} flex-1 font-semibold ${tabBtnBase}`
        : `flex-1 rounded-md font-semibold ${tabBtnBase} ${activeTab === 'global' ? 'bg-blue-600 text-white' : 'text-gray-400'}`;
    const guildTabClass = arenaPremium
        ? `${activeTab === 'guild' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass} flex-1 font-semibold ${tabBtnBase}`
        : `flex-1 rounded-md font-semibold ${tabBtnBase} ${activeTab === 'guild' ? 'bg-blue-600 text-white' : 'text-gray-400'}`;

    const securityBannerClass = arenaPremium
        ? `mb-1.5 rounded-lg border border-amber-500/28 bg-gradient-to-r from-amber-950/55 via-slate-900/50 to-amber-950/45 px-2 py-1.5 text-center text-amber-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/12 ${compactUi ? 'text-[10px] leading-tight' : 'text-[11px] leading-snug'}`
        : `text-center text-yellow-400 bg-tertiary/50 ${compactUi ? 'mb-0.5 rounded-sm p-0.5 text-[11px] leading-tight' : 'rounded-sm p-0.5 text-[10px]'}`;

    const chatBodyClass = arenaPremium
        ? `${arenaGameRoomChatBodyClass} min-h-0 flex-1 space-y-0.5 ${compactHome ? 'overflow-hidden' : compactTournamentMobile ? 'overflow-y-auto' : 'overflow-y-auto'}`
        : `min-h-0 flex-1 space-y-0.5 rounded-md bg-tertiary/40 p-1 pr-1 ${
              compactHome ? 'overflow-hidden' : compactTournamentMobile ? 'overflow-y-auto' : 'min-h-[160px] flex-grow overflow-y-auto sm:min-h-0'
          }`;

    const emptyMuted = arenaPremium ? 'text-slate-500' : 'text-tertiary';

    return (
        <div className={rootClass}>
            {hasGuildChatAccess ? (
                <div className={tabBarClass}>
                    <button type="button" onClick={() => setActiveTab('global')} className={globalTabClass}>
                        전체채팅
                    </button>
                    <button type="button" onClick={() => setActiveTab('guild')} className={guildTabClass}>
                        길드채팅
                    </button>
                </div>
            ) : (
                <h2
                    className={
                        arenaPremium
                            ? `${arenaGameRoomPanelTitleClass} flex-shrink-0 ${compactUi ? 'text-sm pb-1 mb-1.5' : 'pb-1.5 mb-2'}`
                            : `flex-shrink-0 border-b border-color font-semibold ${compactUi ? 'pb-0.5 text-sm' : 'pb-1 text-lg'}`
                    }
                >
                    전체채팅
                </h2>
            )}
            {activeTab === 'global' && <p className={securityBannerClass}>AI 보안관봇이 부적절한 언어 사용을 감지하고 있습니다. 🚓</p>}
            <div
                ref={chatBodyRef}
                className={chatBodyClass}
            >
                {activeTab === 'guild' ? (
                    // 길드 채팅 메시지 표시
                    activeMessages.length > 0 ? (
                        activeMessages.map((msg: any) => {
                            const senderId = msg.user?.id || msg.authorId;
                            const sender = senderId && senderId !== 'system' ? allUsers.find(u => u.id === senderId) : undefined;
                            const isSystem = senderId === 'system';
                            const displayName = isSystem ? '시스템' : (msg.user?.nickname || (senderId === ADMIN_USER_ID || sender?.isAdmin ? ADMIN_NICKNAME : sender?.nickname) || 'Unknown');
                            
                            return (
                                <div key={msg.id || msg.timestamp || msg.createdAt} className={compactMsg}>
                                    <span className={`font-semibold pr-2 ${isSystem ? 'text-blue-400' : 'text-blue-300 cursor-pointer hover:underline'}`}>
                                        {displayName}:
                                    </span>
                                    <span className="text-blue-300">{msg.text || msg.content || ''}</span>
                                </div>
                            );
                        })
                    ) : (
                        <div className={`flex h-full items-center justify-center ${emptyMuted} ${compactEmpty}`}>길드 채팅 메시지가 없습니다.</div>
                    )
                ) : (
                    // 전체 채팅 메시지 표시
                    <>
                        {messages.map(msg => {
                            const isBotMessage = msg.system && !msg.actionInfo && msg.user.nickname === 'AI 보안관봇';
                            return (
                                <div key={msg.id} className={compactMsg}>
                            {msg.location && <span className="font-semibold text-tertiary pr-1">{msg.location}</span>}
                            <span 
                                className={`font-semibold pr-2 ${msg.system ? 'text-highlight' : 'text-tertiary cursor-pointer hover:underline'}`}
                                onClick={() => !msg.system && handleUserClick(msg.user.id)}
                                title={!msg.system ? `${msg.user.nickname} 프로필 보기 / 제재` : ''}
                            >
                                {msg.system ? (isBotMessage ? 'AI 보안관봇' : '시스템') : msg.user.nickname}:
                            </span>
                            {msg.text && (() => {
                                const textStr = msg.text;
                                const parts: (string | React.ReactElement)[] = [];
                                let currentIndex = 0;
                                
                                // 사용자 이름과 장비 이름의 위치 찾기
                                const userLinkIndex = msg.userLink ? textStr.indexOf(`${msg.userLink.userName}님`) : -1;
                                const itemLinkIndex = msg.itemLink ? textStr.indexOf(msg.itemLink.itemName) : -1;
                                
                                // 정렬된 인덱스 배열 생성
                                const linkIndices: Array<{ type: 'user' | 'item', index: number, length: number }> = [];
                                if (userLinkIndex >= 0 && msg.userLink) {
                                    linkIndices.push({ type: 'user', index: userLinkIndex, length: `${msg.userLink.userName}님`.length });
                                }
                                if (itemLinkIndex >= 0 && msg.itemLink) {
                                    linkIndices.push({ type: 'item', index: itemLinkIndex, length: msg.itemLink.itemName.length });
                                }
                                linkIndices.sort((a, b) => a.index - b.index);
                                
                                // 링크가 없는 경우
                                if (linkIndices.length === 0) {
                                    return <span className={isBotMessage ? 'text-highlight' : ''}>{textStr}{isBotMessage && ' 🚓'}</span>;
                                }
                                
                                // 링크가 있는 경우 순차적으로 처리
                                linkIndices.forEach((link, idx) => {
                                    // 링크 이전 텍스트 추가
                                    if (link.index > currentIndex) {
                                        parts.push(textStr.substring(currentIndex, link.index));
                                    }
                                    
                                    // 링크 추가
                                    if (link.type === 'user' && msg.userLink) {
                                        parts.push(
                                            <span 
                                                key={`user-${idx}`}
                                                className="text-blue-400 cursor-pointer hover:underline font-semibold"
                                                onClick={() => {
                                                    if (onViewUser) {
                                                        onViewUser(msg.userLink!.userId);
                                                    } else {
                                                        handleUserClick(msg.userLink!.userId);
                                                    }
                                                }}
                                                title={`${msg.userLink.userName} 프로필 보기`}
                                            >
                                                {msg.userLink.userName}
                                            </span>
                                        );
                                        parts.push('님');
                                    } else if (link.type === 'item' && msg.itemLink) {
                                        // 등급별 색상 매핑
                                        const gradeColorMap: Record<string, string> = {
                                            'normal': 'text-gray-300',
                                            'uncommon': 'text-green-400',
                                            'rare': 'text-blue-400',
                                            'epic': 'text-purple-400',
                                            'legendary': 'text-red-500',
                                            'mythic': 'text-orange-400'
                                        };
                                        const itemGrade = msg.itemLink.itemGrade || 'normal';
                                        const gradeColor = gradeColorMap[itemGrade] || 'text-gray-300';
                                        
                                        parts.push(
                                            <span 
                                                key={`item-${idx}`}
                                                className={`${gradeColor} cursor-pointer hover:underline font-semibold`}
                                                onClick={() => {
                                                    const targetUser = allUsers.find(u => u.id === msg.itemLink!.userId);
                                                    if (targetUser) {
                                                        const item = targetUser.inventory?.find(i => i.id === msg.itemLink!.itemId);
                                                        if (item) {
                                                            handlers.openViewingItem(item, targetUser.id === currentUserWithStatus?.id);
                                                        }
                                                    }
                                                }}
                                                title={`${msg.itemLink.itemName} 클릭하여 상세 정보 보기`}
                                            >
                                                {msg.itemLink.itemName}
                                            </span>
                                        );
                                    }
                                    
                                    currentIndex = link.index + link.length;
                                });
                                
                                // 마지막 텍스트 추가
                                if (currentIndex < textStr.length) {
                                    parts.push(textStr.substring(currentIndex));
                                }
                                
                                return <span className={isBotMessage ? 'text-highlight' : ''}>{parts}{isBotMessage && ' 🚓'}</span>;
                            })()}
                                    {msg.emoji && <span className="text-xl">{msg.emoji}</span>}
                                </div>
                            );
                        })}
                        {messages.length === 0 && <div className={`flex h-full items-center justify-center ${emptyMuted} ${compactEmpty}`}>채팅 메시지가 없습니다.</div>}
                    </>
                )}
            </div>
            <div className={`relative flex-shrink-0 ${arenaPremium ? 'mt-1.5 pt-1' : ''}`}>
               {showQuickChat && (
                   <div
                       ref={quickChatRef}
                       className={
                           arenaPremium
                               ? `${arenaGameRoomQuickChatPopoverClass} z-20`
                               : 'absolute bottom-full mb-2 w-full bg-secondary rounded-lg shadow-xl p-1 z-10 max-h-64 overflow-y-auto'
                       }
                   >
                       <div
                           className={
                               arenaPremium
                                   ? 'mb-2 grid grid-cols-5 gap-2 border-b border-slate-600/45 pb-2 text-2xl'
                                   : 'grid grid-cols-5 gap-1 text-xl mb-1 border-b border-color pb-1'
                           }
                       >
                          {GAME_CHAT_EMOJIS.map(emoji => (
                              <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleSend({ emoji })}
                                  className={arenaPremium ? arenaGameRoomQuickChatEmojiBtnClass : 'w-full p-1 rounded-md hover:bg-accent transition-colors text-center'}
                              >
                                  {emoji}
                              </button>
                          ))}
                       </div>
                       <ul className={arenaPremium ? 'space-y-1' : 'space-y-0.5'}>
                          {GAME_CHAT_MESSAGES.map(msg => (
                              <li key={msg}>
                                  <button
                                      type="button"
                                      onClick={() => handleSend({ text: msg })}
                                      className={arenaPremium ? arenaGameRoomQuickChatPhraseBtnClass : 'w-full text-left text-xs p-1 rounded-md hover:bg-accent transition-colors'}
                                  >
                                      {msg}
                                  </button>
                              </li>
                          ))}
                       </ul>
                   </div>
               )}
               <form onSubmit={handleSendTextSubmit} className={arenaPremium ? 'flex gap-2' : 'flex gap-1'}>
                    <button
                        type="button"
                        onClick={() => setShowQuickChat(s => !s)}
                        className={
                            arenaPremium
                                ? arenaGameRoomChatIconToggleClass
                                : 'bg-secondary hover:bg-tertiary text-primary font-bold px-2.5 rounded-md transition-colors text-lg flex items-center justify-center'
                        }
                        title="빠른 채팅"
                        disabled={isInputDisabled}
                    >
                        <span>🙂</span>
                    </button>
                   <input
                       type="text"
                       value={chatInput}
                       onChange={e => setChatInput(e.target.value)}
                       placeholder={placeholderText}
                       className={
                           arenaPremium
                               ? `${arenaGameRoomChatInputClass} ${compactUi ? 'text-[11px]' : 'text-sm'}`
                               : `flex-grow bg-tertiary border border-color rounded-md p-1 focus:ring-accent focus:border-accent disabled:bg-secondary disabled:text-tertiary ${compactUi ? 'text-[11px]' : 'text-xs'}`
                       }
                       maxLength={30}
                       disabled={isInputDisabled}
                   />
                   <Button
                       type="submit"
                       bare={arenaPremium}
                       disabled={!chatInput.trim() || isInputDisabled}
                       className={
                           arenaPremium
                               ? '!px-3 !py-2 rounded-lg border border-sky-600/40 bg-gradient-to-b from-sky-700/90 to-sky-950 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110 disabled:opacity-40 disabled:grayscale'
                               : '!px-2 !py-1'
                       }
                       {...(arenaPremium ? { colorScheme: 'none' as const } : {})}
                       title="보내기"
                   >
                        💬
                   </Button>
               </form>
            </div>
        </div>
    );
};

export default ChatWindow;
