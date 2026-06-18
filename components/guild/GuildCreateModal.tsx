import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import { Guild } from '../../types/entities.js';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import { resourceIcons } from '../resourceIcons.js';
import { GUILD_CREATION_COST } from '../../constants/index.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';

interface GuildCreateModalProps {
    onClose: () => void;
    onSuccess: (guild: Guild) => void;
}

const GuildCreateModal: React.FC<GuildCreateModalProps> = ({ onClose, onSuccess }) => {
    const { t } = useTranslation(['guild', 'common']);
    const { handlers, currentUserWithStatus } = useAppContext();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true); // 기본값: 공개
    const [joinType, setJoinType] = useState<'application' | 'free'>('free'); // 기본값: 자유가입
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if user already has a guild when modal opens
    // Admin users can always create a guild, even if they're in one
    useEffect(() => {
        if (currentUserWithStatus?.guildId && !currentUserWithStatus?.isAdmin) {
            // User already has a guild (and is not admin), close modal to show guild home
            onClose();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserWithStatus?.guildId, currentUserWithStatus?.isAdmin]);

    const handleCreate = async () => {
        if (!name.trim()) {
            setError(t('createModal.errors.nameRequired'));
            return;
        }

        if (name.length < 2 || name.length > 6) {
            setError(t('createModal.errors.nameLengthAlt'));
            return;
        }

        // 다이아몬드 체크 (클라이언트에서 먼저 체크)
        const diamonds = currentUserWithStatus?.diamonds;
        if (diamonds !== undefined && diamonds !== null) {
            const numDiamonds = typeof diamonds === 'bigint' 
                ? Number(diamonds) 
                : (typeof diamonds === 'number' 
                    ? diamonds 
                    : (parseInt(String(diamonds || 0), 10) || 0));
            
            if (numDiamonds < GUILD_CREATION_COST && !currentUserWithStatus?.isAdmin) {
                setError(t('createModal.errors.insufficientDiamonds', {
                    required: GUILD_CREATION_COST.toLocaleString(),
                    owned: numDiamonds.toLocaleString(),
                }));
                return;
            }
        }

        // Check if user already has a guild
        // Admin users can always create a guild, even if they're in one
        if (currentUserWithStatus?.guildId && !currentUserWithStatus?.isAdmin) {
            // User already has a guild (and is not admin), close modal to show guild home
            onClose();
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('[GuildCreateModal] Attempting to create guild:', { name: name.trim(), description: description.trim() || undefined, isPublic, joinType });
            const result: any = await handlers.handleAction({
                type: 'CREATE_GUILD',
                payload: { name: name.trim(), description: description.trim() || undefined, isPublic, joinType },
            });

            console.log('[GuildCreateModal] Received response:', {
                hasResult: !!result,
                hasError: !!result?.error,
                hasSuccess: !!result?.success,
                hasGuild: !!result?.guild,
                hasClientResponse: !!result?.clientResponse,
                hasClientResponseGuild: !!result?.clientResponse?.guild,
                result: result
            });

            // Server returns { success: true, guild: {...}, updatedUser: {...} } 
            // or { clientResponse: { guild: {...}, updatedUser: {...} } }
            const guild = result?.guild || result?.clientResponse?.guild;

            if (result?.error) {
                console.warn('[GuildCreateModal] Error received:', result.error);
                // If error is about already being in a guild, close modal to show guild home
                if (result.error.includes('이미 길드에 가입되어 있습니다') || 
                    result.error.includes('already in guild')) {
                    onClose();
                    return;
                }
                setError(result.error);
            } else if (guild) {
                console.log('[GuildCreateModal] Guild created successfully:', guild);
                setLoading(false);
                onSuccess(guild);
            } else {
                console.error('[GuildCreateModal] Unexpected response format:', {
                    result,
                    hasResult: !!result,
                    hasSuccess: !!result?.success,
                    hasGuild: !!result?.guild,
                    hasClientResponse: !!result?.clientResponse,
                    hasClientResponseGuild: !!result?.clientResponse?.guild,
                    clientResponseKeys: result?.clientResponse ? Object.keys(result.clientResponse) : [],
                    resultKeys: result ? Object.keys(result) : []
                });
                setError(t('createModal.errors.invalidResponse'));
            }
        } catch (err: any) {
            console.error('[GuildCreateModal] Exception occurred:', err);
            setError(err.message || t('createModal.errors.createFailed'));
        } finally {
            setLoading(false);
        }
    };

    const userDiamonds = currentUserWithStatus
        ? (typeof currentUserWithStatus.diamonds === 'bigint'
            ? Number(currentUserWithStatus.diamonds)
            : (typeof currentUserWithStatus.diamonds === 'number'
                ? currentUserWithStatus.diamonds
                : (parseInt(String(currentUserWithStatus.diamonds || 0), 10) || 0)))
        : 0;
    const canAfford = userDiamonds >= GUILD_CREATION_COST;

    return (
        <DraggableWindow
            title={t('createModal.title')}
            windowId="guild-create"
            onClose={onClose}
            initialWidth={720}
            isTopmost
        >
            <div className="p-5">
                {/* 가로 배치: 왼쪽 = 이름/설명, 오른쪽 = 설정/비용/버튼 */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
                    {/* 왼쪽: 기본 정보 */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                                {t('createModal.nameLabel')} <span className="text-gray-500 font-normal">{t('createModal.nameLengthHint')}</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('createModal.namePlaceholderAlt')}
                                maxLength={6}
                                className="w-full px-3 py-2.5 bg-gray-800/80 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                                {t('createModal.descriptionLabel')} <span className="text-gray-500 font-normal">{t('createModal.descriptionOptionalHint')}</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('createModal.descriptionPlaceholderAlt')}
                                maxLength={200}
                                rows={4}
                                className="w-full px-3 py-2.5 bg-gray-800/80 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none resize-none transition-colors"
                            />
                            <p className="text-xs text-gray-500 mt-1 text-right">{description.length}/200</p>
                        </div>
                    </div>

                    {/* 오른쪽: 설정 & 비용 & 버튼 */}
                    <div className="flex flex-col gap-4">
                        {/* 가입 방식 */}
                        <div className="p-3.5 bg-gray-800/50 rounded-xl border border-gray-700">
                            <label className="block text-sm font-semibold text-gray-300 mb-2.5">
                                {t('createModal.joinMethod')}
                            </label>
                            <div className="space-y-1.5">
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    joinType === 'free'
                                        ? 'border-emerald-500/60 bg-emerald-500/10'
                                        : 'border-gray-600 bg-transparent hover:border-gray-500'
                                }`}>
                                    <input
                                        type="radio"
                                        name="joinType"
                                        value="free"
                                        checked={joinType === 'free'}
                                        onChange={() => setJoinType('free')}
                                        className="w-3.5 h-3.5 text-emerald-500"
                                    />
                                    <span className="text-sm font-medium text-white">{t('createModal.freeJoin')}</span>
                                </label>
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    joinType === 'application'
                                        ? 'border-amber-500/60 bg-amber-500/10'
                                        : 'border-gray-600 bg-transparent hover:border-gray-500'
                                }`}>
                                    <input
                                        type="radio"
                                        name="joinType"
                                        value="application"
                                        checked={joinType === 'application'}
                                        onChange={() => setJoinType('application')}
                                        className="w-3.5 h-3.5 text-amber-500"
                                    />
                                    <span className="text-sm font-medium text-white">{t('createModal.applicationJoin')}</span>
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-1.5">
                                {joinType === 'free' ? t('createModal.freeJoinHint') : t('createModal.applicationJoinHint')}
                            </p>
                        </div>

                        {/* 공개 설정 */}
                        <div className="p-3.5 bg-gray-800/50 rounded-xl border border-gray-700">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-300">{t('createModal.publicSetting')}</span>
                                <ToggleSwitch checked={isPublic} onChange={setIsPublic} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {isPublic ? t('createModal.publicHint') : t('createModal.privateHint')}
                            </p>
                        </div>

                        {/* 비용 */}
                        <div className="p-3.5 rounded-xl border bg-amber-950/30 border-amber-700/40">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-amber-200">{t('createModal.creationCost')}</span>
                                <div className="flex items-center gap-1">
                                    <img src={resourceIcons.diamonds} alt="" className="w-4 h-4 object-contain" />
                                    <span className="font-bold text-amber-200">{GUILD_CREATION_COST.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1.5 text-xs text-amber-200/80">
                                <span>{t('createModal.owned')}</span>
                                <span className={canAfford ? 'text-emerald-400' : 'text-red-400'}>
                                    {userDiamonds.toLocaleString()}
                                </span>
                            </div>
                            {!canAfford && (
                                <p className="text-xs text-red-400 mt-1.5">
                                    {t('createModal.shortage', { count: (GUILD_CREATION_COST - userDiamonds).toLocaleString() })}
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="p-2.5 bg-red-900/30 border border-red-700/50 rounded-lg">
                                <p className="text-xs text-red-200">{error}</p>
                            </div>
                        )}

                        <div className="flex gap-2 mt-auto pt-2">
                            <Button
                                onClick={onClose}
                                colorScheme="gray"
                                className="flex-1 py-2 text-sm font-medium"
                                disabled={loading}
                            >
                                {t('common:actions.cancel')}
                            </Button>
                            <Button
                                onClick={handleCreate}
                                colorScheme="green"
                                className="flex-1 py-2 text-sm font-medium"
                                disabled={loading || !name.trim() || (!currentUserWithStatus?.isAdmin && !canAfford)}
                            >
                                {loading ? t('createModal.creating') : t('createModal.createAction')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildCreateModal;

