import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LiveGameSession, ServerAction, User } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants.js';
import { getPairPetDefinition } from '../shared/constants/petLobby.js';

function pairTurnOrderPetPortrait(session: LiveGameSession, participantId: string): string | null {
    if (!participantId.startsWith('pet-ai-')) return null;
    const uid = participantId.slice('pet-ai-'.length);
    const u = session.player1.id === uid ? session.player1 : session.player2.id === uid ? session.player2 : null;
    const tid = u?.equippedPairPetTemplateId;
    if (!tid) return null;
    return getPairPetDefinition(tid)?.image ?? null;
}

interface PairTurnOrderModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const seatLabel: Record<string, string> = {
    black1: '흑 1',
    white1: '백 1',
    black2: '흑 2',
    white2: '백 2',
};

const ROULETTE_DURATION_MS = 2400;
const ROULETTE_TICK_MS = 90;

const PairTurnOrderModal: React.FC<PairTurnOrderModalProps> = ({ session, currentUser, onAction }) => {
    const pairGame = session.settings.pairGame;
    const seats = pairGame?.turnOrder ?? [];
    const confirmations = pairGame?.orderRevealConfirmed ?? {};
    const isHumanSeat = seats.some((s) => s.kind === 'user' && s.participantId === currentUser.id);
    const hasConfirmed = Boolean(confirmations[currentUser.id]);
    const [rouletteIndex, setRouletteIndex] = useState(0);
    const [rouletteDone, setRouletteDone] = useState(false);
    const autoConfirmSentRef = useRef(false);
    const usersById = useMemo(() => new Map([session.player1, session.player2, currentUser].map((u) => [u.id, u])), [session.player1, session.player2, currentUser]);
    const displayedSeats = useMemo(() => {
        if (rouletteDone || seats.length === 0) return seats;
        return seats.map((_, index) => seats[(index + rouletteIndex) % seats.length]);
    }, [rouletteDone, rouletteIndex, seats]);

    useEffect(() => {
        if (!seats.length) return;
        autoConfirmSentRef.current = false;
        setRouletteDone(false);
        setRouletteIndex(0);
        const interval = window.setInterval(() => {
            setRouletteIndex((prev) => (prev + 1) % seats.length);
        }, ROULETTE_TICK_MS);
        const timeout = window.setTimeout(() => {
            window.clearInterval(interval);
            setRouletteIndex(0);
            setRouletteDone(true);
        }, ROULETTE_DURATION_MS);
        return () => {
            window.clearInterval(interval);
            window.clearTimeout(timeout);
        };
    }, [seats.length, session.id]);

    useEffect(() => {
        if (!rouletteDone || !isHumanSeat || hasConfirmed || autoConfirmSentRef.current) return;
        autoConfirmSentRef.current = true;
        void Promise.resolve(onAction({ type: 'CONFIRM_COLOR_START' as any, payload: { gameId: session.id } }));
    }, [rouletteDone, isHumanSeat, hasConfirmed, onAction, session.id]);

    return (
        <DraggableWindow title="페어 순서 결정" initialWidth={520} shrinkHeightToContent windowId="pair-turn-order" transparentModalBackdrop>
            <div className="flex flex-col gap-4 p-1 text-slate-100">
                <div className="rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-950/60 via-slate-950/95 to-indigo-950/60 p-4 text-center shadow-inner">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-200/70">Pair Go</p>
                    <h3 className="mt-1 text-xl font-black text-fuchsia-50">
                        {rouletteDone ? '착수 순서가 결정되었습니다' : '착수 순서를 결정하는 중입니다'}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        대국은 <span className="font-bold text-amber-200">흑1 → 백1 → 흑2 → 백2</span> 순서로 진행됩니다.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {seats.map((slotSeat, index) => {
                        const seat = displayedSeats[index] ?? slotSeat;
                        const isBlack = slotSeat.player === 1;
                        const user = usersById.get(seat.participantId);
                        const avatarUrl = user ? AVATAR_POOL.find((a) => a.id === user.avatarId)?.url : null;
                        const borderUrl = user ? BORDER_POOL.find((b) => b.id === user.borderId)?.url : null;
                        const petPortrait = !user && seat.kind === 'pet' ? pairTurnOrderPetPortrait(session, seat.participantId) : null;
                        const highlighted = !rouletteDone;
                        return (
                            <div
                                key={slotSeat.seatId}
                                className={`relative overflow-hidden rounded-xl border p-3 text-center shadow-lg transition-all duration-150 ${
                                    highlighted
                                        ? 'scale-[1.04] border-amber-300 bg-gradient-to-b from-amber-400/35 to-fuchsia-900/70 text-amber-50 shadow-[0_0_28px_rgba(251,191,36,0.45)]'
                                        : isBlack
                                          ? 'border-slate-500/35 bg-gradient-to-b from-slate-800 to-black'
                                          : 'border-amber-100/35 bg-gradient-to-b from-zinc-100 to-amber-100 text-slate-950'
                                }`}
                            >
                                <div className="mb-2 flex justify-center">
                                    <Avatar
                                        userId={seat.participantId}
                                        userName={seat.name}
                                        avatarUrl={avatarUrl || petPortrait || (seat.kind === 'pet' ? '/images/pets/pet1.webp' : null)}
                                        borderUrl={borderUrl}
                                        size={44}
                                    />
                                </div>
                                <div className={`text-xs font-black tracking-widest ${highlighted ? 'text-amber-100' : isBlack ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {seatLabel[slotSeat.seatId] ?? slotSeat.seatId}
                                </div>
                                <div className="mt-2 truncate text-sm font-black" title={seat.name}>
                                    {seat.name}
                                </div>
                                <div className={`mt-1 text-[11px] font-semibold ${highlighted ? 'text-amber-100/90' : isBlack ? 'text-fuchsia-200/80' : 'text-fuchsia-800/80'}`}>
                                    {seat.kind === 'user' ? '대국자' : seat.kind === 'pet' ? '펫 AI' : 'AI'}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-3">
                    {isHumanSeat ? (
                        <Button
                            colorScheme="none"
                            disabled={hasConfirmed || !rouletteDone}
                            onClick={() => onAction({ type: 'CONFIRM_COLOR_START', payload: { gameId: session.id } })}
                            className="!rounded-full !border !border-fuchsia-300/50 !bg-gradient-to-r !from-fuchsia-600 !to-indigo-600 !px-8 !py-2.5 !font-black !text-white hover:!from-fuchsia-500 hover:!to-indigo-500 disabled:!opacity-55"
                        >
                            {hasConfirmed ? '확인 완료' : rouletteDone ? '경기 시작 확인' : '순서 결정 중'}
                        </Button>
                    ) : (
                        <p className="text-sm text-slate-400">대국자 확인을 기다리는 중입니다.</p>
                    )}
                    <p className="text-xs text-slate-500">
                        {Object.values(confirmations).filter(Boolean).length} / {Object.keys(confirmations).length} 확인
                    </p>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairTurnOrderModal;
