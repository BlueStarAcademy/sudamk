
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ChatMessage, ServerAction, GameMode, UserWithStatus } from '../../types.js';
import { GAME_CHAT_MESSAGES, GAME_CHAT_EMOJIS } from '../../constants/index.js';
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
import ChatInlineMessageRow from './ChatInlineMessageRow.js';
import { guildChatHistoryEntryToChatMessage } from '../../shared/utils/guildChatMessageAdapter.js';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation('lobby');
    const { t: tGuild } = useTranslation('guild');
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
                return t('locationPrefix.strategic');
            case 'playful':
                return t('locationPrefix.playful');
            case 'global':
                return t('locationPrefix.home');
            default:
                if (mode === 'singleplayer') return t('locationPrefix.singleplayer');
                if (mode === 'tower') return t('locationPrefix.tower');
                if (mode === 'tournament') return t('locationPrefix.tournament');
                return t('locationPrefix.home');
        }
    };

    const handleSend = (message: { text?: string, emoji?: string }) => {
        if (cooldown > 0) return;
        
        if (activeTab === 'guild') {
            // 길드 채팅 전송
            handlers.handleAction({ type: 'SEND_GUILD_CHAT_MESSAGE', payload: { content: message.text || '' } });
        } else {
            // 전체 채팅 전송 — 모든 화면에서 global 채널로 통일 (위치는 location 접두어로 구분)
            const payload = { channel: 'global', ...message, location: getLocationPrefix() };
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
            alert(t('chat.profanityAlert'));
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
        ? t('chat.banPlaceholder', { minutes: banTimeLeft }) 
        : isInputDisabled
            ? t('chat.cooldownPlaceholder', { seconds: cooldown })
            : t('chat.placeholder');

    const hasGuild = !!currentUserWithStatus?.guildId;
    const guildChatUnlocked = userMeetsGuildFeatureLevelRequirement(currentUserWithStatus);
    const hasGuildChatAccess = hasGuild && guildChatUnlocked;
    const displayedMessages = useMemo(() => {
        if (activeTab === 'guild') {
            return guildMessages.map((msg) => guildChatHistoryEntryToChatMessage(msg, allUsers, tGuild));
        }
        return messages;
    }, [activeTab, guildMessages, messages, allUsers, tGuild]);

    useEffect(() => {
        if (!hasGuildChatAccess && activeTab === 'guild') setActiveTab('global');
    }, [hasGuildChatAccess, activeTab]);
    const compactUi = compactHome || compactTournamentMobile;
    const compactMsg = compactUi ? 'text-sm leading-snug' : 'text-base leading-snug';
    const compactEmpty = compactUi ? 'text-sm leading-snug' : 'text-base';

    const rootClass = arenaPremium
        ? 'flex h-full min-h-0 flex-col text-slate-100 p-0'
        : `flex h-full flex-col text-on-panel ${compactHome || compactTournamentMobile ? 'min-h-0 p-1' : 'min-h-[220px] p-4 sm:min-h-0'}`;

    const tabBarClass = arenaPremium
        ? `${arenaGameRoomChatTabBarClass} ${compactUi ? 'mb-1.5' : 'mb-2'}`
        : `flex flex-shrink-0 rounded-lg bg-gray-900/70 ${compactUi ? 'mb-1 p-0.5' : 'mb-2 p-1'}`;

    const tabBtnBase = compactUi ? 'py-1 text-sm' : 'py-1.5 text-base';
    const globalTabClass = arenaPremium
        ? `${activeTab === 'global' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass} flex-1 font-semibold ${tabBtnBase}`
        : `flex-1 rounded-md font-semibold ${tabBtnBase} ${activeTab === 'global' ? 'bg-blue-600 text-white' : 'text-gray-400'}`;
    const guildTabClass = arenaPremium
        ? `${activeTab === 'guild' ? arenaGameRoomChatTabActiveClass : arenaGameRoomChatTabInactiveClass} flex-1 font-semibold ${tabBtnBase}`
        : `flex-1 rounded-md font-semibold ${tabBtnBase} ${activeTab === 'guild' ? 'bg-blue-600 text-white' : 'text-gray-400'}`;

    const securityBannerClass = arenaPremium
        ? `mb-1.5 rounded-lg border border-amber-500/28 bg-gradient-to-r from-amber-950/55 via-slate-900/50 to-amber-950/45 px-2 py-1.5 text-center text-amber-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/12 ${compactUi ? 'text-xs leading-snug' : 'text-sm leading-snug'}`
        : `text-center text-yellow-400 bg-tertiary/50 ${compactUi ? 'mb-0.5 rounded-sm p-0.5 text-xs leading-snug' : 'rounded-sm p-0.5 text-sm'}`;

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
                        {t('chat.global')}
                    </button>
                    <button type="button" onClick={() => setActiveTab('guild')} className={guildTabClass}>
                        {t('chat.guild')}
                    </button>
                </div>
            ) : (
                <h2
                    className={
                        arenaPremium
                            ? `${arenaGameRoomPanelTitleClass} flex-shrink-0 ${compactUi ? 'text-base pb-1 mb-1.5' : 'pb-1.5 mb-2'}`
                            : `flex-shrink-0 border-b border-color font-semibold ${compactUi ? 'pb-0.5 text-base' : 'pb-1 text-xl'}`
                    }
                >
                    {t('chat.global')}
                </h2>
            )}
            {activeTab === 'global' && <p className={securityBannerClass}>{t('chat.securityBanner')}</p>}
            <div
                ref={chatBodyRef}
                className={chatBodyClass}
            >
                {displayedMessages.length > 0 ? (
                    displayedMessages.map((msg) => (
                        <ChatInlineMessageRow
                            key={msg.id}
                            message={msg}
                            rowClassName={compactMsg}
                            onUserClick={handleUserClick}
                            onViewUser={onViewUser}
                            allUsers={allUsers}
                            currentUserId={currentUserWithStatus.id}
                            onOpenViewingItem={(item, isOwn) => handlers.openViewingItem(item, isOwn)}
                        />
                    ))
                ) : (
                    <div className={`flex h-full items-center justify-center ${emptyMuted} ${compactEmpty}`}>
                        {activeTab === 'guild' ? t('chat.noGuildMessages') : t('chat.noMessages')}
                    </div>
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
                                      className={arenaPremium ? arenaGameRoomQuickChatPhraseBtnClass : 'w-full text-left text-sm p-1.5 rounded-md hover:bg-accent transition-colors'}
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
                        title={t('chat.quickChatTitle')}
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
                               ? `${arenaGameRoomChatInputClass} ${compactUi ? 'text-sm' : 'text-base'}`
                               : `flex-grow bg-tertiary border border-color rounded-md p-1.5 focus:ring-accent focus:border-accent disabled:bg-secondary disabled:text-tertiary ${compactUi ? 'text-sm' : 'text-base'}`
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
                               ? '!px-3 !py-2 rounded-lg border border-sky-600/40 bg-gradient-to-b from-sky-700/90 to-sky-950 text-base font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110 disabled:opacity-40 disabled:grayscale'
                               : '!px-2 !py-1'
                       }
                       {...(arenaPremium ? { colorScheme: 'none' as const } : {})}
                       title={t('chat.sendTitle')}
                   >
                        💬
                   </Button>
               </form>
            </div>
        </div>
    );
};

export default ChatWindow;
