import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode, GameStatus } from '../types.js';

interface TimeoutFoulModalProps {
    gameMode: GameMode;
    gameStatus: GameStatus;
    onClose: () => void;
}

const TimeoutFoulModal: React.FC<TimeoutFoulModalProps> = ({ gameMode, gameStatus, onClose }) => {
    const { t } = useTranslation('game');

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 4000);

        return () => clearTimeout(timer);
    }, [onClose]);

    const getMessage = () => {
        if (gameMode === GameMode.Alkkagi && gameStatus === 'alkkagi_placement') {
            return t('status.timeoutFoulAlkkagiPlacement');
        }
        switch (gameMode) {
            case GameMode.Dice:
            case GameMode.Thief:
                return t('status.timeoutFoulAutoTurn');
            case GameMode.Alkkagi:
                return t('status.timeoutFoulPassTurn');
            case GameMode.Curling:
                return t('status.timeoutFoulLoseStone');
            default:
                return t('status.timeoutFoulDefault');
        }
    };

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down">
            <div className="bg-red-800 border-2 border-red-500 rounded-lg shadow-2xl p-4 text-white">
                <h2 className="text-xl font-bold text-center mb-2">{t('status.timeoutFoulTitle')}</h2>
                <p className="text-center text-red-200">{getMessage()}</p>
                 <div className="absolute bottom-0 left-0 h-1 bg-red-400 animate-shrink-x"></div>
            </div>
             <style>{`
                @keyframes shrink-x {
                    from { width: 100%; }
                    to { width: 0%; }
                }
                .animate-shrink-x {
                    animation: shrink-x 4s linear forwards;
                }
             `}</style>
        </div>
    );
};

export default TimeoutFoulModal;
