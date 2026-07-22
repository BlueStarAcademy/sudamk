import React from 'react';
import Button from '../Button.js';
import { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from '../DraggableWindow.js';
import { PRE_GAME_MODAL_ACCENT_BTN_CLASS } from './PreGameDescriptionLayout.js';

type GameResultModalConfirmFooterProps = {
    label: string;
    onConfirm: () => void;
    /** 모바일에서 버튼 최소 높이·글자 크기 보정 */
    isMobile?: boolean;
    disabled?: boolean;
    className?: string;
    /**
     * 확인과 같은 가로 줄에 둘 선행 액션(예: 골드 2배 광고).
     * null이면 확인만 한 줄에 표시.
     */
    leadingAction?: React.ReactNode;
};

/**
 * PVE/PVP 경기 결과 모달 하단 — 확인(=닫기)과 선택적 선행 액션을 한 줄에 배치.
 * `SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS`로 모바일 sticky 분리.
 */
export const GameResultModalConfirmFooter: React.FC<GameResultModalConfirmFooterProps> = ({
    label,
    onConfirm,
    isMobile = false,
    disabled = false,
    className = '',
    leadingAction = null,
}) => (
    <div
        className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex shrink-0 justify-center border-t border-amber-500/25 bg-gradient-to-t from-[#0c0a10] via-[#14111c]/95 to-transparent px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-4 sm:pb-3 sm:pt-2.5 ${className}`}
    >
        <div className="flex w-full max-w-lg flex-row items-stretch justify-center gap-2">
            {leadingAction}
            <Button
                bare
                colorScheme="none"
                type="button"
                disabled={disabled}
                onClick={onConfirm}
                className={`min-w-0 flex-1 px-4 ${PRE_GAME_MODAL_ACCENT_BTN_CLASS} ${
                    isMobile ? '!min-h-[2.75rem] !text-[13px] !font-bold' : ''
                }`}
            >
                {label}
            </Button>
        </div>
    </div>
);

export default GameResultModalConfirmFooter;
