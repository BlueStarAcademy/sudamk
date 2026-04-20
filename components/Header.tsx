
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UserWithStatus } from '../types.js';
import type { ServerAction } from '../types/api.js';
import Button from './Button.js';
import ConfirmModal from './ConfirmModal.js';
import Avatar from './Avatar.js';
import { calculateUserEffects } from '../services/effectService.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { GUILD_BOSS_MAX_ATTEMPTS, GUILD_WAR_PERSONAL_DAILY_ATTEMPTS } from '../shared/constants/guildConstants.js';
import { getTodayKSTDateString } from '../utils/timeUtils.js';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../constants/rules.js';
import { isInsideSudamrAdUi } from '../constants/ads.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { resourceIcons, ResourceIconKey, specialResourceIcons, SpecialResourceIconKey } from './resourceIcons.js';

const RESOURCE_LABEL: Record<ResourceIconKey, string> = {
    gold: '골드',
    diamonds: '다이아',
};

const SPECIAL_RESOURCE_LABEL: Record<SpecialResourceIconKey, string> = {
    guildCoins: '길드 코인',
};

/**
 * 헤더 재화 숫자 — 골드·다이아·길드 코인 동일 클래스 (이전 9px 하한·dense 맞춤으로 길드만 작아지던 문제 방지)
 */
const HEADER_RESOURCE_VALUE_CLASS = {
    pc: 'tabular-nums leading-none text-sm sm:text-base',
    dense: 'min-w-0 tabular-nums leading-none text-xs sm:text-sm',
    fluid: 'min-w-0 flex-1 tabular-nums leading-none tracking-tight text-[clamp(0.5rem,calc(0.1rem+2.5vw),0.95rem)]',
} as const;

/** 네이티브 모바일 특수재화 팝오버: 전면 광고·모달 루트(z-180)·인터스티셜(z-99999) 위에 표시 */
const SPECIAL_RESOURCES_POPOVER_Z = 200_000;

/** 모바일 상단 헤더: 우편함·설정·로그아웃 터치 영역 */
const MOBILE_HEADER_ACTION_BTN =
    'h-[clamp(1.9rem,6.5vw,2.52rem)] w-[clamp(1.9rem,6.5vw,2.52rem)]';
const MOBILE_HEADER_MAIL_ICON = 'h-[clamp(1rem,3.65vw,1.28rem)] w-[clamp(1rem,3.65vw,1.28rem)]';
const MOBILE_HEADER_SETTINGS_ICON = 'text-[clamp(0.95rem,3.55vw,1.28rem)]';
const MOBILE_HEADER_POWER_ICON = 'h-[clamp(1.18rem,4.15vw,1.62rem)] w-[clamp(1.18rem,4.15vw,1.62rem)]';

const getVipHeaderLabel = (user: UserWithStatus): '보상VIP' | '기능VIP' | 'VVIP' | null => {
    const now = Date.now();
    const anyUser = user as unknown as Record<string, unknown>;
    const readExpiry = (keys: string[]): number => {
        for (const key of keys) {
            const value = anyUser[key];
            if (typeof value === 'number' && Number.isFinite(value)) return value;
        }
        return 0;
    };
    const readText = (keys: string[]): string => {
        for (const key of keys) {
            const value = anyUser[key];
            if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
        }
        return '';
    };

    const typedVip = readText(['vipType', 'activeVipType', 'vipTier']);
    if (typedVip.includes('vvip')) return 'VVIP';
    if (typedVip.includes('function')) return '기능VIP';
    if (typedVip.includes('reward')) return '보상VIP';

    const vvipExpiresAt = readExpiry(['vvipExpiresAt', 'vvipEndAt', 'vvipUntil']);
    const rewardVipExpiresAt = readExpiry(['rewardVipExpiresAt', 'rewardVipEndAt', 'rewardVipUntil']);
    const functionVipExpiresAt = readExpiry(['functionVipExpiresAt', 'functionVipEndAt', 'functionVipUntil']);

    if (vvipExpiresAt > now) return 'VVIP';
    const rewardActive = rewardVipExpiresAt > now;
    const functionActive = functionVipExpiresAt > now;
    if (rewardActive && functionActive) return 'VVIP';
    if (functionActive) return '기능VIP';
    if (rewardActive) return '보상VIP';
    return null;
};

const ResourceDisplay = memo<{
    icon: ResourceIconKey;
    value: number;
    className?: string;
    dense?: boolean;
    /** 모바일 헤더: 가로를 채우며 숫자만 clamp로 반응형 */
    fluid?: boolean;
}>(({ icon, value, className, dense, fluid }) => {
    const formattedValue = useMemo(() => value.toLocaleString(), [value]);
    const shell = fluid
        ? 'min-w-0 flex-1'
        : 'flex-shrink-0';
    const valueClass = fluid
        ? HEADER_RESOURCE_VALUE_CLASS.fluid
        : dense
          ? HEADER_RESOURCE_VALUE_CLASS.dense
          : HEADER_RESOURCE_VALUE_CLASS.pc;
    const iconShell = fluid
        ? 'h-[clamp(1.28rem,4.6vw,1.625rem)] w-[clamp(1.28rem,4.6vw,1.625rem)]'
        : dense
          ? 'h-6 w-6'
          : 'w-7 h-7 text-lg';
    const iconImg = fluid
        ? 'h-[clamp(0.82rem,3.2vw,1.05rem)] w-[clamp(0.82rem,3.2vw,1.05rem)]'
        : dense
          ? 'h-4 w-4'
          : 'w-5 h-5';
    return (
        <div
            className={`flex items-center bg-tertiary/50 rounded-full shadow-inner ${shell} ${
                fluid ? 'gap-[clamp(0.125rem,0.8vw,0.25rem)] py-[clamp(0.125rem,0.6vw,0.25rem)] pl-[clamp(0.125rem,0.8vw,0.25rem)] pr-[clamp(0.25rem,1.2vw,0.45rem)]' : dense ? 'gap-0.5 py-0.5 pl-0.5 pr-1.5' : 'gap-1 sm:gap-2 py-1 pl-1 pr-2 sm:pr-3'
            } ${className ?? ''}`}
        >
            <div className={`bg-primary flex flex-shrink-0 items-center justify-center rounded-full ${iconShell}`}>
                <img src={resourceIcons[icon]} alt={RESOURCE_LABEL[icon]} className={`object-contain ${iconImg}`} loading="lazy" decoding="async" />
            </div>
            <span className={`font-bold text-primary whitespace-nowrap ${valueClass}`}>
                {formattedValue}
            </span>
        </div>
    );
});
ResourceDisplay.displayName = 'ResourceDisplay';

const GUILD_BOSS_TICKET_IMG = '/images/guild/ticket.png';
const GUILD_WAR_TICKET_IMG = '/images/guild/warticket.png';

/** 길드 보스·길드전: 남은 횟수 / 일일 최대 (길드홈 패널과 동일 의미) */
const GuildTicketPill = memo<{
    iconSrc: string;
    label: string;
    remaining: number;
    max: number;
    dense: boolean;
    isMobile: boolean;
}>(({ iconSrc, label, remaining, max, dense, isMobile }) => {
    const textClass = isMobile
        ? 'gap-[clamp(0.05rem,0.5vw,0.2rem)] text-[clamp(0.6rem,calc(0.42rem+2.35vw),0.84rem)] sm:gap-1'
        : dense
          ? 'gap-0.5 text-xs sm:gap-1 sm:text-sm'
          : 'gap-0.5 text-sm sm:gap-1 sm:text-base';
    const iconWrap = isMobile
        ? 'h-[clamp(1.28rem,4.6vw,1.625rem)] w-[clamp(1.28rem,4.6vw,1.625rem)]'
        : dense
          ? 'h-6 w-6'
          : 'h-7 w-7 text-lg';
    const iconImg = isMobile
        ? 'h-[clamp(0.82rem,3.2vw,1.05rem)] w-[clamp(0.82rem,3.2vw,1.05rem)]'
        : dense
          ? 'h-4 w-4'
          : 'h-5 w-5';
    return (
        <div
            title={label}
            className={`flex flex-shrink-0 items-center rounded-full border border-tertiary/40 bg-tertiary/60 shadow-inner ${
                isMobile
                    ? 'h-[clamp(1.45rem,4.8vw,1.85rem)] gap-[clamp(0.08rem,0.7vw,0.2rem)] pl-[clamp(0.3rem,1.5vw,0.45rem)] pr-[clamp(0.2rem,1vw,0.35rem)]'
                    : dense
                      ? 'gap-0.5 py-1 pl-1.5 pr-1.5 sm:gap-1'
                      : 'gap-0.5 py-1 pl-2 pr-2 sm:gap-1 sm:pr-2.5'
            }`}
        >
            <div className={`bg-primary flex flex-shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
                <img src={iconSrc} alt="" className={`object-contain ${iconImg}`} loading="lazy" decoding="async" />
            </div>
            <span className={`flex min-w-0 items-center font-bold whitespace-nowrap text-primary tabular-nums ${textClass}`}>
                {`${remaining}/${max}`}
            </span>
        </div>
    );
});
GuildTicketPill.displayName = 'GuildTicketPill';

function useGuildWarTicketsRemaining(
    guildId: string | undefined,
    handleAction: (action: ServerAction) => Promise<{ error?: string; clientResponse?: Record<string, unknown> } | void>,
    /** false면 API·폴링 없음 — 길드전 대기 화면(#/guildwar)에서만 서버 부하를 줄이기 위해 사용 */
    enabled: boolean,
): { remaining: number; max: number } {
    const max = GUILD_WAR_PERSONAL_DAILY_ATTEMPTS;
    const [remaining, setRemaining] = useState(max);
    useEffect(() => {
        if (!enabled || !guildId) {
            setRemaining(max);
            return;
        }
        let cancelled = false;
        const fetchWar = async () => {
            try {
                const r = (await handleAction({ type: 'GET_GUILD_WAR_DATA' })) as {
                    error?: string;
                    clientResponse?: {
                        activeWar?: { status?: string };
                        myRecordInCurrentWar?: { attempts?: number };
                    };
                };
                if (cancelled || r?.error) return;
                const war = r?.clientResponse?.activeWar;
                const rec = r?.clientResponse?.myRecordInCurrentWar;
                if (war && war.status === 'active') {
                    const used = Number(rec?.attempts ?? 0) || 0;
                    setRemaining(Math.max(0, max - used));
                } else {
                    setRemaining(max);
                }
            } catch {
                /* ignore */
            }
        };
        void fetchWar();
        const onEv = () => void fetchWar();
        if (typeof window !== 'undefined') window.addEventListener('sudamr:guild-war-update', onEv);
        const iv = window.setInterval(fetchWar, 60_000);
        return () => {
            cancelled = true;
            if (typeof window !== 'undefined') window.removeEventListener('sudamr:guild-war-update', onEv);
            window.clearInterval(iv);
        };
    }, [guildId, max, handleAction, enabled]);
    return { remaining, max };
}

export const ActionPointTimer: React.FC<{ user: UserWithStatus; mobile?: boolean }> = ({ user, mobile = false }) => {
    const { guilds } = useAppContext();
    const { actionPoints, lastActionPointUpdate } = user;
    const [timeLeft, setTimeLeft] = useState('');

    const guildForAp = user.guildId ? guilds[user.guildId] ?? null : null;

    const regenInterval = useMemo(() => {
        if (!actionPoints) return ACTION_POINT_REGEN_INTERVAL_MS;
        const e = calculateUserEffects(user, guildForAp);
        return e.actionPointRegenInterval > 0 ? e.actionPointRegenInterval : ACTION_POINT_REGEN_INTERVAL_MS;
    }, [user, guildForAp, actionPoints]);

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
    }, [actionPoints?.current, actionPoints?.max, lastActionPointUpdate, regenInterval]);

    // actionPoints가 없으면 타이머 표시 안 함 (훅 이후에만 early return)
    if (!actionPoints) return null;

    if (!timeLeft) return null;

    return (
        <span
            className={`font-mono text-tertiary text-center whitespace-nowrap ${
                mobile
                    ? 'text-[clamp(0.5625rem,calc(0.45rem+1.8vw),0.6875rem)]'
                    : 'text-xs sm:text-sm'
            }`}
        >
            ({timeLeft})
        </span>
    );
};


interface HeaderProps { compact?: boolean }

const Header: React.FC<HeaderProps> = ({ compact = false }) => {
    const { currentUserWithStatus, handlers, unreadMailCount, isNativeMobile, currentRoute } = useAppContext();
    const isMobile = Boolean(isNativeMobile);
    const dense = isMobile || compact;
    const [isSpecialResourcesOpen, setIsSpecialResourcesOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const specialResourcesRef = useRef<HTMLDivElement>(null);
    const specialResourcesPopoverPortalRef = useRef<HTMLDivElement>(null);
    const [specialPopoverFixed, setSpecialPopoverFixed] = useState<{ top: number; right: number } | null>(null);

    const updateSpecialPopoverPosition = useCallback(() => {
        if (!isSpecialResourcesOpen || !specialResourcesRef.current) return;
        const rect = specialResourcesRef.current.getBoundingClientRect();
        const margin = 8;
        const rightOffset = window.innerWidth - rect.right;
        setSpecialPopoverFixed({
            top: rect.bottom + 4,
            right: Math.max(margin, rightOffset),
        });
    }, [isSpecialResourcesOpen]);

    useLayoutEffect(() => {
        if (!isSpecialResourcesOpen) {
            setSpecialPopoverFixed(null);
            return;
        }
        updateSpecialPopoverPosition();
        window.addEventListener('resize', updateSpecialPopoverPosition);
        window.addEventListener('scroll', updateSpecialPopoverPosition, true);
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        vv?.addEventListener('resize', updateSpecialPopoverPosition);
        vv?.addEventListener('scroll', updateSpecialPopoverPosition);
        return () => {
            window.removeEventListener('resize', updateSpecialPopoverPosition);
            window.removeEventListener('scroll', updateSpecialPopoverPosition, true);
            vv?.removeEventListener('resize', updateSpecialPopoverPosition);
            vv?.removeEventListener('scroll', updateSpecialPopoverPosition);
        };
    }, [isSpecialResourcesOpen, updateSpecialPopoverPosition]);

    useEffect(() => {
        // 팝오버 열림 상태에서 외부 클릭으로 닫기
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!isSpecialResourcesOpen) return;
            if (isInsideSudamrAdUi(target)) return;
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

    const { handleLogout, openProfileEditModal, openMailbox, openSettingsModal, handleAction } = handlers;
    const { actionPoints, gold, diamonds, guildCoins, isAdmin, avatarId, borderId, mbti, strategyLevel, playfulLevel, guildId } = currentUserWithStatus;
    const guildWarHeaderTicketsEnabled = currentRoute.view === 'guildwar';
    const guildWarTickets = useGuildWarTicketsRemaining(guildId, handleAction, guildWarHeaderTicketsEnabled);
    const todayKstBoss = getTodayKSTDateString();
    const guildBossUsedToday =
        guildId && currentUserWithStatus.guildBossLastAttemptDayKST === todayKstBoss
            ? (currentUserWithStatus.guildBossAttemptsUsedToday ?? 0)
            : 0;
    const guildBossRemaining = guildId ? Math.max(0, GUILD_BOSS_MAX_ATTEMPTS - guildBossUsedToday) : 0;
    const combinedUserLevel = (Number(strategyLevel) || 0) + (Number(playfulLevel) || 0);
    const vipHeaderLabel = getVipHeaderLabel(currentUserWithStatus);

    // actionPoints가 없으면 기본값 사용
    const safeActionPoints = actionPoints || { current: 0, max: 30 };
    // gold와 diamonds가 없으면 기본값 사용
    const safeGold = (gold !== undefined && gold !== null) ? gold : 0;
    const safeDiamonds = (diamonds !== undefined && diamonds !== null) ? diamonds : 0;
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    const mobileAdditionalResources = useMemo(() => {
        const base: {
            key: string;
            icon: string;
            label: string;
            value: number;
            ratio?: { remaining: number; max: number };
        }[] = [
            { key: 'diamonds', icon: resourceIcons.diamonds, label: RESOURCE_LABEL.diamonds, value: safeDiamonds },
            { key: 'guildCoins', icon: specialResourceIcons.guildCoins, label: SPECIAL_RESOURCE_LABEL.guildCoins, value: guildCoins ?? 0 },
        ];
        if (guildId) {
            base.push({
                key: 'guildBossTickets',
                icon: GUILD_BOSS_TICKET_IMG,
                label: '길드 보스 입장권',
                value: guildBossRemaining,
                ratio: { remaining: guildBossRemaining, max: GUILD_BOSS_MAX_ATTEMPTS },
            });
            if (guildWarHeaderTicketsEnabled) {
                base.push({
                    key: 'guildWarTickets',
                    icon: GUILD_WAR_TICKET_IMG,
                    label: '길드전 참여권',
                    value: guildWarTickets.remaining,
                    ratio: { remaining: guildWarTickets.remaining, max: guildWarTickets.max },
                });
            }
        }
        return base;
    }, [
        guildId,
        guildBossRemaining,
        guildCoins,
        guildWarHeaderTicketsEnabled,
        guildWarTickets.max,
        guildWarTickets.remaining,
        safeDiamonds,
    ]);

    const specialResourcesPopoverPanel = (
        <div className="w-max max-w-[min(18rem,calc(100vw-1rem))] rounded-lg border border-color bg-primary py-1.5 shadow-2xl sm:py-2">
            {(isMobile
                ? mobileAdditionalResources
                : [{ key: 'guildCoins', icon: specialResourceIcons.guildCoins, label: SPECIAL_RESOURCE_LABEL.guildCoins, value: guildCoins ?? 0 }]
            ).map((resource) => (
                <div
                    key={resource.key}
                    className={`flex items-center px-[clamp(0.65rem,2.2vw,0.85rem)] py-1 transition-colors hover:bg-secondary sm:px-3 sm:py-1.5 ${
                        isMobile ? 'gap-[clamp(0.18rem,0.95vw,0.3rem)]' : 'gap-[clamp(0.35rem,1.5vw,0.5rem)] sm:gap-2'
                    }`}
                >
                    <div className={`${isMobile ? 'h-[clamp(1.28rem,4.6vw,1.625rem)] w-[clamp(1.28rem,4.6vw,1.625rem)]' : ''} flex shrink-0 items-center justify-center rounded-full bg-primary`}>
                        <img
                            src={resource.icon}
                            alt={resource.label}
                            className={`shrink-0 object-contain ${
                                isMobile
                                    ? 'h-[clamp(0.82rem,3.2vw,1.05rem)] w-[clamp(0.82rem,3.2vw,1.05rem)]'
                                    : 'h-[clamp(1rem,3.5vw,1.35rem)] w-[clamp(1rem,3.5vw,1.35rem)] sm:h-5 sm:w-5'
                            }`}
                            loading="lazy"
                            decoding="async"
                        />
                    </div>
                    <span className={`min-w-0 font-bold tabular-nums text-primary whitespace-nowrap ${
                        isMobile
                            ? 'text-[clamp(0.34rem,calc(0.03rem+2.05vw),0.82rem)] leading-none tracking-tight'
                            : 'text-[clamp(0.75rem,calc(0.55rem+1.6vw),0.875rem)] sm:text-sm'
                    }`}>
                        {resource.ratio != null
                            ? `${resource.ratio.remaining}/${resource.ratio.max}`
                            : resource.value.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );

    return (
        <>
        <header
            className={`relative z-50 w-full min-w-0 flex-shrink-0 bg-primary/80 shadow-lg backdrop-blur-sm ${isMobile ? 'overflow-x-visible pt-[max(6px,env(safe-area-inset-top,0px))]' : 'overflow-x-hidden'}`}
        >
            <div
                className={`flex min-w-0 w-full items-center ${
                    isMobile
                        ? 'min-h-[clamp(2.45rem,calc(1.55rem+6.2vw),4rem)] flex-nowrap content-center justify-end gap-x-[clamp(0.15rem,1vw,0.35rem)] overflow-x-auto overscroll-x-contain px-[clamp(0.3rem,1.8vw,0.55rem)] py-[clamp(0.2rem,1vw,0.35rem)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                        : dense
                          ? 'min-h-[clamp(3.25rem,calc(2.65rem+1.4vw),3.75rem)] flex-nowrap gap-x-2 gap-y-0 px-2 py-2 sm:gap-x-2 sm:px-2 sm:py-2'
                          : 'min-h-[clamp(3.5rem,calc(2.85rem+2vw),4.85rem)] flex-wrap gap-2 p-2.5 sm:flex-nowrap sm:gap-3 sm:p-3'
                }`}
            >
                {isMobile && vipHeaderLabel && (
                    <div className="mr-auto shrink-0 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-500/35 to-yellow-300/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-100 shadow-[0_8px_20px_-14px_rgba(251,191,36,0.85)]">
                        {vipHeaderLabel}
                    </div>
                )}
                {!isMobile && (
                <div
                    className={`flex min-w-0 flex-shrink-0 cursor-pointer items-center gap-2 sm:gap-3 ${dense ? 'max-w-[min(48%,14rem)]' : ''} relative`}
                    onClick={openProfileEditModal}
                >
                     {vipHeaderLabel && (
                        <span className="absolute -left-1 -top-2 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-500/40 to-yellow-300/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-100 shadow-[0_8px_20px_-14px_rgba(251,191,36,0.85)]">
                            {vipHeaderLabel}
                        </span>
                     )}
                     <Avatar userId={currentUserWithStatus.id} userName={currentUserWithStatus.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={dense ? 36 : compact ? 32 : 40} />
                     <p
                        className={`shrink-0 whitespace-nowrap font-extrabold tabular-nums tracking-tight text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)] ${
                            dense ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                        }`}
                     >
                        Lv.{combinedUserLevel}
                     </p>
                     <h1
                        className={`min-w-0 flex-1 truncate font-bold text-primary ${dense ? 'text-sm leading-tight sm:text-base' : 'text-base sm:text-lg'}`}
                     >
                        {currentUserWithStatus.nickname}
                     </h1>
                     {!mbti && (
                        <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500" aria-hidden />
                     )}
                </div>
                )}

                    <div
                        className={`flex min-w-0 items-center justify-end gap-0.5 sm:w-auto sm:gap-2 ${
                            isMobile
                                ? 'min-w-0 w-full max-w-full flex-1 flex-nowrap content-center justify-end gap-x-[clamp(0.12rem,0.9vw,0.28rem)] overflow-x-visible'
                                : dense
                                  ? 'min-w-0 flex-1 flex-nowrap overflow-hidden'
                                  : 'min-w-0 flex-1 flex-wrap sm:flex-nowrap'
                        }`}
                    >
                    <div
                        data-onboarding-target="onboarding-header-ap"
                        className={`flex items-center rounded-full border border-tertiary/40 bg-tertiary/60 shadow-inner ${
                            isMobile
                                ? 'min-w-0 shrink h-[clamp(1.45rem,4.8vw,1.85rem)] gap-[clamp(0.08rem,0.7vw,0.2rem)] pl-[clamp(0.3rem,1.5vw,0.45rem)] pr-[clamp(0.12rem,0.7vw,0.22rem)] sm:gap-1'
                                : dense
                                  ? 'flex-shrink-0 gap-0.5 py-1 pl-1.5 pr-1 sm:gap-1'
                                  : 'flex-shrink-0 gap-0.5 py-1 pl-2 pr-1 sm:gap-1'
                        }`}
                    >
                        <span
                            className={`flex min-w-0 items-center font-bold whitespace-nowrap text-primary ${
                                isMobile
                                    ? 'gap-[clamp(0.05rem,0.5vw,0.2rem)] text-[clamp(0.6rem,calc(0.42rem+2.35vw),0.84rem)] sm:gap-1'
                                    : dense
                                      ? 'gap-0.5 text-xs sm:gap-1 sm:text-sm'
                                      : 'gap-0.5 text-sm sm:gap-1 sm:text-base'
                            }`}
                        >
                            <span
                                className={`leading-none ${isMobile ? 'text-[clamp(0.85rem,calc(0.65rem+2vw),1.05rem)]' : 'text-base'}`}
                            >
                                ⚡
                            </span>
                            {`${safeActionPoints.current}/${safeActionPoints.max}`}
                        </span>
                        <ActionPointTimer user={currentUserWithStatus} mobile={isMobile} />
                        <button
                            onClick={handlers.openActionPointModal}
                            className={`flex flex-shrink-0 items-center justify-center transition-colors ${
                                isMobile
                                    ? 'h-[clamp(1.45rem,4.8vw,1.85rem)] w-[clamp(1.45rem,4.8vw,1.85rem)] rounded-none border-0 bg-transparent p-[clamp(0.1rem,0.5vw,0.2rem)] hover:bg-primary/20 active:bg-primary/30'
                                    : `rounded-full border-0 bg-primary/70 hover:bg-primary ${
                                          dense ? 'h-7 w-7' : 'h-7 w-7 sm:h-8 sm:w-8'
                                      }`
                            }`}
                            title="행동력 충전 (상점)"
                        >
                            <img
                                src={resourceIcons.actionPlus}
                                alt="행동력 충전"
                                className={`object-contain ${
                                    isMobile
                                        ? 'h-[clamp(0.75rem,2.6vw,0.95rem)] w-[clamp(0.75rem,2.6vw,0.95rem)]'
                                        : dense
                                          ? 'h-3.5 w-3.5'
                                          : 'h-4 w-4 sm:h-5 sm:w-5'
                                }`}
                                loading="lazy"
                                decoding="async"
                            />
                        </button>
                    </div>
                    {!isMobile && guildId && (
                        <>
                            <GuildTicketPill
                                iconSrc={GUILD_BOSS_TICKET_IMG}
                                label="길드 보스 입장권"
                                remaining={guildBossRemaining}
                                max={GUILD_BOSS_MAX_ATTEMPTS}
                                dense={dense}
                                isMobile={false}
                            />
                            {guildWarHeaderTicketsEnabled ? (
                                <GuildTicketPill
                                    iconSrc={GUILD_WAR_TICKET_IMG}
                                    label="길드전 참여권"
                                    remaining={guildWarTickets.remaining}
                                    max={guildWarTickets.max}
                                    dense={dense}
                                    isMobile={false}
                                />
                            ) : null}
                        </>
                    )}
                    <div
                        className={`relative min-w-[4.5rem] shrink-0 ${isMobile ? 'flex-1' : 'sm:min-w-0'}`}
                        ref={specialResourcesRef}
                    >
                        {isMobile ? (
                            <div className="flex min-w-0 w-full max-w-full items-center gap-[clamp(0.1rem,0.8vw,0.24rem)]">
                                <div className="min-w-0 flex-1 overflow-hidden">
                                    <ResourceDisplay
                                        icon="gold"
                                        value={safeGold}
                                        dense={dense}
                                        fluid
                                        className="h-[clamp(1.45rem,4.8vw,1.85rem)]"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSpecialResourcesOpen(!isSpecialResourcesOpen)}
                                    aria-expanded={isSpecialResourcesOpen}
                                    className={`flex h-[clamp(1.45rem,4.8vw,1.85rem)] w-[clamp(1.45rem,4.8vw,1.85rem)] shrink-0 touch-manipulation items-center justify-center rounded-full border border-tertiary/40 bg-tertiary/60 transition-all hover:bg-tertiary/80 active:scale-95 ${
                                        isSpecialResourcesOpen ? 'bg-tertiary/80' : ''
                                    }`}
                                    title="다른 재화"
                                >
                                    <span
                                        className={`text-[clamp(0.44rem,1.9vw,0.62rem)] text-primary transition-transform duration-200 ${
                                            isSpecialResourcesOpen ? 'rotate-180' : ''
                                        }`}
                                        aria-hidden
                                    >
                                        ▼
                                    </span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex min-w-0 w-full max-w-full items-center gap-1">
                                <ResourceDisplay icon="gold" value={safeGold} dense={dense} />
                                <ResourceDisplay icon="diamonds" value={safeDiamonds} dense={dense} />
                                <div
                                    className={`flex flex-shrink-0 items-center rounded-full bg-tertiary/50 shadow-inner ${
                                        dense ? 'gap-0.5 py-0.5 pl-0.5 pr-1.5' : 'gap-1 py-1 pl-1 pr-2 sm:gap-2 sm:pr-3'
                                    }`}
                                >
                                    <div
                                        className={`bg-primary flex flex-shrink-0 items-center justify-center rounded-full ${
                                            dense ? 'h-6 w-6' : 'h-7 w-7 text-lg'
                                        }`}
                                    >
                                        <img
                                            src={specialResourceIcons.guildCoins}
                                            alt={SPECIAL_RESOURCE_LABEL.guildCoins}
                                            className={`object-contain ${dense ? 'h-4 w-4' : 'h-5 w-5'}`}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                    <span className={`min-w-0 font-bold text-primary whitespace-nowrap ${dense ? HEADER_RESOURCE_VALUE_CLASS.dense : HEADER_RESOURCE_VALUE_CLASS.pc}`}>
                                        {(guildCoins ?? 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div
                        className={`w-px flex-shrink-0 self-center bg-border-color ${
                            isMobile ? 'mx-[clamp(0.1rem,0.8vw,0.25rem)] h-[clamp(1.35rem,4.5vw,1.85rem)]' : dense ? 'mx-0.5 h-7' : 'mx-1 h-9 sm:mx-2'
                        }`}
                    />
                    
                    {/* 공통 버튼들 (모바일에서도 항상 노출) */}
                    <div
                        className={`flex flex-shrink-0 items-center sm:gap-2 ${
                            isMobile ? 'gap-1.5' : 'gap-0.5'
                        }`}
                    >
                    {isAdmin && (
                        <Button
                            onClick={() => { window.location.hash = '#/admin'; }}
                            colorScheme="none"
                            className={`${
                                isMobile
                                    ? '!h-[clamp(1.45rem,4.8vw,1.85rem)] !min-h-0 !max-h-none !px-[clamp(0.35rem,1.8vw,0.5rem)] !py-0 !text-[clamp(0.55rem,calc(0.35rem+1.85vw),0.65rem)] !leading-none rounded-full border border-indigo-300/50 bg-gradient-to-r from-indigo-500/85 via-sky-500/80 to-cyan-400/80 text-white shadow-[0_10px_24px_-18px_rgba(59,130,246,0.55)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-18px_rgba(96,165,250,0.6)]'
                                    : dense
                                      ? '!h-7 !min-h-7 !max-h-7 !px-2 !py-0 !text-[10px] !leading-none rounded-full border border-indigo-300/50 bg-gradient-to-r from-indigo-500/85 via-sky-500/80 to-cyan-400/80 text-white shadow-[0_10px_24px_-18px_rgba(59,130,246,0.55)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-18px_rgba(96,165,250,0.6)]'
                                      : '!px-3 !py-1.5 text-[9px] sm:text-xs rounded-lg border border-indigo-300/50 bg-gradient-to-r from-indigo-500/85 via-sky-500/80 to-cyan-400/80 text-white shadow-[0_10px_24px_-18px_rgba(59,130,246,0.55)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-18px_rgba(96,165,250,0.6)]'
                            } flex-shrink-0 whitespace-nowrap`}
                            style={{
                                letterSpacing: dense || isMobile ? '0.04em' : '0.08em',
                                ...(dense && !isMobile ? { fontSize: '10px' } : {}),
                            }}
                        >
                            관리자
                        </Button>
                    )}
                    <button
                        onClick={openMailbox}
                        className={
                            isMobile
                                ? `relative flex ${MOBILE_HEADER_ACTION_BTN} flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 transition-colors hover:bg-primary`
                                : dense
                                  ? 'relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 transition-colors hover:bg-primary'
                                  : 'relative rounded-lg p-2 text-xl transition-colors hover:bg-secondary'
                        }
                        title="우편함"
                    >
                        <img
                            src="/images/icon/mail.png"
                            alt="우편함"
                            className={`object-contain ${
                                isMobile ? MOBILE_HEADER_MAIL_ICON : dense ? 'h-4 w-4' : 'h-6 w-6'
                            }`}
                            loading="lazy"
                            decoding="async"
                        />
                        {unreadMailCount > 0 && (
                            <span
                                className={`absolute rounded-full border-2 border-primary bg-red-500 ${
                                    isMobile ? 'right-0 top-0 h-[clamp(0.36rem,1.45vw,0.5rem)] w-[clamp(0.36rem,1.45vw,0.5rem)]' : dense ? 'top-0 right-0 h-1.5 w-1.5' : 'top-1 right-1 h-2.5 w-2.5'
                                }`}
                            />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={openSettingsModal}
                        className={
                            isMobile
                                ? `relative flex ${MOBILE_HEADER_ACTION_BTN} flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 ${MOBILE_HEADER_SETTINGS_ICON} transition-colors hover:bg-primary`
                                : dense
                                  ? 'relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 text-sm transition-colors hover:bg-primary'
                                  : 'relative rounded-lg p-2 text-xl transition-colors hover:bg-secondary'
                        }
                        title="설정"
                        aria-label="설정 열기"
                    >
                        ⚙️
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(true)}
                        className={`flex shrink-0 items-center justify-center rounded-full border-2 border-red-800/85 bg-red-500 text-black shadow-sm transition-colors hover:bg-red-600 ${
                            isMobile ? MOBILE_HEADER_ACTION_BTN : dense ? 'h-9 w-9' : 'h-10 w-10'
                        }`}
                        title="로그아웃"
                        aria-label="로그아웃"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className={`text-black ${
                                isMobile ? MOBILE_HEADER_POWER_ICON : dense ? 'h-[1.125rem] w-[1.125rem]' : 'h-5 w-5'
                            }`}
                            aria-hidden
                        >
                            <path
                                d="M12 3v9"
                                stroke="currentColor"
                                strokeWidth={2.8}
                                strokeLinecap="round"
                            />
                            <path
                                d="M5.636 5.636a9 9 0 1012.728 0"
                                stroke="currentColor"
                                strokeWidth={2.8}
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                    </div>
                </div>
            </div>
        </header>
        {isSpecialResourcesOpen &&
            specialPopoverFixed &&
            typeof document !== 'undefined' &&
            createPortal(
                <div
                    ref={specialResourcesPopoverPortalRef}
                    className="pointer-events-auto fixed w-max max-w-[min(18rem,calc(100vw-1rem))]"
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
        {showLogoutConfirm && (
            <ConfirmModal
                title="로그아웃"
                message="로그아웃 하시겠습니까?"
                confirmText="로그아웃"
                cancelText="취소"
                onConfirm={handleLogout}
                onCancel={() => setShowLogoutConfirm(false)}
                isTopmost
                windowId="logout-confirm-modal"
                variant="premium-danger"
            />
        )}
        </>
    );
};

export default Header;