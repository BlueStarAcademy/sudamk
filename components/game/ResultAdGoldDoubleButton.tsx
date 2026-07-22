import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, GameSummary, ServerAction } from '../../types.js';
import { useAdContext } from '../ads/AdProvider.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

type ResultAdGoldDoubleButtonProps = {
    session: LiveGameSession;
    summary?: Pick<GameSummary, 'gold' | 'matchGold' | 'vipGoldBonus' | 'adGoldBonus' | 'adGoldDoubled'> | null;
    isWinner?: boolean;
    onAction?: (action: ServerAction) => void | Promise<unknown>;
    onClaimed?: (amount: number) => void;
    className?: string;
};

export function getResultAdGoldDoubleBase(
    summary?: Pick<GameSummary, 'gold' | 'matchGold' | 'vipGoldBonus' | 'adGoldBonus'> | null,
): number {
    if (!summary) return 0;
    const matchGold = Number(summary.matchGold);
    if (Number.isFinite(matchGold) && matchGold > 0) return Math.floor(matchGold);
    const totalGold = Math.max(0, Number(summary.gold ?? 0));
    const vipGoldBonus = Math.max(0, Number(summary.vipGoldBonus ?? 0));
    const adGoldBonus = Math.max(0, Number(summary.adGoldBonus ?? 0));
    return Math.max(0, Math.floor(totalGold - vipGoldBonus - adGoldBonus));
}

export function isResultAdGoldDoubleEligibleSession(session: LiveGameSession): boolean {
    return resolveArenaSessionPolicy(session).allowsResultAdGoldDouble;
}

const ResultAdGoldDoubleButton: React.FC<ResultAdGoldDoubleButtonProps> = ({
    session,
    summary,
    isWinner: _isWinner,
    onAction,
    onClaimed,
    className = '',
}) => {
    const { t } = useTranslation(['game', 'common']);
    const { showShopAdRewardInterstitial, isAdFree } = useAdContext();
    const [pending, setPending] = useState(false);
    const [claimedLocally, setClaimedLocally] = useState(false);

    const baseGold = useMemo(() => getResultAdGoldDoubleBase(summary), [summary]);
    const canClaim =
        Boolean(onAction) &&
        isResultAdGoldDoubleEligibleSession(session) &&
        baseGold > 0 &&
        !summary?.adGoldDoubled &&
        (summary?.adGoldBonus ?? 0) <= 0 &&
        !claimedLocally;

    if (!canClaim) return null;

    const runClaim = () => {
        if (!onAction || pending) return;
        setPending(true);
        void Promise.resolve(onAction({ type: 'CLAIM_RESULT_AD_GOLD_DOUBLE', payload: { gameId: session.id } }))
            .then((result) => {
                const anyResult = result as any;
                if (anyResult?.error) {
                    window.alert(String(anyResult.error));
                    return;
                }
                // 서버가 실제 지급한 금액만 반영한다. 응답에 adGoldBonus가 없으면 낙관적 2배 표시하지 않음.
                const rawBonus = anyResult?.clientResponse?.adGoldBonus ?? anyResult?.adGoldBonus;
                const adGoldBonus = Number(rawBonus);
                if (!Number.isFinite(adGoldBonus) || adGoldBonus <= 0) {
                    window.alert(t('game:summary.adGoldDoubleFailed'));
                    return;
                }
                const safeBonus = Math.floor(adGoldBonus);
                setClaimedLocally(true);
                onClaimed?.(safeBonus);
            })
            .finally(() => setPending(false));
    };

    return (
        <div className={`flex min-w-0 flex-1 items-stretch ${className}`}>
            <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (pending) return;
                    showShopAdRewardInterstitial(runClaim, {
                        placementName: `result-gold-double-${session.id}`,
                        onDismissed: () => window.alert(t('common:ads.dismissedNoReward')),
                    });
                }}
                className="min-h-[40px] w-full rounded-[0.65rem] border border-amber-300/60 bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-2 text-xs font-black text-slate-950 shadow-[0_10px_28px_-14px_rgba(251,191,36,0.9)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70 sm:text-sm"
                title={t('game:summary.adGoldDoubleHint')}
            >
                {pending
                    ? t('game:summary.adGoldDoubleClaiming')
                    : isAdFree
                      ? t('game:summary.adGoldDoubleAdFree')
                      : t('game:summary.adGoldDoubleButton')}
            </button>
        </div>
    );
};

export default ResultAdGoldDoubleButton;
