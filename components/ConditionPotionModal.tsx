import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import {
    CONDITION_POTION_BY_TYPE,
    CONDITION_POTION_TYPES,
    type ConditionPotionType,
} from '../shared/constants/conditionPotion.js';
import { countConditionPotionsByType } from '../shared/utils/conditionPotionInventory.js';

/** TournamentBracket 챔피언십 푸터 버튼과 동일 계열 — 모달 전용 */
const champBtnBase =
    'rounded-xl border px-4 py-3 text-base font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_28px_-12px_rgba(0,0,0,0.85)] transition-colors active:brightness-95 disabled:pointer-events-none disabled:opacity-45';
const champBtnMuted = `${champBtnBase} border-slate-500/45 bg-gradient-to-b from-slate-600/90 via-slate-800/95 to-slate-950 text-slate-100 hover:brightness-110`;
const champBtnEmerald = `${champBtnBase} border-emerald-300/50 bg-gradient-to-b from-emerald-400/95 via-emerald-600/92 to-emerald-950 text-slate-950 hover:brightness-110`;
const champBtnAmber = `${champBtnBase} border-amber-300/55 bg-gradient-to-b from-amber-400/92 via-amber-600/88 to-amber-950 text-amber-50 hover:brightness-110`;

const GRADE_LABEL = {
    normal: '일반',
    uncommon: '고급',
    rare: '희귀',
} as const;

const GRADE_RING = {
    normal: 'border bg-gradient-to-b border-slate-500/55 from-slate-700/90 to-slate-950 text-slate-100',
    uncommon: 'border bg-gradient-to-b border-emerald-400/45 from-emerald-900/85 to-slate-950 text-emerald-100',
    rare: 'border bg-gradient-to-b border-amber-400/55 from-amber-950/90 to-slate-950 text-amber-100',
} as const;

interface ConditionPotionModalProps {
    currentUser?: User;
    currentCondition: number;
    onClose: () => void;
    onConfirm: (potionType: ConditionPotionType) => void | Promise<{ error?: string } | void>;
    isTopmost?: boolean;
}

const ConditionPotionModal: React.FC<ConditionPotionModalProps> = ({
    currentUser: propCurrentUser,
    currentCondition,
    onClose,
    onConfirm,
    isTopmost,
}) => {
    const { handlers, currentUserWithStatus, updateTrigger, modals } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const currentUser = currentUserWithStatus ?? propCurrentUser;
    const isShopOpen = Boolean(modals?.isShopOpen);
    const [shopCloseRefreshNonce, setShopCloseRefreshNonce] = useState(0);
    const prevShopOpenRef = useRef(isShopOpen);
    const [selectedPotionType, setSelectedPotionType] = useState<ConditionPotionType | null>(null);
    const [showConditionIncrease, setShowConditionIncrease] = useState(false);
    const [conditionIncreaseAmount, setConditionIncreaseAmount] = useState(0);
    const prevConditionRef = useRef<number>(currentCondition);
    const [isApplyingPotion, setIsApplyingPotion] = useState(false);

    useEffect(() => {
        if (prevShopOpenRef.current && !isShopOpen) {
            setShopCloseRefreshNonce((n) => n + 1);
        }
        prevShopOpenRef.current = isShopOpen;
    }, [isShopOpen]);

    useEffect(() => {
        if (prevConditionRef.current !== undefined && currentCondition !== 1000 && prevConditionRef.current !== 1000) {
            const increase = currentCondition - prevConditionRef.current;
            if (increase > 0) {
                setConditionIncreaseAmount(increase);
                setShowConditionIncrease(true);
                const timer = setTimeout(() => setShowConditionIncrease(false), 2000);
                return () => clearTimeout(timer);
            }
        }
        prevConditionRef.current = currentCondition;
    }, [currentCondition]);

    const potionCounts = useMemo(() => {
        return countConditionPotionsByType(currentUser?.inventory);
    }, [currentUser?.inventory, updateTrigger, shopCloseRefreshNonce]);

    const displayCondition = currentCondition === 1000 ? 1000 : currentCondition;

    const expectedRecovery = useMemo(() => {
        if (!selectedPotionType || currentCondition === 1000) return null;
        const potion = CONDITION_POTION_BY_TYPE[selectedPotionType];
        const minAfter = Math.min(100, currentCondition + potion.minRecovery);
        const maxAfter = Math.min(100, currentCondition + potion.maxRecovery);
        return { min: minAfter, max: maxAfter };
    }, [selectedPotionType, currentCondition]);

    const hasPotion = selectedPotionType ? potionCounts[selectedPotionType] > 0 : false;

    const handleConfirm = async () => {
        if (!currentUser || !selectedPotionType || isApplyingPotion) return;

        if (!hasPotion) {
            handlers.openShop('consumables', { modal: true });
            return;
        }

        setIsApplyingPotion(true);
        try {
            await Promise.resolve(onConfirm(selectedPotionType));
        } finally {
            setIsApplyingPotion(false);
        }
    };

    if (!currentUser) {
        return null;
    }

    return (
        <DraggableWindow
            title="컨디션 회복"
            headerShowTitle
            initialWidth={isNativeMobile ? 360 : 640}
            initialHeight={isNativeMobile ? 500 : 680}
            onClose={onClose}
            isTopmost={isTopmost}
            windowId="condition-potion-modal"
            mobileViewportFit
            mobileViewportMaxHeightVh={94}
            bodyPaddingClassName="p-0"
            bodyScrollable={false}
            containerExtraClassName="shadow-[0_28px_100px_-28px_rgba(0,0,0,0.92),0_0_56px_-24px_rgba(251,191,36,0.14)]"
        >
            <div
                className={`flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[#1a2234] via-[#101520] to-[#06080e] ${isNativeMobile ? 'gap-3 pt-3' : 'gap-5 pt-4'}`}
            >
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
                        {CONDITION_POTION_TYPES.map((type) => {
                            const potion = CONDITION_POTION_BY_TYPE[type];
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
                                    className={`group relative min-w-0 w-full overflow-hidden rounded-2xl border transition-colors duration-200 ${
                                        isNativeMobile
                                            ? 'flex flex-col items-center px-2 py-2.5 text-center'
                                            : 'p-4 text-left'
                                    } ${
                                        isSelected
                                            ? 'border-amber-400/70 bg-gradient-to-br from-amber-950/50 via-slate-900/95 to-slate-950 shadow-[0_0_32px_-10px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-amber-300/35'
                                            : 'border-slate-600/50 bg-gradient-to-b from-slate-800/75 to-slate-950/95 hover:border-amber-500/40 hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.75)]'
                                    }`}
                                >
                                    {!isNativeMobile ? (
                                        <div className="flex items-start justify-between gap-2">
                                            <span
                                                className={`rounded-md border bg-gradient-to-b px-2 py-0.5 text-xs font-bold ${gradeClass}`}
                                            >
                                                {GRADE_LABEL[potion.grade]}
                                            </span>
                                            {isSelected ? (
                                                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-100">
                                                    선택
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="flex w-full items-center justify-center gap-1">
                                            <span
                                                className={`rounded border bg-gradient-to-b px-1.5 py-0.5 text-xs font-bold leading-none ${gradeClass}`}
                                            >
                                                {GRADE_LABEL[potion.grade]}
                                            </span>
                                            {isSelected ? (
                                                <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-xs font-bold leading-none text-amber-50">
                                                    선택
                                                </span>
                                            ) : null}
                                        </div>
                                    )}
                                    {isNativeMobile ? (
                                        <div className="mt-2 flex w-full min-w-0 flex-col items-center gap-1.5">
                                            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-black/35 shadow-inner">
                                                <img src={potion.image} alt="" className="h-10 w-10 object-contain" />
                                            </div>
                                            <h3 className="w-full text-xs font-bold leading-normal text-amber-50">
                                                {shortPotionLabel}
                                            </h3>
                                            <p className="text-xs leading-normal text-slate-200">
                                                회복{' '}
                                                <span className="font-bold text-white">
                                                    {potion.minRecovery}~{potion.maxRecovery}
                                                </span>
                                            </p>
                                            <p
                                                className={`text-xs font-bold leading-normal tabular-nums ${count > 0 ? 'text-sky-200' : 'text-rose-300'}`}
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
                                                    className="h-[4.25rem] w-[4.25rem] object-contain"
                                                />
                                            </div>
                                            <h3 className="text-center text-base font-bold text-amber-50">{potion.name}</h3>
                                            <p className="text-center text-sm text-slate-200">
                                                회복량{' '}
                                                <span className="font-bold text-white">
                                                    {potion.minRecovery}~{potion.maxRecovery}
                                                </span>
                                            </p>
                                            <p
                                                className={`text-sm font-bold tabular-nums ${count > 0 ? 'text-sky-200' : 'text-rose-300'}`}
                                            >
                                                보유 {count}개
                                            </p>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div
                    className={`shrink-0 rounded-2xl border border-amber-300/20 bg-gradient-to-b from-[#283247]/95 via-[#151c2a]/98 to-[#07090f] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_48px_-20px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.04] ${
                        isNativeMobile ? 'mx-3 mb-2 p-3' : 'mx-5 mb-3 p-4'
                    }`}
                >
                    <div className={`relative flex items-center justify-between ${isNativeMobile ? 'mb-2' : 'mb-3'}`}>
                        <span className={`font-bold text-slate-200 ${isNativeMobile ? 'text-sm' : 'text-base'}`}>현재 컨디션</span>
                        <span
                            className={`relative font-bold tabular-nums text-amber-50 ${
                                isNativeMobile ? 'text-2xl' : 'text-3xl'
                            } ${showConditionIncrease ? 'text-emerald-300' : ''} ${isApplyingPotion ? 'text-emerald-200' : ''}`}
                        >
                            {displayCondition === 1000 ? '—' : displayCondition}
                        </span>
                        {showConditionIncrease && conditionIncreaseAmount > 0 && (
                            <span
                                className={`pointer-events-none absolute font-bold text-emerald-300 ${
                                    isNativeMobile ? 'right-3 top-2 text-base' : 'right-5 top-3 text-lg'
                                }`}
                                style={{ animation: 'fadeUp 2s ease-out forwards' }}
                            >
                                +{conditionIncreaseAmount}
                            </span>
                        )}
                    </div>
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/25 to-transparent" aria-hidden />
                    <div className={`mt-3 flex items-center justify-between gap-2 ${isNativeMobile ? 'text-sm' : 'text-base'}`}>
                        <span className="font-semibold text-slate-200">{isNativeMobile ? '회복 후(예상)' : '예상 회복 후 컨디션'}</span>
                        <span className="text-right text-lg font-bold tabular-nums text-emerald-200 sm:text-xl">
                            {expectedRecovery ? `${expectedRecovery.min} ~ ${expectedRecovery.max}` : '—'}
                        </span>
                    </div>
                </div>

                <div
                    className={`flex w-full shrink-0 border-t border-amber-400/20 bg-gradient-to-t from-black/35 to-transparent ${isNativeMobile ? 'gap-2 px-3 py-3' : 'gap-3 px-5 py-4'}`}
                >
                    <button type="button" onClick={onClose} className={`${champBtnMuted} flex-1 min-h-[48px] sm:min-h-[52px]`}>
                        닫기
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedPotionType || isApplyingPotion}
                        className={
                            selectedPotionType && !hasPotion
                                ? `${champBtnAmber} flex-1 min-h-[48px] sm:min-h-[52px]`
                                : `${champBtnEmerald} flex-1 min-h-[48px] sm:min-h-[52px]`
                        }
                    >
                        {isApplyingPotion ? '회복 적용 중...' : selectedPotionType && !hasPotion ? '상점으로 이동' : '회복제 사용'}
                    </button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ConditionPotionModal;
