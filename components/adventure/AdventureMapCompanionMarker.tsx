import React from 'react';
import { useTranslation } from 'react-i18next';
import { PAIR_PET_CATALOG } from '../../shared/constants/petLobby.js';

type Props = {
    templateId: string;
    displayName?: string;
};

/** 탐험 맵 좌하단 동행 펫 마커 (정적 초상 + 약한 bob) */
const AdventureMapCompanionMarker: React.FC<Props> = ({ templateId, displayName }) => {
    const { t } = useTranslation('lobby');
    const def = PAIR_PET_CATALOG.find((p) => p.templateId === templateId);
    const src = def?.image ?? '/images/pets/pet1.webp';
    const label = displayName || def?.displayName || t('adventure.companionPet');

    return (
        <div
            className="pointer-events-none absolute bottom-[6%] left-[6%] z-30 flex flex-col items-center"
            aria-label={label}
        >
            <div className="adventure-map-companion-bob relative flex h-14 w-14 items-end justify-center sm:h-16 sm:w-16">
                <img
                    src={src}
                    alt=""
                    className="max-h-full max-w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                    draggable={false}
                />
            </div>
            <span className="mt-0.5 max-w-[5.5rem] truncate rounded bg-black/55 px-1.5 py-0.5 text-center text-[10px] font-semibold text-amber-100">
                {label}
            </span>
            <style>{`
                @keyframes adventure-companion-bob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .adventure-map-companion-bob {
                    animation: adventure-companion-bob 2.4s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .adventure-map-companion-bob { animation: none; }
                }
            `}</style>
        </div>
    );
};

export default AdventureMapCompanionMarker;
