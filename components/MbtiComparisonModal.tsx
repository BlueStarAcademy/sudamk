import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { User } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import DraggableWindow from './DraggableWindow';

interface MbtiComparisonModalProps {
    opponentUser: User;
    onClose: () => void;
    isTopmost?: boolean;
}

type MbtiGoStyle = {
    style: string;
    strengths: string[];
    weaknesses: string[];
    playStyle: string;
};

function getMbtiGoStyle(t: TFunction<'profile'>, mbti: string): MbtiGoStyle | null {
    const data = t(`mbtiComparison.types.${mbti}`, { returnObjects: true, defaultValue: null }) as MbtiGoStyle | string;
    if (!data || typeof data === 'string') return null;
    return data;
}

function analyzeCompatibility(
    t: TFunction<'profile'>,
    myMbti: string | null | undefined,
    opponentMbti: string | null | undefined,
) {
    if (!myMbti || !opponentMbti || myMbti.length !== 4 || opponentMbti.length !== 4) {
        return null;
    }

    const myStyle = getMbtiGoStyle(t, myMbti);
    const opponentStyle = getMbtiGoStyle(t, opponentMbti);

    if (!myStyle || !opponentStyle) {
        return null;
    }

    const differences: string[] = [];
    const similarities: string[] = [];

    if (myMbti[0] !== opponentMbti[0]) {
        differences.push(myMbti[0] === 'E' ? t('mbtiComparison.diffEActive') : t('mbtiComparison.diffIActive'));
    } else {
        similarities.push(myMbti[0] === 'E' ? t('mbtiComparison.simE') : t('mbtiComparison.simI'));
    }

    if (myMbti[1] !== opponentMbti[1]) {
        differences.push(myMbti[1] === 'S' ? t('mbtiComparison.diffSReal') : t('mbtiComparison.diffNReal'));
    } else {
        similarities.push(myMbti[1] === 'S' ? t('mbtiComparison.simS') : t('mbtiComparison.simN'));
    }

    if (myMbti[2] !== opponentMbti[2]) {
        differences.push(myMbti[2] === 'T' ? t('mbtiComparison.diffTLogic') : t('mbtiComparison.diffFLogic'));
    } else {
        similarities.push(myMbti[2] === 'T' ? t('mbtiComparison.simT') : t('mbtiComparison.simF'));
    }

    if (myMbti[3] !== opponentMbti[3]) {
        differences.push(myMbti[3] === 'J' ? t('mbtiComparison.diffJPlan') : t('mbtiComparison.diffPPlan'));
    } else {
        similarities.push(myMbti[3] === 'J' ? t('mbtiComparison.simJ') : t('mbtiComparison.simP'));
    }

    const warnings: string[] = [];
    if (opponentMbti[0] === 'E') warnings.push(t('mbtiComparison.warnE'));
    if (opponentMbti[1] === 'N') warnings.push(t('mbtiComparison.warnN'));
    if (opponentMbti[2] === 'T') warnings.push(t('mbtiComparison.warnT'));
    if (opponentMbti[3] === 'J') warnings.push(t('mbtiComparison.warnJ'));

    const strategies: string[] = [];
    if (opponentMbti[0] === 'I') strategies.push(t('mbtiComparison.stratI'));
    if (opponentMbti[1] === 'S') strategies.push(t('mbtiComparison.stratS'));
    if (opponentMbti[2] === 'F') strategies.push(t('mbtiComparison.stratF'));
    if (opponentMbti[3] === 'P') strategies.push(t('mbtiComparison.stratP'));

    let compatibilityScore = 50;
    const sameCount = [0, 1, 2, 3].filter((i) => myMbti[i] === opponentMbti[i]).length;
    compatibilityScore += sameCount * 10;
    compatibilityScore -= (4 - sameCount) * 5;

    if (myMbti[0] === 'E' && opponentMbti[0] === 'I') compatibilityScore += 5;
    if (myMbti[1] === 'S' && opponentMbti[1] === 'N') compatibilityScore -= 10;
    if (myMbti[2] === 'T' && opponentMbti[2] === 'F') compatibilityScore += 5;
    if (myMbti[3] === 'J' && opponentMbti[3] === 'P') compatibilityScore += 5;

    compatibilityScore = Math.max(0, Math.min(100, compatibilityScore));

    let compatibilityLevel: 'very-good' | 'good' | 'neutral' | 'bad' | 'very-bad';
    let compatibilityText: string;
    if (compatibilityScore >= 80) {
        compatibilityLevel = 'very-good';
        compatibilityText = t('mbtiComparison.compatVeryGood');
    } else if (compatibilityScore >= 60) {
        compatibilityLevel = 'good';
        compatibilityText = t('mbtiComparison.compatGood');
    } else if (compatibilityScore >= 40) {
        compatibilityLevel = 'neutral';
        compatibilityText = t('mbtiComparison.compatNeutral');
    } else if (compatibilityScore >= 20) {
        compatibilityLevel = 'bad';
        compatibilityText = t('mbtiComparison.compatBad');
    } else {
        compatibilityLevel = 'very-bad';
        compatibilityText = t('mbtiComparison.compatVeryBad');
    }

    return {
        myStyle,
        opponentStyle,
        differences,
        similarities,
        warnings,
        strategies,
        compatibilityScore,
        compatibilityLevel,
        compatibilityText,
    };
}

const MbtiComparisonModal: React.FC<MbtiComparisonModalProps> = ({ opponentUser, onClose, isTopmost }) => {
    const { t } = useTranslation('profile');
    const { currentUserWithStatus } = useAppContext();

    const analysis = useMemo(() => {
        return analyzeCompatibility(t, currentUserWithStatus?.mbti, opponentUser.mbti);
    }, [t, currentUserWithStatus?.mbti, opponentUser.mbti]);

    if (opponentUser.mbti && opponentUser.mbti.length === 4 && !currentUserWithStatus?.mbti) {
        const opponentStyle = getMbtiGoStyle(t, opponentUser.mbti);
        if (opponentStyle) {
            return (
                <DraggableWindow title={t('mbtiComparison.opponentAnalysis')} onClose={onClose} windowId="mbti-comparison" initialWidth={500} initialHeight={520} isTopmost={isTopmost}>
                    <div className="p-4 space-y-4">
                        <div className="bg-gray-800/50 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1">{t('mbtiComparison.opponentMbti')}</p>
                            <p className="text-xl font-bold text-red-400">{opponentUser.mbti}</p>
                            <p className="text-sm text-gray-300 mt-1">{opponentStyle.style}</p>
                            <p className="text-xs text-gray-400 mt-1">{opponentStyle.playStyle}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                            <h3 className="text-sm font-bold text-white mb-2">{t('mbtiComparison.opponentReference')}</h3>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-xs font-semibold text-green-300 mb-1">{t('mbtiComparison.strengths')}</p>
                                    <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5">
                                        {opponentStyle.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-red-300 mb-1">{t('mbtiComparison.weaknesses')}</p>
                                    <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5">
                                        {opponentStyle.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 text-center">{t('mbtiComparison.setMbtiHint')}</p>
                        <div className="flex justify-center">
                            <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">{t('actions.ok', { ns: 'common' })}</button>
                        </div>
                    </div>
                </DraggableWindow>
            );
        }
    }

    if (!currentUserWithStatus?.mbti || !opponentUser.mbti) {
        return (
            <DraggableWindow title={t('mbtiComparison.title')} onClose={onClose} windowId="mbti-comparison" initialWidth={500} initialHeight={300} isTopmost={isTopmost}>
                <div className="p-4 text-center">
                    <p className="text-gray-300 mb-4">
                        {!currentUserWithStatus?.mbti && !opponentUser.mbti
                            ? t('mbtiComparison.notSetBoth')
                            : !opponentUser.mbti
                            ? t('mbtiComparison.opponentNotSet')
                            : t('mbtiComparison.cannotLoad')}
                    </p>
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        {t('actions.ok', { ns: 'common' })}
                    </button>
                </div>
            </DraggableWindow>
        );
    }

    if (!analysis) {
        return (
            <DraggableWindow title={t('mbtiComparison.title')} onClose={onClose} windowId="mbti-comparison" initialWidth={500} initialHeight={300} isTopmost={isTopmost}>
                <div className="p-4 text-center">
                    <p className="text-gray-300 mb-4">{t('mbtiComparison.cannotAnalyze')}</p>
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        {t('actions.ok', { ns: 'common' })}
                    </button>
                </div>
            </DraggableWindow>
        );
    }

    const compatibilityColor = {
        'very-good': 'text-green-400',
        good: 'text-green-300',
        neutral: 'text-yellow-300',
        bad: 'text-orange-300',
        'very-bad': 'text-red-400',
    }[analysis.compatibilityLevel];

    const compatibilityBgColor = {
        'very-good': 'bg-green-900/30 border-green-500/50',
        good: 'bg-green-800/30 border-green-400/50',
        neutral: 'bg-yellow-900/30 border-yellow-500/50',
        bad: 'bg-orange-900/30 border-orange-500/50',
        'very-bad': 'bg-red-900/30 border-red-500/50',
    }[analysis.compatibilityLevel];

    return (
        <DraggableWindow title={t('mbtiComparison.goStyleCompareTitle')} onClose={onClose} windowId="mbti-comparison" initialWidth={700} initialHeight={800} isTopmost={isTopmost}>
            <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '750px' }}>
                <div className={`p-4 rounded-lg border-2 ${compatibilityBgColor}`}>
                    <div className="text-center">
                        <p className="text-sm text-gray-400 mb-1">{t('mbtiComparison.compatibilityScoreLabel')}</p>
                        <p className={`text-3xl font-bold ${compatibilityColor} mb-2`}>
                            {t('mbtiComparison.scoreUnit', { score: analysis.compatibilityScore })}
                        </p>
                        <p className={`text-lg font-semibold ${compatibilityColor}`}>{analysis.compatibilityText}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">{t('mbtiComparison.myMbtiLabel')}</p>
                        <p className="text-xl font-bold text-blue-400 mb-2">{currentUserWithStatus.mbti}</p>
                        <p className="text-sm text-gray-300 mb-2">{analysis.myStyle.style}</p>
                        <p className="text-xs text-gray-400">{analysis.myStyle.playStyle}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">{t('mbtiComparison.opponentMbtiShort')}</p>
                        <p className="text-xl font-bold text-red-400 mb-2">{opponentUser.mbti}</p>
                        <p className="text-sm text-gray-300 mb-2">{analysis.opponentStyle.style}</p>
                        <p className="text-xs text-gray-400">{analysis.opponentStyle.playStyle}</p>
                    </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-bold text-white mb-3">{t('mbtiComparison.opponentGoStyleShort')}</h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-sm font-semibold text-green-300 mb-1">{t('mbtiComparison.strengths')}</p>
                            <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
                                {analysis.opponentStyle.strengths.map((strength, idx) => (
                                    <li key={idx}>{strength}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-red-300 mb-1">{t('mbtiComparison.weaknesses')}</p>
                            <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
                                {analysis.opponentStyle.weaknesses.map((weakness, idx) => (
                                    <li key={idx}>{weakness}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {analysis.warnings.length > 0 && (
                    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                        <h3 className="text-lg font-bold text-red-300 mb-3 flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{t('mbtiComparison.watchOut')}</span>
                        </h3>
                        <ul className="space-y-2">
                            {analysis.warnings.map((warning, idx) => (
                                <li key={idx} className="text-sm text-gray-200 flex items-start gap-2">
                                    <span className="text-red-400 mt-0.5">•</span>
                                    <span>{warning}</span>
                                </li>
                            ))}
                        </ul>
                        {analysis.opponentStyle.strengths.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-red-500/30">
                                <p className="text-xs text-gray-400 mb-2">{t('mbtiComparison.watchStrengths')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.opponentStyle.strengths.map((strength, idx) => (
                                        <span key={idx} className="px-2 py-1 bg-red-800/50 rounded text-xs text-red-200">
                                            {strength}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {analysis.strategies.length > 0 && (
                    <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                        <h3 className="text-lg font-bold text-blue-300 mb-3 flex items-center gap-2">
                            <span>💡</span>
                            <span>{t('mbtiComparison.strategyTitle')}</span>
                        </h3>
                        <ul className="space-y-2">
                            {analysis.strategies.map((strategy, idx) => (
                                <li key={idx} className="text-sm text-gray-200 flex items-start gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>{strategy}</span>
                                </li>
                            ))}
                        </ul>
                        {analysis.opponentStyle.weaknesses.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-blue-500/30">
                                <p className="text-xs text-gray-400 mb-2">{t('mbtiComparison.useWeaknessesShort')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.opponentStyle.weaknesses.map((weakness, idx) => (
                                        <span key={idx} className="px-2 py-1 bg-blue-800/50 rounded text-xs text-blue-200">
                                            {weakness}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    {analysis.differences.length > 0 && (
                        <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3">
                            <h3 className="text-sm font-bold text-yellow-300 mb-2">{t('mbtiComparison.differences')}</h3>
                            <ul className="space-y-1">
                                {analysis.differences.map((diff, idx) => (
                                    <li key={idx} className="text-xs text-gray-300">• {diff}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {analysis.similarities.length > 0 && (
                        <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
                            <h3 className="text-sm font-bold text-green-300 mb-2">{t('mbtiComparison.similarities')}</h3>
                            <ul className="space-y-1">
                                {analysis.similarities.map((sim, idx) => (
                                    <li key={idx} className="text-xs text-gray-300">• {sim}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default MbtiComparisonModal;
