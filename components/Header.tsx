
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UserWithStatus } from '../types.js';
import type { ServerAction } from '../types/api.js';
import Button from './Button.js';
import ConfirmModal from './ConfirmModal.js';
import { calculateUserEffects } from '../services/effectService.js';
import { GUILD_BOSS_MAX_ATTEMPTS, GUILD_WAR_PERSONAL_DAILY_ATTEMPTS } from '../shared/constants/guildConstants.js';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE,
    CHAMPIONSHIP_VERSUS_VENUE_KINDS,
} from '../shared/constants/championshipVersusVenue.js';
import { getTodayKSTDateString, getNextKstMidnightUtcMs } from '../utils/timeUtils.js';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../constants/rules.js';
import { isInsideSudamrAdUi } from '../constants/ads.js';
import { useAppUserSlice, useAppUiSlice, useAppRouteSlice } from '../hooks/useAppSlices.js';
import { resourceIcons, ResourceIconKey, specialResourceIcons, SpecialResourceIconKey } from './resourceIcons.js';
import ChampionshipVersusDuelTicketCountdown from './ChampionshipVersusDuelTicketCountdown.js';
import LiveCountdownToMs from './LiveCountdownToMs.js';
import { computeChampionshipVersusDuelTicketStateForVenue } from '../shared/utils/championshipVersusDuelTickets.js';

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

/** 모바일 헤더: 참여권·재화 드롭다운 ▼ 버튼 (크기·내부 아이콘 통일) */
const MOBILE_HEADER_CHEVRON_BTN =
    'flex h-[clamp(1.45rem,4.8vw,1.85rem)] w-[clamp(1.45rem,4.8vw,1.85rem)] shrink-0 touch-manipulation items-center justify-center rounded-full border border-tertiary/40 bg-tertiary/60 shadow-inner transition-all hover:bg-tertiary/80 active:scale-95';
const MOBILE_HEADER_CHEVRON_ICON =
    'text-[clamp(0.44rem,1.9vw,0.62rem)] text-primary transition-transform duration-200';

/** 모바일 헤더 드롭다운 팝오버 행 (참여권·재화 동일) */
const MOBILE_HEADER_POPOVER_ROW =
    'flex items-center gap-[clamp(0.18rem,0.95vw,0.3rem)] px-[clamp(0.65rem,2.2vw,0.85rem)] py-1 transition-colors hover:bg-secondary sm:px-3 sm:py-1.5';
const MOBILE_HEADER_POPOVER_ICON_SHELL =
    'flex h-[clamp(1.28rem,4.6vw,1.625rem)] w-[clamp(1.28rem,4.6vw,1.625rem)] shrink-0 items-center justify-center rounded-full bg-primary';
const MOBILE_HEADER_POPOVER_ICON_IMG =
    'h-[clamp(0.82rem,3.2vw,1.05rem)] w-[clamp(0.82rem,3.2vw,1.05rem)] shrink-0 object-contain';
const MOBILE_HEADER_POPOVER_VALUE =
    'min-w-0 font-bold tabular-nums leading-none tracking-tight text-primary whitespace-nowrap text-[clamp(0.34rem,calc(0.03rem+2.05vw),0.82rem)]';
const MOBILE_HEADER_POPOVER_COUNTDOWN =
    'shrink-0 font-mono font-bold tabular-nums text-amber-200/95 text-[clamp(0.34rem,calc(0.03rem+2.05vw),0.82rem)] leading-none';

const ResourceDisplay = memo<{
    icon: ResourceIconKey;
    value: number;
    className?: string;
    dense?: boolean;
    /** 모바일 헤더: 가로를 채우며 숫자만 clamp로 반응형 */
    fluid?: boolean;
    /** fluid일 때 내용 너비만 쓰고 늘리지 않음 (헤더 우측 정렬 등) */
    fluidShrinkToFit?: boolean;
}>(({ icon, value, className, dense, fluid, fluidShrinkToFit }) => {
    const { t } = useTranslation('common');
    const formattedValue = useMemo(() => value.toLocaleString(), [value]);
    const shell =
        fluid && !fluidShrinkToFit
            ? 'min-w-0 flex-1'
            : fluid
              ? 'min-w-0 w-max max-w-full shrink-0'
              : 'flex-shrink-0';
    const valueClass = fluid
        ? fluidShrinkToFit
            ? 'min-w-0 tabular-nums leading-none tracking-tight text-[clamp(0.5rem,calc(0.1rem+2.5vw),0.95rem)]'
            : HEADER_RESOURCE_VALUE_CLASS.fluid
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
                <img src={resourceIcons[icon]} alt={t(`resources.${icon}`)} className={`object-contain ${iconImg}`} decoding="async" fetchpriority="high" />
            </div>
            <span className={`font-bold text-primary whitespace-nowrap ${valueClass}`}>
                {formattedValue}
            </span>
        </div>
    );
});
ResourceDisplay.displayName = 'ResourceDisplay';

const GUILD_BOSS_TICKET_IMG = '/images/guild/ticket.webp';
const GUILD_WAR_TICKET_IMG = '/images/guild/warticket.webp';

function useGuildWarTicketsRemaining(
    guildId: string | undefined,
    handleAction: (action: ServerAction) => Promise<{ error?: string; clientResponse?: Record<string, unknown> } | void>,
): { remaining: number; max: number } {
    const max = GUILD_WAR_PERSONAL_DAILY_ATTEMPTS;
    const EVENT_REFRESH_COOLDOWN_MS = 30000;
    const [remaining, setRemaining] = useState(max);
    const handleActionRef = useRef(handleAction);
    const lastFetchAtRef = useRef(0);

    useEffect(() => {
        handleActionRef.current = handleAction;
    }, [handleAction]);

    useEffect(() => {
        if (!guildId) {
            setRemaining(max);
            lastFetchAtRef.current = 0;
            return;
        }
        let cancelled = false;
        const fetchWar = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastFetchAtRef.current < EVENT_REFRESH_COOLDOWN_MS) return;
            lastFetchAtRef.current = now;
            try {
                const r = (await handleActionRef.current({ type: 'GET_GUILD_WAR_DATA' })) as {
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
        void fetchWar(true);
        const onEv = () => void fetchWar(true);
        if (typeof window !== 'undefined') window.addEventListener('sudamr:guild-war-update', onEv);
        return () => {
            cancelled = true;
            if (typeof window !== 'undefined') window.removeEventListener('sudamr:guild-war-update', onEv);
        };
    }, [guildId, max, EVENT_REFRESH_COOLDOWN_MS]);
    return { remaining, max };
}

function useKstMidnightDeadlineMs(): number {
    const [ms, setMs] = useState(() => getNextKstMidnightUtcMs(Date.now()));
    useEffect(() => {
        const id = window.setInterval(() => {
            setMs(getNextKstMidnightUtcMs(Date.now()));
        }, 1000);
        return () => clearInterval(id);
    }, []);
    return ms;
}

export const ActionPointTimer: React.FC<{ user: UserWithStatus; mobile?: boolean }> = ({ user, mobile = false }) => {
    const { guilds } = useAppUserSlice();
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
    const { t: tCommon } = useTranslation('common');
    const { t: tNav } = useTranslation('nav');
    const { currentUserWithStatus, unreadMailCount } = useAppUserSlice();
    const { handlers } = useAppUiSlice();
    const { isNativeMobile } = useAppRouteSlice();
    const isMobile = Boolean(isNativeMobile);
    const dense = isMobile || compact;
    const guildWarTickets = useGuildWarTicketsRemaining(currentUserWithStatus?.guildId, handlers.handleAction);
    const [isSpecialResourcesOpen, setIsSpecialResourcesOpen] = useState(false);
    const [isParticipationTicketsOpen, setIsParticipationTicketsOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const specialResourcesRef = useRef<HTMLDivElement>(null);
    const specialResourcesPopoverPortalRef = useRef<HTMLDivElement>(null);
    const participationTicketsRef = useRef<HTMLDivElement>(null);
    const participationPopoverPortalRef = useRef<HTMLDivElement>(null);
    const [specialPopoverFixed, setSpecialPopoverFixed] = useState<{ top: number; right: number } | null>(null);
    const [participationPopoverFixed, setParticipationPopoverFixed] = useState<{ top: number; right: number } | null>(null);

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

    const updateParticipationPopoverPosition = useCallback(() => {
        if (!isParticipationTicketsOpen || !participationTicketsRef.current) return;
        const rect = participationTicketsRef.current.getBoundingClientRect();
        const margin = 8;
        const rightOffset = window.innerWidth - rect.right;
        setParticipationPopoverFixed({
            top: rect.bottom + 4,
            right: Math.max(margin, rightOffset),
        });
    }, [isParticipationTicketsOpen]);

    useLayoutEffect(() => {
        if (!isParticipationTicketsOpen) {
            setParticipationPopoverFixed(null);
            return;
        }
        updateParticipationPopoverPosition();
        window.addEventListener('resize', updateParticipationPopoverPosition);
        window.addEventListener('scroll', updateParticipationPopoverPosition, true);
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        vv?.addEventListener('resize', updateParticipationPopoverPosition);
        vv?.addEventListener('scroll', updateParticipationPopoverPosition);
        return () => {
            window.removeEventListener('resize', updateParticipationPopoverPosition);
            window.removeEventListener('scroll', updateParticipationPopoverPosition, true);
            vv?.removeEventListener('resize', updateParticipationPopoverPosition);
            vv?.removeEventListener('scroll', updateParticipationPopoverPosition);
        };
    }, [isParticipationTicketsOpen, updateParticipationPopoverPosition]);

    useEffect(() => {
        if (!isSpecialResourcesOpen && !isParticipationTicketsOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isInsideSudamrAdUi(target)) return;

            if (isSpecialResourcesOpen) {
                if (
                    !specialResourcesRef.current?.contains(target) &&
                    !specialResourcesPopoverPortalRef.current?.contains(target)
                ) {
                    setIsSpecialResourcesOpen(false);
                }
            }
            if (isParticipationTicketsOpen) {
                if (
                    !participationTicketsRef.current?.contains(target) &&
                    !participationPopoverPortalRef.current?.contains(target)
                ) {
                    setIsParticipationTicketsOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSpecialResourcesOpen, isParticipationTicketsOpen]);

    if (!currentUserWithStatus) return null;

    const { handleLogout, openMailbox, openSettingsModal, handleAction } = handlers;
    const { actionPoints, gold, diamonds, guildCoins, champCoins, isAdmin, guildId } = currentUserWithStatus;
    const todayKstBoss = getTodayKSTDateString();
    const guildBossUsedToday =
        guildId && currentUserWithStatus.guildBossLastAttemptDayKST === todayKstBoss
            ? (currentUserWithStatus.guildBossAttemptsUsedToday ?? 0)
            : 0;
    const guildBossRemaining = guildId ? Math.max(0, GUILD_BOSS_MAX_ATTEMPTS - guildBossUsedToday) : 0;
    // actionPoints가 없으면 기본값 사용
    const safeActionPoints = actionPoints || { current: 0, max: 30 };
    // gold와 diamonds가 없으면 기본값 사용
    const safeGold = (gold !== undefined && gold !== null) ? gold : 0;
    const safeDiamonds = (diamonds !== undefined && diamonds !== null) ? diamonds : 0;
    
    const mobileAdditionalResources = useMemo(
        () => [
            {
                key: 'guildCoins' as const,
                icon: specialResourceIcons.guildCoins,
                label: tCommon('resources.guildCoins'),
                value: guildCoins ?? 0,
            },
            {
                key: 'champCoins' as const,
                icon: specialResourceIcons.champCoins,
                label: tCommon('resources.champCoins'),
                value: champCoins ?? 0,
            },
        ],
        [guildCoins, champCoins, tCommon],
    );

    const specialResourcesPopoverPanel = (
        <div className="w-max max-w-[min(18rem,calc(100vw-1rem))] rounded-lg border border-color bg-primary py-1.5 shadow-2xl sm:py-2">
            {(isMobile
                ? mobileAdditionalResources
                : [
                      {
                          key: 'guildCoins' as const,
                          icon: specialResourceIcons.guildCoins,
                          label: tCommon('resources.guildCoins'),
                          value: guildCoins ?? 0,
                      },
                      {
                          key: 'champCoins' as const,
                          icon: specialResourceIcons.champCoins,
                          label: tCommon('resources.champCoins'),
                          value: champCoins ?? 0,
                      },
                  ]
            ).map((resource) => (
                <div
                    key={resource.key}
                    className={isMobile ? MOBILE_HEADER_POPOVER_ROW : 'flex items-center gap-[clamp(0.35rem,1.5vw,0.5rem)] px-[clamp(0.65rem,2.2vw,0.85rem)] py-1 transition-colors hover:bg-secondary sm:gap-2 sm:px-3 sm:py-1.5'}
                >
                    <div className={isMobile ? MOBILE_HEADER_POPOVER_ICON_SHELL : 'flex shrink-0 items-center justify-center rounded-full bg-primary'}>
                        <img
                            src={resource.icon}
                            alt={resource.label}
                            className={
                                isMobile
                                    ? MOBILE_HEADER_POPOVER_ICON_IMG
                                    : 'h-[clamp(1rem,3.5vw,1.35rem)] w-[clamp(1rem,3.5vw,1.35rem)] shrink-0 object-contain sm:h-5 sm:w-5'
                            }
                            loading="lazy"
                            decoding="async"
                        />
                    </div>
                    <span className={isMobile ? MOBILE_HEADER_POPOVER_VALUE : 'min-w-0 font-bold tabular-nums whitespace-nowrap text-primary text-[clamp(0.75rem,calc(0.55rem+1.6vw),0.875rem)] sm:text-sm'}>
                        {resource.value.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );

    const kstMidnightDeadlineMs = useKstMidnightDeadlineMs();

    const participationTicketsPopoverPanel = (
        <div className="w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-color bg-primary py-1.5 shadow-2xl sm:py-2">
            <div
                className={isMobile ? MOBILE_HEADER_POPOVER_ROW : 'flex min-w-0 items-center gap-2 px-[clamp(0.65rem,2.2vw,0.85rem)] py-1.5 sm:gap-2.5 sm:px-3 sm:py-2'}
            >
                <div
                    className={isMobile ? MOBILE_HEADER_POPOVER_ICON_SHELL : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary'}
                >
                    <img
                        src={GUILD_BOSS_TICKET_IMG}
                        alt=""
                        className={isMobile ? MOBILE_HEADER_POPOVER_ICON_IMG : 'h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6'}
                        loading="lazy"
                        decoding="async"
                    />
                </div>
                <span
                    className={`min-w-0 font-bold tabular-nums whitespace-nowrap ${
                        guildId ? 'text-primary' : 'text-slate-500'
                    } ${
                        isMobile ? MOBILE_HEADER_POPOVER_VALUE : 'text-sm sm:text-base'
                    }`}
                >
                    {guildId ? `${guildBossRemaining}/${GUILD_BOSS_MAX_ATTEMPTS}` : '—/—'}
                </span>
                {guildId ? (
                    <LiveCountdownToMs
                        deadlineMs={kstMidnightDeadlineMs}
                        className={`shrink-0 font-mono font-bold tabular-nums text-amber-200/95 ${
                            isMobile ? MOBILE_HEADER_POPOVER_COUNTDOWN : 'text-xs sm:text-sm'
                        }`}
                    />
                ) : null}
            </div>
            <div
                className={isMobile ? MOBILE_HEADER_POPOVER_ROW : 'flex min-w-0 items-center gap-2 px-[clamp(0.65rem,2.2vw,0.85rem)] py-1.5 sm:gap-2.5 sm:px-3 sm:py-2'}
            >
                <div
                    className={isMobile ? MOBILE_HEADER_POPOVER_ICON_SHELL : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary'}
                >
                    <img
                        src={GUILD_WAR_TICKET_IMG}
                        alt=""
                        className={isMobile ? MOBILE_HEADER_POPOVER_ICON_IMG : 'h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6'}
                        loading="lazy"
                        decoding="async"
                    />
                </div>
                <span
                    className={`min-w-0 font-bold tabular-nums whitespace-nowrap ${
                        guildId ? 'text-primary' : 'text-slate-500'
                    } ${
                        isMobile ? MOBILE_HEADER_POPOVER_VALUE : 'text-sm sm:text-base'
                    }`}
                >
                    {guildId ? `${guildWarTickets.remaining}/${guildWarTickets.max}` : '—/—'}
                </span>
                {guildId ? (
                    <LiveCountdownToMs
                        deadlineMs={kstMidnightDeadlineMs}
                        className={`shrink-0 font-mono font-bold tabular-nums text-amber-200/95 ${
                            isMobile ? MOBILE_HEADER_POPOVER_COUNTDOWN : 'text-xs sm:text-sm'
                        }`}
                    />
                ) : null}
            </div>
            {CHAMPIONSHIP_VERSUS_VENUE_KINDS.map((vk) => {
                const { tickets: cur, nextAt } = computeChampionshipVersusDuelTicketStateForVenue(
                    currentUserWithStatus,
                    vk,
                    Date.now(),
                );
                return (
                    <div
                        key={vk}
                        className={isMobile ? MOBILE_HEADER_POPOVER_ROW : 'flex min-w-0 items-center gap-2 px-[clamp(0.65rem,2.2vw,0.85rem)] py-1.5 sm:gap-2.5 sm:px-3 sm:py-2'}
                    >
                        <div
                            className={isMobile ? MOBILE_HEADER_POPOVER_ICON_SHELL : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary'}
                        >
                            <img
                                src={CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE[vk]}
                                alt=""
                                className={isMobile ? MOBILE_HEADER_POPOVER_ICON_IMG : 'h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6'}
                                loading="lazy"
                                decoding="async"
                            />
                        </div>
                        <span
                            className={`min-w-0 font-bold tabular-nums whitespace-nowrap text-primary ${
                                isMobile ? MOBILE_HEADER_POPOVER_VALUE : 'text-sm sm:text-base'
                            }`}
                        >
                            {`${cur}/${CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}`}
                        </span>
                        {cur < CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX && typeof nextAt === 'number' && Number.isFinite(nextAt) ? (
                            <ChampionshipVersusDuelTicketCountdown
                                current={cur}
                                max={CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}
                                nextAt={nextAt}
                                className={`shrink-0 font-mono font-bold tabular-nums text-amber-200/95 ${
                                    isMobile ? MOBILE_HEADER_POPOVER_COUNTDOWN : 'text-xs sm:text-sm'
                                }`}
                            />
                        ) : null}
                    </div>
                );
            })}
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
                            title={tNav('header.actionPointRechargeShop')}
                        >
                            <img
                                src={resourceIcons.actionPlus}
                                alt={tNav('header.actionPointRecharge')}
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
                    <div className="relative shrink-0" ref={participationTicketsRef}>
                        <button
                            type="button"
                            onClick={() => {
                                setIsParticipationTicketsOpen((v) => !v);
                                setIsSpecialResourcesOpen(false);
                            }}
                            aria-expanded={isParticipationTicketsOpen}
                            className={`${
                                isMobile
                                    ? MOBILE_HEADER_CHEVRON_BTN
                                    : `flex flex-shrink-0 items-center justify-center rounded-full border border-tertiary/40 bg-tertiary/60 shadow-inner transition-all hover:bg-tertiary/80 active:scale-95 ${
                                          dense ? 'h-7 w-7' : 'h-7 w-7 sm:h-8 sm:w-8'
                                      }`
                            } ${isParticipationTicketsOpen ? 'bg-tertiary/80' : ''}`}
                            title={tNav('header.participationTickets')}
                        >
                            <span
                                className={`${
                                    isMobile ? MOBILE_HEADER_CHEVRON_ICON : 'text-xs text-primary transition-transform duration-200 sm:text-sm'
                                } ${isParticipationTicketsOpen ? 'rotate-180' : ''}`}
                                aria-hidden
                            >
                                ▼
                            </span>
                        </button>
                    </div>
                    <div
                        className={`relative min-w-[4.5rem] shrink-0 ${isMobile ? 'flex-1' : 'sm:min-w-0'}`}
                        ref={specialResourcesRef}
                    >
                        {isMobile ? (
                            <div className="flex min-w-0 w-full max-w-full items-center justify-end gap-[clamp(0.1rem,0.8vw,0.24rem)]">
                                <div className="min-w-0 shrink-0 overflow-hidden">
                                    <ResourceDisplay
                                        icon="gold"
                                        value={safeGold}
                                        dense={dense}
                                        fluid
                                        fluidShrinkToFit
                                        className="h-[clamp(1.45rem,4.8vw,1.85rem)]"
                                    />
                                </div>
                                <div className="min-w-0 shrink-0 overflow-hidden">
                                    <ResourceDisplay
                                        icon="diamonds"
                                        value={safeDiamonds}
                                        dense={dense}
                                        fluid
                                        fluidShrinkToFit
                                        className="h-[clamp(1.45rem,4.8vw,1.85rem)]"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSpecialResourcesOpen(!isSpecialResourcesOpen);
                                        setIsParticipationTicketsOpen(false);
                                    }}
                                    aria-expanded={isSpecialResourcesOpen}
                                    className={`${MOBILE_HEADER_CHEVRON_BTN} ${
                                        isSpecialResourcesOpen ? 'bg-tertiary/80' : ''
                                    }`}
                                    title={tNav('header.guildChampCoins')}
                                >
                                    <span
                                        className={`${MOBILE_HEADER_CHEVRON_ICON} ${
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
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSpecialResourcesOpen(!isSpecialResourcesOpen);
                                        setIsParticipationTicketsOpen(false);
                                    }}
                                    aria-expanded={isSpecialResourcesOpen}
                                    className={`flex flex-shrink-0 items-center justify-center rounded-full border border-tertiary/40 bg-tertiary/60 shadow-inner transition-all hover:bg-tertiary/80 active:scale-95 ${
                                        dense ? 'h-7 w-7' : 'h-7 w-7 sm:h-8 sm:w-8'
                                    } ${isSpecialResourcesOpen ? 'bg-tertiary/80' : ''}`}
                                    title={tNav('header.guildChampCoins')}
                                >
                                    <span
                                        className={`text-xs text-primary transition-transform duration-200 sm:text-sm ${
                                            isSpecialResourcesOpen ? 'rotate-180' : ''
                                        }`}
                                        aria-hidden
                                    >
                                        ▼
                                    </span>
                                </button>
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
                            {tNav('header.admin')}
                        </Button>
                    )}
                    <button
                        onClick={openMailbox}
                        className={
                            isMobile
                                ? `relative flex ${MOBILE_HEADER_ACTION_BTN} flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 transition-colors hover:bg-primary`
                                : dense
                                  ? 'relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 transition-colors hover:bg-primary'
                                  : 'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 transition-colors hover:bg-primary'
                        }
                        title={tNav('header.mailbox')}
                    >
                        <img
                            src="/images/icon/mail.webp"
                            alt={tNav('header.mailbox')}
                            className={`object-contain ${
                                isMobile ? MOBILE_HEADER_MAIL_ICON : dense ? 'h-4 w-4' : 'h-6 w-6'
                            }`}
                            loading="lazy"
                            decoding="async"
                        />
                        {unreadMailCount > 0 && (
                            <span
                                className={`pointer-events-none absolute z-[1] rounded-full border-2 border-primary bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.95),0_0_3px_rgba(0,0,0,0.65)] ring-2 ring-zinc-950/85 ${
                                    isMobile
                                        ? 'right-0 top-0 h-[clamp(0.55rem,2.6vw,0.7rem)] w-[clamp(0.55rem,2.6vw,0.7rem)] min-h-[10px] min-w-[10px]'
                                        : dense
                                          ? 'right-0 top-0 h-3 w-3'
                                          : 'right-0.5 top-0.5 h-3.5 w-3.5 sm:right-1 sm:top-1 sm:h-4 sm:w-4'
                                }`}
                                aria-hidden
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
                                  ? 'relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 text-sm transition-colors hover:bg-primary'
                                  : 'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/70 text-xl transition-colors hover:bg-primary'
                        }
                        title={tNav('header.settings')}
                        aria-label={tNav('header.settingsOpen')}
                    >
                        ⚙️
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(true)}
                        className={`flex shrink-0 items-center justify-center rounded-full border-2 border-red-800/85 bg-red-500 text-black shadow-sm transition-colors hover:bg-red-600 ${
                            isMobile ? MOBILE_HEADER_ACTION_BTN : dense ? 'h-9 w-9' : 'h-10 w-10'
                        }`}
                        title={tNav('header.logout')}
                        aria-label={tNav('header.logout')}
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
                document.body,
            )}
        {isParticipationTicketsOpen &&
            participationPopoverFixed &&
            typeof document !== 'undefined' &&
            createPortal(
                <div
                    ref={participationPopoverPortalRef}
                    className="pointer-events-auto fixed w-max max-w-[min(20rem,calc(100vw-1rem))]"
                    style={{
                        top: participationPopoverFixed.top,
                        right: participationPopoverFixed.right,
                        zIndex: SPECIAL_RESOURCES_POPOVER_Z,
                    }}
                >
                    {participationTicketsPopoverPanel}
                </div>,
                document.body,
            )}
        {showLogoutConfirm && (
            <ConfirmModal
                title={tNav('header.logout')}
                message={tNav('header.logoutConfirm')}
                confirmText={tNav('header.logout')}
                cancelText={tCommon('actions.cancel')}
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