import React from 'react';
import { LiveGameSession, User, ServerAction, Player } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';
import { aiUserId } from '../constants/index.js';
import { getAdventureCodexMonsterById } from '../constants/adventureMonstersCodex.js';

interface BaseStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const startPanelShell =
    'rounded-xl border border-cyan-400/15 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black/90 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_48px_-18px_rgba(0,0,0,0.82),0_0_48px_-20px_rgba(34,211,238,0.1)]';

/** 베이스: 흑·백·덤 확정 + 양측 프로필 — 푸터에는 두지 않고 모달 전용 */
export const BaseStartConfirmationContent: React.FC<BaseStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const {
        id: gameId,
        player1,
        player2,
        blackPlayerId,
        whitePlayerId,
        preGameConfirmations,
        finalKomi,
        gameStatus,
        baseKomiBidsSnapshot
    } = session;
    const isKomiResultPhase = gameStatus === 'base_komi_result';
    const hasConfirmed = isKomiResultPhase
        ? !!session.preGameKomiSummaryAck?.[currentUser.id]
        : !!preGameConfirmations?.[currentUser.id];

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const komiLabel = finalKomi != null ? String(finalKomi) : '—';

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
                베이스 대국 준비
            </p>
            <div className="flex justify-center">{cards}</div>
            <div className="space-y-2 rounded-lg border border-white/10 bg-black/35 px-3 py-3 text-[0.9rem] sm:text-[0.95rem]">
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <span className="shrink-0 font-semibold text-stone-400">흑돌</span>
                    <span className="truncate text-right font-bold text-stone-100">
                        {getSessionPlayerDisplayName(session, blackPlayer)}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2 pb-1">
                    <span className="shrink-0 font-semibold text-stone-400">백돌</span>
                    <span className="truncate text-right font-bold text-stone-100">
                        {getSessionPlayerDisplayName(session, whitePlayer)}
                    </span>
                </div>
                <div className="border-t border-white/5 pt-2 space-y-2">
                    {baseKomiBidsSnapshot?.[player1.id] && baseKomiBidsSnapshot?.[player2.id] ? (
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
                                            {bid.color === Player.Black ? '흑' : '백'}, {bid.komi}집
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                    <p className="text-center text-sm text-cyan-100/90">
                        덤 <span className="font-mono font-bold text-amber-200">{komiLabel}</span>집
                    </p>
                </div>
            </div>
            <p className="text-center text-xs leading-relaxed text-stone-400">
                {isKomiResultPhase
                    ? '흑·백·덤을 확인한 뒤 다음 단계로 진행해 주세요.'
                    : '준비가 끝나면 시작하기를 눌러 대국을 시작해 주세요.'}
            </p>
            <Button
                onClick={() =>
                    onAction({
                        type: isKomiResultPhase ? 'CONFIRM_BASE_KOMI_SUMMARY' : 'CONFIRM_BASE_REVEAL',
                        payload: { gameId }
                    })
                }
                disabled={!!hasConfirmed}
                className="w-full !rounded-xl !border !border-cyan-400/30 !bg-gradient-to-r !from-cyan-900/80 !to-slate-800/90 !py-2.5 !text-[0.95rem] !font-bold !text-cyan-50 hover:!from-cyan-800 hover:!to-slate-700 disabled:!opacity-50"
            >
                {hasConfirmed ? '상대방 확인 대기 중…' : isKomiResultPhase ? '다음 단계' : '시작하기'}
            </Button>
        </div>
    );
};

const BaseStartConfirmationModal: React.FC<BaseStartConfirmationModalProps> = (props) => (
    <DraggableWindow
        title="베이스 대국 준비"
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
