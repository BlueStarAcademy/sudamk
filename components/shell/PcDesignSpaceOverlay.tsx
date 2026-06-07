import React from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    PC_DESIGN_CANVAS_HEIGHT,
    PC_DESIGN_CANVAS_WIDTH,
} from '../../shared/constants/viewportDesign.js';

type PcDesignSpaceOverlayProps = {
    children: React.ReactNode;
    className?: string;
    zIndex?: number;
    onBackdropClick?: () => void;
};

/**
 * PC 설계 캔버스 좌표계 오버레이 — `#sudamr-modal-root`에 포털.
 * 커스텀 모달(레벨업·매너 등)이 vw/dvh 대신 캔버스 scale을 따르도록 함.
 */
const PcDesignSpaceOverlay: React.FC<PcDesignSpaceOverlayProps> = ({
    children,
    className = '',
    zIndex = 65,
    onBackdropClick,
}) => {
    const { modalLayerUsesDesignPixels } = useAppContext();
    const modalRoot =
        typeof document !== 'undefined' ? document.getElementById('sudamr-modal-root') : null;

    const content = (
        <div
            className={`pointer-events-auto fixed inset-0 flex items-center justify-center ${className}`.trim()}
            style={
                modalLayerUsesDesignPixels
                    ? {
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: PC_DESIGN_CANVAS_WIDTH,
                          height: PC_DESIGN_CANVAS_HEIGHT,
                          zIndex,
                      }
                    : { zIndex }
            }
            onClick={onBackdropClick}
            role="presentation"
        >
            <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );

    if (modalLayerUsesDesignPixels && modalRoot) {
        return createPortal(content, modalRoot);
    }

    return createPortal(content, document.body);
};

export default PcDesignSpaceOverlay;
