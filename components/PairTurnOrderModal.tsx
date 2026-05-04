import React, { useEffect, useMemo, useState } from 'react';
import { LiveGameSession, ServerAction, User } from '../types.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants.js';
import { getPairPetDefinition, getPairPetDisplayName } from '../shared/constants/petLobby.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from '../shared/utils/pairPetRoll.js';
import {
    isPairAiOpponentSyntheticDisplayParticipant,
    resolvePairAiOpponentPetSyntheticDisplayLevel,
} from '../shared/utils/strategicAiDifficulty.js';

function pairTurnOrderPetPortrait(session: LiveGameSession, participantId: string): string | null {
    if (!participantId.startsWith('pet-ai-')) return null;
    const uid = participantId.slice('pet-ai-'.length);
    const u = session.player1.id === uid ? session.player1 : session.player2.id === uid ? session.player2 : null;
    const tid = u?.equippedPairPetTemplateId;
    if (!tid) return null;
    return getPairPetDefinition(tid)?.image ?? null;
}

function pairTurnOrderPetDisplayName(session: LiveGameSession, participantId: string, fallbackName: string): string {
    if (isPairAiOpponentSyntheticDisplayParticipant(participantId)) {
        const level = resolvePairAiOpponentPetSyntheticDisplayLevel(session.id, session.settings, participantId);
        const def = getPairPetDefinition(participantId === 'pair-opponent-pet' ? 'pair-pet-2' : 'pair-pet-1');
        return `Lv.${level} ${def?.displayName ?? fallbackName}`;
    }
    if (!participantId.startsWith('pet-ai-')) return fallbackName;
    const uid = participantId.slice('pet-ai-'.length);
    const u = session.player1.id === uid ? session.player1 : session.player2.id === uid ? session.player2 : null;
    if (!u) return fallbackName;
    const row = getEquippedPairPetInventoryRow(u);
    if (!row) return fallbackName;
    const meta = resolvePairPetMetaFromInventoryRow(row);
    const level = Math.max(1, Math.floor(meta.level) || 1);
    return `Lv.${level} ${getPairPetDisplayName(row)}`;
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
    const isHandheld = useIsHandheldDevice(1025);
    const pairGame = session.settings.pairGame;
    const seats = pairGame?.turnOrder ?? [];
    const confirmations = pairGame?.orderRevealConfirmed ?? {};
    const isHumanSeat = seats.some((s) => s.kind === 'user' && s.participantId === currentUser.id);
    const hasConfirmed = Boolean(confirmations[currentUser.id]);
    const [rouletteIndex, setRouletteIndex] = useState(0);
    const [rouletteDone, setRouletteDone] = useState(false);
    const usersById = useMemo(() => new Map([session.player1, session.player2, currentUser].map((u) => [u.id, u])), [session.player1, session.player2, currentUser]);
    const displayedSeats = useMemo(() => {
        if (rouletteDone || seats.length === 0) return seats;
        return seats.map((_, index) => seats[(index + rouletteIndex) % seats.length]);
    }, [rouletteDone, rouletteIndex, seats]);

    useEffect(() => {
        if (!seats.length) return;
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

    return (
        <DraggableWindow
            title="페어 순서 결정"
            initialWidth={520}
            shrinkHeightToContent
            windowId="pair-turn-order"
            transparentModalBackdrop
            hideFooter
            mobileViewportFit
            bodyPaddingClassName="p-0"
            headerShowTitle
            containerExtraClassName={isHandheld ? '!max-w-[min(100vw,520px)]' : undefined}
        >
            <div className={`flex flex-col text-slate-100 ${isHandheld ? 'gap-2 px-1.5 pb-1 pt-0.5' : 'gap-4 p-1'}`}>
                <div
                    className={`rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-950/60 via-slate-950/95 to-indigo-950/60 text-center shadow-inner ${
                        isHandheld ? 'px-2.5 py-2' : 'p-4'
                    }`}
                >
                    <p className={`font-bold uppercase tracking-[0.22em] text-fuchsia-200/70 ${isHandheld ? 'text-[10px] tracking-[0.14em]' : 'text-xs'}`}>
                        Pair Go
                    </p>
                    <h3 className={`mt-0.5 font-black text-fuchsia-50 ${isHandheld ? 'text-base leading-snug' : 'mt-1 text-xl'}`}>
                        {rouletteDone ? '착수 순서가 결정되었습니다' : '착수 순서를 결정하는 중입니다'}
                    </h3>
                    <p className={`leading-relaxed text-slate-300 ${isHandheld ? 'mt-1 text-[11px]' : 'mt-2 text-sm'}`}>
                        대국은 <span className="font-bold text-amber-200">흑1 → 백1 → 흑2 → 백2</span> 순서로 진행됩니다.
                    </p>
                </div>

                <div className={`grid grid-cols-2 sm:grid-cols-4 ${isHandheld ? 'gap-1.5' : 'gap-2'}`}>
                    {seats.map((slotSeat, index) => {
                        const seat = displayedSeats[index] ?? slotSeat;
                        const isBlack = slotSeat.player === 1;
                        const user = usersById.get(seat.participantId);
                        const avatarUrl = user ? AVATAR_POOL.find((a) => a.id === user.avatarId)?.url : null;
                        const borderUrl = user ? BORDER_POOL.find((b) => b.id === user.borderId)?.url : null;
                        const petPortrait = !user && seat.kind === 'pet' ? pairTurnOrderPetPortrait(session, seat.participantId) : null;
                        const seatDisplayName =
                            !user && seat.kind === 'pet'
                                ? pairTurnOrderPetDisplayName(session, seat.participantId, seat.name)
                                : seat.name;
                        const highlighted = !rouletteDone;
                        return (
                            <div
                                key={slotSeat.seatId}
                                className={`relative overflow-hidden rounded-xl border text-center shadow-lg transition-all duration-150 ${
                                    isHandheld ? 'p-1.5' : 'p-3'
                                } ${
                                    highlighted
                                        ? `${isHandheld ? 'scale-[1.02]' : 'scale-[1.04]'} border-amber-300 bg-gradient-to-b from-amber-400/35 to-fuchsia-900/70 text-amber-50 shadow-[0_0_28px_rgba(251,191,36,0.45)]`
                                        : isBlack
                                          ? 'border-slate-500/35 bg-gradient-to-b from-slate-800 to-black'
                                          : 'border-amber-100/35 bg-gradient-to-b from-zinc-100 to-amber-100 text-slate-950'
                                }`}
                            >
                                <div className={`flex justify-center ${isHandheld ? 'mb-1' : 'mb-2'}`}>
                                    <Avatar
                                        userId={seat.participantId}
                                        userName={seatDisplayName}
                                        avatarUrl={avatarUrl || petPortrait || (seat.kind === 'pet' ? '/images/pets/pet1.webp' : null)}
                                        borderUrl={borderUrl}
                                        size={isHandheld ? 32 : 44}
                                    />
                                </div>
                                <div
                                    className={`font-black tracking-widest ${isHandheld ? 'text-[10px]' : 'text-xs'} ${
                                        highlighted ? 'text-amber-100' : isBlack ? 'text-slate-300' : 'text-slate-600'
                                    }`}
                                >
                                    {seatLabel[slotSeat.seatId] ?? slotSeat.seatId}
                                </div>
                                <div className={`truncate font-black ${isHandheld ? 'mt-1 text-[11px]' : 'mt-2 text-sm'}`} title={seatDisplayName}>
                                    {seatDisplayName}
                                </div>
                                <div
                                    className={`font-semibold ${isHandheld ? 'mt-0.5 text-[9px]' : 'mt-1 text-[11px]'} ${
                                        highlighted ? 'text-amber-100/90' : isBlack ? 'text-fuchsia-200/80' : 'text-fuchsia-800/80'
                                    }`}
                                >
                                    {seat.kind === 'user' ? '대국자' : seat.kind === 'pet' ? '펫 AI' : 'AI'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div
                className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex flex-col items-center gap-1.5 border-t border-white/10 bg-gradient-to-t from-slate-950/98 via-slate-950/92 to-transparent px-2 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-2 sm:gap-2 sm:px-3 sm:pb-3 sm:pt-3`}
            >
                {isHumanSeat ? (
                    <Button
                        colorScheme="none"
                        disabled={hasConfirmed || !rouletteDone}
                        onClick={() => onAction({ type: 'CONFIRM_COLOR_START', payload: { gameId: session.id } })}
                        className={`!rounded-full !border !border-fuchsia-300/50 !bg-gradient-to-r !from-fuchsia-600 !to-indigo-600 !font-black !text-white hover:!from-fuchsia-500 hover:!to-indigo-500 disabled:!opacity-55 ${
                            isHandheld ? '!px-6 !py-2 !text-[12px]' : '!px-8 !py-2.5'
                        }`}
                    >
                        {hasConfirmed ? '확인 완료' : rouletteDone ? '경기 시작 확인' : '순서 결정 중'}
                    </Button>
                ) : (
                    <p className={`text-slate-400 ${isHandheld ? 'text-[11px]' : 'text-sm'}`}>대국자 확인을 기다리는 중입니다.</p>
                )}
                <p className={`text-slate-500 ${isHandheld ? 'text-[10px]' : 'text-xs'}`}>
                    {Object.values(confirmations).filter(Boolean).length} / {Object.keys(confirmations).length} 확인
                </p>
            </div>
        </DraggableWindow>
    );
};

export default PairTurnOrderModal;
