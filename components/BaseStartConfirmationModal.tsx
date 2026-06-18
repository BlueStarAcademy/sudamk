import React from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, User, ServerAction, Player } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';
import { aiUserId } from '../constants/index.js';
import { getAdventureCodexMonsterById } from '../constants/adventureMonstersCodex.js';
import { modeIncludesBaseCaptureMix } from '../shared/utils/liveSessionArenaKind.js';

interface BaseStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const startPanelShell =
    'rounded-xl border border-cyan-400/15 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black/90 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_48px_-18px_rgba(0,0,0,0.82),0_0_48px_-20px_rgba(34,211,238,0.1)]';

/** 베이스: 흑·백·덤 확정 + 양측 프로필 — 푸터에는 두지 않고 모달 전용 */
export const BaseStartConfirmationContent: React.FC<BaseStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const { t } = useTranslation('game');
    const {
        id: gameId,
        player1,
        player2,
        blackPlayerId,
        whitePlayerId,
        preGameConfirmations,
        finalKomi,
        baseKomiBidsSnapshot,
        effectiveCaptureTargets,
        settings,
    } = session;
    const hasConfirmed = !!preGameConfirmations?.[currentUser.id];

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const komiLabel = finalKomi != null ? String(finalKomi) : '—';
    const isBaseCaptureMix = modeIncludesBaseCaptureMix(session.mode, settings);
    const baseCaptureTarget = settings.captureTarget ?? effectiveCaptureTargets?.[Player.Black] ?? 20;
    const blackCaptureTarget = effectiveCaptureTargets?.[Player.Black] ?? baseCaptureTarget;
    const whiteCaptureTarget = effectiveCaptureTargets?.[Player.White] ?? baseCaptureTarget;
    const captureBidPoints = Math.max(0, baseCaptureTarget - whiteCaptureTarget);

    const monsterEntry =
        session.gameCategory === 'adventure' && session.adventureMonsterCodexId
            ? getAdventureCodexMonsterById(session.adventureMonsterCodexId)
            : undefined;
    const monsterName = monsterEntry?.name;
    const monsterPortraitUrl = monsterEntry?.imageWebp;
    const blackUiPlayer =
        blackPlayer.id === aiUserId && monsterName ? { ...blackPlayer, nickname: monsterName } : blackPlayer;
    const whiteUiPlayer =
        whitePlayer.id === aiUserId && monsterName ? { ...whitePlayer, nickname: monsterName } : whitePlayer;
    const p1Seat = { ...player1, nickname: getSessionPlayerDisplayName(session, player1) };
    const p2Seat = { ...player2, nickname: getSessionPlayerDisplayName(session, player2) };
    const avatarUrlOverrides =
        monsterPortraitUrl ? { [aiUserId]: monsterPortraitUrl } satisfies Partial<Record<string, string>> : undefined;

    const cards = (
        <PreGameColorRoulette
            key={`${gameId}-start-${blackPlayerId}-${whitePlayerId}`}
            layout="cardsOnly"
            animate={false}
            participantsInDisplayOrder={[p1Seat, p2Seat]}
            blackPlayer={blackUiPlayer}
            whitePlayer={whiteUiPlayer}
            avatarUrlOverrides={avatarUrlOverrides}
        />
    );

    return (
        <div className={`${startPanelShell} space-y-4 px-4 py-4 sm:px-5 sm:py-5`}>
            <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-cyan-300/85">
                {isBaseCaptureMix ? t('captureTiebreaker.baseCaptureTitle') : t('captureTiebreaker.basePrepTitle')}
            </p>
            <div className="flex justify-center">{cards}</div>
            <div className="space-y-2 rounded-lg border border-white/10 bg-black/35 px-3 py-3 text-[0.9rem] sm:text-[0.95rem]">
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <span className="shrink-0 font-semibold text-stone-400">{t('roundSummary.curlingBlack')}</span>
                    <span className="truncate text-right font-bold text-stone-100">
                        {getSessionPlayerDisplayName(session, blackPlayer)}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2 pb-1">
                    <span className="shrink-0 font-semibold text-stone-400">{t('roundSummary.curlingWhite')}</span>
                    <span className="truncate text-right font-bold text-stone-100">
                        {getSessionPlayerDisplayName(session, whitePlayer)}
                    </span>
                </div>
                <div className="border-t border-white/5 pt-2 space-y-2">
                    {isBaseCaptureMix ? (
                        <div className="space-y-2">
                            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                                따내기 점수 제시 결과
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                                    <p className="text-[10px] font-semibold text-stone-500">{t('captureTiebreaker.baseTargetLabel')}</p>
                                    <p className="font-mono text-lg font-black text-stone-100">{baseCaptureTarget}{t('captureBid.pointsSuffix')}</p>
                                </div>
                                <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-2 py-2">
                                    <p className="text-[10px] font-semibold text-stone-500">{t('captureTiebreaker.bidScoreLabel')}</p>
                                    <p className="font-mono text-lg font-black text-amber-200">{captureBidPoints}{t('captureBid.pointsSuffix')}</p>
                                </div>
                                <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-2">
                                    <p className="text-[10px] font-semibold text-stone-500">{t('captureTiebreaker.whiteTargetLabel')}</p>
                                    <p className="font-mono text-lg font-black text-cyan-100">{whiteCaptureTarget}{t('captureBid.pointsSuffix')}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                                <span className="font-semibold text-stone-400">{t('captureTiebreaker.blackWinCondition')}</span>
                                <span className="font-mono font-bold text-amber-100">{blackCaptureTarget}{t('captureTiebreaker.capturePoints')}</span>
                            </div>
                        </div>
                    ) : baseKomiBidsSnapshot?.[player1.id] && baseKomiBidsSnapshot?.[player2.id] ? (
                        <div className="space-y-1.5">
                            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                                덤 입찰(최종 라운드)
                            </p>
                            {[player1, player2].map((pl) => {
                                const bid = baseKomiBidsSnapshot[pl.id]!;
                                return (
                                    <div key={pl.id} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="truncate text-stone-400">{getSessionPlayerDisplayName(session, pl)}</span>
                                        <span className="shrink-0 font-bold text-amber-100/95">
                                            {bid.color === Player.Black ? tCommon('blackShort') : tCommon('whiteShort')}, {bid.komi}{t('captureTiebreaker.komiStones')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                    {!isBaseCaptureMix && (
                        <p className="text-center text-sm text-cyan-100/90">
                            {t('captureTiebreaker.komiWhite')} <span className="font-mono font-bold text-amber-200">{komiLabel}</span>{t('captureTiebreaker.komiStones')}
                        </p>
                    )}
                </div>
            </div>
            <p className="text-center text-xs leading-relaxed text-stone-400">
                준비가 끝나면 시작하기를 눌러 대국을 시작해 주세요.
            </p>
            <Button
                onClick={() =>
                    onAction({
                        type: 'CONFIRM_BASE_REVEAL',
                        payload: { gameId }
                    })
                }
                disabled={!!hasConfirmed}
                className="w-full !rounded-xl !border !border-cyan-400/30 !bg-gradient-to-r !from-cyan-900/80 !to-slate-800/90 !py-2.5 !text-[0.95rem] !font-bold !text-cyan-50 hover:!from-cyan-800 hover:!to-slate-700 disabled:!opacity-50"
            >
                {hasConfirmed ? tCommon('waitingOpponentConfirmShort') : tCommon('confirmStart')}
            </Button>
        </div>
    );
};

const BaseStartConfirmationModal: React.FC<BaseStartConfirmationModalProps> = (props) => (
    <DraggableWindow
        title={t('captureTiebreaker.basePrepTitle')}
        windowId="base-start-confirm"
        initialWidth={420}
        shrinkHeightToContent
        modal
        modalBackdrop
        transparentModalBackdrop
        hideFooter
        headerShowTitle
        mobileViewportFit
        bodyPaddingClassName="p-0"
        bodyNoScroll
        containerExtraClassName="!max-w-[min(100vw,440px)]"
    >
        <BaseStartConfirmationContent {...props} />
    </DraggableWindow>
);

export default BaseStartConfirmationModal;
