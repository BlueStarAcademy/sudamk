import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { InventoryItem, ServerAction } from '../../types.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import { MATERIAL_ITEMS } from '../../constants';
import { BLACKSMITH_DISASSEMBLY_JACKPOT_RATES } from '../../constants/rules.js';
import { formatBlacksmithPercentInt } from '../../shared/utils/formatBlacksmithPercentInt.js';
import { getBlacksmithViewerTypography, BLACKSMITH_MOBILE_WORK_ROOT_CLASS } from '../../shared/constants/blacksmithViewerTypography.js';

const MATERIAL_TIERS = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'] as const;

function getMaterialDisplayName(materialName: string): string {
    if (materialName === '신비의 강화석') return '신비 강화석';
    return materialName;
}

type CraftType = 'upgrade' | 'downgrade';

function getAvailableCraftTypes(tierIndex: number): CraftType[] {
    const types: CraftType[] = [];
    if (tierIndex > 0) types.push('downgrade');
    if (tierIndex < MATERIAL_TIERS.length - 1) types.push('upgrade');
    return types;
}

const QUANTITY_BADGE_CLASS =
    'absolute bottom-0 right-0 rounded-tl-md bg-black/60 px-1 py-0.5 text-[9px] font-bold leading-none text-white sm:text-[10px]';

const PANEL_QUANTITY_BADGE_CLASS =
    'absolute bottom-0 right-0 rounded-tl-md bg-black/60 px-1 py-0.5 text-[10px] font-bold leading-none text-white sm:text-xs';

const ConversionCraftSection: React.FC<{
    materialName: string;
    craftType: CraftType;
    inventory: InventoryItem[];
    onAction: (action: ServerAction) => void | Promise<void>;
    pcViewer: boolean;
    mobileWork?: boolean;
    sliderId: string;
    isBlacksmithBusy?: boolean;
}> = ({ materialName, craftType, inventory, onAction, pcViewer, mobileWork = false, sliderId, isBlacksmithBusy = false }) => {
    const { t } = useTranslation('blacksmith');
    const isUpgrade = craftType === 'upgrade';
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork });
    const tierIndex = MATERIAL_TIERS.indexOf(materialName as (typeof MATERIAL_TIERS)[number]);

    if (tierIndex === -1) return null;

    const sourceMaterialName = materialName;
    const targetMaterialName = isUpgrade ? MATERIAL_TIERS[tierIndex + 1] : MATERIAL_TIERS[tierIndex - 1];
    if (!targetMaterialName) return null;

    const sourceTemplate = MATERIAL_ITEMS[sourceMaterialName];
    const targetTemplate = MATERIAL_ITEMS[targetMaterialName];
    const conversionRate = isUpgrade ? 10 : 1;
    const yieldMin = isUpgrade ? 1 : 3;
    const yieldMax = isUpgrade ? 1 : 5;

    const sourceMaterialCount = useMemo(
        () =>
            inventory
                .filter((i) => i.name === sourceMaterialName)
                .reduce((sum, i) => sum + (i.quantity || 0), 0),
        [inventory, sourceMaterialName]
    );

    const maxQuantity = Math.floor(sourceMaterialCount / conversionRate);
    const [quantity, setQuantity] = useState(maxQuantity > 0 ? 1 : 0);

    useEffect(() => {
        const newMaxQuantity = Math.floor(sourceMaterialCount / conversionRate);
        setQuantity((prev) => (newMaxQuantity > 0 ? Math.min(Math.max(prev, 1), newMaxQuantity) : 0));
    }, [sourceMaterialCount, conversionRate, materialName, craftType]);

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setQuantity(Math.max(0, Math.min(maxQuantity, value)));
        } else {
            setQuantity(0);
        }
    };

    const handleConfirm = async () => {
        if (quantity > 0) {
            await onAction({ type: 'CRAFT_MATERIAL', payload: { materialName, craftType, quantity } });
        }
    };

    return (
        <section
            className={`flex h-full min-h-0 flex-col rounded-lg border ${
                isUpgrade ? 'border-cyan-400/25 bg-cyan-950/20' : 'border-slate-500/30 bg-slate-900/25'
            } p-2.5 sm:p-3`}
        >
            <div className="mb-3 shrink-0 text-center">
                <span className={`block font-bold ${isUpgrade ? 'text-cyan-200' : 'text-slate-100'} ${typo.heading}`}>
                    {isUpgrade ? t('convert.combine') : t('convert.disassemble')}
                </span>
            </div>

            <div className="mb-3 flex shrink-0 items-center justify-center gap-2 sm:gap-2.5">
                <div className="relative h-14 w-14 shrink-0 rounded-md border border-black/20 bg-slate-900/50 sm:h-16 sm:w-16">
                    {sourceTemplate?.image && (
                        <img src={sourceTemplate.image} alt={getMaterialDisplayName(sourceMaterialName)} className="h-full w-full object-contain p-1" />
                    )}
                    <span className={PANEL_QUANTITY_BADGE_CLASS}>{sourceMaterialCount.toLocaleString()}</span>
                </div>
                <span className={`shrink-0 text-lg sm:text-xl ${isUpgrade ? 'text-cyan-300/80' : 'text-slate-400'}`}>→</span>
                <div
                    className={`relative h-14 w-14 shrink-0 rounded-md border bg-slate-900/40 sm:h-16 sm:w-16 ${
                        isUpgrade ? 'border-emerald-400/35' : 'border-slate-500/35'
                    }`}
                >
                    {targetTemplate?.image && (
                        <img src={targetTemplate.image} alt={getMaterialDisplayName(targetMaterialName)} className="h-full w-full object-contain p-1" />
                    )}
                </div>
            </div>

            <div className="mt-auto flex min-h-0 flex-1 flex-col justify-end gap-2">
                <p className={`shrink-0 text-center text-secondary ${typo.body}`}>
                    예상{' '}
                    {yieldMin === yieldMax
                        ? t('convert.yieldSingle', { count: (quantity * yieldMin).toLocaleString() })
                        : t('convert.yieldRange', { min: (quantity * yieldMin).toLocaleString(), max: (quantity * yieldMax).toLocaleString() })}
                </p>
                <input
                    id={sliderId}
                    type="range"
                    min="0"
                    max={maxQuantity}
                    value={quantity}
                    onChange={handleQuantityChange}
                    disabled={maxQuantity === 0}
                    className="h-2 w-full shrink-0 appearance-none rounded-full bg-slate-800 accent-cyan-300"
                    aria-label={t('convert.quantityAria', { action: isUpgrade ? t('convert.combine') : t('convert.disassemble') })}
                />
                <div className={`flex shrink-0 justify-between tabular-nums text-slate-300 ${typo.body}`}>
                    <span>
                        {(quantity * conversionRate).toLocaleString()} / {sourceMaterialCount.toLocaleString()}
                    </span>
                    <span>{quantity}회</span>
                </div>
                <ResourceActionButton
                    onClick={handleConfirm}
                    variant={isUpgrade ? 'accent' : 'neutral'}
                    disabled={quantity === 0 || isBlacksmithBusy}
                    className={`!w-full shrink-0 !py-2.5 ${typo.bodySemi}`}
                >
                    {isBlacksmithBusy ? t('convert.processing') : t('convert.timesSuffix', { count: quantity }) + ' ' + (isUpgrade ? t('convert.combine') : t('convert.disassemble'))}
                </ResourceActionButton>
            </div>
        </section>
    );
};

interface ConversionViewProps {
    onAction: (action: ServerAction) => Promise<void>;
    pcViewer?: boolean;
    stackedViewport?: boolean;
    isBlacksmithBusy?: boolean;
}

const ConversionView: React.FC<ConversionViewProps> = ({ onAction, pcViewer = false, stackedViewport = false, isBlacksmithBusy = false }) => {
    const { t } = useTranslation('blacksmith');
    const { currentUserWithStatus } = useAppContext();
    const [selectedMaterialName, setSelectedMaterialName] = useState<string>(MATERIAL_TIERS[0]);

    if (!currentUserWithStatus) return null;

    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork: stackedViewport && !pcViewer });
    const { inventory } = currentUserWithStatus;

    const materialCategories = useMemo(() => {
        const categories: Record<string, InventoryItem[]> = {};
        inventory
            .filter((item) => item.type === 'material')
            .forEach((item) => {
                if (!categories[item.name]) {
                    categories[item.name] = [];
                }
                categories[item.name].push(item);
            });
        return categories;
    }, [inventory]);

    const getMaterialQuantity = (materialName: string) =>
        materialCategories[materialName]?.reduce((sum, item) => sum + (item.quantity || 0), 0) ?? 0;

    const selectedTierIndex = MATERIAL_TIERS.indexOf(selectedMaterialName as (typeof MATERIAL_TIERS)[number]);
    const availableCraftTypes = selectedTierIndex >= 0 ? getAvailableCraftTypes(selectedTierIndex) : [];
    const blacksmithLevel = currentUserWithStatus.blacksmithLevel ?? 1;

    return (
        <div className={`flex h-full min-h-0 w-full flex-col ${stackedViewport ? `${BLACKSMITH_MOBILE_WORK_ROOT_CLASS} min-h-[min(72dvh,100%)]` : ''}`}>
            <div
                className={`flex min-h-0 flex-1 overflow-hidden rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#171c2a]/70 via-[#101522]/88 to-[#0b1018]/92 ${
                    stackedViewport ? 'flex-row gap-1.5 p-1.5' : 'flex-row gap-2 p-2 sm:gap-2.5 sm:p-2.5'
                }`}
            >
                <nav
                    className={`flex h-full w-[4.75rem] shrink-0 flex-col justify-between gap-1 overflow-hidden sm:w-[5.5rem] ${
                        stackedViewport ? 'py-0.5' : 'py-1'
                    }`}
                    aria-label={t('convert.selectMaterialAria')}
                >
                    {MATERIAL_TIERS.map((materialName) => {
                        const quantity = getMaterialQuantity(materialName);
                        const materialData = MATERIAL_ITEMS[materialName];
                        const isSelected = selectedMaterialName === materialName;

                        return (
                            <button
                                key={materialName}
                                type="button"
                                onClick={() => setSelectedMaterialName(materialName)}
                                className={`flex min-h-0 flex-1 flex-col items-center justify-center rounded-md border px-1 py-1 transition ${
                                    isSelected
                                        ? 'border-amber-400/70 bg-gradient-to-b from-amber-900/35 to-slate-900/80 shadow-[0_0_10px_-6px_rgba(251,191,36,0.55)]'
                                        : 'border-white/10 bg-gradient-to-b from-slate-900/80 to-black/55 hover:border-cyan-400/30 hover:bg-slate-800/70'
                                }`}
                                title={getMaterialDisplayName(materialName)}
                            >
                                <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
                                    <img
                                        src={materialData.image as string | undefined}
                                        alt={getMaterialDisplayName(materialName)}
                                        className="max-h-full max-w-full object-contain p-0.5"
                                    />
                                    <span className={QUANTITY_BADGE_CLASS}>{quantity.toLocaleString()}</span>
                                </div>
                            </button>
                        );
                    })}
                </nav>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-[#131722]/90 via-[#0f131d]/95 to-[#0a0d15]/95 p-2 sm:p-2.5">
                    {selectedTierIndex >= 0 && (
                        <>
                            <div className="mb-2 shrink-0 text-center">
                                <h3 className={`font-bold text-amber-100 ${typo.headingLg}`}>{getMaterialDisplayName(selectedMaterialName)}</h3>
                            </div>

                            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 overflow-hidden sm:gap-3">
                                <div className="flex min-h-0 min-w-0 flex-col">
                                    {availableCraftTypes.includes('downgrade') ? (
                                        <ConversionCraftSection
                                            materialName={selectedMaterialName}
                                            craftType="downgrade"
                                            inventory={inventory}
                                            onAction={onAction}
                                            pcViewer={pcViewer}
                                            mobileWork={stackedViewport && !pcViewer}
                                            sliderId={`conversion-downgrade-${selectedMaterialName}`}
                                            isBlacksmithBusy={isBlacksmithBusy}
                                        />
                                    ) : (
                                        <div className={`flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/15 px-2 text-center text-slate-500 ${typo.body}`}>
                                            분해 불가
                                        </div>
                                    )}
                                </div>
                                <div className="flex min-h-0 min-w-0 flex-col">
                                    {availableCraftTypes.includes('upgrade') ? (
                                        <ConversionCraftSection
                                            materialName={selectedMaterialName}
                                            craftType="upgrade"
                                            inventory={inventory}
                                            onAction={onAction}
                                            pcViewer={pcViewer}
                                            mobileWork={stackedViewport && !pcViewer}
                                            sliderId={`conversion-upgrade-${selectedMaterialName}`}
                                            isBlacksmithBusy={isBlacksmithBusy}
                                        />
                                    ) : (
                                        <div className={`flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/15 px-2 text-center text-slate-500 ${typo.body}`}>
                                            합성 불가
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div
                                className={`mt-2.5 shrink-0 rounded-lg border border-cyan-300/20 bg-gradient-to-br from-[#101a2f] via-[#0c1527] to-[#09101d] px-3 py-2 text-center text-cyan-200/90 ${typo.body}`}
                            >
                                대박 확률{' '}
                                <span className="font-semibold text-emerald-300">
                                    {formatBlacksmithPercentInt(BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[Math.max(0, blacksmithLevel - 1)])}%
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConversionView;
