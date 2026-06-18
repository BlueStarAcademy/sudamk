import { useTranslation } from 'react-i18next';
import React, { type ReactNode } from 'react';
import {
    MOBILE_MODAL_TITLE_BAR_CLASS,
    MOBILE_MODAL_TITLE_HEADING_CLASS,
    SUDAMR_MODAL_CLOSE_BUTTON_CLASS,
} from '../../shared/constants/mobileModalChrome.js';

type MobileModalTitleBarProps = {
    title: string;
    titleContent?: ReactNode;
    onClose?: () => void;
    headerContent?: ReactNode;
    /** 패널 상단 모서리 — DraggableWindow rounded-t 와 맞춤 */
    topRoundedClass?: string;
    className?: string;
    titleId?: string;
};

const MobileModalTitleBar: React.FC<MobileModalTitleBarProps> = ({
    title,
    titleContent,
    onClose,
    headerContent,
    topRoundedClass = 'rounded-t-xl',
    className,
    titleId,
}) => {
    const { t } = useTranslation('common');
    return (
    <div className={`${MOBILE_MODAL_TITLE_BAR_CLASS} ${topRoundedClass}${className ? ` ${className}` : ''}`}>
        <h2 id={titleId} className={MOBILE_MODAL_TITLE_HEADING_CLASS}>
            {titleContent ?? title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
            {headerContent}
            {onClose ? (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className={`z-30 shrink-0 ${SUDAMR_MODAL_CLOSE_BUTTON_CLASS}`}
                    aria-label={t('modal.closeAria', { title })}
                >
                    닫기
                </button>
            ) : null}
        </div>
    </div>
);
};

export default MobileModalTitleBar;
