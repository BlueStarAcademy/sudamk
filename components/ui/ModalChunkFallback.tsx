import React from 'react';
import InlineLoadingSpinner from './InlineLoadingSpinner.js';
import {
    DEFAULT_CHUNK_LOADING_LABEL,
    MODAL_CHUNK_FALLBACK_MIN_HEIGHT,
} from '../../shared/constants/uiFeedback.js';

const ModalChunkFallback: React.FC<{ label?: string }> = ({
    label = DEFAULT_CHUNK_LOADING_LABEL,
}) => (
    <div
        className="flex h-full w-full flex-col items-center justify-center"
        style={{ minHeight: MODAL_CHUNK_FALLBACK_MIN_HEIGHT }}
    >
        <InlineLoadingSpinner label={label} />
    </div>
);

export default ModalChunkFallback;
