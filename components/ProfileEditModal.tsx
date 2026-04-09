

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { UserWithStatus, ServerAction, AvatarInfo, BorderInfo } from '../types.js';
import { AVATAR_POOL, BORDER_POOL, RANKING_TIERS, SHOP_BORDER_ITEMS } from '../constants';
import { MBTI_QUESTIONS } from '../constants/mbtiQuestions.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { containsProfanity } from '../profanity.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface ProfileEditModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}


type EditTab = 'avatar' | 'border' | 'nickname' | 'mbti';
type BorderCategory = '기본' | '레벨제한' | '구매테두리' | '전시즌보상';

const MBTI_DETAILS = {
  'E': { name: '외향 (E)', general: '사교적이며 활동적입니다. 외부 세계에 에너지를 쏟으며 사람들과의 교류를 즐깁니다.', goStyle: '적극적으로 전투를 이끌고 중앙을 중시하는 기풍입니다. 상대방과의 수싸움을 즐기며 판을 복잡하게 만드는 경향이 있습니다.' },
  'I': { name: '내향 (I)', general: '신중하고 조용하며, 내면 세계에 더 집중합니다. 깊이 있는 관계를 선호하며 혼자만의 시간을 통해 에너지를 얻습니다.', goStyle: '실리를 중시하며 견실하게 집을 짓는 기풍입니다. 상대의 도발에 쉽게 응하지 않으며, 조용히 형세를 유리하게 만듭니다.' },
  'S': { name: '감각 (S)', general: '현실적이고 실용적이며, 오감을 통해 정보를 받아들입니다. 현재에 집중하고 구체적인 사실을 중시합니다.', goStyle: '눈앞의 집과 실리에 집중하는 현실적인 기풍입니다. 정석과 기본적인 행마에 충실하며, 확실한 승리를 추구합니다.' },
  'N': { name: '직관 (N)', general: '상상력이 풍부하고 미래지향적입니다. 가능성과 의미를 탐구하며, 전체적인 그림을 보는 것을 선호합니다.', goStyle: '창의적이고 변칙적인 수를 선호하는 기풍입니다. 대세관이 뛰어나며, 판 전체를 아우르는 큰 그림을 그리며 둡니다.' },
  'T': { name: '사고 (T)', general: '논리적이고 분석적이며, 객관적인 사실을 바탕으로 결정을 내립니다. 공정함과 원칙을 중요하게 생각합니다.', goStyle: '냉철한 수읽기를 바탕으로 최선의 수를 찾아내는 이성적인 기풍입니다. 감정에 휘둘리지 않고 형세판단에 근거하여 둡니다.' },
  'F': { name: '감정 (F)', general: '공감 능력이 뛰어나고 사람들과의 관계를 중시합니다. 조화와 협력을 바탕으로 결정을 내리며, 타인의 감정을 고려합니다.', goStyle: '상대의 기세나 심리에 영향을 받는 감성적인 기풍입니다. 때로는 무리수처럼 보이는 과감한 수를 두기도 합니다.' },
  'J': { name: '판단 (J)', general: '체계적이고 계획적이며, 목표를 설정하고 달성하는 것을 선호합니다. 결정을 빨리 내리고 질서 있는 환경을 좋아합니다.', goStyle: '한번 정한 작전을 밀고 나가는 계획적인 기풍입니다. 정해진 목표를 향해 흔들림 없이 나아가며, 끝내기에 강한 모습을 보입니다.' },
  'P': { name: '인식 (P)', general: '융통성 있고 적응력이 뛰어나며, 상황에 따라 유연하게 대처합니다. 자율성을 중시하고 새로운 경험에 개방적입니다.', goStyle: '형세에 따라 유연하게 작전을 바꾸는 임기응변에 능한 기풍입니다. 정해진 수순보다 즉흥적인 감각으로 두는 것을 즐깁니다.' },
};

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

const BORDER_CATEGORY_ORDER: BorderCategory[] = ['기본', '레벨제한', '구매테두리', '전시즌보상'];

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ currentUser, onClose, onAction, isTopmost }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const isPcMode = !isNativeMobile;
    const avatarScrollRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<EditTab>('avatar');
    const [borderCategoryTab, setBorderCategoryTab] = useState<BorderCategory>('기본');
    const [selectedAvatarId, setSelectedAvatarId] = useState(currentUser.avatarId);
    const [selectedBorderId, setSelectedBorderId] = useState(currentUser.borderId);
    const [newNickname, setNewNickname] = useState(currentUser.nickname);

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
                        alert("닉네임에 부적절한 단어가 포함되어 있습니다.");
                        return;
                    }
                    if (window.confirm(`다이아 ${nicknameChangeCost}개를 사용하여 닉네임을 '${newNickname}'(으)로 변경하시겠습니까?`)) {
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
                        const calculatedMbti = calculateMbtiFromAnswers();
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

    const calculateMbtiFromAnswers = useCallback((): string | null => {
        let mbtiResult = '';
        for (const question of MBTI_QUESTIONS) {
            const answer = mbtiAnswers[question.id];
            if (!answer) return null;
            mbtiResult += answer;
        }
        return mbtiResult;
    }, [mbtiAnswers]);

    const isSaveDisabled = useMemo(() => {
        switch (activeTab) {
            case 'avatar': return selectedAvatarId === currentUser.avatarId;
            case 'border': return selectedBorderId === currentUser.borderId;
            case 'nickname': return newNickname === currentUser.nickname || !canAffordNicknameChange || newNickname.trim().length < 2 || newNickname.trim().length > 12;
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
            '기본': [],
            '레벨제한': [],
            '구매테두리': [],
            '전시즌보상': [],
        };

        BORDER_POOL.forEach(border => {
            if (border.unlockTier) {
                categories['전시즌보상'].push(border);
            } else if (border.requiredLevelSum) {
                categories['레벨제한'].push(border);
            } else if (isShopItem(border)) {
                 categories['구매테두리'].push(border);
            } else {
                 categories['기본'].push(border);
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
                const avatarStrip = (
                    <div
                        ref={avatarScrollRef}
                        tabIndex={0}
                        role="listbox"
                        aria-label="아바타 목록"
                        className={`flex w-full cursor-default gap-2 overflow-x-auto overflow-y-visible [scrollbar-width:thin] outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 ${
                            isPcMode
                                ? 'min-h-[92px] max-h-[92px] flex-nowrap px-3 py-2 scroll-px-3'
                                : 'min-h-[88px] px-3 py-2.5 scroll-px-3 sm:min-h-[96px] sm:gap-2.5 sm:px-4 sm:py-3 sm:scroll-px-4'
                        }`}
                    >
                        {AVATAR_POOL.map((avatar: AvatarInfo) => {
                            const isUnlocked =
                                avatar.type === 'any' ||
                                (avatar.type === 'strategy' && currentUser.strategyLevel >= avatar.requiredLevel) ||
                                (avatar.type === 'playful' && currentUser.playfulLevel >= avatar.requiredLevel);
                            const sel = selectedAvatarId === avatar.id;
                            const thumb = isPcMode ? 48 : 52;
                            return (
                                <button
                                    key={avatar.id}
                                    type="button"
                                    role="option"
                                    aria-selected={sel}
                                    disabled={!isUnlocked}
                                    onClick={() => isUnlocked && setSelectedAvatarId(avatar.id)}
                                    className={`relative flex w-[4.25rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border p-1 transition-all duration-200 sm:w-[4.75rem] ${
                                        sel ? pickRingSel : pickRingIdle
                                    } ${!isUnlocked ? 'cursor-not-allowed opacity-45 grayscale' : 'cursor-pointer'}`}
                                >
                                    <Avatar userId="pick" userName={avatar.name} avatarUrl={avatar.url} size={thumb} />
                                    <span className="w-full truncate text-center text-[8px] font-medium text-zinc-300 sm:text-[9px]">{avatar.name}</span>
                                    {!isUnlocked && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/75 px-1 text-center">
                                            <span className="text-[8px] font-bold text-amber-100">잠김</span>
                                            <span className="text-[7px] text-zinc-300">
                                                {avatar.type === 'strategy' ? '전략' : '놀이'} Lv.{avatar.requiredLevel}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                );

                const previewSize = isPcMode ? 88 : 100;
                const previewPanel = (
                    <div className={`${panelSurface} flex flex-col items-center gap-2 px-3 py-3 sm:px-4 sm:py-4`}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">미리보기</p>
                        <div className="rounded-full p-1 shadow-[0_0_32px_rgba(245,158,11,0.2)] ring-2 ring-amber-400/35 ring-offset-2 ring-offset-zinc-950">
                            <Avatar
                                userId="preview"
                                userName={currentUser.nickname}
                                avatarUrl={previewAvatarUrl}
                                borderUrl={previewBorderUrl}
                                size={previewSize}
                            />
                        </div>
                        <p className="max-w-[14rem] text-center text-[10px] leading-snug text-zinc-400 sm:max-w-[16rem] sm:text-[11px]">
                            탭하여 선택 · 저장 시 프로필에 적용
                        </p>
                    </div>
                );

                if (isPcMode) {
                    return (
                        <div className="flex min-h-0 flex-1 flex-row items-stretch gap-3">
                            <div className="w-[min(40%,13.5rem)] shrink-0">{previewPanel}</div>
                            <div className={`${panelSurface} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 py-2`}>
                                <p className="mb-1 shrink-0 px-2 text-xs font-semibold text-stone-200">아바타 선택</p>
                                {avatarStrip}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col gap-4">
                        {previewPanel}
                        <div className={`${panelSurface} px-2 py-2 sm:px-3 sm:py-3`}>
                            <p className="mb-2 px-2 text-xs font-semibold text-stone-200 sm:text-sm">아바타 선택</p>
                            {avatarStrip}
                        </div>
                    </div>
                );
            }
            case 'border': {
                const { ownedBorders, strategyLevel, playfulLevel, previousSeasonTier } = currentUser;
                const userLevelSum = strategyLevel + playfulLevel;
                const tierOrder = RANKING_TIERS.map((t) => t.name);
                const tileAvatarSize = isPcMode ? 48 : 56;

                const renderBorderTiles = (borders: BorderInfo[], gridClass: string) => (
                    <div className={gridClass}>
                        {borders.map((border) => {
                            const isOwned =
                                ownedBorders?.includes(border.id) || border.id === 'default' || border.id === 'simple_black';
                            let isUnlockedByAchievement = false;
                            let unlockText = border.description;

                            if (border.unlockTier) {
                                unlockText = `이전 시즌 ${border.unlockTier} 티어 필요`;
                                if (previousSeasonTier) {
                                    const requiredTierIndex = tierOrder.indexOf(border.unlockTier);
                                    const userTierIndex = tierOrder.indexOf(previousSeasonTier);
                                    if (requiredTierIndex !== -1 && userTierIndex !== -1 && userTierIndex <= requiredTierIndex) {
                                        isUnlockedByAchievement = true;
                                    }
                                }
                            } else if (border.requiredLevelSum) {
                                unlockText = `레벨 합 ${border.requiredLevelSum} 필요`;
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
                                        ? `${shopItem.price.gold.toLocaleString()} 골드`
                                        : `${shopItem.price.diamonds?.toLocaleString()} 다이아`;
                                    if (window.confirm(`'${border.name}' 테두리를 ${priceText}로 구매하시겠습니까?`)) {
                                        onAction({ type: 'BUY_BORDER', payload: { borderId: border.id } });
                                    }
                                }
                            };

                            const isClickable = isUnlocked || isPurchasable;
                            const title = isUnlocked
                                ? border.description
                                : isPurchasable
                                  ? `클릭하여 구매: ${border.description}`
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
                                        />
                                        {!isUnlocked && !isPurchasable && (
                                            <div
                                                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 bg-zinc-950/95 text-[9px] shadow-md sm:h-5 sm:w-5 sm:text-[10px]"
                                                aria-hidden
                                            >
                                                🔒
                                            </div>
                                        )}
                                        {isPurchasable && shopItem && (
                                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 rounded-b-full bg-black/80 py-px text-[8px] font-semibold text-amber-100 sm:py-0.5 sm:text-[9px]">
                                                {shopItem.price.gold ? (
                                                    <img src="/images/icon/Gold.png" alt="" className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                                ) : (
                                                    <img src="/images/icon/Zem.png" alt="" className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                                )}
                                                <span>{shopItem.price.gold?.toLocaleString() || shopItem.price.diamonds?.toLocaleString()}</span>
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
                                                ? `레벨합 ${border.requiredLevelSum}`
                                                : border.unlockTier
                                                  ? `${border.unlockTier} 티어`
                                                  : ''}
                                        </p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                );

                const borderPreviewSize = isPcMode ? 88 : 100;
                const borderPreviewPanel = (
                    <div className={`${panelSurface} flex flex-col items-center gap-1.5 px-3 py-3 sm:gap-2 sm:px-4 sm:py-4`}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">테두리 미리보기</p>
                        <div className="rounded-full p-1 shadow-[0_0_28px_rgba(245,158,11,0.18)] ring-2 ring-amber-400/30 ring-offset-2 ring-offset-zinc-950">
                            <Avatar
                                userId="preview"
                                userName={currentUser.nickname}
                                avatarUrl={previewAvatarUrl}
                                borderUrl={previewBorderUrl}
                                size={borderPreviewSize}
                            />
                        </div>
                        <p className="max-w-[13rem] text-center text-[10px] leading-snug text-zinc-400 sm:max-w-[18rem] sm:text-[11px]">
                            탭하여 적용 · 상점 테두리는 가격 확인 후 구매
                        </p>
                    </div>
                );

                const categoriesWithItems = BORDER_CATEGORY_ORDER.filter((c) => categorizedBorders[c].length > 0);

                if (isPcMode) {
                    const activeBorders = categorizedBorders[borderCategoryTab] ?? [];
                    return (
                        <div className="flex min-h-0 flex-1 flex-row items-stretch gap-3">
                            <div className="w-[min(38%,12.5rem)] shrink-0">{borderPreviewPanel}</div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                                <div
                                    className="flex shrink-0 flex-wrap gap-1 rounded-xl border border-white/10 bg-black/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                    role="tablist"
                                    aria-label="테두리 종류"
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
                                <div className={`${panelSurface} min-h-0 flex-1 overflow-hidden p-2.5 sm:p-3`}>
                                    {renderBorderTiles(
                                        activeBorders,
                                        'grid grid-cols-5 gap-2 sm:grid-cols-5 sm:gap-2.5',
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col gap-4">
                        {borderPreviewPanel}
                        <div className="space-y-4">
                            {(Object.keys(categorizedBorders) as BorderCategory[]).map((category) => {
                                const borders = categorizedBorders[category];
                                if (borders.length === 0) return null;

                                return (
                                    <div key={category} className={`${panelSurface} p-3 sm:p-4`}>
                                        <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
                                            <span className="h-1 w-1 rounded-full bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.6)]" aria-hidden />
                                            <h3 className="text-sm font-bold tracking-wide text-amber-100/95 sm:text-base">{category}</h3>
                                        </div>
                                        {renderBorderTiles(
                                            borders,
                                            'grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] sm:gap-3',
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
                    <div className="mx-auto flex max-w-md flex-col gap-4 px-1">
                        <div className={`${panelSurface} p-4 sm:p-5`}>
                            <label htmlFor="nickname-input" className="mb-2 block text-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/75 sm:text-sm sm:tracking-[0.24em]">
                                새 닉네임
                            </label>
                            <p className="mb-3 text-center text-[11px] text-zinc-500">2~6자 · 비속어 불가 · 변경 시 다이아가 소모됩니다</p>
                            <input
                                id="nickname-input"
                                type="text"
                                value={newNickname}
                                onChange={(e) => setNewNickname(e.target.value)}
                                className="w-full rounded-xl border border-white/12 bg-black/45 px-4 py-3 text-center text-base font-semibold tracking-tight text-stone-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
                                maxLength={6}
                                minLength={2}
                                placeholder="닉네임 입력"
                            />
                        </div>
                        <div className={`${panelSurface} px-4 py-3 text-sm`}>
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <span className="text-zinc-400">변경 비용</span>
                                <span
                                    className={`flex items-center gap-1.5 font-bold tabular-nums ${canAffordNicknameChange ? 'text-cyan-200' : 'text-red-400'}`}
                                >
                                    <img src="/images/icon/Zem.png" alt="" className="h-4 w-4" /> {nicknameChangeCost}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-zinc-400">보유 다이아</span>
                                <span className="flex items-center gap-1.5 font-bold tabular-nums text-stone-100">
                                    <img src="/images/icon/Zem.png" alt="" className="h-4 w-4" /> {currentUser.diamonds.toLocaleString()}
                                </span>
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
                                <h3 className="mb-2 text-lg font-bold tracking-tight text-amber-100 sm:text-xl">MBTI란 무엇인가요?</h3>
                                <p className="text-sm leading-relaxed text-zinc-400">
                                    MBTI(Myers-Briggs Type Indicator)는 개인의 선호도를 바탕으로 성격 유형을 이해하는 도구입니다.
                                    자신을 더 잘 이해하고 다른 사람들과의 관계를 개선하는 데 도움을 줄 수 있습니다.
                                </p>
                                <h4 className="mb-2 mt-5 text-base font-bold text-amber-200/90 sm:text-lg">바둑 MBTI</h4>
                                <p className="text-sm leading-relaxed text-zinc-400">
                                    바둑 MBTI는 당신의 바둑 스타일을 MBTI 개념으로 분석한 것입니다.
                                    각 유형마다 고유한 플레이 성향이 있어, 자신에 맞는 스타일을 찾을 수 있습니다.
                                </p>
                                <div className="mt-6 rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-950/50 to-zinc-950/80 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                    <div className="mb-2 flex items-center justify-center gap-2">
                                        <img src="/images/icon/Zem.png" alt="" className="h-7 w-7" />
                                        <span className="text-2xl font-black tabular-nums text-amber-200">100</span>
                                    </div>
                                    <p className="mb-4 text-sm text-zinc-300">최초 설정 시 다이아 100개를 드립니다</p>
                                    <Button
                                        onClick={() => {
                                            setIsMbtiQuestionMode(true);
                                            setMbtiQuestionIndex(0);
                                            setMbtiAnswers({});
                                        }}
                                        colorScheme="none"
                                        className="w-full rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-200/95 to-amber-700 py-3 text-[15px] font-bold text-amber-950 shadow-[0_6px_20px_rgba(180,83,9,0.35)] transition hover:brightness-110"
                                    >
                                        MBTI 설정하기
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
                                        질문 {mbtiQuestionIndex + 1} / {MBTI_QUESTIONS.length}
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
                                                    <span className="font-semibold text-amber-200/90">바둑 스타일</span> {option.goStyle}
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
                    <div className={`${panelSurface} flex flex-1 flex-col ${isPcMode ? 'p-2' : 'p-3 sm:p-4'}`}>
                        <h4 className={`mb-1.5 text-center font-bold text-amber-100/95 ${isPcMode ? 'text-xs' : 'text-sm'}`}>{title}</h4>
                        <div className={`mb-2 flex justify-center gap-1.5 ${isPcMode ? '' : 'mb-3 gap-2'}`}>
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
                                    {MBTI_DETAILS[opt].name}
                                </button>
                            ))}
                        </div>
                        <div
                            className={`flex-1 rounded-lg border border-white/8 bg-black/35 leading-relaxed text-zinc-400 ${
                                isPcMode
                                    ? 'min-h-[4.75rem] p-2 text-[10px] leading-snug'
                                    : 'min-h-[7.5rem] p-2.5 text-[11px] sm:text-xs'
                            }`}
                        >
                            <h5 className="font-bold text-amber-200/90">일반적 성향</h5>
                            <p>{MBTI_DETAILS[selected].general}</p>
                            <h5 className="mt-1.5 font-bold text-cyan-200/85 sm:mt-2">바둑 성향</h5>
                            <p>{MBTI_DETAILS[selected].goStyle}</p>
                        </div>
                    </div>
                );

                const finalMbti = `${mbti.ei}${mbti.sn}${mbti.tf}${mbti.jp}`;

                return (
                    <div className={`${isPcMode ? 'space-y-2' : 'space-y-4'}`}>
                        <div className={`${panelSurface} px-3 py-2 text-center sm:px-4 sm:py-2.5`}>
                            <p className="text-[11px] text-zinc-400 sm:text-sm">MBTI는 프로필에 공개됩니다</p>
                        </div>
                        <div className={`grid grid-cols-1 md:grid-cols-2 ${isPcMode ? 'gap-2' : 'gap-3 md:gap-4'}`}>
                            <DichotomySelector title="에너지 방향" options={['E', 'I']} selected={mbti.ei} onSelect={(v) => setMbti((p) => ({ ...p, ei: v as 'E' | 'I' }))} />
                            <DichotomySelector title="인식 기능" options={['S', 'N']} selected={mbti.sn} onSelect={(v) => setMbti((p) => ({ ...p, sn: v as 'S' | 'N' }))} />
                            <DichotomySelector title="판단 기능" options={['T', 'F']} selected={mbti.tf} onSelect={(v) => setMbti((p) => ({ ...p, tf: v as 'T' | 'F' }))} />
                            <DichotomySelector title="생활 양식" options={['J', 'P']} selected={mbti.jp} onSelect={(v) => setMbti((p) => ({ ...p, jp: v as 'J' | 'P' }))} />
                        </div>
                        <div
                            className={`${panelSurface} flex items-center justify-center gap-3 whitespace-nowrap px-3 sm:gap-4 sm:px-4 ${isPcMode ? 'py-2' : 'py-3 sm:py-3.5'}`}
                        >
                            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:text-sm">나의 MBTI</span>
                            <span className="min-w-0 truncate text-xl font-black tabular-nums tracking-wider text-emerald-300 sm:text-2xl sm:text-3xl">{finalMbti}</span>
                        </div>
                        <div className={`${panelSurface} ${isPcMode ? 'p-2' : 'p-3'}`}>
                            <Button
                                onClick={() => {
                                    setIsMbtiQuestionMode(true);
                                    setMbtiQuestionIndex(0);
                                    setMbtiAnswers({});
                                }}
                                colorScheme="none"
                                className={`w-full rounded-xl border border-violet-400/40 bg-gradient-to-b from-violet-950/80 to-zinc-950 font-bold text-violet-100 transition hover:border-violet-300/50 hover:brightness-110 ${isPcMode ? 'py-2 text-xs' : 'py-3 text-sm'}`}
                            >
                                질문으로 다시 설정하기
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
        { id: 'avatar', label: '아바타' },
        { id: 'border', label: '테두리' },
        { id: 'nickname', label: '닉네임' },
        { id: 'mbti', label: 'MBTI' },
    ];

    return (
        <DraggableWindow
            title="프로필 설정"
            onClose={onClose}
            windowId="profile-edit"
            initialWidth={isNativeMobile ? 640 : 960}
            initialHeight={isNativeMobile ? 560 : 800}
            isTopmost={isTopmost}
        >
            <div className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-zinc-950/40 via-zinc-950/80 to-black/90">
                <div className="pointer-events-none absolute inset-x-8 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" aria-hidden />
                <div className="shrink-0 px-1 pb-3 pt-1">
                    <div className="flex gap-1 rounded-xl border border-white/10 bg-black/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex-1 rounded-lg px-2 py-2 text-center text-xs font-bold transition-all sm:py-2.5 sm:text-sm ${
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
                    className={`min-h-0 flex-1 overflow-x-hidden px-1 pb-2 sm:px-2 ${
                        isPcMode ? 'overflow-y-hidden' : 'overflow-y-auto [scrollbar-width:thin]'
                    }`}
                >
                    {renderTabContent()}
                </div>
                <div className="shrink-0 border-t border-amber-500/20 bg-gradient-to-t from-black/60 to-transparent px-1 pb-1 pt-3 sm:px-2">
                    <div className="flex flex-wrap justify-end gap-2 sm:gap-3">
                        <Button
                            onClick={onClose}
                            colorScheme="none"
                            className="!rounded-xl !border !border-white/18 !bg-white/[0.06] !px-5 !py-2.5 !text-sm !font-bold !text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:!border-amber-400/35 hover:!bg-white/[0.1]"
                        >
                            취소
                        </Button>
                        <Button
                            onClick={handleSave}
                            colorScheme="none"
                            disabled={isSaveDisabled}
                            className="!rounded-xl !border !border-emerald-500/40 !bg-gradient-to-b !from-emerald-600/95 !to-emerald-900 !px-6 !py-2.5 !text-sm !font-bold !text-white shadow-[0_6px_20px_rgba(5,150,105,0.35)] disabled:!opacity-40"
                        >
                            {activeTab === 'nickname' && !canAffordNicknameChange
                                ? '다이아 부족'
                                : activeTab === 'mbti' && isMbtiQuestionMode
                                  ? mbtiQuestionIndex < MBTI_QUESTIONS.length - 1
                                      ? '다음'
                                      : '완료'
                                  : '저장'}
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ProfileEditModal;
