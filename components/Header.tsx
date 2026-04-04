
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UserWithStatus } from '../types.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { calculateUserEffects } from '../services/effectService.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../constants/rules.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { resourceIcons, ResourceIconKey, specialResourceIcons, SpecialResourceIconKey } from './resourceIcons.js';

const RESOURCE_LABEL: Record<ResourceIconKey, string> = {
    gold: '골드',
    diamonds: '다이아',
};

const SPECIAL_RESOURCE_LABEL: Record<SpecialResourceIconKey, string> = {
    guildCoins: '길드 코인',
};

/** 네이티브 모바일 특수재화 팝오버: 전면 광고·모달 루트(z-180)·인터스티셜(z-99999) 위에 표시 */
const SPECIAL_RESOURCES_POPOVER_Z = 200_000;

const ResourceDisplay = memo<{ icon: ResourceIconKey; value: number; className?: string; dense?: boolean }>(({ icon, value, className, dense }) => {
    const formattedValue = useMemo(() => value.toLocaleString(), [value]);
    return (
        <div className={`flex items-center bg-tertiary/50 rounded-full shadow-inner flex-shrink-0 ${dense ? 'gap-0.5 py-0.5 pl-0.5 pr-1.5' : 'gap-1 sm:gap-2 py-1 pl-1 pr-2 sm:pr-3'} ${className ?? ''}`}>
            <div className={`bg-primary flex items-center justify-center rounded-full flex-shrink-0 ${dense ? 'w-5 h-5' : 'w-7 h-7 text-lg'}`}>
                <img src={resourceIcons[icon]} alt={RESOURCE_LABEL[icon]} className={`object-contain ${dense ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} loading="lazy" decoding="async" />
            </div>
            <span className={`font-bold text-primary whitespace-nowrap ${dense ? 'text-[8px] max-w-[4.2rem] truncate' : 'text-[9px] sm:text-sm'}`}>{formattedValue}</span>
        </div>
    );
});
ResourceDisplay.displayName = 'ResourceDisplay';

export const ActionPointTimer: React.FC<{ user: UserWithStatus }> = ({ user }) => {
    const { actionPoints, lastActionPointUpdate } = user;
    const [timeLeft, setTimeLeft] = useState('');
    
    // actionPoints가 없으면 타이머 표시 안 함
    if (!actionPoints) return null;
    
    const regenInterval = useMemo(() => {
        const e = calculateUserEffects(user);
        return e.actionPointRegenInterval > 0 ? e.actionPointRegenInterval : ACTION_POINT_REGEN_INTERVAL_MS;
    }, [user]);

    useEffect(() => {
        if (!actionPoints || actionPoints.current >= actionPoints.max) {
            setTimeLeft('');
            return;
        }

        const updateTimer = () => {
            const nextRegenTime = lastActionPointUpdate + regenInterval;
            const remainingMs = Math.max(0, nextRegenTime - Date.now());
            const totalSeconds = Math.floor(remainingMs / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        };

        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
    }, [actionPoints.current, actionPoints.max, lastActionPointUpdate, regenInterval]);

    if (!timeLeft) return null;

    return <span className="text-[8px] sm:text-xs text-tertiary font-mono text-center whitespace-nowrap">({timeLeft})</span>;
};


interface HeaderProps { compact?: boolean }

const Header: React.FC<HeaderProps> = ({ compact = false }) => {
    const { currentUserWithStatus, handlers, unreadMailCount, isNativeMobile } = useAppContext();
    const isMobile = Boolean(isNativeMobile);
    const dense = isMobile || compact;
    const [isSpecialResourcesOpen, setIsSpecialResourcesOpen] = useState(false);
    const specialResourcesRef = useRef<HTMLDivElement>(null);
    const specialResourcesPopoverPortalRef = useRef<HTMLDivElement>(null);
    const [specialPopoverFixed, setSpecialPopoverFixed] = useState<{ top: number; right: number } | null>(null);

    const updateSpecialPopoverPosition = useCallback(() => {
        if (!isMobile || !isSpecialResourcesOpen || !specialResourcesRef.current) return;
        const rect = specialResourcesRef.current.getBoundingClientRect();
        setSpecialPopoverFixed({
            top: rect.bottom + 4,
            right: window.innerWidth - rect.right,
        });
    }, [isMobile, isSpecialResourcesOpen]);

    useLayoutEffect(() => {
        if (!isMobile || !isSpecialResourcesOpen) {
            setSpecialPopoverFixed(null);
            return;
        }
        updateSpecialPopoverPosition();
        window.addEventListener('resize', updateSpecialPopoverPosition);
        window.addEventListener('scroll', updateSpecialPopoverPosition, true);
        return () => {
            window.removeEventListener('resize', updateSpecialPopoverPosition);
            window.removeEventListener('scroll', updateSpecialPopoverPosition, true);
        };
    }, [isMobile, isSpecialResourcesOpen, updateSpecialPopoverPosition]);

    useEffect(() => {
        // 팝오버 열림 상태에서 외부 클릭으로 닫기
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!isSpecialResourcesOpen) return;
            if (specialResourcesRef.current?.contains(target)) return;
            if (specialResourcesPopoverPortalRef.current?.contains(target)) return;
            setIsSpecialResourcesOpen(false);
        };
        if (isSpecialResourcesOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isSpecialResourcesOpen]);

    if (!currentUserWithStatus) return null;

    const { handleLogout, openShop, openSettingsModal, openProfileEditModal, openMailbox } = handlers;
    const { actionPoints, gold, diamonds, guildCoins, isAdmin, avatarId, borderId, mbti, strategyLevel, playfulLevel } = currentUserWithStatus;
    const combinedUserLevel = (Number(strategyLevel) || 0) + (Number(playfulLevel) || 0);

    // actionPoints가 없으면 기본값 사용
    const safeActionPoints = actionPoints || { current: 0, max: 30 };
    // gold와 diamonds가 없으면 기본값 사용
    const safeGold = (gold !== undefined && gold !== null) ? gold : 0;
    const safeDiamonds = (diamonds !== undefined && diamonds !== null) ? diamonds : 0;
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    const specialResourcesPopoverPanel = (
        <div className="bg-primary border border-color rounded-lg shadow-2xl min-w-[100px] py-2">
            <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors">
                <img src={specialResourceIcons.guildCoins} alt={SPECIAL_RESOURCE_LABEL.guildCoins} className="w-5 h-5 object-contain" />
                <span className="font-bold text-sm text-primary whitespace-nowrap">
                    {(guildCoins ?? 0).toLocaleString()}
                </span>
            </div>
        </div>
    );

    return (
        <>
        <header className="relative z-50 w-full min-w-0 flex-shrink-0 overflow-x-hidden bg-primary/80 shadow-lg backdrop-blur-sm">
            <div
                className={`flex min-w-0 flex-wrap items-center gap-1 sm:gap-2 sm:flex-nowrap sm:items-center sm:gap-3 ${
                    dense ? 'min-h-0 px-1.5 py-1 sm:min-h-[52px] sm:p-2' : 'min-h-[70px] p-2.5 sm:min-h-[75px] sm:p-3'
                } ${dense ? 'gap-y-1' : 'gap-2'}`}
            >
                <div
                    className={`flex min-w-0 flex-shrink-0 cursor-pointer items-center gap-1.5 sm:gap-3 ${dense ? 'max-w-[min(42%,11rem)]' : ''} relative`}
                    onClick={openProfileEditModal}
                >
                     <Avatar userId={currentUserWithStatus.id} userName={currentUserWithStatus.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={dense ? 28 : compact ? 32 : 40} />
                     <div className="min-w-0 flex-1">
                        <h1 className={`font-bold text-primary truncate ${dense ? 'max-w-full text-[11px] sm:text-base' : ''}`}>{currentUserWithStatus.nickname}</h1>
                        <p className={`truncate text-tertiary ${dense ? 'text-[9px] sm:text-xs' : 'text-xs'}`}>
                            Lv.{combinedUserLevel}
                        </p>
                     </div>
                     {!mbti && (
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                     )}
                </div>

                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-0.5 sm:w-auto sm:flex-nowrap sm:gap-2">
                    <div
                        className={`flex flex-shrink-0 items-center gap-0.5 rounded-full border border-tertiary/40 bg-tertiary/60 shadow-inner sm:gap-1 ${
                            dense ? 'pl-1 pr-0.5 py-0.5' : 'pl-2 pr-1 py-1'
                        }`}
                    >
                        <span
                            className={`flex items-center gap-0.5 font-bold whitespace-nowrap text-primary sm:gap-1 ${dense ? 'text-[8px]' : 'text-[9px] sm:text-xs'}`}
                        >
                            <span className={`leading-none ${dense ? 'text-sm' : 'text-base'}`}>⚡</span>
                            {`${safeActionPoints.current}/${safeActionPoints.max}`}
                        </span>
                        <ActionPointTimer user={currentUserWithStatus} />
                        <button
                            onClick={handlers.openActionPointModal}
                            className={`flex flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 transition-colors hover:bg-primary ${
                                dense ? 'h-6 w-6' : 'h-7 w-7 sm:h-8 sm:w-8'
                            }`}
                            title="행동력 충전 (상점)"
                        >
                            <img
                                src={resourceIcons.actionPlus}
                                alt="행동력 충전"
                                className={`object-contain ${dense ? 'h-3 w-3' : 'h-4 w-4 sm:h-5 sm:w-5'}`}
                                loading="lazy"
                                decoding="async"
                            />
                        </button>
                    </div>
                    <ResourceDisplay icon="gold" value={safeGold} className="flex-shrink-0" dense={dense} />
                    <div className="relative flex-shrink-0" ref={specialResourcesRef}>
                        <div className="flex items-center gap-0.5 sm:gap-1">
                            <ResourceDisplay icon="diamonds" value={safeDiamonds} className="flex-shrink-0" dense={dense} />
                            <button
                                onClick={() => setIsSpecialResourcesOpen(!isSpecialResourcesOpen)}
                                className={`flex flex-shrink-0 items-center justify-center rounded-full border border-tertiary/40 bg-tertiary/60 transition-all hover:bg-tertiary/80 ${
                                    dense ? 'h-5 w-5' : 'h-6 w-6 sm:h-7 sm:w-7'
                                } ${isSpecialResourcesOpen ? 'bg-tertiary/80' : ''}`}
                                title="특수 재화"
                            >
                                <span
                                    className={`text-primary transition-transform ${dense ? 'text-[8px]' : 'text-[10px] sm:text-xs'} ${isSpecialResourcesOpen ? 'rotate-180' : ''}`}
                                >
                                    ▼
                                </span>
                            </button>
                        </div>
                        {isSpecialResourcesOpen && !isMobile && (
                            <div className="absolute top-full right-0 z-[99999] mt-1 min-w-[100px]">
                                {specialResourcesPopoverPanel}
                            </div>
                        )}
                    </div>
                    
                    <div className={`w-px flex-shrink-0 bg-border-color ${dense ? 'mx-0.5 h-6 self-center' : 'mx-1 h-9 sm:mx-2'}`} />
                    
                    {/* 공통 버튼들 (모바일에서도 항상 노출) */}
                    <div className="flex items-center gap-0.5 sm:gap-2">
                    {isAdmin && (
                        <Button
                            onClick={() => { window.location.hash = '#/admin'; }}
                            colorScheme="none"
                            className={`${
                                dense
                                    ? '!h-6 !min-h-6 !max-h-6 !px-1.5 !py-0 !text-[8px] !leading-none rounded-full border border-indigo-300/50 bg-gradient-to-r from-indigo-500/85 via-sky-500/80 to-cyan-400/80 text-white shadow-[0_10px_24px_-18px_rgba(59,130,246,0.55)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-18px_rgba(96,165,250,0.6)]'
                                    : '!px-3 !py-1.5 text-[9px] sm:text-xs rounded-lg border border-indigo-300/50 bg-gradient-to-r from-indigo-500/85 via-sky-500/80 to-cyan-400/80 text-white shadow-[0_10px_24px_-18px_rgba(59,130,246,0.55)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-18px_rgba(96,165,250,0.6)]'
                            } flex-shrink-0 whitespace-nowrap`}
                            style={{ letterSpacing: dense ? '0.04em' : '0.08em', ...(dense ? { fontSize: '8px' } : {}) }}
                        >
                            관리자
                        </Button>
                    )}
                    <button
                        onClick={openMailbox}
                        className={
                            dense
                                ? 'relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 transition-colors hover:bg-primary'
                                : 'relative rounded-lg p-2 text-xl transition-colors hover:bg-secondary'
                        }
                        title="우편함"
                    >
                        <img
                            src="/images/icon/mail.png"
                            alt="우편함"
                            className={`object-contain ${dense ? 'h-3 w-3' : 'h-6 w-6'}`}
                            loading="lazy"
                            decoding="async"
                        />
                        {unreadMailCount > 0 && (
                            <span
                                className={`absolute rounded-full border-2 border-primary bg-red-500 ${dense ? 'top-0 right-0 h-2 w-2' : 'top-1 right-1 h-2.5 w-2.5'}`}
                            />
                        )}
                    </button>
                    <button
                        onClick={openSettingsModal}
                        className={
                            dense
                                ? 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 text-sm leading-none transition-colors hover:bg-primary'
                                : 'rounded-lg p-2 text-xl transition-colors hover:bg-secondary'
                        }
                        title="설정"
                    >
                        ⚙️
                    </button>
                    <Button
                        onClick={handleLogout}
                        colorScheme="none"
                        className={`${
                            dense
                                ? '!h-6 !min-h-6 !max-h-6 !px-1.5 !py-0 !text-[8px] !leading-none rounded-full border border-rose-300/55 bg-gradient-to-r from-rose-500/85 via-red-500/80 to-orange-400/80 text-white shadow-[0_10px_22px_-18px_rgba(248,113,113,0.55)] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-16px_rgba(248,113,113,0.6)]'
                                : '!px-3 !py-1.5 text-[9px] sm:text-xs rounded-lg border border-rose-300/55 bg-gradient-to-r from-rose-500/85 via-red-500/80 to-orange-400/80 text-white shadow-[0_10px_22px_-18px_rgba(248,113,113,0.55)] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-16px_rgba(248,113,113,0.6)]'
                        } whitespace-nowrap`}
                        style={{ letterSpacing: dense ? '0.04em' : '0.08em', ...(dense ? { fontSize: '8px' } : {}) }}
                    >
                        로그아웃
                    </Button>
                    </div>
                </div>
            </div>
        </header>
        {isMobile &&
            isSpecialResourcesOpen &&
            specialPopoverFixed &&
            typeof document !== 'undefined' &&
            createPortal(
                <div
                    ref={specialResourcesPopoverPortalRef}
                    className="pointer-events-auto fixed w-max max-w-[min(16rem,calc(100vw-1rem))]"
                    style={{
                        top: specialPopoverFixed.top,
                        right: specialPopoverFixed.right,
                        zIndex: SPECIAL_RESOURCES_POPOVER_Z,
                    }}
                >
                    {specialResourcesPopoverPanel}
                </div>,
                document.body
            )}
        </>
    );
};

export default Header;