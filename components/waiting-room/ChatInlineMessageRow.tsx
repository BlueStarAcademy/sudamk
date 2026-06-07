import React from 'react';
import type { ChatMessage, InventoryItem, UserWithStatus } from '../../types.js';

const ITEM_GRADE_COLOR_MAP: Record<string, string> = {
    normal: 'text-gray-300',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-red-500',
    mythic: 'text-orange-400',
};

export type ChatInlineMessageRowProps = {
    message: ChatMessage;
    rowClassName: string;
    onUserClick: (userId: string) => void;
    onViewUser?: (userId: string) => void;
    allUsers: UserWithStatus[];
    currentUserId?: string;
    onOpenViewingItem: (item: InventoryItem, isOwn: boolean) => void;
    suffix?: React.ReactNode;
};

function renderMessageText(
    msg: ChatMessage,
    isBotMessage: boolean,
    onUserClick: (userId: string) => void,
    onViewUser: ((userId: string) => void) | undefined,
    allUsers: UserWithStatus[],
    currentUserId: string | undefined,
    onOpenViewingItem: (item: InventoryItem, isOwn: boolean) => void,
): React.ReactNode {
    if (msg.actionInfo) {
        return (
            <>
                <span className="text-yellow-400">{msg.actionInfo.message}</span>
                <span className="text-gray-400"> (매너 </span>
                <span className={msg.actionInfo.scoreChange > 0 ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'}>
                    {msg.actionInfo.scoreChange > 0 ? `+${msg.actionInfo.scoreChange}` : msg.actionInfo.scoreChange}
                </span>
                <span className="text-gray-400">)</span>
            </>
        );
    }

    if (!msg.text) return null;

    const textStr = msg.text;
    const parts: (string | React.ReactElement)[] = [];
    let currentIndex = 0;

    const userLinkIndex = msg.userLink ? textStr.indexOf(`${msg.userLink.userName}님`) : -1;
    const itemLinkIndex = msg.itemLink ? textStr.indexOf(msg.itemLink.itemName) : -1;

    const linkIndices: Array<{ type: 'user' | 'item'; index: number; length: number }> = [];
    if (userLinkIndex >= 0 && msg.userLink) {
        linkIndices.push({ type: 'user', index: userLinkIndex, length: `${msg.userLink.userName}님`.length });
    }
    if (itemLinkIndex >= 0 && msg.itemLink) {
        linkIndices.push({ type: 'item', index: itemLinkIndex, length: msg.itemLink.itemName.length });
    }
    linkIndices.sort((a, b) => a.index - b.index);

    if (linkIndices.length === 0) {
        return (
            <span className={isBotMessage ? 'text-highlight' : ''}>
                {textStr}
                {isBotMessage && ' 🚓'}
            </span>
        );
    }

    linkIndices.forEach((link, idx) => {
        if (link.index > currentIndex) {
            parts.push(textStr.substring(currentIndex, link.index));
        }

        if (link.type === 'user' && msg.userLink) {
            parts.push(
                <span
                    key={`user-${idx}`}
                    className="cursor-pointer font-semibold text-blue-400 hover:underline"
                    onClick={() => {
                        if (onViewUser) {
                            onViewUser(msg.userLink!.userId);
                        } else {
                            onUserClick(msg.userLink!.userId);
                        }
                    }}
                    title={`${msg.userLink.userName} 프로필 보기`}
                >
                    {msg.userLink.userName}
                </span>,
            );
            parts.push('님');
        } else if (link.type === 'item' && msg.itemLink) {
            const itemGrade = msg.itemLink.itemGrade || 'normal';
            const gradeColor = ITEM_GRADE_COLOR_MAP[itemGrade] || 'text-gray-300';

            parts.push(
                <span
                    key={`item-${idx}`}
                    className={`${gradeColor} cursor-pointer font-semibold hover:underline`}
                    onClick={() => {
                        const targetUser = allUsers.find((u) => u.id === msg.itemLink!.userId);
                        if (targetUser) {
                            const item = targetUser.inventory?.find((i) => i.id === msg.itemLink!.itemId);
                            if (item) {
                                onOpenViewingItem(item, targetUser.id === currentUserId);
                            }
                        }
                    }}
                    title={`${msg.itemLink.itemName} 클릭하여 상세 정보 보기`}
                >
                    {msg.itemLink.itemName}
                </span>,
            );
        }

        currentIndex = link.index + link.length;
    });

    if (currentIndex < textStr.length) {
        parts.push(textStr.substring(currentIndex));
    }

    return (
        <span className={isBotMessage ? 'text-highlight' : ''}>
            {parts}
            {isBotMessage && ' 🚓'}
        </span>
    );
}

const ChatInlineMessageRow: React.FC<ChatInlineMessageRowProps> = ({
    message: msg,
    rowClassName,
    onUserClick,
    onViewUser,
    allUsers,
    currentUserId,
    onOpenViewingItem,
    suffix,
}) => {
    const isBotMessage = msg.system && !msg.actionInfo && msg.user.nickname === 'AI 보안관봇';

    return (
        <div className={`group ${rowClassName}`}>
            {msg.location && <span className="pr-1 font-semibold text-tertiary">{msg.location}</span>}
            <span
                className={`pr-2 font-semibold ${msg.system ? 'text-highlight' : 'cursor-pointer text-tertiary hover:underline'}`}
                onClick={() => !msg.system && onUserClick(msg.user.id)}
                title={!msg.system ? `${msg.user.nickname} 프로필 보기 / 제재` : ''}
            >
                {msg.system ? (isBotMessage ? 'AI 보안관봇' : '시스템') : msg.user.nickname}:
            </span>
            {msg.text &&
                renderMessageText(msg, isBotMessage, onUserClick, onViewUser, allUsers, currentUserId, onOpenViewingItem)}
            {msg.emoji && <span className="text-xl">{msg.emoji}</span>}
            {suffix}
        </div>
    );
};

export default ChatInlineMessageRow;
