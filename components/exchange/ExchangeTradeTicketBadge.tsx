import { useTranslation } from 'react-i18next';
import React from 'react';

type ExchangeTradeTicketBadgeProps = {
    count: number;
    compact?: boolean;
};

/** 거래소 타이틀 옆 거래등록권 보유 수량 */
export const ExchangeTradeTicketBadge: React.FC<ExchangeTradeTicketBadgeProps> = ({ count, compact = false }) => {
    const { t } = useTranslation('exchange');
    return (
    <div
        className={`flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-900/20 font-semibold text-emerald-200 ${
            compact ? 'px-1.5 py-0.5 text-[11px] leading-tight' : 'px-2 py-1 text-xs sm:text-sm'
        }`}
        title={t('labels.tradeTicket')}
    >
        <img
            src="/images/use/allowtrade.webp"
            alt={t('labels.tradeTicket')}
            className={compact ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain'}
        />
        <span className="tabular-nums">{count.toLocaleString()}</span>
    </div>
    );
};

export default ExchangeTradeTicketBadge;
