
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';
import { usePreGameDeadlineAutoSubmit } from '../hooks/usePreGameDeadlineAutoSubmit.js';

interface CaptureBidModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const AdjustButton: React.FC<{
    amount: number;
    onAdjust: (amount: number) => void;
    disabled: boolean;
}> = React.memo(({ amount, onAdjust, disabled }) => (
    <Button
        onClick={() => onAdjust(amount)}
        disabled={disabled}
        colorScheme="gray"
        // 작은 스텝 버튼: +, -가 커서 불편하다는 피드백 반영
        className="w-11 h-11 !px-0 !py-0 rounded-xl border border-slate-600/70 bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 transition-all font-extrabold text-sm shadow-[0_4px_14px_rgba(0,0,0,0.28)]"
        style={{ fontSize: '0.95rem' }}
        title={amount > 0 ? `+${amount}` : `${amount}`}
    >
        {amount > 0 ? `+${amount}` : `${amount}`}
    </Button>
));


const CaptureBidModal: React.FC<CaptureBidModalProps> = (props) => {
    const { session, currentUser, onAction } = props;
    const { id: gameId, player1, player2, bids, biddingRound, captureBidDeadline, settings } = session;
    const [localBid, setLocalBid] = useState<number>(1);
    const [countdown, setCountdown] = useState(PRE_GAME_PVP_COUNTDOWN_SECONDS);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const lastBiddingRoundRef = useRef(biddingRound);
    const latestProps = useRef(props);
    useEffect(() => {
        latestProps.current = props;
    });

    useEffect(() => {
        if (biddingRound !== lastBiddingRoundRef.current) {
            setLocalBid(1);
            setIsSubmitting(false);
            lastBiddingRoundRef.current = biddingRound;
        }
    }, [biddingRound]);

    const pairGame = settings.pairGame;
    const myPairTeam =
        pairGame?.teamA.members.some((m) => m.kind === 'user' && m.id === currentUser.id)
            ? 'teamA'
            : pairGame?.teamB.members.some((m) => m.kind === 'user' && m.id === currentUser.id)
              ? 'teamB'
              : null;
    const pairCaptainId = myPairTeam
        ? pairGame?.[myPairTeam].members.find((m) => m.kind === 'user')?.id
        : null;
    const isPairBidViewer = Boolean(pairGame && myPairTeam);
    const canSubmitPairBid = !isPairBidViewer || pairCaptainId === currentUser.id;
    const myBidSubjectId = myPairTeam === 'teamA' ? player1.id : myPairTeam === 'teamB' ? player2.id : currentUser.id;
    const opponentSubjectId = myPairTeam === 'teamA' ? player2.id : myPairTeam === 'teamB' ? player1.id : (currentUser.id === player1.id ? player2.id : player1.id);
    const opponent = opponentSubjectId === player1.id ? player1 : player2;
    const myBid = bids?.[myBidSubjectId];
    const opponentBid = bids?.[opponentSubjectId];
    const bothHaveBid = typeof myBid === 'number' && typeof opponentBid === 'number';
    const hasBidCountdown = Boolean(captureBidDeadline) && resolveArenaSessionPolicy(session).matchAxis === 'pvp';
    
    const handleBidSubmit = useCallback(() => {
        const { onAction: currentOnAction, session: currentSession, currentUser } = latestProps.current;
        const pg = currentSession.settings.pairGame;
        const team =
            pg?.teamA.members.some((m) => m.kind === 'user' && m.id === currentUser.id)
                ? 'teamA'
                : pg?.teamB.members.some((m) => m.kind === 'user' && m.id === currentUser.id)
                  ? 'teamB'
                  : null;
        const subjectId = team === 'teamA' ? currentSession.player1.id : team === 'teamB' ? currentSession.player2.id : currentUser.id;
        const captainId = team ? pg?.[team].members.find((m) => m.kind === 'user')?.id : null;
        const myCurrentBid = currentSession.bids?.[subjectId];
        
        if ((team && captainId !== currentUser.id) || typeof myCurrentBid === 'number' || isSubmitting) return;

        setIsSubmitting(true);
        currentOnAction({ type: 'UPDATE_CAPTURE_BID', payload: { gameId, bid: localBid } });
        setTimeout(() => setIsSubmitting(false), 5000);
    }, [isSubmitting, gameId, localBid]);

    usePreGameDeadlineAutoSubmit({
        deadline: hasBidCountdown && typeof myBid !== 'number' ? captureBidDeadline : undefined,
        enabled: canSubmitPairBid,
        alreadySubmitted: typeof myBid === 'number' || isSubmitting,
        onSubmit: handleBidSubmit,
    });

    useEffect(() => {
        if (typeof myBid === 'number' || !hasBidCountdown || !captureBidDeadline) {
            setCountdown(0);
            return;
        };
        const timerId = setInterval(() => {
             const remaining = Math.max(0, Math.ceil((captureBidDeadline - Date.now()) / 1000));
             setCountdown(remaining);
             if (remaining <= 0) {
                 clearInterval(timerId);
             }
        }, 1000);
        return () => clearInterval(timerId);
    }, [myBid, hasBidCountdown, captureBidDeadline]);

    const adjustBid = useCallback((amount: number) => {
        if (typeof myBid === 'number') return;
        setLocalBid(prev => Math.max(1, Math.min(Math.max(1, (settings.captureTarget || 20) - 1), prev + amount)));
    }, [myBid, settings.captureTarget]);

    const progressPercent = useMemo(
        () => Math.max(0, Math.min(100, (countdown / PRE_GAME_PVP_COUNTDOWN_SECONDS) * 100)),
        [countdown],
    );
    const baseTarget = settings.captureTarget || 20;
    const maxBid = Math.max(1, baseTarget - 1);
    const effectiveLocalBid = Math.min(localBid, maxBid);
    const whiteTargetIfWin = Math.max(1, baseTarget - effectiveLocalBid);

    useEffect(() => {
        setLocalBid((prev) => Math.max(1, Math.min(maxBid, prev)));
    }, [maxBid]);

    const renderContent = () => {
        if (bothHaveBid) {
          const p1Bid = bids![player1.id]!;
          const p2Bid = bids![player2.id]!;
          let winnerText = '';
          const isTie = p1Bid === p2Bid;
          
          let winner: typeof player1 | undefined;
          let winnerBid: number | undefined;
          if (p1Bid > p2Bid) {
              winner = player1;
              winnerBid = p1Bid;
          } else if (p2Bid > p1Bid) {
              winner = player2;
              winnerBid = p2Bid;
          }

          if (winner && typeof winnerBid === 'number') {
            winnerText = `${winner.nickname}님이 ${winnerBid}점을 제시하여 흑(선)이 됩니다. 백의 목표는 ${Math.max(1, baseTarget - winnerBid)}점입니다.`;
          } else {
            winnerText = biddingRound === 2 ? '두 번째에도 비겨서, 랜덤으로 결정됩니다.' : '동점이므로, 재설정합니다!';
          }
          
          const pulseText = isTie && biddingRound === 1
            ? '재설정으로 즉시 전환됩니다...'
            : '잠시 후 대국이 시작됩니다...';

          return (
            <div className="space-y-5 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-300/35 bg-amber-500/10 text-amber-200 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                흑선 배팅 결과
              </div>
              <div className="grid grid-cols-2 gap-3 text-lg">
                  <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-4 rounded-2xl border border-slate-700">
                      <p className="text-slate-300 text-sm mb-1">{player1.nickname}</p>
                      <p className="text-3xl font-extrabold">{p1Bid}<span className="text-base font-semibold ml-1 text-slate-300">점</span></p>
                  </div>
                  <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-4 rounded-2xl border border-slate-700">
                      <p className="text-slate-300 text-sm mb-1">{player2.nickname}</p>
                      <p className="text-3xl font-extrabold">{p2Bid}<span className="text-base font-semibold ml-1 text-slate-300">점</span></p>
                  </div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-lg font-bold text-yellow-300">{winnerText}</p>
              </div>
              <p className="text-sm text-slate-400 animate-pulse">{pulseText}</p>
            </div>
          );
        }

        if (typeof myBid === 'number') {
            return (
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 text-emerald-200 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                        설정 완료
                    </div>
                    <p className="text-slate-300 animate-pulse">{opponent.nickname}님의 설정을 기다리고 있습니다...</p>
                    <div className="flex justify-center items-center h-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-300"></div>
                    </div>
                </div>
            );
        }

        const buttonsDisabled = typeof myBid === 'number' || !canSubmitPairBid;

        return (
            <div className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 p-4">
                        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-amber-300/10 blur-2xl" />
                        <p className="relative text-sm text-slate-200 leading-relaxed">
                            기본 목표는 <span className="font-bold text-amber-300">{baseTarget}개</span>.
                            <br />
                            흑(선수)을 가져오기 위해 <span className="font-bold text-amber-200">상대에게 줄 점수</span>를 제시하세요.
                            <br />
                            <span className="text-slate-300/90">더 높은 점수를 제시한 플레이어가 흑이 되며, 백의 목표가 그만큼 낮아집니다. 최대 {maxBid}점까지 제시할 수 있습니다.</span>
                        </p>
                    </div>

                    {hasBidCountdown ? (
                        <div className="w-full sm:w-[240px] rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-semibold text-slate-400 whitespace-nowrap">배팅 타이머</div>
                                <div className="text-xs text-amber-200/90 whitespace-nowrap">라운드 {biddingRound}</div>
                            </div>
                            <div className="mt-3 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-600">
                                <div
                                    className="bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-400 h-2 rounded-full"
                                    style={{ width: `${progressPercent}%`, transition: 'width 1s linear' }}
                                />
                            </div>
                            <div className="mt-3 flex items-end justify-between">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-mono font-bold text-amber-300 tracking-wider">{countdown}</span>
                                    <span className="text-xs text-slate-300 pb-1">초</span>
                                </div>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">남은 시간 내 배팅 확정</div>
                        </div>
                    ) : (
                        <div className="w-full sm:w-[240px] rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                            <div className="text-xs font-semibold text-emerald-200">AI전 무제한 제시</div>
                            <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                                AI는 1~5점 사이에서 자동 제시합니다. 제한시간 없이 점수를 고를 수 있습니다.
                            </p>
                        </div>
                    )}
                </div>

                <div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-900/80 border border-slate-700 p-3 rounded-2xl text-center">
                            <div className="text-xs text-slate-400 mb-1">기본 목표</div>
                            <div className="text-2xl font-extrabold text-slate-100">
                                {baseTarget}
                                <span className="text-sm font-semibold ml-1">개</span>
                            </div>
                        </div>
                        <div className="bg-slate-900/80 border border-amber-400/35 p-3 rounded-2xl text-center">
                            <div className="text-xs text-amber-200/90 mb-1">상대에게 주는 점수</div>
                            <div className="text-2xl font-extrabold text-amber-300">
                                {effectiveLocalBid}
                                <span className="text-sm font-semibold ml-1">점</span>
                            </div>
                            <div className="text-[11px] text-slate-300/90 mt-1">
                                흑 선택 시 백 목표: <span className="text-amber-200 font-semibold">{whiteTargetIfWin}점</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-2 w-fit mx-auto">
                        <AdjustButton amount={10} onAdjust={adjustBid} disabled={buttonsDisabled} />
                        <AdjustButton amount={5} onAdjust={adjustBid} disabled={buttonsDisabled} />
                        <AdjustButton amount={3} onAdjust={adjustBid} disabled={buttonsDisabled} />
                        <AdjustButton amount={1} onAdjust={adjustBid} disabled={buttonsDisabled} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 w-fit mx-auto">
                        <AdjustButton amount={-10} onAdjust={adjustBid} disabled={buttonsDisabled} />
                        <AdjustButton amount={-5} onAdjust={adjustBid} disabled={buttonsDisabled} />
                        <AdjustButton amount={-3} onAdjust={adjustBid} disabled={buttonsDisabled} />
                        <AdjustButton amount={-1} onAdjust={adjustBid} disabled={buttonsDisabled} />
                    </div>
                    <div className="mt-3 text-center text-[11px] text-slate-400">
                        {canSubmitPairBid ? (
                            <>현재 제시: <span className="text-amber-200 font-semibold">{effectiveLocalBid}점</span></>
                        ) : (
                            <>팀 방장의 입찰을 기다리고 있습니다.</>
                        )}
                    </div>
                </div>

                <div className="flex justify-center">
                    <Button
                        onClick={handleBidSubmit}
                        disabled={isSubmitting || buttonsDisabled}
                        className="!py-2 !px-6 rounded-xl font-extrabold tracking-wide bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 hover:brightness-110 max-w-[320px]"
                    >
                        {isSubmitting ? '설정 중...' : '흑선 점수 제시 확정'}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <DraggableWindow title={`흑선 가져오기 ${biddingRound === 2 ? '· 재배팅 라운드' : ''}`} windowId="capture-bid">
             {renderContent()}
        </DraggableWindow>
    );
};

export default CaptureBidModal;