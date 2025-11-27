import React, { useState, useEffect } from 'react';
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
            setError('길드 이름을 입력해주세요.');
            return;
        }

        if (name.length < 2 || name.length > 6) {
            setError('길드 이름은 2자 이상 6자 이하여야 합니다.');
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
                setError(`다이아가 부족합니다. (필요: ${GUILD_CREATION_COST.toLocaleString()}개, 보유: ${numDiamonds.toLocaleString()}개)`);
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
                setError('길드 생성 응답 형식이 올바르지 않습니다.');
            }
        } catch (err: any) {
            console.error('[GuildCreateModal] Exception occurred:', err);
            setError(err.message || '길드 생성에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DraggableWindow
            title="길드 창설"
            windowId="guild-create"
            onClose={onClose}
            initialWidth={500}
            isTopmost
        >
            <div className="p-6">
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                        길드 이름 *
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="길드 이름을 입력하세요"
                        maxLength={6}
                        className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">2-6자</p>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                        길드 설명
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="길드 설명을 입력하세요 (선택사항)"
                        maxLength={200}
                        rows={4}
                        className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">{description.length}/200자</p>
                </div>

                {/* 가입방식 설정 */}
                <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <label className="block text-sm font-semibold text-gray-300 mb-3">
                        가입 방식
                    </label>
                    <div className="space-y-2">
                        <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            joinType === 'free' 
                                ? 'border-green-500/60 bg-green-500/10' 
                                : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                        }`}>
                            <input
                                type="radio"
                                name="joinType"
                                value="free"
                                checked={joinType === 'free'}
                                onChange={(e) => setJoinType(e.target.value as 'free')}
                                className="w-4 h-4 text-green-500 focus:ring-green-500"
                            />
                            <div className="flex-1">
                                <div className="font-semibold text-white">자유가입</div>
                                <div className="text-xs text-gray-400">누구나 자동으로 가입할 수 있습니다</div>
                            </div>
                        </label>
                        <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            joinType === 'application' 
                                ? 'border-yellow-500/60 bg-yellow-500/10' 
                                : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                        }`}>
                            <input
                                type="radio"
                                name="joinType"
                                value="application"
                                checked={joinType === 'application'}
                                onChange={(e) => setJoinType(e.target.value as 'application')}
                                className="w-4 h-4 text-yellow-500 focus:ring-yellow-500"
                            />
                            <div className="flex-1">
                                <div className="font-semibold text-white">신청가입</div>
                                <div className="text-xs text-gray-400">길드장의 승인이 필요합니다</div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 공개 설정 */}
                <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-gray-300">
                            공개 설정
                        </label>
                        <ToggleSwitch checked={isPublic} onChange={setIsPublic} />
                    </div>
                    <p className="text-xs text-gray-400">
                        {isPublic ? (
                            <span className="text-green-400">● 길드 목록에 표시되어 누구나 찾을 수 있습니다.</span>
                        ) : (
                            <span className="text-yellow-400">● 길드 목록에 표시되지 않으며, 초대를 통해서만 가입할 수 있습니다.</span>
                        )}
                    </p>
                </div>

                <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm text-yellow-200">
                            길드 생성 비용:
                        </p>
                        <div className="flex items-center gap-1">
                            <img src={resourceIcons.diamonds} alt="다이아" className="w-5 h-5 object-contain" />
                            <span className="font-bold text-yellow-200">{GUILD_CREATION_COST.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-yellow-300">
                            현재 보유:
                        </p>
                        <div className="flex items-center gap-1">
                            <img src={resourceIcons.diamonds} alt="다이아" className="w-4 h-4 object-contain" />
                            <span className="text-xs text-yellow-300 font-semibold">
                                {/* 다이아몬드 타입 변환 (BigInt일 수 있음) */}
                                {(() => {
                                    const diamonds = currentUserWithStatus?.diamonds;
                                    if (!diamonds) return 0;
                                    const numDiamonds = typeof diamonds === 'bigint' 
                                        ? Number(diamonds) 
                                        : (typeof diamonds === 'number' 
                                            ? diamonds 
                                            : (parseInt(String(diamonds || 0), 10) || 0));
                                    return numDiamonds.toLocaleString();
                                })()}
                            </span>
                        </div>
                    </div>
                    {/* 다이아몬드 부족 경고 */}
                    {(() => {
                        const diamonds = currentUserWithStatus?.diamonds;
                        if (!diamonds) return null;
                        const numDiamonds = typeof diamonds === 'bigint' 
                            ? Number(diamonds) 
                            : (typeof diamonds === 'number' 
                                ? diamonds 
                                : (parseInt(String(diamonds || 0), 10) || 0));
                        const canAfford = numDiamonds >= GUILD_CREATION_COST;
                        if (!canAfford) {
                            return (
                                <div className="mt-2 pt-2 border-t border-yellow-700/30">
                                    <p className="text-xs text-red-400">
                                        다이아가 부족합니다. (필요: {GUILD_CREATION_COST.toLocaleString()}개, 보유: {numDiamonds.toLocaleString()}개)
                                    </p>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                        <p className="text-sm text-red-200">{error}</p>
                    </div>
                )}

                <div className="flex gap-3">
                    <Button
                        onClick={onClose}
                        colorScheme="gray"
                        className="flex-1"
                        disabled={loading}
                    >
                        취소
                    </Button>
                    <Button
                        onClick={handleCreate}
                        colorScheme="green"
                        className="flex-1"
                        disabled={(() => {
                            if (loading || !name.trim()) return true;
                            // 다이아몬드 체크
                            const diamonds = currentUserWithStatus?.diamonds;
                            if (diamonds !== undefined && diamonds !== null && !currentUserWithStatus?.isAdmin) {
                                const numDiamonds = typeof diamonds === 'bigint' 
                                    ? Number(diamonds) 
                                    : (typeof diamonds === 'number' 
                                        ? diamonds 
                                        : (parseInt(String(diamonds || 0), 10) || 0));
                                return numDiamonds < GUILD_CREATION_COST;
                            }
                            return false;
                        })()}
                    >
                        {loading ? '생성 중...' : '길드 생성'}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildCreateModal;

