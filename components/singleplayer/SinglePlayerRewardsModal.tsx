import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import { SinglePlayerLevel } from '../../types.js';
import SinglePlayerRewardsTable from './SinglePlayerRewardsTable.js';

interface SinglePlayerRewardsModalProps {
    open: boolean;
    onClose: () => void;
    /** 대기실에서 현재 고른 반 — 모달을 열 때 해당 탭이 기본 선택됨 */
    initialClass?: SinglePlayerLevel;
}

const SinglePlayerRewardsModal: React.FC<SinglePlayerRewardsModalProps> = ({ open, onClose, initialClass }) => {
    if (!open) return null;

    return (
        <DraggableWindow
            title="스테이지 클리어 보상표"
            windowId="single-player-rewards-table"
            onClose={onClose}
            initialWidth={760}
            initialHeight={560}
            modal
            closeOnOutsideClick
        >
            <div className="max-h-[min(72vh,520px)] overflow-hidden flex flex-col p-1 sm:p-2 text-on-panel min-h-0">
                <SinglePlayerRewardsTable initialClassWhenModalOpens={initialClass} />
            </div>
        </DraggableWindow>
    );
};

export default SinglePlayerRewardsModal;
