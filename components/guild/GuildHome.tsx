import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { Guild as GuildType } from '../../types/index.js';
import { GuildDashboard } from './GuildDashboard.js';
import BackButton from '../BackButton.js';

interface GuildHomeProps {
    initialGuild?: GuildType;
}

const GuildHome: React.FC<GuildHomeProps> = ({ initialGuild }) => {
    const { currentUserWithStatus, guilds, handlers } = useAppContext();
    const [guildDonationAnimation, setGuildDonationAnimation] = useState<{ coins: number; research: number; type: 'gold' | 'diamond' } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasLoadedRef = useRef(false);

    // 현재 사용자의 길드 찾기
    const myGuild = useMemo(() => {
        // 사용자가 길드에 속해있지 않으면 null 반환
        if (!currentUserWithStatus?.guildId) return null;
        const guildId = initialGuild?.id || currentUserWithStatus?.guildId;
        if (!guildId) return null;
        return guilds[guildId] || initialGuild || null;
    }, [guilds, currentUserWithStatus?.guildId, initialGuild]);

    // 새로고침 시 길드 정보 로드 (guilds 상태가 비어있을 때만)
    // guildId가 변경될 때만 실행되도록 하고, guilds 객체는 의존성에서 제거
    useEffect(() => {
        const guildId = currentUserWithStatus?.guildId;
        if (!guildId) {
            hasLoadedRef.current = true; // 길드 ID가 없으면 더 이상 시도하지 않음
            return;
        }
        
        // 이미 로드 시도했거나 로딩 중이면 스킵
        if (hasLoadedRef.current || isLoading) {
            return;
        }
        
        // guilds에 길드가 없거나, 멤버 목록이 비어있으면 GET_GUILD_INFO로 최신 데이터 동기화
        const existingGuild = guilds[guildId] || initialGuild;
        const needsLoad = !existingGuild || !existingGuild.members || existingGuild.members.length === 0;
        if (needsLoad) {
            const loadGuildInfo = async () => {
                setIsLoading(true);
                try {
                    const result: any = await handlers.handleAction({ type: 'GET_GUILD_INFO' });
                    if (result?.error) {
                        console.warn('[GuildHome] Failed to load guild info:', result.error);
                        // "가입한 길드가 없습니다" 또는 "길드를 찾을 수 없습니다" 오류는 프로필로 리다이렉트
                        if (result.error.includes('가입한 길드가 없습니다') || result.error.includes('길드를 찾을 수 없습니다')) {
                            hasLoadedRef.current = true; // 재시도 방지
                            // 길드가 없으면 프로필로 리다이렉트
                            setTimeout(() => {
                                window.location.hash = '#/profile';
                            }, 500);
                        } else {
                            // 다른 오류는 재시도 가능하도록 false로 설정 (하지만 실제로는 true로 유지하여 무한 루프 방지)
                            hasLoadedRef.current = true;
                        }
                    } else if (result?.clientResponse?.guild) {
                        hasLoadedRef.current = true;
                        console.log('[GuildHome] GET_GUILD_INFO success:', {
                            guildId: result.clientResponse.guild.id,
                            guildName: result.clientResponse.guild.name,
                            hasName: !!result.clientResponse.guild.name,
                            guildKeys: Object.keys(result.clientResponse.guild)
                        });
                        // guilds 상태는 useApp.ts에서 자동으로 업데이트됨
                    } else {
                        hasLoadedRef.current = true; // 성공 응답이지만 guild 없음
                    }
                } catch (error) {
                    console.error('[GuildHome] Error loading guild info:', error);
                    hasLoadedRef.current = true; // 에러 발생 시에도 재시도 방지
                    // 에러 발생 시 프로필로 리다이렉트
                    setTimeout(() => {
                        window.location.hash = '#/profile';
                    }, 500);
                } finally {
                    setIsLoading(false);
                }
            };
            loadGuildInfo();
        } else {
            hasLoadedRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserWithStatus?.guildId, initialGuild]);

    // 길드 기부 애니메이션 처리 (WebSocket 이벤트 또는 액션 결과에서 받을 수 있음)
    useEffect(() => {
        // 기부 애니메이션은 3초 후 자동으로 사라짐
        if (guildDonationAnimation) {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
            animationTimeoutRef.current = setTimeout(() => {
                setGuildDonationAnimation(null);
            }, 3000);
        }
        return () => {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
        };
    }, [guildDonationAnimation]);

    // 사용자가 길드에 속해있지 않으면 프로필로 리다이렉트 (currentUserWithStatus가 로드된 후에만, 길드 ID가 확실히 없을 때만)
    useEffect(() => {
        if (!currentUserWithStatus) return; // 사용자 정보가 아직 로드 중이면 대기
        if (!currentUserWithStatus.guildId) {
            const t = setTimeout(() => {
                window.location.hash = '#/profile';
            }, 2000);
            return () => clearTimeout(t);
        }
    }, [currentUserWithStatus]);
    
    if (!currentUserWithStatus?.guildId) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <BackButton onClick={() => window.location.hash = '#/profile'} />
                <p className="text-gray-400">로그인 정보를 확인하는 중...</p>
            </div>
        );
    }

    // 로딩 중이면 로딩 표시
    if (isLoading && !myGuild) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">길드 정보를 불러오는 중...</p>
            </div>
        );
    }

    // 길드가 없거나 사용자가 길드에 속해있지 않으면 프로필로 리다이렉트 (로드 완료 후 myGuild가 없을 때만)
    useEffect(() => {
        if (!currentUserWithStatus?.guildId) return;
        if (isLoading) return; // 로딩 중에는 리다이렉트하지 않음
        if (!myGuild && hasLoadedRef.current) {
            window.location.hash = '#/profile';
        }
    }, [currentUserWithStatus?.guildId, myGuild, isLoading]);

    // 길드가 없으면 로딩 또는 리다이렉트 중 표시
    if (!myGuild) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <BackButton onClick={() => window.location.hash = '#/profile'} />
                <p className="text-gray-400">길드 정보를 불러오는 중...</p>
            </div>
        );
    }

    // 길드가 있으면 대시보드 표시
    return <GuildDashboard guild={myGuild} guildDonationAnimation={guildDonationAnimation} onDonationComplete={(coins: number, research: number, type: 'gold' | 'diamond') => setGuildDonationAnimation({ coins, research, type })} />;
};

export default GuildHome;
