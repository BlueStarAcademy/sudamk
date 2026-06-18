

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserWithStatus, ServerAction, AvatarInfo, BorderInfo } from '../types.js';
import { AVATAR_POOL, BORDER_POOL, RANKING_TIERS, SHOP_BORDER_ITEMS } from '../constants';
import { MBTI_QUESTIONS, calculateMbtiFromAnswers } from '../constants/mbtiQuestions.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { containsProfanity } from '../profanity.js';
import {
    nicknameContainsReservedStaffTerms,
    RESERVED_STAFF_NICKNAME_USER_MESSAGE,
} from '../shared/utils/staffNicknameDisplay.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../shared/utils/walletAmountDisplay.js';
import { useScreenGuide } from '../hooks/useScreenGuide.js';
import ScreenGuideModal from './ScreenGuideModal.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';

interface ProfileEditModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
    embedded?: boolean;
}


type EditTab = 'avatar' | 'border' | 'nickname' | 'mbti';
type BorderCategory = 'basic' | 'levelLocked' | 'shop' | 'seasonReward';

type MbtiState = {
    ei: 'E' | 'I';
    sn: 'S' | 'N';
    tf: 'T' | 'F';
    jp: 'J' | 'P';
};

const panelSurface =
    'rounded-xl border border-white/[0.08] bg-gradient-to-b from-zinc-800/85 via-zinc-900/90 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_40px_rgba(0,0,0,0.45)]';
const pickRingSel =
    'border-amber-400/75 bg-amber-500/[0.12] shadow-[0_0_24px_rgba(245,158,11,0.18)] ring-2 ring-amber-400/55 ring-offset-2 ring-offset-zinc-950';
const pickRingIdle =
    'border-white/10 bg-black/30 hover:border-amber-500/40 hover:bg-white/[0.05]';

const BORDER_CATEGORY_ORDER: BorderCategory[] = ['basic', 'levelLocked', 'shop', 'seasonReward'];

/** 테두리(링 등)로 시각이 커져도 미리보기 칸(px)은 고정 — `Avatar`의 `size`는 이 값에 맞춰 산출 */
const PROFILE_PREVIEW_FRAME_PX = { mobile: 112, pc: 136 } as const;
const PROFILE_PREVIEW_BORDER_SCALE_MAX = 1.52;

const formatVipRemainingPlain = (
    expiresAt: number | undefined,
    nowMs: number,
    t: (key: string, opts?: Record<string, unknown>) => string,
): string => {
    if (!expiresAt || expiresAt <= nowMs) return t('edit.expired');
    const ms = Math.max(0, expiresAt - nowMs);
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const parts: string[] = [];
    if (days > 0) parts.push(t('edit.durationDays', { days }));
    if (hours > 0) parts.push(t('edit.durationHours', { hours }));
    if (minutes > 0 || parts.length === 0) parts.push(t('edit.durationMinutes', { minutes }));
    return t('edit.remaining', { duration: parts.join(' ') });
};

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ currentUser, onClose, onAction, isTopmost, embedded = false }) => {
    const { t } = useTranslation('profile');
    const profileEditGuide = useScreenGuide('profileEdit');
    const { isNativeMobile } = useNativeMobileShell();
    const isPcMode = !isNativeMobile;
    const avatarScrollRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<EditTab>('avatar');
    const [borderCategoryTab, setBorderCategoryTab] = useState<BorderCategory>('basic');
    const [selectedAvatarId, setSelectedAvatarId] = useState(currentUser.avatarId);
    const [selectedBorderId, setSelectedBorderId] = useState(currentUser.borderId);
    const [newNickname, setNewNickname] = useState(currentUser.nickname);
    const [nowMs, setNowMs] = useState(() => Date.now());

    // currentUser 변경 시 로컬 상태 동기화
    React.useEffect(() => {
        setSelectedAvatarId(currentUser.avatarId);
        setSelectedBorderId(currentUser.borderId);
        setNewNickname(currentUser.nickname);
    }, [currentUser.avatarId, currentUser.borderId, currentUser.nickname]);
    
    const parseMbti = (mbtiString: string | null | undefined): MbtiState => {
        if (mbtiString && mbtiString.length === 4) {
            return {
                ei: mbtiString[0] as 'E' | 'I',
                sn: mbtiString[1] as 'S' | 'N',
                tf: mbtiString[2] as 'T' | 'F',
                jp: mbtiString[3] as 'J' | 'P',
            };
        }
        return { ei: 'E', sn: 'S', tf: 'T', jp: 'J' };
    };

    const [mbti, setMbti] = useState<MbtiState>(parseMbti(currentUser.mbti));
    const [isMbtiQuestionMode, setIsMbtiQuestionMode] = useState(false);
    const [mbtiQuestionIndex, setMbtiQuestionIndex] = useState(0);
    const [mbtiAnswers, setMbtiAnswers] = useState<Record<string, string>>({});
    const hasMbti = !!currentUser.mbti;

    // 탭 변경 시 질문 모드 초기화
    React.useEffect(() => {
        if (activeTab !== 'mbti') {
            setIsMbtiQuestionMode(false);
            setMbtiQuestionIndex(0);
            setMbtiAnswers({});
        }
    }, [activeTab]);

    // currentUser.mbti 변경 시 mbti state 업데이트
    React.useEffect(() => {
        setMbti(parseMbti(currentUser.mbti));
    }, [currentUser.mbti]);

    useEffect(() => {
        const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (activeTab !== 'avatar') return;
        const el = avatarScrollRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (el.scrollWidth <= el.clientWidth + 1) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [activeTab]);
    
    const nicknameChangeCost = 150;
    const canAffordNicknameChange = currentUser.diamonds >= nicknameChangeCost;

    const currentUserAvatarUrl = useMemo(() => AVATAR_POOL.find((a: AvatarInfo) => a.id === currentUser.avatarId)?.url, [currentUser.avatarId]);

    const previewAvatarUrl = useMemo(
        () => AVATAR_POOL.find((a: AvatarInfo) => a.id === selectedAvatarId)?.url ?? currentUserAvatarUrl,
        [selectedAvatarId, currentUserAvatarUrl],
    );

    const previewBorderUrl = useMemo(
        () => BORDER_POOL.find((b) => b.id === selectedBorderId)?.url,
        [selectedBorderId],
    );

    const rewardVipExpiresAt = Math.max(currentUser.rewardVipExpiresAt ?? 0, currentUser.vvipExpiresAt ?? 0);
    const functionVipExpiresAt = Math.max(currentUser.functionVipExpiresAt ?? 0, currentUser.vvipExpiresAt ?? 0);
    const diamondPkgExpiresAt = currentUser.diamondPackageExpiresAt ?? 0;
    const diamondPkgRoman =
        diamondPkgExpiresAt > nowMs && currentUser.activeDiamondPackageTier === 1
            ? 'I'
            : diamondPkgExpiresAt > nowMs && currentUser.activeDiamondPackageTier === 2
              ? 'II'
              : diamondPkgExpiresAt > nowMs && currentUser.activeDiamondPackageTier === 3
                ? 'III'
                : null;
    const vipStatusPanel = (
        <div
            className={`${panelSurface} flex w-full min-w-0 flex-col justify-center gap-2 ${
                isNativeMobile
                    ? 'max-w-full shrink-0 px-2.5 py-2 text-[11px] leading-snug'
                    : 'min-w-[16rem] max-w-[22rem] flex-none gap-2.5 px-4 py-3 text-xs sm:min-w-[19rem]'
            }`}
        >
            <div
                className="flex min-w-0 flex-col gap-0.5 border-b border-white/10 pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
            >
                <span className={`shrink-0 font-bold text-violet-100 ${isNativeMobile ? 'text-[11px]' : ''}`}>{t('edit.functionVip')}</span>
                <span
                    className={`min-w-0 break-words text-right font-semibold tabular-nums sm:max-w-[11rem] sm:pl-1 ${
                        functionVipExpiresAt > nowMs ? 'text-emerald-300' : 'text-zinc-500'
                    } ${isNativeMobile ? 'text-[10px]' : 'text-[13px]'}`}
                >
                    {functionVipExpiresAt > nowMs
                        ? formatVipRemainingPlain(functionVipExpiresAt, nowMs, t)
                        : isNativeMobile
                          ? t('edit.inactive')
                          : t('edit.deactivated')}
                </span>
            </div>
            <div
                className={`flex min-w-0 flex-col gap-0.5 border-b border-white/10 pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3`}
            >
                <span className={`shrink-0 font-bold text-fuchsia-100 ${isNativeMobile ? 'text-[11px]' : ''}`}>{t('edit.rewardVip')}</span>
                <span
                    className={`min-w-0 break-words text-right font-semibold tabular-nums sm:max-w-[11rem] sm:pl-1 ${
                        rewardVipExpiresAt > nowMs ? 'text-emerald-300' : 'text-zinc-500'
                    } ${isNativeMobile ? 'text-[10px]' : 'text-[13px]'}`}
                >
                    {rewardVipExpiresAt > nowMs
                        ? formatVipRemainingPlain(rewardVipExpiresAt, nowMs, t)
                        : isNativeMobile
                          ? t('edit.inactive')
                          : t('edit.deactivated')}
                </span>
            </div>
            <div className={`flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3`}>
                <span
                    className={`flex min-w-0 shrink-0 items-center gap-0.5 font-bold text-cyan-100 ${isNativeMobile ? 'text-[11px]' : ''}`}
                >
                    <img src="/images/icon/Zem.webp" alt="" className="h-3 w-3 shrink-0 object-contain opacity-90" />
                    <span className="min-w-0 break-words">{diamondPkgRoman ? t('edit.diamondPackageNamed', { roman: diamondPkgRoman }) : t('edit.diamondPackage')}</span>
                </span>
                <span
                    className={`min-w-0 break-words text-right font-semibold tabular-nums sm:max-w-[11rem] sm:pl-1 ${
                        diamondPkgRoman && diamondPkgExpiresAt > nowMs ? 'text-emerald-300' : 'text-zinc-500'
                    } ${isNativeMobile ? 'text-[10px]' : 'text-[13px]'}`}
                >
                    {diamondPkgRoman && diamondPkgExpiresAt > nowMs
                        ? formatVipRemainingPlain(diamondPkgExpiresAt, nowMs, t)
                        : isNativeMobile
                          ? t('edit.inactive')
                          : t('edit.deactivated')}
                </span>
            </div>
        </div>
    );

    const renderPreviewRow = (previewPanel: React.ReactNode) => (
        <div className="flex w-full min-w-0 shrink-0 justify-center">
            {isNativeMobile ? (
                <div className="flex w-full min-w-0 max-w-full flex-col items-stretch gap-2">
                    <div className="flex min-w-0 justify-center">{previewPanel}</div>
                    <div className="min-w-0 w-full self-stretch">{vipStatusPanel}</div>
                </div>
            ) : (
                <div className="flex w-full min-w-0 max-w-[42rem] flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-start sm:gap-3">
                    {previewPanel}
                    {vipStatusPanel}
                </div>
            )}
        </div>
    );

    const handleSave = () => {
        switch (activeTab) {
            case 'avatar':
                if (selectedAvatarId !== currentUser.avatarId) {
                    onAction({ type: 'UPDATE_AVATAR', payload: { avatarId: selectedAvatarId } });
                }
                break;
            case 'border':
                 if (selectedBorderId !== currentUser.borderId) {
                    onAction({ type: 'UPDATE_BORDER', payload: { borderId: selectedBorderId } });
                }
                break;
            case 'nickname':
                if (newNickname !== currentUser.nickname) {
                    if (containsProfanity(newNickname)) {
                        alert(t('edit.profanityAlert'));
                        return;
                    }
                    if (
                        nicknameContainsReservedStaffTerms(newNickname) &&
                        !currentUser.staffNicknameDisplayEligibility &&
                        !currentUser.isAdmin
                    ) {
                        alert(RESERVED_STAFF_NICKNAME_USER_MESSAGE);
                        return;
                    }
                    if (window.confirm(t('edit.nicknameChangeConfirm', { cost: nicknameChangeCost, name: newNickname }))) {
                        onAction({ type: 'CHANGE_NICKNAME', payload: { newNickname } });
                    }
                }
                break;
            case 'mbti':
                if (isMbtiQuestionMode) {
                    // 질문 모드에서는 모든 답변을 완료한 후에만 저장
                    if (mbtiQuestionIndex < MBTI_QUESTIONS.length - 1) {
                        // 다음 질문으로
                        setMbtiQuestionIndex(prev => prev + 1);
                        return;
                    } else {
                        // 모든 질문 완료 - MBTI 계산 및 저장
                        const calculatedMbti = computeMbtiFromQuiz();
                        if (calculatedMbti) {
                            const isFirstTime = !hasMbti;
                            onAction({
                                type: 'UPDATE_MBTI',
                                payload: { mbti: calculatedMbti, isMbtiPublic: true, isFirstTime }
                            });
                            setIsMbtiQuestionMode(false);
                            setMbtiQuestionIndex(0);
                            setMbtiAnswers({});
                        }
                    }
                } else {
                    // 기존 방식: 직접 선택하여 변경
                    const newMbtiString = `${mbti.ei}${mbti.sn}${mbti.tf}${mbti.jp}`;
                    onAction({
                        type: 'UPDATE_MBTI',
                        payload: { mbti: newMbtiString, isMbtiPublic: true, isFirstTime: false }
                    });
                }
                break;
        }
    };

    const computeMbtiFromQuiz = useCallback((): string | null => calculateMbtiFromAnswers(mbtiAnswers, MBTI_QUESTIONS), [mbtiAnswers]);

    const isSaveDisabled = useMemo(() => {
        switch (activeTab) {
            case 'avatar': return selectedAvatarId === currentUser.avatarId;
            case 'border': return selectedBorderId === currentUser.borderId;
            case 'nickname':
                return (
                    newNickname === currentUser.nickname ||
                    !canAffordNicknameChange ||
                    newNickname.trim().length < 2 ||
                    newNickname.trim().length > 12 ||
                    (nicknameContainsReservedStaffTerms(newNickname) &&
                        !currentUser.staffNicknameDisplayEligibility &&
                        !currentUser.isAdmin)
                );
            case 'mbti': {
                if (isMbtiQuestionMode) {
                    // 질문 모드에서는 현재 질문에 답변했는지 확인
                    const currentQuestion = MBTI_QUESTIONS[mbtiQuestionIndex];
                    return !mbtiAnswers[currentQuestion.id];
                } else {
                    // 직접 선택 모드
                    const newMbtiString = `${mbti.ei}${mbti.sn}${mbti.tf}${mbti.jp}`;
                    return newMbtiString === (currentUser.mbti || '');
                }
            }
            default: return true;
        }
    }, [activeTab, selectedAvatarId, selectedBorderId, newNickname, currentUser, canAffordNicknameChange, mbti, isMbtiQuestionMode, mbtiQuestionIndex, mbtiAnswers]);

    const categorizedBorders = useMemo(() => {
        const isShopItem = (b: BorderInfo) => SHOP_BORDER_ITEMS.some(sb => sb.id === b.id);
        
        const categories: Record<BorderCategory, BorderInfo[]> = {
            basic: [],
            levelLocked: [],
            shop: [],
            seasonReward: [],
        };

        BORDER_POOL.forEach(border => {
            if (border.unlockTier) {
                categories.seasonReward.push(border);
            } else if (border.requiredLevelSum) {
                categories.levelLocked.push(border);
            } else if (isShopItem(border)) {
                 categories.shop.push(border);
            } else {
                 categories.basic.push(border);
            }
        });
        
        return categories;
    }, []);

    useEffect(() => {
        if (activeTab !== 'border') return;
        const first = BORDER_CATEGORY_ORDER.find((c) => (categorizedBorders[c]?.length ?? 0) > 0);
        if (first) setBorderCategoryTab(first);
    }, [activeTab, categorizedBorders]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'avatar': {
                const avatarGrid = (
                    <div
                        ref={avatarScrollRef}
                        tabIndex={0}
                        role="listbox"
                        aria-label={t('edit.avatarListAria')}
                        className={`grid min-h-0 flex-1 w-full cursor-default gap-2 overflow-y-auto [scrollbar-width:thin] outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 ${
                            isPcMode
                                ? 'grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] auto-rows-min px-3 py-2.5'
                                : 'grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] auto-rows-min gap-1.5 px-2 py-2 sm:grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] sm:gap-2.5 sm:px-4 sm:py-3'
                        }`}
                    >
                        {AVATAR_POOL.map((avatar: AvatarInfo) => {
                            const isUnlocked =
                                avatar.type === 'any' ||
                                (avatar.type === 'strategy' && currentUser.userLevel >= avatar.requiredLevel) ||
                                (avatar.type === 'playful' && currentUser.userLevel >= avatar.requiredLevel);
                            const sel = selectedAvatarId === avatar.id;
                            const thumb = isPcMode ? 48 : isNativeMobile ? 40 : 52;
                            return (
                                <button
                                    key={avatar.id}
                                    type="button"
                                    role="option"
                                    aria-selected={sel}
                                    aria-label={avatar.name ? t('edit.avatarAria', { name: avatar.name }) : t('edit.avatarDefaultAria')}
                                    disabled={!isUnlocked}
                                    onClick={() => isUnlocked && setSelectedAvatarId(avatar.id)}
                                    className={`relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border p-0.5 transition-all duration-200 sm:min-h-[6.25rem] sm:p-1 ${
                                        isNativeMobile ? 'min-h-[4.5rem]' : 'min-h-[5.75rem]'
                                    } ${sel ? pickRingSel : pickRingIdle} ${
                                        !isUnlocked ? 'cursor-not-allowed opacity-45 grayscale' : 'cursor-pointer'
                                    }`}
                                >
                                    <Avatar userId="pick" userName="" avatarUrl={avatar.url} size={thumb} />
                                    {!isUnlocked && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/75 px-1 text-center">
                                            <span className="text-[8px] font-bold text-amber-100">{t('edit.locked')}</span>
                                            <span className="text-[7px] text-zinc-300">
                                                {avatar.type === 'strategy' ? t('edit.strategyLevel') : t('edit.playfulLevel')} Lv.{avatar.requiredLevel}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                );

                const previewFramePx = isPcMode ? PROFILE_PREVIEW_FRAME_PX.pc : PROFILE_PREVIEW_FRAME_PX.mobile;
                const previewAvatarSize = Math.max(44, Math.floor(previewFramePx / PROFILE_PREVIEW_BORDER_SCALE_MAX));
                const previewPanel = (
                    <div
                        className={`${panelSurface} flex shrink-0 items-center justify-center ${
                            isNativeMobile ? 'min-h-0 w-auto px-2 py-2' : 'min-h-0 w-full max-w-[18rem] flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4'
                        }`}
                    >
                        <div
                            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_0_24px_rgba(245,158,11,0.18)] ring-2 ring-amber-400/40 ring-inset"
                            style={{ width: previewFramePx, height: previewFramePx }}
                        >
                            <Avatar
                                userId="preview"
                                userName={currentUser.nickname}
                                avatarUrl={previewAvatarUrl}
                                borderUrl={previewBorderUrl}
                                size={previewAvatarSize}
                            />
                        </div>
                    </div>
                );

                return (
                    <div className={`flex min-h-0 flex-1 flex-col ${isNativeMobile ? 'gap-2' : 'gap-3 sm:gap-4'}`}>
                        {renderPreviewRow(previewPanel)}
                        <div className={`${panelSurface} flex min-h-0 flex-1 flex-col overflow-hidden ${isNativeMobile ? 'px-2 py-1.5' : 'px-2 py-2 sm:px-3 sm:py-3'}`}>
                            <p className={`mb-1.5 shrink-0 px-1 font-semibold text-stone-200 ${isNativeMobile ? 'text-[11px]' : 'px-2 text-xs sm:text-sm'}`}>{t('edit.avatarSelect')}</p>
                            {avatarGrid}
                        </div>
                    </div>
                );
            }
            case 'border': {
                const { ownedBorders, userLevel, previousSeasonTier } = currentUser;
                const userLevelSum = userLevel;
                const tierOrder = RANKING_TIERS.map((t) => t.name);
                const tileAvatarSize = isPcMode ? 48 : isNativeMobile ? 44 : 56;

                const renderBorderTiles = (borders: BorderInfo[], gridClass: string) => (
                    <div className={gridClass}>
                        {borders.map((border) => {
                            const isOwned =
                                ownedBorders?.includes(border.id) || border.id === 'default' || border.id === 'simple_black';
                            let isUnlockedByAchievement = false;
                            let unlockText = border.description;

                            if (border.unlockTier) {
                                unlockText = t('edit.tierRequired', { tier: border.unlockTier });
                                if (previousSeasonTier) {
                                    const requiredTierIndex = tierOrder.indexOf(border.unlockTier);
                                    const userTierIndex = tierOrder.indexOf(previousSeasonTier);
                                    if (requiredTierIndex !== -1 && userTierIndex !== -1 && userTierIndex <= requiredTierIndex) {
                                        isUnlockedByAchievement = true;
                                    }
                                }
                            } else if (border.requiredLevelSum) {
                                unlockText = t('edit.levelSumRequired', { level: border.requiredLevelSum });
                                if (userLevelSum >= border.requiredLevelSum) {
                                    isUnlockedByAchievement = true;
                                }
                            }

                            const isUnlocked = isOwned || isUnlockedByAchievement;
                            const shopItem = SHOP_BORDER_ITEMS.find((b) => b.id === border.id);
                            const isPurchasable = shopItem && !isOwned;
                            const sel = selectedBorderId === border.id;

                            const handleClick = () => {
                                if (isUnlocked) {
                                    setSelectedBorderId(border.id);
                                } else if (isPurchasable && shopItem) {
                                    const priceText = shopItem.price.gold
                                        ? t('edit.goldPrice', { amount: formatGoldAmountKoG(shopItem.price.gold) })
                                        : t('edit.diamondPrice', { amount: formatWalletDiamonds(shopItem.price.diamonds ?? 0) });
                                    if (window.confirm(t('edit.borderPurchaseConfirm', { name: border.name, price: priceText }))) {
                                        onAction({ type: 'BUY_BORDER', payload: { borderId: border.id } });
                                    }
                                }
                            };

                            const isClickable = isUnlocked || isPurchasable;
                            const title = isUnlocked
                                ? border.description
                                : isPurchasable
                                  ? t('edit.borderPurchaseHint', { description: border.description })
                                  : unlockText;

                            return (
                                <button
                                    key={border.id}
                                    type="button"
                                    title={title}
                                    disabled={!isClickable}
                                    onClick={handleClick}
                                    className={`relative flex flex-col items-center gap-0.5 rounded-xl border p-1 text-left transition-all duration-200 sm:gap-1 sm:p-1.5 ${
                                        sel ? pickRingSel : pickRingIdle
                                    } ${!isClickable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                >
                                    <div className={`relative rounded-full ${!isUnlocked && !isPurchasable ? 'opacity-55' : ''}`}>
                                        <Avatar
                                            userId="preview"
                                            userName={border.name}
                                            avatarUrl={previewAvatarUrl}
                                            borderUrl={border.url}
                                            size={tileAvatarSize}
                                            className="z-0"
                                        />
                                        {!isUnlocked && !isPurchasable && (
                                            <div
                                                className="absolute -right-0.5 -top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 bg-zinc-950/95 text-[9px] shadow-md sm:h-5 sm:w-5 sm:text-[10px]"
                                                aria-hidden
                                            >
                                                🔒
                                            </div>
                                        )}
                                        {isPurchasable && shopItem && (
                                            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-0.5 rounded-b-full bg-black/80 py-px text-[8px] font-semibold text-amber-100 sm:py-0.5 sm:text-[9px]">
                                                {shopItem.price.gold ? (
                                                    <img src="/images/icon/Gold.webp" alt="" className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                                ) : (
                                                    <img src="/images/icon/Zem.webp" alt="" className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                                )}
                                                <span>
                                                    {shopItem.price.gold != null
                                                        ? formatGoldAmountKoG(shopItem.price.gold)
                                                        : formatWalletDiamonds(shopItem.price.diamonds ?? 0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="w-full truncate text-center text-[8px] font-medium text-zinc-200 sm:text-[10px]">{border.name}</p>
                                    {!isUnlocked && !isPurchasable && (
                                        <p
                                            className={`line-clamp-2 w-full text-center text-[7px] leading-tight text-red-300/90 sm:text-[8px] ${
                                                isPcMode ? 'min-h-[1.25rem]' : 'min-h-[1.75rem]'
                                            }`}
                                        >
                                            {border.requiredLevelSum
                                                ? t('edit.levelSumShort', { level: border.requiredLevelSum })
                                                : border.unlockTier
                                                  ? t('edit.tierShort', { tier: border.unlockTier })
                                                  : ''}
                                        </p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                );

                const borderPreviewFramePx = isPcMode ? PROFILE_PREVIEW_FRAME_PX.pc : PROFILE_PREVIEW_FRAME_PX.mobile;
                const borderPreviewAvatarSize = Math.max(44, Math.floor(borderPreviewFramePx / PROFILE_PREVIEW_BORDER_SCALE_MAX));
                const borderPreviewPanel = (
                    <div
                        className={`${panelSurface} flex shrink-0 items-center justify-center ${
                            isNativeMobile ? 'min-h-0 w-auto px-2 py-2' : 'min-h-0 w-full max-w-[18rem] flex-col gap-1.5 px-3 py-3 sm:gap-2 sm:px-4 sm:py-4'
                        }`}
                    >
                        <div
                            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_0_24px_rgba(245,158,11,0.18)] ring-2 ring-amber-400/35 ring-inset"
                            style={{ width: borderPreviewFramePx, height: borderPreviewFramePx }}
                        >
                            <Avatar
                                userId="preview"
                                userName={currentUser.nickname}
                                avatarUrl={previewAvatarUrl}
                                borderUrl={previewBorderUrl}
                                size={borderPreviewAvatarSize}
                            />
                        </div>
                    </div>
                );

                const categoriesWithItems = BORDER_CATEGORY_ORDER.filter((c) => categorizedBorders[c].length > 0);

                if (isPcMode) {
                    const activeBorders = categorizedBorders[borderCategoryTab] ?? [];
                    return (
                        <div className="flex min-h-0 flex-1 flex-col gap-3">
                            {renderPreviewRow(borderPreviewPanel)}
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                                <div
                                    className="flex shrink-0 flex-wrap gap-1 rounded-xl border border-white/10 bg-black/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                    role="tablist"
                                    aria-label={t('edit.borderCategoryAria')}
                                >
                                    {categoriesWithItems.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            role="tab"
                                            aria-selected={borderCategoryTab === cat}
                                            onClick={() => setBorderCategoryTab(cat)}
                                            className={`rounded-lg px-3 py-1.5 text-center text-xs font-bold transition-all ${
                                                borderCategoryTab === cat
                                                    ? 'bg-gradient-to-b from-amber-200/95 via-amber-500 to-amber-800 text-amber-950 shadow-[0_2px_12px_rgba(180,83,9,0.35)] ring-1 ring-amber-200/45'
                                                    : 'text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                                <div className={`${panelSurface} min-h-0 flex-1 overflow-y-auto p-2.5 [scrollbar-width:thin] sm:p-3`}>
                                    {renderBorderTiles(
                                        activeBorders,
                                        'grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] sm:gap-2.5',
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className={`flex min-h-0 flex-1 flex-col ${isNativeMobile ? 'gap-2' : 'gap-4'}`}>
                        {renderPreviewRow(borderPreviewPanel)}
                        <div className={`min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] ${isNativeMobile ? 'space-y-2' : 'space-y-4'}`}>
                            {(Object.keys(categorizedBorders) as BorderCategory[]).map((category) => {
                                const borders = categorizedBorders[category];
                                if (borders.length === 0) return null;

                                return (
                                    <div key={category} className={`${panelSurface} ${isNativeMobile ? 'p-2' : 'p-3 sm:p-4'}`}>
                                        <div className={`flex items-center gap-2 border-b border-white/10 ${isNativeMobile ? 'mb-2 pb-1.5' : 'mb-3 pb-2'}`}>
                                            <span className="h-1 w-1 rounded-full bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.6)]" aria-hidden />
                                            <h3 className={`font-bold tracking-wide text-amber-100/95 ${isNativeMobile ? 'text-xs' : 'text-sm sm:text-base'}`}>{t(`edit.borderCategories.${category}`)}</h3>
                                        </div>
                                        {renderBorderTiles(
                                            borders,
                                            isNativeMobile
                                                ? 'grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5'
                                                : 'grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] sm:gap-3',
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }
            case 'nickname':
                return (
                    <div className="flex min-h-0 flex-1 items-center justify-center px-1 py-4">
                        <div className="flex w-full max-w-md flex-col gap-4">
                            <div className={`${panelSurface} p-4 sm:p-5`}>
                                <label htmlFor="nickname-input" className="mb-2 block text-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/75 sm:text-sm sm:tracking-[0.24em]">
                                    {t('edit.newNickname')}
                                </label>
                                <p className="mb-3 text-center text-[11px] text-zinc-500">{t('edit.nicknameHint')}</p>
                                <input
                                    id="nickname-input"
                                    type="text"
                                    value={newNickname}
                                    onChange={(e) => setNewNickname(e.target.value)}
                                    className="w-full rounded-xl border border-white/12 bg-black/45 px-4 py-3 text-center text-base font-semibold tracking-tight text-stone-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
                                    maxLength={6}
                                    minLength={2}
                                    placeholder={t('edit.nicknamePlaceholder')}
                                />
                            </div>
                            <div className={`${panelSurface} px-4 py-3 text-sm`}>
                                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                    <span className="text-zinc-400">{t('edit.changeCost')}</span>
                                    <span
                                        className={`flex items-center gap-1.5 font-bold tabular-nums ${canAffordNicknameChange ? 'text-cyan-200' : 'text-red-400'}`}
                                    >
                                        <img src="/images/icon/Zem.webp" alt="" className="h-4 w-4" /> {nicknameChangeCost}
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-zinc-400">{t('edit.ownedDiamonds')}</span>
                                    <span className="flex items-center gap-1.5 font-bold tabular-nums text-stone-100">
                                        <img src="/images/icon/Zem.webp" alt="" className="h-4 w-4" /> {formatWalletDiamonds(currentUser.diamonds)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'mbti': {
                // MBTI 미설정 시: 설명 및 설정 버튼 표시
                if (!hasMbti && !isMbtiQuestionMode) {
                    return (
                        <div className="space-y-4">
                            <div className={`${panelSurface} p-4 sm:p-5`}>
                                <h3 className="mb-2 text-lg font-bold tracking-tight text-amber-100 sm:text-xl">{t('edit.mbtiWhatTitle')}</h3>
                                <p className="text-sm leading-relaxed text-zinc-400">
                                    {t('edit.mbtiWhatDesc')}
                                </p>
                                <h4 className="mb-2 mt-5 text-base font-bold text-amber-200/90 sm:text-lg">{t('edit.goMbtiTitle')}</h4>
                                <p className="text-sm leading-relaxed text-zinc-400">
                                    {t('edit.goMbtiDesc')}
                                </p>
                                <div className="mt-6 rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-950/50 to-zinc-950/80 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                    <div className="mb-2 flex items-center justify-center gap-2">
                                        <img src="/images/icon/Zem.webp" alt="" className="h-7 w-7" />
                                        <span className="text-2xl font-black tabular-nums text-amber-200">100</span>
                                    </div>
                                    <p className="mb-4 text-sm text-zinc-300">{t('edit.mbtiFirstReward')}</p>
                                    <Button
                                        onClick={() => {
                                            setIsMbtiQuestionMode(true);
                                            setMbtiQuestionIndex(0);
                                            setMbtiAnswers({});
                                        }}
                                        colorScheme="none"
                                        className="w-full rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-200/95 to-amber-700 py-3 text-[15px] font-bold text-amber-950 shadow-[0_6px_20px_rgba(180,83,9,0.35)] transition hover:brightness-110"
                                    >
                                        {t('edit.setupMbti')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                }

                // 질문 모드
                if (isMbtiQuestionMode) {
                    const currentQuestion = MBTI_QUESTIONS[mbtiQuestionIndex];
                    const progress = ((mbtiQuestionIndex + 1) / MBTI_QUESTIONS.length) * 100;

                    return (
                        <div className="space-y-4">
                            <div className={`${panelSurface} p-4`}>
                                <div className="mb-2 flex items-center justify-between text-xs text-zinc-400 sm:text-sm">
                                    <span>
                                        {t('edit.questionProgress', { current: mbtiQuestionIndex + 1, total: MBTI_QUESTIONS.length })}
                                    </span>
                                    <span className="tabular-nums text-amber-200/80">{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                            <div className={`${panelSurface} p-4 sm:p-5`}>
                                <h3 className="mb-4 text-base font-bold leading-snug text-stone-100 sm:text-lg">{currentQuestion.question}</h3>
                                <div className="space-y-2.5">
                                    {currentQuestion.options.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setMbtiAnswers((prev) => ({ ...prev, [currentQuestion.id]: option.value }))}
                                            className={`w-full rounded-xl border p-3.5 text-left transition-all duration-200 sm:p-4 ${
                                                mbtiAnswers[currentQuestion.id] === option.value
                                                    ? `${pickRingSel} text-stone-50`
                                                    : `${pickRingIdle} text-zinc-200`
                                            }`}
                                        >
                                            <div className="mb-1 font-semibold sm:text-base">{option.text}</div>
                                            {option.goStyle && (
                                                <div className="mt-2 border-t border-white/15 pt-2 text-xs leading-relaxed text-zinc-400">
                                                    <span className="font-semibold text-amber-200/90">{t('edit.goStyleLabel')}</span> {option.goStyle}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                }

                // 이미 설정된 경우: 변경 가능 (직접 선택 방식)
                const DichotomySelector: React.FC<{
                    title: string;
                    options: ('E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P')[];
                    selected: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
                    onSelect: (value: any) => void;
                }> = ({ title, options, selected, onSelect }) => (
                    <div className={`${panelSurface} flex flex-col ${isPcMode ? 'p-2.5' : 'p-3 sm:p-4'}`}>
                        <h4 className={`mb-1.5 text-center font-bold text-amber-100/95 ${isPcMode ? 'text-xs' : 'text-sm'}`}>{title}</h4>
                        <div className={`flex justify-center gap-1.5 ${isPcMode ? '' : 'gap-2'}`}>
                            {options.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => onSelect(opt)}
                                    className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition-all sm:px-2 sm:py-2 ${
                                        isPcMode ? 'min-w-[4.75rem] text-[11px]' : 'min-w-[5.5rem] sm:min-w-[6rem] sm:text-sm'
                                    } ${
                                        selected === opt
                                            ? 'border-amber-400/70 bg-amber-500/20 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                                            : 'border-white/10 bg-black/35 text-zinc-300 hover:border-amber-500/35 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    {t(`edit.mbtiTypes.${opt}.name`)}
                                </button>
                            ))}
                        </div>
                    </div>
                );

                const finalMbti = `${mbti.ei}${mbti.sn}${mbti.tf}${mbti.jp}`;
                const selectedMbtiDetails = [mbti.ei, mbti.sn, mbti.tf, mbti.jp].map((key) => ({
                    name: t(`edit.mbtiTypes.${key}.name`),
                    general: t(`edit.mbtiTypes.${key}.general`),
                    goStyle: t(`edit.mbtiTypes.${key}.goStyle`),
                }));

                return (
                    <div className={`${isPcMode ? 'space-y-2' : 'space-y-4'}`}>
                        <div className={`${panelSurface} px-3 py-2 text-center sm:px-4 sm:py-2.5`}>
                            <p className="text-[11px] text-zinc-400 sm:text-sm">{t('edit.mbtiPublicHint')}</p>
                        </div>
                        <div className={`grid ${isPcMode ? 'grid-cols-4 gap-2' : 'grid-cols-1 gap-3 md:grid-cols-2 md:gap-4'}`}>
                            <DichotomySelector title={t('edit.energyDirection')} options={['E', 'I']} selected={mbti.ei} onSelect={(v) => setMbti((p) => ({ ...p, ei: v as 'E' | 'I' }))} />
                            <DichotomySelector title={t('edit.perception')} options={['S', 'N']} selected={mbti.sn} onSelect={(v) => setMbti((p) => ({ ...p, sn: v as 'S' | 'N' }))} />
                            <DichotomySelector title={t('edit.judgment')} options={['T', 'F']} selected={mbti.tf} onSelect={(v) => setMbti((p) => ({ ...p, tf: v as 'T' | 'F' }))} />
                            <DichotomySelector title={t('edit.lifestyle')} options={['J', 'P']} selected={mbti.jp} onSelect={(v) => setMbti((p) => ({ ...p, jp: v as 'J' | 'P' }))} />
                        </div>
                        <div className={`${panelSurface} p-3 sm:p-4`}>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                                <h4 className="text-sm font-bold text-amber-100 sm:text-base">{t('edit.overallTendency')}</h4>
                                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm font-black tracking-widest text-emerald-300">
                                    {finalMbti}
                                </span>
                            </div>
                            <div className={`grid gap-3 ${isPcMode ? 'md:grid-cols-2' : ''}`}>
                                <div className="rounded-lg border border-amber-400/15 bg-black/30 p-3">
                                    <h5 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200/85">{t('edit.generalTendency')}</h5>
                                    <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">
                                        {selectedMbtiDetails.map((detail) => detail.general).join(' ')}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-cyan-400/15 bg-black/30 p-3">
                                    <h5 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/85">{t('edit.goTendency')}</h5>
                                    <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">
                                        {selectedMbtiDetails.map((detail) => detail.goStyle).join(' ')}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div
                            className={`${panelSurface} flex flex-wrap items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4 ${isPcMode ? 'py-2' : 'py-2.5 sm:py-3'}`}
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:text-sm">{t('edit.myMbti')}</span>
                                <span className="min-w-0 truncate text-xl font-black tabular-nums tracking-wider text-emerald-300 sm:text-2xl sm:text-3xl">{finalMbti}</span>
                            </div>
                            <Button
                                onClick={() => {
                                    setIsMbtiQuestionMode(true);
                                    setMbtiQuestionIndex(0);
                                    setMbtiAnswers({});
                                }}
                                colorScheme="none"
                                className={`shrink-0 rounded-xl border border-violet-400/40 bg-gradient-to-b from-violet-950/80 to-zinc-950 font-bold text-violet-100 transition hover:border-violet-300/50 hover:brightness-110 ${isPcMode ? 'px-3 py-1.5 text-[11px]' : 'px-3 py-2 text-xs sm:px-4 sm:py-2 sm:text-sm'}`}
                            >
                                {t('edit.resetMbti')}
                            </Button>
                        </div>
                    </div>
                );
            }
            default:
                return null;
        }
    };
    
    const tabs: { id: EditTab; label: string }[] = [
        { id: 'avatar', label: t('edit.tabs.avatar') },
        { id: 'border', label: t('edit.tabs.border') },
        { id: 'nickname', label: t('edit.tabs.nickname') },
        { id: 'mbti', label: t('edit.tabs.mbti') },
    ];

    const profileEditBody = (
            <div className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-zinc-950/40 via-zinc-950/80 to-black/90">
                <div className="pointer-events-none absolute inset-x-8 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" aria-hidden />
                <div className={`shrink-0 px-1 ${isNativeMobile ? 'pb-2 pt-0.5' : 'pb-3 pt-1'}`}>
                    <div className="flex gap-1 rounded-xl border border-white/10 bg-black/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex-1 rounded-lg px-2 text-center font-bold transition-all sm:py-2.5 sm:text-sm ${
                                    isNativeMobile ? 'py-1.5 text-[11px]' : 'py-2 text-xs'
                                } ${
                                    activeTab === tab.id
                                        ? 'bg-gradient-to-b from-amber-200/95 via-amber-500 to-amber-800 text-amber-950 shadow-[0_4px_16px_rgba(180,83,9,0.35)] ring-1 ring-amber-200/50'
                                        : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                {tab.label}
                                {tab.id === 'mbti' && !currentUser.mbti && (
                                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                <div
                    className={`flex min-h-0 flex-1 flex-col overflow-x-hidden px-1 pb-2 sm:px-2 ${
                        activeTab === 'avatar' || activeTab === 'border'
                            ? 'overflow-y-hidden'
                            : 'overflow-y-auto [scrollbar-width:thin]'
                    }`}
                >
                    {renderTabContent()}
                </div>
                <div className="shrink-0 border-t border-amber-500/20 bg-gradient-to-t from-black/60 to-transparent px-1 pb-1.5 pt-2 sm:px-2 sm:pb-2 sm:pt-2.5">
                    <div className="flex flex-wrap justify-center">
                        <Button
                            onClick={handleSave}
                            colorScheme="none"
                            disabled={isSaveDisabled}
                            className="!rounded-lg !border !border-emerald-500/40 !bg-gradient-to-b !from-emerald-600/95 !to-emerald-900 !px-8 !py-1.5 !text-sm !font-bold !text-white shadow-[0_4px_14px_rgba(5,150,105,0.3)] disabled:!opacity-40 sm:!py-2"
                        >
                            {activeTab === 'nickname' && !canAffordNicknameChange
                                ? t('edit.insufficientDiamonds')
                                : activeTab === 'mbti' && isMbtiQuestionMode
                                  ? mbtiQuestionIndex < MBTI_QUESTIONS.length - 1
                                      ? t('edit.next')
                                      : t('edit.complete')
                                  : t('edit.save')}
                        </Button>
                    </div>
                </div>
            </div>
    );

    const guideModal = profileEditGuide.isOpen ? (
        <ScreenGuideModal
            guideId="profileEdit"
            onClose={profileEditGuide.close}
            onDismissForever={profileEditGuide.dismissForever}
            isTopmost={isTopmost}
        />
    ) : null;

    if (embedded) {
        return (
            <>
                <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{profileEditBody}</div>
                {guideModal}
            </>
        );
    }

    return (
        <>
            <DraggableWindow
                title={t('edit.title')}
                onClose={onClose}
                windowId="profile-edit"
                initialWidth={isNativeMobile ? 640 : 960}
                initialHeight={isNativeMobile ? 560 : 800}
                isTopmost={isTopmost}
            >
                {profileEditBody}
            </DraggableWindow>
            {guideModal}
        </>
    );
};

export default ProfileEditModal;
