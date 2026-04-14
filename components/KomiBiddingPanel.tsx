import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LiveGameSession, User, Player, KomiBid, ServerAction } from '../types.js';
import { GameCategory } from '../types/enums.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';

interface KomiBiddingPanelProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
    /** 베이스 바둑: 바둑판 하단 푸터에만 표시 (드래그 창 없음) */
    layout?: 'window' | 'inline';
}

const KOMI_BID_TIME_SEC = 30;

const komiWindowShell =
    'rounded-xl border border-amber-400/20 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black/90 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_50px_-20px_rgba(0,0,0,0.85),0_0_60px_-24px_rgba(251,191,36,0.12)]';

const AdjustButton: React.FC<{ amount: number; onAdjust: (amount: number) => void; disabled: boolean }> = React.memo(
    ({ amount, onAdjust, disabled }) => (
        <button
            type="button"
            onClick={() => onAdjust(amount)}
            disabled={disabled}
            className="w-full rounded-lg border border-white/12 bg-white/5 py-1.5 text-sm font-bold text-amber-50/95 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
            {amount > 0 ? `+${amount}` : `${amount}`}
        </button>
    )
);

const KomiBiddingPanel: React.FC<KomiBiddingPanelProps> = (props) => {
    const { session, currentUser, onAction, layout = 'window' } = props;
    const { id: gameId, player1, player2, komiBids, komiBiddingDeadline, gameStatus, komiBiddingRound, gameCategory } =
        session;
    const isAdventure = gameCategory === GameCategory.Adventure;
    const [selectedColor, setSelectedColor] = useState<Player>(Player.Black);
    const [komiValue, setKomiValue] = useState<number>(0);
    const [timer, setTimer] = useState(KOMI_BID_TIME_SEC);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const latestProps = useRef(props);
    useEffect(() => {
        latestProps.current = props;
    });

    const opponent = currentUser.id === player1.id ? player2 : player1;
    const myBid = komiBids?.[currentUser.id];
    const opponentBid = opponent ? komiBids?.[opponent.id] : undefined;

    const handleBidSubmit = useCallback(() => {
        const { session: currentSession, onAction: currentOnAction, currentUser: cu } = latestProps.current;
        const myCurrentBid = currentSession.komiBids?.[cu.id];
        if (myCurrentBid || isSubmitting) return;
        if (selectedColor === Player.None) return;

        setIsSubmitting(true);
        const bid: KomiBid = { color: selectedColor, komi: komiValue };
        currentOnAction({ type: 'UPDATE_KOMI_BID', payload: { gameId: currentSession.id, bid } });
        setTimeout(() => setIsSubmitting(false), 5000);
    }, [isSubmitting, selectedColor, komiValue]);

    useEffect(() => {
        setSelectedColor(Player.Black);
        setKomiValue(0);
    }, [komiBiddingRound]);

    useEffect(() => {
        if (myBid) {
            setTimer(0);
            return;
        }
        if (isAdventure || !komiBiddingDeadline) {
            setTimer(KOMI_BID_TIME_SEC);
            return;
        }
        const intervalId = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((komiBiddingDeadline - Date.now()) / 1000));
            setTimer(remaining);
            if (remaining <= 0) {
                handleBidSubmit();
            }
        }, 1000);
        return () => clearInterval(intervalId);
    }, [myBid, komiBiddingDeadline, handleBidSubmit, isAdventure]);

    const adjustKomi = (amount: number) => {
        setKomiValue((prev) => Math.max(0, Math.min(100, prev + amount)));
    };

    const baseKomi = 0.5;

    const renderDescription = () => {
        if (selectedColor === Player.Black) {
            const finalKomi = komiValue + baseKomi;
            return `흑을 잡고, 백에게 덤 ${finalKomi}집을 줍니다.`;
        }
        const finalKomi = baseKomi - komiValue;
        if (finalKomi >= 0) {
            return `백을 잡고, 흑에게서 덤 ${finalKomi}집을 받습니다.`;
        }
        return `백을 잡고, 흑에게 오히려 덤 ${Math.abs(finalKomi)}집을 줍니다.`;
    };

    const renderBidResult = () => {
        if (!myBid || !opponentBid || !opponent) {
            return (
                <div className={`${komiWindowShell} px-4 py-5 text-center`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">덤 설정</p>
                    <h3 className="mt-2 text-base font-bold text-stone-50">결과 확인 중</h3>
                    <p className="mt-2 text-sm text-stone-400">상대 설정을 기다립니다.</p>
                    <div className="mt-5 flex justify-center">
                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                    </div>
                </div>
            );
        }
        let resultText = '';
        const isTie = myBid.color === opponentBid.color && myBid.komi === opponentBid.komi;

        if (myBid.color !== opponentBid.color) {
            resultText = '서로 다른 색 → 각자 선택한 색으로 시작합니다. (덤 0.5집)';
        } else if (myBid.komi !== opponentBid.komi) {
            resultText = '같은 색 → 더 유리한 덤을 제시한 쪽이 그 색·덤을 가져갑니다.';
        } else if (komiBiddingRound === 1) {
            resultText = '같은 색·같은 덤 → 2차 덤 설정으로 넘어갑니다.';
        } else {
            resultText = '2차에서도 동일 → 흑/백이 무작위로 정해집니다.';
        }

        const pulseText =
            isTie && komiBiddingRound === 1 ? '잠시 후 재설정을 시작합니다…' : '잠시 후 대국이 시작됩니다…';

        return (
            <div className={`${komiWindowShell} space-y-3 px-4 py-4`}>
                <div className="text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/85">
                        덤 설정 결과{komiBiddingRound === 2 ? ' · 재설정' : ''}
                    </p>
                </div>
                <div className="space-y-2 rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-stone-200">
                    <div className="flex justify-between gap-2">
                        <span className="text-stone-500">{getSessionPlayerDisplayName(session, currentUser)}</span>
                        <span className="font-bold text-amber-100">
                            {myBid.color === Player.Black ? '흑' : '백'}, {myBid.komi}집
                        </span>
                    </div>
                    <div className="flex justify-between gap-2">
                        <span className="text-stone-500">{getSessionPlayerDisplayName(session, opponent)}</span>
                        <span className="font-bold text-amber-100">
                            {opponentBid.color === Player.Black ? '흑' : '백'}, {opponentBid.komi}집
                        </span>
                    </div>
                </div>
                <p className="text-center text-xs leading-relaxed text-amber-200/85">{resultText}</p>
                <p className="text-center text-[11px] text-stone-500 animate-pulse">{pulseText}</p>
            </div>
        );
    };

    const panelProps = {
        windowId: 'komi-bidding' as const,
        initialWidth: 340,
        shrinkHeightToContent: true,
        modal: false,
        hideFooter: true,
        headerShowTitle: true,
        defaultPosition: { x: 14, y: 96 },
        bodyPaddingClassName: 'p-0',
        bodyNoScroll: true,
        containerExtraClassName: '!max-w-[min(100vw,360px)]',
    };

    if (gameStatus === 'komi_bid_reveal') {
        return layout === 'inline' ? (
            <div className="w-full min-w-0 max-w-full overflow-x-auto">{renderBidResult()}</div>
        ) : (
            <DraggableWindow title="덤 설정" {...panelProps}>
                {renderBidResult()}
            </DraggableWindow>
        );
    }

    if (myBid) {
        const waitingBody = (
            <div className={`${komiWindowShell} px-4 py-6 text-center`}>
                <p className="text-sm font-semibold text-emerald-300/95">설정을 전송했습니다</p>
                <p className="mt-2 text-xs text-stone-400">상대방의 덤 설정을 기다리는 중입니다.</p>
                <div className="mt-5 flex justify-center">
                    <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-400/25 border-t-emerald-400" />
                </div>
            </div>
        );
        return layout === 'inline' ? (
            <div className="w-full min-w-0 max-w-full overflow-x-auto">{waitingBody}</div>
        ) : (
            <DraggableWindow title="덤 설정" {...panelProps}>
                {waitingBody}
            </DraggableWindow>
        );
    }

    const buttonsDisabled = !!myBid;

    const biddingBody = (
            <div className={`${komiWindowShell} px-3 pb-3 pt-2 sm:px-4 sm:pb-4`}>
                <p className="mb-2 text-center text-[11px] leading-snug text-stone-400">
                    원하는 돌 색과 추가 덤(0~100)을 정하세요. 기본 덤 백 {baseKomi}집.
                </p>
                {!isAdventure && (
                    <>
                        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                                style={{ width: `${(timer / KOMI_BID_TIME_SEC) * 100}%`, transition: 'width 0.5s linear' }}
                            />
                        </div>
                        <p className="mb-3 text-center font-mono text-2xl font-bold tabular-nums text-amber-100">{timer}</p>
                    </>
                )}

                <div className="mb-3 flex justify-center gap-2">
                    <button
                        type="button"
                        disabled={buttonsDisabled}
                        onClick={() => setSelectedColor(Player.Black)}
                        className={`min-w-[5.5rem] rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                            selectedColor === Player.Black
                                ? 'border-amber-400/60 bg-amber-500/20 text-amber-50 shadow-[0_0_20px_-8px_rgba(251,191,36,0.5)]'
                                : 'border-white/10 bg-white/5 text-stone-400 hover:bg-white/10'
                        } disabled:opacity-40`}
                    >
                        흑
                    </button>
                    <button
                        type="button"
                        disabled={buttonsDisabled}
                        onClick={() => setSelectedColor(Player.White)}
                        className={`min-w-[5.5rem] rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                            selectedColor === Player.White
                                ? 'border-slate-300/50 bg-slate-200/15 text-slate-50 shadow-[0_0_20px_-8px_rgba(226,232,240,0.35)]'
                                : 'border-white/10 bg-white/5 text-stone-400 hover:bg-white/10'
                        } disabled:opacity-40`}
                    >
                        백
                    </button>
                </div>

                <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wider text-stone-500">추가 덤</p>
                <div className="mb-2 rounded-xl border border-amber-500/25 bg-black/40 py-2 text-center font-mono text-xl font-bold text-amber-200">
                    {komiValue}집
                </div>
                <div className="mb-1 grid grid-cols-4 gap-1.5">
                    <AdjustButton amount={10} onAdjust={adjustKomi} disabled={buttonsDisabled} />
                    <AdjustButton amount={5} onAdjust={adjustKomi} disabled={buttonsDisabled} />
                    <AdjustButton amount={3} onAdjust={adjustKomi} disabled={buttonsDisabled} />
                    <AdjustButton amount={1} onAdjust={adjustKomi} disabled={buttonsDisabled} />
                </div>
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                    <AdjustButton amount={-10} onAdjust={adjustKomi} disabled={buttonsDisabled} />
                    <AdjustButton amount={-5} onAdjust={adjustKomi} disabled={buttonsDisabled} />
                    <AdjustButton amount={-3} onAdjust={adjustKomi} disabled={buttonsDisabled} />
                    <AdjustButton amount={-1} onAdjust={adjustKomi} disabled={buttonsDisabled} />
                </div>

                <p className="mb-3 min-h-[2.5rem] text-center text-[11px] leading-snug text-stone-400">{renderDescription()}</p>

                <Button
                    onClick={handleBidSubmit}
                    disabled={buttonsDisabled || isSubmitting}
                    className="w-full !rounded-xl !border !border-amber-400/35 !bg-gradient-to-r !from-amber-700/90 !to-amber-600/85 !py-2.5 !font-bold !text-amber-50 hover:!from-amber-600 hover:!to-amber-500"
                >
                    {buttonsDisabled ? '설정 완료' : '덤 설정 완료'}
                </Button>
            </div>
    );

    return layout === 'inline' ? (
        <div className="w-full min-w-0 max-w-full overflow-x-auto">
            {biddingBody}
        </div>
    ) : (
        <DraggableWindow
            title={komiBiddingRound === 2 ? '덤 설정 (재설정)' : '덤 설정'}
            {...panelProps}
        >
            {biddingBody}
        </DraggableWindow>
    );
};

export default KomiBiddingPanel;
