import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UserWithStatus, ServerAction } from '../types/index.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';

interface AdminModerationModalProps {
    user: UserWithStatus;
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}

const AdminModerationModal: React.FC<AdminModerationModalProps> = ({ user, currentUser, onClose, onAction, isTopmost }) => {
    const { t } = useTranslation('common');
    const now = Date.now();
    const isChatBanned = user.chatBanUntil && user.chatBanUntil > now;
    const isConnectionBanned = user.connectionBanUntil && user.connectionBanUntil > now;

    const chatBanTimeLeft = isChatBanned ? Math.ceil((user.chatBanUntil! - now) / 1000 / 60) : 0;
    const connectionBanTimeLeft = isConnectionBanned ? Math.ceil((user.connectionBanUntil! - now) / 1000 / 60) : 0;

    const applySanction = (sanctionType: 'chat' | 'connection', durationMinutes: number) => {
        onAction({
            type: 'ADMIN_APPLY_SANCTION',
            payload: {
                targetUserId: user.id,
                sanctionType,
                durationMinutes,
                reason: t('adminModeration.sanctionReason'),
            }
        });
    };

    const liftSanction = (sanctionType: 'chat' | 'connection') => {
        onAction({
            type: 'ADMIN_LIFT_SANCTION',
            payload: {
                targetUserId: user.id,
                sanctionType,
            }
        });
    };

    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);

    const chatBanOptions = [
        { label: t('adminModeration.duration1m'), minutes: 1 },
        { label: t('adminModeration.duration5m'), minutes: 5 },
        { label: t('adminModeration.duration10m'), minutes: 10 },
        { label: t('adminModeration.duration30m'), minutes: 30 },
        { label: t('adminModeration.duration1h'), minutes: 60 },
    ];

    const connectionBanOptions = [
        { label: t('adminModeration.duration10m'), minutes: 10 },
        { label: t('adminModeration.duration1h'), minutes: 60 },
        { label: t('adminModeration.duration6h'), minutes: 360 },
        { label: t('adminModeration.duration1d'), minutes: 1440 },
        { label: t('adminModeration.duration3d'), minutes: 4320 },
        { label: t('adminModeration.durationPermanent'), minutes: 999999 },
    ];

    return (
        <DraggableWindow title={t('adminModeration.title', { nickname: user.nickname })} onClose={onClose} windowId={`admin-mod-${user.id}`} isTopmost={isTopmost}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-lg">
                    <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={64} />
                    <div>
                        <h3 className="text-xl font-bold">{user.nickname}</h3>
                        <p className="text-sm text-gray-400">ID: {user.username}</p>
                    </div>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg space-y-3">
                    <h4 className="font-bold text-lg border-b border-gray-600 pb-2">{t('adminModeration.chatSanction')}</h4>
                    {isChatBanned ? (
                        <div className="flex justify-between items-center">
                            <span className="text-red-400">{t('adminModeration.chatBanned', { minutes: chatBanTimeLeft })}</span>
                            <Button onClick={() => liftSanction('chat')} colorScheme="yellow" className="!text-xs !py-1">{t('adminModeration.lift')}</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-5 gap-2">
                            {chatBanOptions.map(opt => (
                                <Button key={opt.minutes} onClick={() => applySanction('chat', opt.minutes)} className="!text-xs">{opt.label}</Button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="bg-gray-800/50 p-4 rounded-lg space-y-3">
                    <h4 className="font-bold text-lg border-b border-gray-600 pb-2">{t('adminModeration.connectionSanction')}</h4>
                    {isConnectionBanned ? (
                        <div className="flex justify-between items-center">
                            <span className="text-red-400">{t('adminModeration.connectionBanned', { minutes: connectionBanTimeLeft })}</span>
                            <Button onClick={() => liftSanction('connection')} colorScheme="yellow" className="!text-xs !py-1">{t('adminModeration.lift')}</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                             {connectionBanOptions.map(opt => (
                                <Button key={opt.minutes} onClick={() => applySanction('connection', opt.minutes)} colorScheme="orange" className="!text-xs">{opt.label}</Button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default AdminModerationModal;
