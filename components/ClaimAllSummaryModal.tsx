import React from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';

interface ClaimAllSummaryModalProps {
    summary: { gold: number, diamonds: number, actionPoints: number };
    onClose: () => void;
    isTopmost?: boolean;
}

const ClaimAllSummaryModal: React.FC<ClaimAllSummaryModalProps> = ({ summary, onClose, isTopmost }) => {
    return (
        <DraggableWindow title="일괄 수령 결과" onClose={onClose} windowId="claim-all-summary" initialWidth={400} isTopmost={isTopmost}>
            <>
            <div className="text-center">
                <h2 className="text-xl font-bold mb-4">아래 보상을 모두 수령했습니다!</h2>
                <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg text-lg">
                    {summary.gold > 0 && (
                        <div className="flex justify-between items-center gap-3">
                            <img src="/images/icon/Gold.png" alt="" className="h-5 w-5 shrink-0 object-contain" title="골드" />
                            <span className="font-bold text-yellow-300 tabular-nums">+{summary.gold.toLocaleString()}</span>
                        </div>
                    )}
                    {summary.diamonds > 0 && (
                        <div className="flex justify-between items-center gap-3">
                            <img src="/images/icon/Zem.png" alt="" className="h-5 w-5 shrink-0 object-contain" title="다이아" />
                            <span className="font-bold text-cyan-300 tabular-nums">+{summary.diamonds.toLocaleString()}</span>
                        </div>
                    )}
                    {summary.actionPoints > 0 && (
                        <div className="flex justify-between items-center gap-3">
                            <span className="shrink-0 text-lg" title="행동력" aria-hidden>
                                ⚡
                            </span>
                            <span className="font-bold text-green-300 tabular-nums">+{summary.actionPoints.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>
                <div className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} px-1 pt-2`}>
                    <Button onClick={onClose} className="w-full py-2.5">
                        확인
                    </Button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default ClaimAllSummaryModal;