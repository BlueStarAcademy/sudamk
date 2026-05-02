import React from 'react';

type Props = {
    /** 방장에게만 표시 */
    visible: boolean;
    disabled?: boolean;
    compact?: boolean;
    onUserDropped: (userId: string) => void;
};

const PAIR_USER_DRAG_MIME = 'text/pair-user-id';

const PairRoomKickDropZone: React.FC<Props> = ({ visible, disabled, compact = false, onUserDropped }) => {
    if (!visible) return null;

    /** 페어 채팅 패널과 동일한 최소 높이에 맞춘 정사각형 */
    const box = compact ? 'h-[8.5rem] w-[8.5rem] shrink-0' : 'h-[11rem] w-[11rem] shrink-0';

    return (
        <div
            className={`flex flex-col items-center justify-center self-center rounded-xl border-2 border-dashed border-rose-400/40 bg-rose-950/15 px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-rose-500/12 ${box}`}
            onDragOver={(e) => {
                if (disabled) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
                if (disabled) return;
                e.preventDefault();
                const id = e.dataTransfer.getData(PAIR_USER_DRAG_MIME);
                if (id) onUserDropped(id);
            }}
        >
            <span className={`font-extrabold uppercase tracking-wide text-rose-200/90 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>강퇴</span>
            <span className={`mt-1 font-semibold leading-tight text-rose-100/75 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
                유저를 여기로
                <br />
                드래그
            </span>
        </div>
    );
};

export default PairRoomKickDropZone;
