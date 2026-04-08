
import React from 'react';
// FIX: Corrected import path for types. The path was './../types.js' which pointed to 'components/types.js', but the file is in the root directory.
import { GameProps, GameStatus, Negotiation } from '../../types.js';
import GameSummaryModal from '../GameSummaryModal.js';
import NigiriModal from '../NigiriModal.js';
import CaptureBidModal from '../CaptureBidModal.js';
import CaptureTiebreakerModal from '../CaptureTiebreakerModal.js';
import RPSMinigame from '../RPSMinigame.js';
import ThiefRoleSelection from '../ThiefRoleSelection.js';
import ThiefRoleConfirmedModal from '../ThiefRoleConfirmedModal.js';
import TurnPreferenceSelection from '../TurnPreferenceSelection.js';
import NoContestModal from '../NoContestModal.js';
import ThiefRoundSummary from '../ThiefRoundSummary.js';
import CurlingRoundSummary from '../CurlingRoundSummary.js';
import Button from '../Button.js';
import DiceRoundSummary from '../DiceRoundSummary.js';
import BasePlacementModal from '../BasePlacementModal.js';
import KomiBiddingPanel from '../KomiBiddingPanel.js';
import AlkkagiPlacementModal from '../AlkkagiPlacementModal.js';
import NegotiationModal from '../NegotiationModal.js';
import DiceGoTurnSelectionModal from '../DiceGoTurnSelectionModal.js';
import BaseStartConfirmationModal from '../BaseStartConfirmationModal.js';
import AlkkagiRoundSummary from '../AlkkagiRoundSummary.js';
import DiceGoStartConfirmationModal from '../DiceGoStartConfirmationModal.js';
import CurlingStartConfirmationModal from '../CurlingStartConfirmationModal.js';
import AlkkagiStartConfirmationModal from '../AlkkagiStartConfirmationModal.js';
import SinglePlayerSummaryModal from '../SinglePlayerSummaryModal.js';
import TowerSummaryModal from '../TowerSummaryModal.js';
import AiGameDescriptionModal from '../AiGameDescriptionModal.js';
import ColorStartConfirmationModal from '../ColorStartConfirmationModal.js';

interface GameModalsProps extends GameProps {
    confirmModalType: 'resign' | null;
    onHideConfirmModal: () => void;
    showResultModal: boolean;
    onCloseResults: () => void;
    onOpenGameRecordList?: () => void;
}

const GameModals: React.FC<GameModalsProps> = (props) => {
    const { session, currentUser, onAction, confirmModalType, onHideConfirmModal, showResultModal, onCloseResults, isSpectator, activeNegotiation, onlineUsers, onViewUser, onOpenGameRecordList } = props;
    const { gameStatus, mode, id: gameId } = session;

    const renderModals = () => {
        // AI 봇 대전(대기실의 "AI와 대결하기"로 시작된 일반/로비 AI 경기만):
        // 대국실 입장 시 룰 설명 모달을 먼저 띄우고, "경기 시작" 확인 후 진행
        // (협상(draft) 상태가 남아 activeNegotiation이 잡히더라도, 게임 화면에서는 AI 시작 모달이 우선)
        if (session.isAiGame && gameStatus === 'pending' && !session.isSinglePlayer && session.gameCategory !== 'tower') {
            if (isSpectator) return null;
            return <AiGameDescriptionModal session={session} onAction={onAction} />;
        }

        // 전략바둑 PVP(히든바둑 등) 돌가리기: 게임이 이미 시작된 경우 협상 모달보다 돌가리기 창을 우선 표시
        // (수락 직후 activeNegotiation이 아직 남아 있으면 NegotiationModal이 가려버리는 버그 방지)
        if (!isSpectator && ['nigiri_choosing', 'nigiri_guessing', 'nigiri_reveal'].includes(gameStatus) && session.nigiri) {
            return <NigiriModal session={session} currentUser={currentUser} onAction={onAction} />;
        }

        if (activeNegotiation) {
            return <NegotiationModal negotiation={activeNegotiation} currentUser={currentUser} onAction={onAction} onlineUsers={onlineUsers} />;
        }

        // 싱글플레이: 계가 완료(ended) 후에만 결과 모달 표시. 계가 중(scoring)에는 바둑판 오버레이로 표시
        if (session.isSinglePlayer && showResultModal !== false && (showResultModal || gameStatus === 'ended')) {
            return <SinglePlayerSummaryModal session={session} currentUser={currentUser} onAction={onAction} onClose={onCloseResults} />;
        }

        // 도전의 탑: 계가 완료(ended) 후에만 결과 모달 표시. 계가 중(scoring)에는 바둑판 오버레이로 표시
        if (session.gameCategory === 'tower' && showResultModal !== false && (showResultModal || gameStatus === 'ended')) {
            return <TowerSummaryModal session={session} currentUser={currentUser} onAction={onAction} onClose={onCloseResults} />;
        }
        
        const playerOnlyStates: GameStatus[] = [
            'nigiri_choosing', 'nigiri_guessing',
            'base_placement',
            'komi_bidding',
            'capture_bidding',
            'dice_rps', 'thief_rps', 'alkkagi_rps', 'curling_rps', 'omok_rps', 'ttamok_rps',
            'color_start_confirmation',
            'turn_preference_selection',
            'thief_role_selection',
            'alkkagi_simultaneous_placement',
            'dice_turn_rolling',
            
        ];

        if (isSpectator && playerOnlyStates.includes(gameStatus)) {
            return null;
        }
        
        const rpsStates: GameStatus[] = ['dice_rps', 'dice_rps_reveal', 'thief_rps', 'thief_rps_reveal', 'alkkagi_rps', 'alkkagi_rps_reveal', 'curling_rps', 'curling_rps_reveal', 'omok_rps', 'omok_rps_reveal', 'ttamok_rps', 'ttamok_rps_reveal'];
        
        if (gameStatus === 'dice_turn_rolling' || gameStatus === 'dice_turn_rolling_animating' || gameStatus === 'dice_turn_choice') return <DiceGoTurnSelectionModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'dice_start_confirmation') return <DiceGoStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'color_start_confirmation') return <ColorStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'turn_preference_selection') return <TurnPreferenceSelection session={session} currentUser={currentUser} onAction={onAction} tiebreaker={session.turnSelectionTiebreaker} />;
        if (['nigiri_choosing', 'nigiri_guessing', 'nigiri_reveal'].includes(gameStatus)) return <NigiriModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'capture_bidding') return <CaptureBidModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (['capture_tiebreaker', 'capture_reveal'].includes(gameStatus)) return <CaptureTiebreakerModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'base_placement') return <BasePlacementModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (['komi_bidding', 'komi_bid_reveal'].includes(gameStatus)) return <KomiBiddingPanel session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'base_game_start_confirmation') return <BaseStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (rpsStates.includes(gameStatus)) return <RPSMinigame session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'alkkagi_start_confirmation') return <AlkkagiStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'curling_start_confirmation') return <CurlingStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'thief_role_selection') return <ThiefRoleSelection session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'thief_role_confirmed') return <ThiefRoleConfirmedModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'thief_round_end') return <ThiefRoundSummary session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'curling_round_end') return <CurlingRoundSummary session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'alkkagi_round_end') return <AlkkagiRoundSummary session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'dice_round_end') return <DiceRoundSummary session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === 'alkkagi_simultaneous_placement') return <AlkkagiPlacementModal session={session} currentUser={currentUser} />;
        
        // 게임이 종료되었을 때만 결과 모달 표시
        // scoring 상태일 때는 분석 결과가 준비될 때까지 게임 화면을 유지 (바둑판 초기화 방지)
        // 도전의 탑과 싱글플레이어는 이미 위에서 처리했으므로 제외
        // 확인 버튼을 눌렀을 때 모달이 닫히도록 하기 위해 showResultModal이 명시적으로 false일 때는 모달을 표시하지 않음
        if ((showResultModal !== false && (showResultModal || gameStatus === 'ended' || gameStatus === 'no_contest')) && 
            !session.isSinglePlayer && session.gameCategory !== 'tower') {
            if (gameStatus === 'ended') return (
                <GameSummaryModal
                    session={session}
                    currentUser={currentUser}
                    onConfirm={onCloseResults}
                    onAction={onAction}
                    onOpenGameRecordList={onOpenGameRecordList}
                    isSpectator={isSpectator}
                />
            );
            if (gameStatus === 'no_contest') return (
                <NoContestModal
                    session={session}
                    currentUser={currentUser}
                    onConfirm={onCloseResults}
                    onAction={onAction}
                    onOpenGameRecordList={onOpenGameRecordList}
                    isSpectator={isSpectator}
                />
            );
        }
        return null;
    };

    const confirmModalContent = {
        resign: {
            title: '기권 확인',
            lead: '경기를 포기하시겠습니까?',
            detail: '대국이 즉시 종료되며 기권패로 처리됩니다.',
            confirmText: '기권',
            onConfirm: () => onAction({ type: 'RESIGN_GAME', payload: { gameId } }),
        },
    };

    const content = confirmModalType ? confirmModalContent[confirmModalType] : null;

    return (
        <>
            {renderModals()}
            {content && (
                <div
                    className="absolute inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 pointer-events-auto bg-slate-950/60 backdrop-blur-[8px]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="resign-confirm-title"
                >
                    <div className="sudamr-modal-panel flex w-full max-w-[min(100%,20.5rem)] flex-col overflow-hidden rounded-xl border border-rose-500/20 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_64px_-24px_rgba(0,0,0,0.85),0_0_80px_-40px_rgba(244,63,94,0.18)] ring-1 ring-rose-500/10">
                        <div
                            className="h-px w-full shrink-0 bg-gradient-to-r from-transparent via-rose-400/70 to-transparent"
                            aria-hidden
                        />
                        <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-0 sm:px-5 sm:pt-4">
                            <p className="text-center text-[10px] font-semibold tracking-[0.18em] text-rose-300/90">
                                대국 포기
                            </p>
                            <h2
                                id="resign-confirm-title"
                                className="text-center text-lg font-bold tracking-tight text-primary sm:text-xl"
                            >
                                {content.title}
                            </h2>
                            <p className="text-center text-[15px] font-medium leading-snug text-stone-100/95 sm:text-base">
                                {content.lead}
                            </p>
                        </div>
                        <div className="sudamr-modal-inner-well mx-3.5 mt-2.5 px-3 py-2 sm:mx-4 sm:px-3.5 sm:py-2.5">
                            <p className="text-center text-xs leading-relaxed text-secondary sm:text-[13px]">
                                {content.detail}
                            </p>
                        </div>
                        <div className="mt-3 flex gap-2 border-t border-white/[0.07] bg-gradient-to-b from-black/25 to-black/10 px-3.5 py-3 sm:gap-2.5 sm:px-4 sm:py-3.5">
                            <Button
                                type="button"
                                onClick={onHideConfirmModal}
                                colorScheme="gray"
                                className="min-h-10 flex-1 !border-white/15 !py-2 text-sm font-semibold shadow-none"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    onHideConfirmModal();
                                    content.onConfirm();
                                }}
                                colorScheme="red"
                                className="min-h-10 flex-1 !border-rose-600/50 !py-2 text-sm font-semibold shadow-[0_0_24px_-8px_rgba(244,63,94,0.55)]"
                            >
                                {content.confirmText}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GameModals;
