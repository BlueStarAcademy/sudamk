import React from 'react';
import { GameRecord } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import GameRecordViewerPanel from './gameRecord/GameRecordViewerPanel.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';

interface GameRecordViewerModalProps {
    record: GameRecord;
    onClose: () => void;
    isTopmost?: boolean;
    embedded?: boolean;
    /** 모바일 전체 뷰포트: 우측 상단 닫기 + modal 레이아웃 뷰어 */
    mobileFullScreen?: boolean;
}

const MODAL_BOARD_PX = 840;
const SIDEBAR_WIDTH_PX = 280;
const MODAL_PADDING_PX = 48;

const GameRecordViewerModal: React.FC<GameRecordViewerModalProps> = ({
    record,
    onClose,
    isTopmost,
    embedded = false,
    mobileFullScreen = false,
}) => {
    const modalWidth = MODAL_BOARD_PX + SIDEBAR_WIDTH_PX + MODAL_PADDING_PX;
    const modalHeight = MODAL_BOARD_PX + 160 + MODAL_PADDING_PX;

    const body = (
        <GameRecordViewerPanel
            record={record}
            variant={embedded && !mobileFullScreen ? 'inline' : 'modal'}
            fitContainer={mobileFullScreen}
            onClose={mobileFullScreen ? onClose : undefined}
        />
    );

    if (embedded && mobileFullScreen) {
        return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-black px-1 pb-1 sm:px-2 sm:pb-2">
                {body}
            </div>
        );
    }

    if (embedded) {
        return <div className={`${PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS} min-h-0 flex-1`}>{body}</div>;
    }

    return (
        <DraggableWindow
            title={`기보 — ${record.opponent.nickname}`}
            onClose={onClose}
            initialWidth={modalWidth}
            initialHeight={modalHeight}
            windowId="gameRecordViewer"
            isTopmost={isTopmost}
            headerShowTitle
            mobileViewportFit
            mobileLockViewportHeight
            bodyNoScroll
            hideFooter
            skipIngameBoardFrameSizeCap
            viewportPortal
            pcViewportMaxWidthCss="min(calc(100vw - 12px), 1200px)"
            pcViewportMaxHeightCss="calc(100dvh - 10px)"
            mobileViewportMaxHeightCss="calc(100dvh - 10px)"
            mobileViewportDvhBottomGapPx={6}
            bodyPaddingClassName="p-2 sm:p-3"
        >
            {body}
        </DraggableWindow>
    );
};

export default GameRecordViewerModal;
