import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCooldownRemainingSeconds } from '../../hooks/useCooldownRemainingSeconds.js';

type PairLobbyProposalCooldownButtonProps = {
    cooldownUntilMs?: number;
    disabled: boolean;
    title?: string;
    onClick: () => void;
    className: string;
    children: React.ReactNode;
};

/** 변경 제안 버튼 — 쿨다운 카운트다운은 이 컴포넌트 내부에서만 틱 */
const PairLobbyProposalCooldownButton: React.FC<PairLobbyProposalCooldownButtonProps> = ({
    cooldownUntilMs,
    disabled,
    title,
    onClick,
    className,
    children,
}) => {
    const { t } = useTranslation('lobby');
    const cooldownSeconds = useCooldownRemainingSeconds(cooldownUntilMs);
    const onCooldown = cooldownSeconds > 0;
    const resolvedTitle = onCooldown ? t('alerts.proposalCooldown', { seconds: cooldownSeconds }) : title;

    return (
        <button
            type="button"
            disabled={disabled || onCooldown}
            title={resolvedTitle}
            onClick={onClick}
            className={className}
        >
            {children}
        </button>
    );
};

export default PairLobbyProposalCooldownButton;
