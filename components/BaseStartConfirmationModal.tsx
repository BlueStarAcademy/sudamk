import React from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';

interface BaseStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const startPanelShell =
    'rounded-xl border border-cyan-400/15 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black/90 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_48px_-18px_rgba(0,0,0,0.82),0_0_48px_-20px_rgba(34,211,238,0.1)]';

const BaseStartConfirmationModal: React.FC<BaseStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations, finalKomi } = session;
    const hasConfirmed = preGameConfirmations?.[currentUser.id];

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const blackName = getSessionPlayerDisplayName(session, blackPlayer);
    const whiteName = getSessionPlayerDisplayName(session, whitePlayer);
    const komiLabel = finalKomi != null ? String(finalKomi) : '—';

    return (
        <DraggableWindow
            title="대국 시작"
            windowId="base-start-confirm"
            initialWidth={320}
            shrinkHeightToContent
            modal={false}
            hideFooter
            headerShowTitle
            defaultPosition={{ x: 14, y: 120 }}
            bodyPaddingClassName="p-0"
            bodyNoScroll
            containerExtraClassName="!max-w-[min(100vw,340px)]"
        >
            <div className={`${startPanelShell} space-y-3 px-4 py-4`}>
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-300/85">
                    흑 · 백 · 덤 확정
                </p>
                <div className="space-y-2.5 rounded-lg border border-white/10 bg-black/35 px-3 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                        <span className="shrink-0 text-stone-500">흑</span>
                        <span className="truncate text-right font-bold text-stone-100">{blackName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0 text-stone-500">백</span>
                        <span className="truncate text-right font-bold text-stone-100">{whiteName}</span>
                    </div>
                    <p className="border-t border-white/5 pt-2 text-center text-xs text-cyan-100/90">
                        백 덤 <span className="font-mono font-bold text-amber-200">{komiLabel}</span>집
                    </p>
                </div>
                <p className="text-center text-[11px] leading-relaxed text-stone-500">
                    위와 같이 대국이 진행됩니다. 확인 후 착수를 시작하세요.
                </p>
                <Button
                    onClick={() => onAction({ type: 'CONFIRM_BASE_REVEAL', payload: { gameId } })}
                    disabled={!!hasConfirmed}
                    className="w-full !rounded-xl !border !border-cyan-400/30 !bg-gradient-to-r !from-cyan-900/80 !to-slate-800/90 !py-2.5 !font-bold !text-cyan-50 hover:!from-cyan-800 hover:!to-slate-700 disabled:!opacity-50"
                >
                    {hasConfirmed ? '상대방 확인 대기 중…' : '대국 시작'}
                </Button>
            </div>
        </DraggableWindow>
    );
};

export default BaseStartConfirmationModal;
