import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from './DraggableWindow.js';
import { TOURNAMENT_LOBBY_IMG } from '../assets.js';

interface ChampionshipHelpModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const ChampionshipHelpModal: React.FC<ChampionshipHelpModalProps> = ({ onClose, isTopmost }) => {
    const { t } = useTranslation('tournament');
    return (
        <DraggableWindow title={t('championship.help.titleKo')} onClose={onClose} windowId="championship-help" initialWidth={700} isTopmost={isTopmost}>
            <div className="max-h-[70vh] overflow-y-auto pr-2 text-gray-300">
                <div className="space-y-4">
                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <img src={TOURNAMENT_LOBBY_IMG} alt={t('championship.help.altChampionship')} className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.help.overview')}</h3>
                            <p className="text-sm mb-2">
                                {t('championship.help.overviewBody1')}
                            </p>
                            <p className="text-sm mb-2">
                                <strong className="text-yellow-400">{t('championship.help.unlockHintRich')}</strong> {t('championship.help.unlockHintBody')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 bg-gray-900/50 p-4 rounded-lg">
                        <img src="/images/championship/Champ1.webp" alt={t('championship.help.neighborhood')} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.help.neighborhood')}</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>골드 획득이 가능한 던전입니다</li>
                                <li>각 단계에서 6명의 플레이어(유저 + 5봇)가 풀리그 방식으로 진행</li>
                                <li>5회차로 나누어 진행, 각 회차마다 다른 상대와 경기</li>
                                <li>승리 횟수에 따라 순위 결정 (1등~6등)</li>
                                <li>순위에 따라 골드 꾸러미 보상 지급</li>
                                <li><strong className="text-yellow-400">{t('championship.help.rankUnlock')}</strong></li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 bg-gray-900/50 p-4 rounded-lg">
                        <img src="/images/championship/Champ2.webp" alt={t('championship.help.national')} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.help.national')}</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>강화석(재료) 획득이 가능한 던전입니다</li>
                                <li>각 단계에서 8명의 플레이어(유저 + 7봇)가 토너먼트 방식으로 진행</li>
                                <li>8강, 4강, 결승으로 진행되며 승리 시 다음 라운드 진출, 패배 시 탈락</li>
                                <li>최종 순위에 따라 재료 상자 보상 지급</li>
                                <li><strong className="text-yellow-400">{t('championship.help.rankUnlock')}</strong></li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 bg-gray-900/50 p-4 rounded-lg">
                        <img src="/images/championship/Champ3.webp" alt={t('championship.help.world')} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.help.world')}</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>장비 상자 및 변경권 획득이 가능한 던전입니다</li>
                                <li>각 단계에서 16명의 플레이어(유저 + 15봇)가 토너먼트 방식으로 진행</li>
                                <li>16강, 8강, 4강, 결승으로 진행되며 승리 시 다음 라운드 진출, 패배 시 탈락</li>
                                <li>최종 순위에 따라 다이아 꾸러미 보상 지급</li>
                                <li><strong className="text-yellow-400">{t('championship.help.rankUnlock')}</strong></li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-yellow-300 mb-2">{t('championship.help.commonFeatures')}</h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <h4 className="font-semibold text-yellow-200 mb-1">{t('championship.help.simulationTitle')}</h4>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>50초 동안 진행, 초반/중반/종반으로 나뉨</li>
                                        <li>초반 능력: 전투력, 사고속도, 집중력</li>
                                        <li>중반 능력: 전투력, 판단력, 집중력, 안정감</li>
                                        <li>종반 능력: 계산력, 안정감, 집중력</li>
                                        <li>5초마다 30% 확률로 랜덤 이벤트 발생</li>
                                        <li>치명타 발생 시 추가 점수 획득</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-yellow-200 mb-1">{t('championship.help.conditionTitle')}</h4>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>각 경기/라운드 전에 40~100 사이의 랜덤 컨디션 부여</li>
                                        <li>실시간 바둑 경기에서는 컨디션에 따라 묘수·실수 경향이 달라집니다</li>
                                        <li>시뮬레이션(50초) 진행 중에는 능력치 수치가 바뀌지 않습니다</li>
                                        <li>컨디션 회복제로 회복 가능 (상점 구매 또는 퀘스트 보상)</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-yellow-200 mb-1">{t('championship.help.rewardsTitle')}</h4>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li><strong className="text-yellow-300">{t('championship.help.baseRewardLine')}</strong> {t('championship.help.baseRewardDesc')}</li>
                                        <li><strong className="text-yellow-300">{t('championship.help.rankRewardLine')}</strong> {t('championship.help.rankRewardDesc')}</li>
                                        <li><strong className="text-yellow-300">{t('championship.help.neighborhoodRewardLine')}</strong> {t('championship.help.neighborhoodRewardDesc')}</li>
                                        <li><strong className="text-yellow-300">{t('championship.help.nationalRewardLine')}</strong> {t('championship.help.nationalRewardDesc')}</li>
                                        <li><strong className="text-yellow-300">{t('championship.help.worldRewardLine')}</strong> {t('championship.help.worldRewardDesc')}</li>
                                        <li><strong className="text-yellow-300">{t('championship.help.dailyScoreLine')}</strong> {t('championship.help.dailyScoreDesc')}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ChampionshipHelpModal;
