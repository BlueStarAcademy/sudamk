import React from 'react';
import { createPortal } from 'react-dom';
import Button from '../Button.js';

type Props = {
    gold: number;
    diamonds: number;
    onClose: () => void;
};

/**
 * 신규 온보딩 최종 단계(phase 14) 완료 후 보상 안내.
 */
const OnboardingTutorialCompleteModal: React.FC<Props> = ({ gold, diamonds, onClose }) => {
    const mount = typeof document !== 'undefined' ? document.getElementById('sudamr-modal-root') : null;
    if (!mount) return null;
    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-complete-title"
        >
            <div className="w-full max-w-md rounded-2xl border border-white/18 bg-slate-950/95 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/10 sm:p-6">
                <h2 id="onboarding-complete-title" className="text-center text-lg font-bold text-amber-100 sm:text-xl">
                    튜토리얼 완료
                </h2>
                <p className="mt-3 text-center text-sm leading-relaxed text-stone-200/95 sm:text-[15px]">
                    {gold > 0 || diamonds > 0 ? (
                        <>
                            축하합니다! 보상으로 골드 <span className="font-semibold text-amber-200">{gold}</span>와 다이아{' '}
                            <span className="font-semibold text-cyan-200">{diamonds}</span>를 지급했습니다.
                        </>
                    ) : (
                        <>튜토리얼을 모두 마치셨습니다.</>
                    )}
                </p>
                <div className="mt-5 flex justify-center">
                    <Button type="button" colorScheme="accent" className="min-h-10 px-8 text-sm font-semibold" onClick={onClose}>
                        확인
                    </Button>
                </div>
            </div>
        </div>,
        mount,
    );
};

export default OnboardingTutorialCompleteModal;
