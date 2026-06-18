import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from './DraggableWindow.js';

interface SimulationArenaHelpModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const SimulationArenaHelpModal: React.FC<SimulationArenaHelpModalProps> = ({ onClose, isTopmost }) => {
    const { t } = useTranslation('tournament');
    return (
        <DraggableWindow title={t('championship.simulationHelp.title')} onClose={onClose} windowId="simulation-arena-help" initialWidth={700} isTopmost={isTopmost}>
            <div className="max-h-[70vh] overflow-y-auto pr-2 text-gray-300">
                <div className="space-y-4">
                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <img src="/images/PlayingArena.webp" alt={t('championship.simulationHelp.altSimulation')} className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.simulationHelp.overview')}</h3>
                            <p className="text-sm mb-2">
                                {t('championship.simulationHelp.overviewBody')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex flex-col gap-2 flex-shrink-0">
                            <img src="/images/icon/Gold.webp" alt={t('championship.simulationHelp.altGold')} className="w-16 h-16 object-cover rounded-lg" />
                            <img src="/images/materials/materials1.webp" alt={t('championship.simulationHelp.altMaterial')} className="w-16 h-16 object-cover rounded-lg" />
                            <img src="/images/Box/EquipmentBox1.webp" alt={t('championship.simulationHelp.altEquipmentBox')} className="w-16 h-16 object-cover rounded-lg" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.simulationHelp.rewardGuide')}</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li>{t('championship.simulationHelp.rewardNeighborhood')}</li>
                                <li>{t('championship.simulationHelp.rewardNational')}</li>
                                <li>{t('championship.simulationHelp.rewardWorld')}</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <div className="w-32 h-32 bg-gradient-to-br from-green-500 via-yellow-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl font-bold text-white">{t('championship.simulationHelp.fiftySeconds')}</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.simulationHelp.progress')}</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li>{t('championship.simulationHelp.progressOpening')}</li>
                                <li>{t('championship.simulationHelp.progressMidgame')}</li>
                                <li>{t('championship.simulationHelp.progressEndgame')}</li>
                                <li>{t('championship.simulationHelp.progressScoring')}</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex flex-col gap-1 flex-shrink-0 text-xs text-center">
                            <div className="bg-green-600/50 p-2 rounded">{t('championship.simulationHelp.opening')}</div>
                            <div className="bg-yellow-600/50 p-2 rounded">{t('championship.simulationHelp.midgame')}</div>
                            <div className="bg-red-600/50 p-2 rounded">{t('championship.simulationHelp.endgame')}</div>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.simulationHelp.abilityCalc')}</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li>
                                    {t('championship.simulationHelp.openingFormula')}
                                </li>
                                <li>
                                    {t('championship.simulationHelp.midgameFormula')}
                                </li>
                                <li>
                                    {t('championship.simulationHelp.endgameFormula')}
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">🎲</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.simulationHelp.randomEvent')}</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li>{t('championship.simulationHelp.randomEvent1')}</li>
                                <li>{t('championship.simulationHelp.randomEvent2')}</li>
                                <li>{t('championship.simulationHelp.randomEvent3')}</li>
                                <li>{t('championship.simulationHelp.randomEvent4')}</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <div className="w-32 h-32 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-4xl">⚡</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.simulationHelp.critical')}</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li>{t('championship.simulationHelp.critical1')}</li>
                                <li>{t('championship.simulationHelp.critical2')}</li>
                                <li>{t('championship.simulationHelp.critical3')}</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <img src="/images/use/con1.webp" alt={t('championship.simulationHelp.altCondition')} className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.simulationHelp.conditionTitle')}</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li>{t('championship.simulationHelp.condition1')}</li>
                                <li>{t('championship.simulationHelp.condition2')}</li>
                                <li>{t('championship.simulationHelp.condition3')}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SimulationArenaHelpModal;
