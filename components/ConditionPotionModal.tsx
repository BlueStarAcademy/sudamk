import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

/** TournamentBracket 챔피언십 푸터 버튼과 동일 계열 — 모달 전용 */
const champBtnBase =
    'rounded-xl border px-4 py-2.5 text-xs font-black tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_28px_-12px_rgba(0,0,0,0.85)] transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';
const champBtnMuted = `${champBtnBase} border-slate-500/45 bg-gradient-to-b from-slate-600/90 via-slate-800/95 to-slate-950 text-slate-100 hover:brightness-110`;
const champBtnEmerald = `${champBtnBase} border-emerald-300/50 bg-gradient-to-b from-emerald-400/95 via-emerald-600/92 to-emerald-950 text-slate-950 hover:brightness-110`;
const champBtnAmber = `${champBtnBase} border-amber-300/55 bg-gradient-to-b from-amber-400/92 via-amber-600/88 to-amber-950 text-amber-50 hover:brightness-110`;

type PotionType = 'small' | 'medium' | 'large';

interface PotionInfo {
    name: string;
    image: string;
    minRecovery: number;
    maxRecovery: number;
    price: number;
    grade: 'normal' | 'uncommon' | 'rare';
}

const GRADE_LABEL: Record<PotionInfo['grade'], string> = {
    normal: '일반',
    uncommon: '고급',
    rare: '희귀',
};
const GRADE_RING: Record<PotionInfo['grade'], string> = {
    normal: 'border bg-gradient-to-b border-slate-500/55 from-slate-700/90 to-slate-950 text-slate-100',
    uncommon: 'border bg-gradient-to-b border-emerald-400/45 from-emerald-900/85 to-slate-950 text-emerald-100',
    rare: 'border bg-gradient-to-b border-amber-400/55 from-amber-950/90 to-slate-950 text-amber-100',
};

/** 서버 tournamentActions USE_CONDITION_POTION과 동일한 수치(표시·낙관적 UI 일치) */
const POTION_TYPES: Record<PotionType, PotionInfo> = {
    small: {
        name: '컨디션회복제(소)',
        image: '/images/use/con1.png',
        minRecovery: 5,
        maxRecovery: 15,
        price: 100,
        grade: 'normal'
    },
    medium: {
        name: '컨디션회복제(중)',
        image: '/images/use/con2.png',
        minRecovery: 15,
        maxRecovery: 25,
        price: 150,
        grade: 'uncommon'
    },
    large: {
        name: '컨디션회복제(대)',
        image: '/images/use/con3.png',
        minRecovery: 25,
        maxRecovery: 35,
        price: 200,
        grade: 'rare'
    }
};

interface ConditionPotionModalProps {
    currentUser?: User; // Optional: useAppContext에서 가져올 수 있도록
    currentCondition: number;
    onClose: () => void;
    onConfirm: (potionType: PotionType) => void;
    onAction?: (action: any) => void;
    isTopmost?: boolean;
}

const ConditionPotionModal: React.FC<ConditionPotionModalProps> = ({ 
    currentUser: propCurrentUser, 
    currentCondition, 
    onClose, 
    onConfirm,
    isTopmost 
}) => {
    const { handlers, currentUserWithStatus, updateTrigger, modals } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    // prop으로 받은 currentUser가 있으면 사용하고, 없으면 context에서 가져옴
    const currentUser = currentUserWithStatus || propCurrentUser;
    const isShopOpen = Boolean(modals?.isShopOpen);
    const [shopCloseRefreshNonce, setShopCloseRefreshNonce] = useState(0);
    const prevShopOpenRef = useRef(isShopOpen);
    const [selectedPotionType, setSelectedPotionType] = useState<PotionType | null>(null);
    const [previousCondition, setPreviousCondition] = useState<number | undefined>(currentCondition);
    const [showConditionIncrease, setShowConditionIncrease] = useState(false);
    const [conditionIncreaseAmount, setConditionIncreaseAmount] = useState(0);
    const prevConditionRef = useRef<number>(currentCondition);
    /** HTTP 응답 전에도 보유 수·컨디션 바가 즉시 반응하도록(서버 확정값은 updateTrigger로 동기화) */
    const [optimisticPotionDelta, setOptimisticPotionDelta] = useState<Partial<Record<PotionType, number>>>({});
    const [optimisticConditionAdd, setOptimisticConditionAdd] = useState(0);

    // 상점을 닫고 돌아올 때(구매 직후 포함) 보유 수·골드 UI가 남는 경우 방지
    useEffect(() => {
        if (prevShopOpenRef.current && !isShopOpen) {
            setShopCloseRefreshNonce((n) => n + 1);
        }
        prevShopOpenRef.current = isShopOpen;
    }, [isShopOpen]);

    useEffect(() => {
        setOptimisticPotionDelta({});
        setOptimisticConditionAdd(0);
    }, [updateTrigger, currentUser?.id, shopCloseRefreshNonce]);

    // 컨디션 변화 감지 및 애니메이션 트리거
    useEffect(() => {
        if (prevConditionRef.current !== undefined && currentCondition !== 1000 && prevConditionRef.current !== 1000) {
            const increase = currentCondition - prevConditionRef.current;
            if (increase > 0) {
                setConditionIncreaseAmount(increase);
                setShowConditionIncrease(true);
                setTimeout(() => {
                    setShowConditionIncrease(false);
                }, 2000);
            }
        }
        prevConditionRef.current = currentCondition;
        setPreviousCondition(currentCondition);
    }, [currentCondition]);

    // 보유 중인 각 컨디션 회복제 개수 계산 (`currentUser` 전체·상점 닫힘·updateTrigger에 반응 — inventory 참조만으로는 놓칠 수 있음)
    const potionCounts = useMemo(() => {
        const counts: Record<PotionType, number> = { small: 0, medium: 0, large: 0 };
        if (!currentUser?.inventory) return counts;
        currentUser.inventory
            .filter(item => item.type === 'consumable' && item.name.startsWith('컨디션회복제'))
            .forEach(item => {
                if (item.name === '컨디션회복제(소)') {
                    counts.small += item.quantity || 1;
                } else if (item.name === '컨디션회복제(중)') {
                    counts.medium += item.quantity || 1;
                } else if (item.name === '컨디션회복제(대)') {
                    counts.large += item.quantity || 1;
                }
            });
        (['small', 'medium', 'large'] as PotionType[]).forEach((t) => {
            const d = optimisticPotionDelta[t];
            if (d) counts[t] = Math.max(0, counts[t] + d);
        });
        return counts;
    }, [currentUser, updateTrigger, shopCloseRefreshNonce, optimisticPotionDelta]);

    const displayCondition =
        currentCondition === 1000 ? 1000 : Math.min(100, currentCondition + optimisticConditionAdd);

    // 선택한 회복제의 예상 회복량 계산(서버 확정 `currentCondition` 기준 — 낙관적 표시 수치와 1틱 어긋날 수 있음)
    const expectedRecovery = useMemo(() => {
        if (!selectedPotionType) return null;
        const potion = POTION_TYPES[selectedPotionType];
        if (currentCondition === 1000) return null;
        const minAfter = Math.min(100, currentCondition + potion.minRecovery);
        const maxAfter = Math.min(100, currentCondition + potion.maxRecovery);
        return { min: minAfter, max: maxAfter, avg: Math.floor((minAfter + maxAfter) / 2) };
    }, [selectedPotionType, currentCondition]);

    const hasPotion = useMemo(() => {
        if (!selectedPotionType) return false;
        return potionCounts[selectedPotionType] > 0;
    }, [selectedPotionType, potionCounts]);

    const handleConfirm = () => {
        if (!currentUser || !selectedPotionType) return;
        
        // 0개인 아이템을 선택한 경우 상점 열기
        if (!hasPotion) {
            handlers.openShop('consumables');
            // 창을 닫지 않음 (구매 후 돌아올 수 있도록)
            return;
        }

        const potion = POTION_TYPES[selectedPotionType];
        setOptimisticPotionDelta((prev) => ({
            ...prev,
            [selectedPotionType]: (prev[selectedPotionType] ?? 0) - 1,
        }));
        if (currentCondition !== 1000) {
            setOptimisticConditionAdd((a) => Math.min(100 - currentCondition, a + potion.minRecovery));
        }

        onConfirm(selectedPotionType);
    };

    if (!currentUser) {
        return null;
    }

    const titleContent = (
        <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/75">Championship venue</p>
            <p className="truncate text-base font-black leading-tight text-amber-50 sm:text-lg">컨디션 회복</p>
        </div>
    );

    return (
        <DraggableWindow
            title="컨디션 회복"
            titleContent={titleContent}
            headerShowTitle
            initialWidth={isNativeMobile ? 360 : 640}
            initialHeight={isNativeMobile ? 500 : 680}
            onClose={onClose}
            isTopmost={isTopmost}
            windowId="condition-potion-modal"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            bodyPaddingClassName="p-0"
            containerExtraClassName="shadow-[0_28px_100px_-28px_rgba(0,0,0,0.92),0_0_56px_-24px_rgba(251,191,36,0.14)]"
        >
            <div
                className={`flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[#1a2234] via-[#101520] to-[#06080e] ${isNativeMobile ? 'gap-3' : 'gap-5'}`}
            >
                <div className={`shrink-0 px-3 pt-3 sm:px-5 sm:pt-4 ${isNativeMobile ? 'pb-1' : 'pb-0'}`}>
                    <div className="mx-auto h-px w-20 bg-gradient-to-r from-transparent via-amber-400/45 to-transparent" aria-hidden />
                    <p className="mt-2 text-center text-[11px] font-semibold text-amber-200/80">
                        경기장 전용 회복 — 사용 시 보유 회복제 1개가 소모됩니다
                    </p>
                </div>

                <div
                    className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain ${isNativeMobile ? 'gap-3 px-3 pb-2' : 'gap-4 px-5 pb-3'}`}
                >
                    <div
                        className={
                            isNativeMobile
                                ? 'grid min-w-0 grid-cols-3 gap-1.5'
                                : 'grid grid-cols-3 gap-4'
                        }
                    >
                        {(Object.keys(POTION_TYPES) as PotionType[]).map((type) => {
                            const potion = POTION_TYPES[type];
                            const count = potionCounts[type];
                            const isSelected = selectedPotionType === type;
                            const gradeClass = GRADE_RING[potion.grade];
                            const shortPotionLabel = potion.name.replace(/^컨디션회복제/, '').trim();

                            return (
                                <button
                                    type="button"
                                    key={type}
                                    title={`${potion.name} · 회복 ${potion.minRecovery}~${potion.maxRecovery} · 보유 ${count}`}
                                    onClick={() => setSelectedPotionType(type)}
                                    className={`group relative min-w-0 w-full overflow-hidden rounded-2xl border transition-all duration-200 ${
                                        isNativeMobile
                                            ? 'flex flex-col items-center px-1.5 py-2 text-center active:scale-[0.99]'
                                            : 'p-4 text-left'
                                    } ${
                                        isSelected
                                            ? 'border-amber-400/70 bg-gradient-to-br from-amber-950/50 via-slate-900/95 to-slate-950 shadow-[0_0_32px_-10px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-amber-300/35'
                                            : 'border-slate-600/50 bg-gradient-to-b from-slate-800/75 to-slate-950/95 hover:border-amber-500/40 hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.75)]'
                                    }`}
                                >
                                    <div
                                        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90 ${isSelected ? 'from-amber-300/90 via-amber-500/80 to-amber-300/90' : 'from-transparent via-amber-500/25 to-transparent opacity-0 group-hover:opacity-100'}`}
                                        aria-hidden
                                    />
                                    {!isNativeMobile ? (
                                        <div className="flex items-start justify-between gap-2">
                                            <span
                                                className={`rounded-md border bg-gradient-to-b px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${gradeClass}`}
                                            >
                                                {GRADE_LABEL[potion.grade]}
                                            </span>
                                            {isSelected ? (
                                                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-black text-amber-200">
                                                    선택
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="flex w-full items-center justify-center gap-0.5">
                                            <span
                                                className={`rounded border bg-gradient-to-b px-1 py-0.5 text-[8px] font-black leading-none ${gradeClass}`}
                                            >
                                                {GRADE_LABEL[potion.grade]}
                                            </span>
                                            {isSelected ? (
                                                <span className="rounded bg-amber-400/25 px-1 py-0.5 text-[8px] font-black leading-none text-amber-100">
                                                    선택
                                                </span>
                                            ) : null}
                                        </div>
                                    )}
                                    {isNativeMobile ? (
                                        <div className="mt-1.5 flex w-full min-w-0 flex-col items-center gap-1">
                                            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-black/35 shadow-inner">
                                                <img src={potion.image} alt="" className="h-9 w-9 object-contain drop-shadow-md" />
                                            </div>
                                            <h3 className="w-full truncate px-0.5 text-[10px] font-black leading-tight text-amber-50">
                                                {shortPotionLabel}
                                            </h3>
                                            <p className="text-[9px] leading-none text-slate-400">
                                                <span className="font-bold text-slate-200">
                                                    {potion.minRecovery}~{potion.maxRecovery}
                                                </span>
                                            </p>
                                            <p
                                                className={`text-[9px] font-bold leading-none tabular-nums ${count > 0 ? 'text-sky-300' : 'text-rose-300/90'}`}
                                            >
                                                보유 {count}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-3 flex flex-col items-center gap-2.5">
                                            <div className="relative flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-2xl border border-amber-500/25 bg-black/40 shadow-[inset_0_2px_12px_rgba(0,0,0,0.45)]">
                                                <img
                                                    src={potion.image}
                                                    alt={potion.name}
                                                    className="h-[4.25rem] w-[4.25rem] object-contain drop-shadow-lg"
                                                />
                                            </div>
                                            <h3 className="text-center text-sm font-black text-amber-50">{potion.name}</h3>
                                            <p className="text-center text-[11px] text-slate-400">
                                                회복량{' '}
                                                <span className="font-bold text-slate-200">
                                                    {potion.minRecovery}~{potion.maxRecovery}
                                                </span>
                                            </p>
                                            <p
                                                className={`text-xs font-bold tabular-nums ${count > 0 ? 'text-sky-300' : 'text-rose-300/90'}`}
                                            >
                                                보유 {count}개
                                            </p>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {selectedPotionType && !hasPotion && (
                        <div
                            className={`rounded-xl border border-rose-500/35 bg-gradient-to-r from-rose-950/50 to-slate-950/60 px-3 py-2.5 text-center ${isNativeMobile ? 'text-[11px]' : 'text-sm'}`}
                        >
                            <p className="font-semibold text-rose-100/95">
                                {POTION_TYPES[selectedPotionType].name}이(가) 없습니다.
                            </p>
                            <p className="mt-0.5 text-[11px] text-rose-200/70">하단의 고급 버튼으로 상점에서 구매할 수 있습니다.</p>
                        </div>
                    )}

                </div>

                <div
                    className={`shrink-0 rounded-2xl border border-amber-300/20 bg-gradient-to-b from-[#283247]/95 via-[#151c2a]/98 to-[#07090f] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_48px_-20px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.04] ${
                        isNativeMobile ? 'mx-3 mb-2 p-3' : 'mx-5 mb-3 p-4'
                    }`}
                >
                    <div className={`relative flex items-center justify-between ${isNativeMobile ? 'mb-2' : 'mb-3'}`}>
                        <span className={`font-bold text-slate-400 ${isNativeMobile ? 'text-xs' : 'text-sm'}`}>현재 컨디션</span>
                        <span
                            className={`relative font-black tabular-nums text-amber-100 transition-all duration-300 ${
                                isNativeMobile ? 'text-xl' : 'text-2xl'
                            } ${showConditionIncrease ? 'scale-110 text-emerald-300' : ''}`}
                        >
                            {displayCondition === 1000 ? '—' : displayCondition}
                        </span>
                        {showConditionIncrease && conditionIncreaseAmount > 0 && (
                            <span
                                className={`pointer-events-none absolute font-black text-emerald-300 ${
                                    isNativeMobile ? 'right-3 top-2 text-sm' : 'right-5 top-3 text-base'
                                }`}
                                style={{
                                    animation: 'fadeUp 2s ease-out forwards',
                                    textShadow: '0 0 12px rgba(52, 211, 153, 0.75)',
                                }}
                            >
                                +{conditionIncreaseAmount}
                            </span>
                        )}
                    </div>
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/25 to-transparent" aria-hidden />
                    <div className={`mt-3 flex items-center justify-between gap-2 ${isNativeMobile ? 'text-xs' : 'text-sm'}`}>
                        <span className="font-semibold text-slate-400">{isNativeMobile ? '회복 후(예상)' : '예상 회복 후 컨디션'}</span>
                        <span className="text-right font-black tabular-nums text-emerald-200/95 sm:text-lg">
                            {expectedRecovery ? `${expectedRecovery.min} ~ ${expectedRecovery.max}` : '—'}
                        </span>
                    </div>
                </div>

                <div
                    className={`flex w-full shrink-0 border-t border-amber-400/20 bg-gradient-to-t from-black/35 to-transparent ${isNativeMobile ? 'gap-2 px-3 py-3' : 'gap-3 px-5 py-4'}`}
                >
                    <button type="button" onClick={onClose} className={`${champBtnMuted} flex-1 min-h-[46px] sm:min-h-[48px]`}>
                        닫기
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedPotionType}
                        className={
                            selectedPotionType && !hasPotion
                                ? `${champBtnAmber} flex-1 min-h-[46px] sm:min-h-[48px]`
                                : `${champBtnEmerald} flex-1 min-h-[46px] sm:min-h-[48px]`
                        }
                    >
                        {selectedPotionType && !hasPotion ? '상점으로 이동' : '회복제 사용'}
                    </button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ConditionPotionModal;

