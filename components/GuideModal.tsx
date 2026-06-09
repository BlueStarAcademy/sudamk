import React from 'react';
import DraggableWindow, { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from './DraggableWindow.js';
import GuidePanelLayout, { type GuideSelection } from './guide/GuidePanelLayout.js';
import type { HelpCategory } from '../shared/constants/helpCenterContent.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';

export type GuideModalProps = {
    title: string;
    windowId: string;
    onClose: () => void;
    isTopmost?: boolean;
    initialSelection?: GuideSelection;
    categoryFilter?: string[];
    extraCategories?: HelpCategory[];
    /** 화면 첫 안내용 — 다시 보지 않기 버튼 */
    showDismissForever?: boolean;
    onDismissForever?: () => void;
    /** PC/모바일 퀵 유틸 인라인 패널 — DraggableWindow 생략 */
    embedded?: boolean;
};

const GuideModal: React.FC<GuideModalProps> = ({
    title,
    windowId,
    onClose,
    isTopmost,
    initialSelection,
    categoryFilter,
    extraCategories,
    showDismissForever = false,
    onDismissForever,
    embedded = false,
}) => {
    const footer =
        showDismissForever && onDismissForever ? (
            <div className="flex w-full flex-col gap-2.5">
                <p className="text-center text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                    「다시 보지 않기」로 닫은 안내는 우측 퀵 메뉴의{' '}
                    <span className="font-semibold text-amber-200/90">도움말</span>에서 언제든 다시 볼 수 있습니다.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                    type="button"
                    className={`${SUDAMR_MODAL_CLOSE_BUTTON_CLASS} text-slate-200`}
                    onClick={() => {
                        onDismissForever();
                        onClose();
                    }}
                >
                    다시 보지 않기
                </button>
                <button
                    type="button"
                    className={`${SUDAMR_MODAL_CLOSE_BUTTON_CLASS} bg-amber-600/40 hover:bg-amber-600/55`}
                    onClick={onClose}
                >
                    확인
                </button>
                </div>
            </div>
        ) : null;

    const body = (
        <GuidePanelLayout
            categoryFilter={categoryFilter}
            extraCategories={extraCategories}
            initialSelection={initialSelection}
            footer={footer}
        />
    );

    if (embedded) {
        return <div className={`${PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS} min-h-0 flex-1`}>{body}</div>;
    }

    return (
        <DraggableWindow
            title={title}
            onClose={onClose}
            windowId={windowId}
            initialWidth={960}
            initialHeight={620}
            isTopmost={isTopmost}
            mobileViewportFit
            headerShowTitle
            bodyPaddingClassName="!p-0"
            bodyScrollable={false}
            bodyNoScroll
            pcViewportMaxHeightCss="min(85vh, 720px)"
            containerExtraClassName="!max-w-[min(96vw,1040px)]"
        >
            {body}
        </DraggableWindow>
    );
};

export default GuideModal;
