import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../shared/utils/walletAmountDisplay.js';

interface ClaimAllSummaryModalProps {
    summary: { gold: number, diamonds: number, actionPoints: number };
    onClose: () => void;
    isTopmost?: boolean;
}

const ClaimAllSummaryModal: React.FC<ClaimAllSummaryModalProps> = ({ summary, onClose, isTopmost }) => {
    const { t } = useTranslation('inventory');
    return (
        <DraggableWindow title={t('claimAll.title')} onClose={onClose} windowId="claim-all-summary" initialWidth={400} isTopmost={isTopmost}>
            <>
            <div className="text-center">
                <h2 className="text-xl font-bold mb-4">{t('claimAll.allClaimed')}</h2>
                <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg text-lg">
                    {summary.gold > 0 && (
                        <div className="flex justify-between items-center gap-3">
                            <img src="/images/icon/Gold.webp" alt="" className="h-5 w-5 shrink-0 object-contain" title={t('gold', { ns: 'common' })} />
                            <span className="font-bold text-yellow-300 tabular-nums">+{formatGoldAmountKoG(summary.gold)}</span>
                        </div>
                    )}
                    {summary.diamonds > 0 && (
                        <div className="flex justify-between items-center gap-3">
                            <img src="/images/icon/Zem.webp" alt="" className="h-5 w-5 shrink-0 object-contain" title={t('diamonds', { ns: 'common' })} />
                            <span className="font-bold text-cyan-300 tabular-nums">+{formatWalletDiamonds(summary.diamonds)}</span>
                        </div>
                    )}
                    {summary.actionPoints > 0 && (
                        <div className="flex justify-between items-center gap-3">
                            <span className="shrink-0 text-lg" title={t('actionPoints', { ns: 'common' })} aria-hidden>
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