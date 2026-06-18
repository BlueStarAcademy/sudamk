import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GuildDonation } from '../../types/entities.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';
import { MAX_GAME_INTEGER_INPUT } from '../../shared/constants/numericLimits.js';
import { clampDigitsOnlyInputString, clampGameInt } from '../../shared/utils/gameIntegerField.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';

interface GuildDonationPanelProps {
    guildId: string;
    donations: GuildDonation[];
    onDonationsUpdate: (donations: GuildDonation[]) => void;
    onGuildUpdate: () => void;
}

const GuildDonationPanel: React.FC<GuildDonationPanelProps> = ({ guildId, donations, onDonationsUpdate, onGuildUpdate }) => {
    const { t } = useTranslation(['guild', 'common']);
    const { handlers, currentUserWithStatus } = useAppContext();
    const [donationAmount, setDonationAmount] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDonate = async () => {
        const amount = clampGameInt(parseInt(donationAmount, 10) || 0, { min: 1, max: MAX_GAME_INTEGER_INPUT });
        if (!amount || amount <= 0) {
            alert(t('donation.enterAmount'));
            return;
        }

        if (currentUserWithStatus && currentUserWithStatus.gold < amount) {
            alert(t('donation.insufficientGold'));
            return;
        }

        setLoading(true);
        try {
            const result: any = await handlers.handleAction({
                type: 'DONATE_TO_GUILD',
                payload: { amount },
            });
            if (result && !result.error && result.clientResponse?.donation) {
                onDonationsUpdate([result.clientResponse.donation, ...donations]);
                onGuildUpdate();
                setDonationAmount('');
            } else if (result?.error) {
                alert(result.error);
            }
        } catch (error: any) {
            alert(error.message || t('donation.failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">{t('donation.title')}</h2>
            
            <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">{t('donation.donateSection')}</h3>
                <div className="flex gap-2 mb-4">
                    <input
                        type="number"
                        value={donationAmount}
                        onChange={(e) => setDonationAmount(clampDigitsOnlyInputString(e.target.value))}
                        placeholder={t('donation.placeholder')}
                        min={1}
                        max={MAX_GAME_INTEGER_INPUT}
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <Button
                        onClick={handleDonate}
                        colorScheme="green"
                        disabled={loading || !donationAmount}
                        className="!py-2 !px-4"
                    >
                        {t('donation.donate')}
                    </Button>
                </div>
                <p className="text-sm text-gray-400">
                    {t('donation.ownedGold', { amount: formatGoldAmountKoG(currentUserWithStatus?.gold ?? 0) })}
                </p>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t('donation.historySection')}</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {donations.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">{t('donation.noHistory')}</p>
                    ) : (
                        donations.map((donation) => (
                            <div key={donation.id} className="p-3 bg-gray-800/50 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-white">User {donation.userId}</span>
                                    <span className="text-yellow-400 font-semibold">
                                        {t('donation.goldUnit', { amount: donation.amount.toLocaleString() })}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {new Date(donation.createdAt).toLocaleString()}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default GuildDonationPanel;
