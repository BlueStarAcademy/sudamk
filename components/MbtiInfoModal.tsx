import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from './DraggableWindow.js';
import { MBTI_QUESTIONS, calculateMbtiFromAnswers } from '../constants/mbtiQuestions.js';
import { useAppContext } from '../hooks/useAppContext.js';

interface MbtiInfoModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const MBTI_TYPES = ['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ'] as const;

const MbtiInfoModal: React.FC<MbtiInfoModalProps> = ({ onClose, isTopmost }) => {
    const { t } = useTranslation('profile');
    const { currentUser, handlers } = useAppContext();
    const [isSettingMbti, setIsSettingMbti] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [showResult, setShowResult] = useState(false);
    const [calculatedMbti, setCalculatedMbti] = useState<string | null>(null);
    const [hasClaimedReward, setHasClaimedReward] = useState<boolean>(() => !!currentUser?.mbti);

    const hasMbti = useMemo(() => !!currentUser?.mbti, [currentUser]);

    useEffect(() => {
        if (currentUser?.mbti) {
            setHasClaimedReward(true);
        }
    }, [currentUser?.mbti]);

    const handleStartMbtiSetting = () => {
        setIsSettingMbti(true);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setShowResult(false);
        setCalculatedMbti(null);
    };

    const handleAnswer = (questionId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleNextQuestion = async () => {
        if (currentQuestionIndex < MBTI_QUESTIONS.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            const mbti = calculateMbtiFromAnswers(answers, MBTI_QUESTIONS);
            if (!mbti) {
                alert(t('mbtiInfo.answerAll'));
                return;
            }
            setCalculatedMbti(mbti);
            const isFirstTime = !hasMbti && !hasClaimedReward;
            await handlers.handleAction({
                type: 'UPDATE_MBTI',
                payload: { mbti, isMbtiPublic: true, isFirstTime }
            });
            setShowResult(true);
            if (isFirstTime) {
                setHasClaimedReward(true);
            }
            setIsSettingMbti(false);
            console.log('MBTI set:', mbti, 'MBTI reward processed.');
        }
    };

    const currentQuestion = MBTI_QUESTIONS[currentQuestionIndex];

    return (
        <DraggableWindow title={t('mbtiInfo.title')} onClose={onClose} windowId="mbti-info" initialWidth={440} isTopmost={isTopmost}>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
                {!isSettingMbti && !hasMbti && !hasClaimedReward && (
                    <div className="text-center mb-4">
                        <p className="text-lg font-bold text-white mb-2">{t('mbtiInfo.whatIsMbti')}</p>
                        <p className="text-sm text-gray-300 mb-4">
                            {t('mbtiInfo.mbtiExplain1')}
                            {t('mbtiInfo.mbtiExplain2')}
                        </p>
                        <button
                            onClick={handleStartMbtiSetting}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                        >
                            MBTI 설정하기
                        </button>
                        <p className="text-sm text-yellow-400 mt-2">{t('mbtiInfo.completeReward')}</p>
                    </div>
                )}

                {isSettingMbti && !showResult && (
                    <div className="space-y-4">
                        <p className="text-xs text-gray-400">
                            {t('mbtiInfo.questionProgress', { current: currentQuestionIndex + 1, total: MBTI_QUESTIONS.length })}
                        </p>
                        <p className="text-lg font-bold text-white">{currentQuestion.question}</p>
                        <div className="space-y-2">
                            {currentQuestion.options.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => handleAnswer(currentQuestion.id, option.value)}
                                    className={`block w-full text-left p-3 rounded-md transition-colors duration-200
                                        ${answers[currentQuestion.id] === option.value
                                            ? 'bg-blue-700 text-white'
                                            : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                                        }`}
                                >
                                    {option.text}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleNextQuestion}
                                disabled={!answers[currentQuestion.id]}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {currentQuestionIndex < MBTI_QUESTIONS.length - 1 ? t('edit.next', { ns: 'profile' }) : t('mbtiInfo.complete')}
                            </button>
                        </div>
                    </div>
                )}

                {showResult && calculatedMbti && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-white/10 pb-4">
                            <p className="text-xl font-bold text-yellow-300 sm:text-2xl">
                                {t('mbtiInfo.yourMbtiIs', { mbti: calculatedMbti })}
                            </p>
                            <button
                                type="button"
                                onClick={handleStartMbtiSetting}
                                className="shrink-0 whitespace-nowrap rounded-lg bg-purple-600 px-3 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-purple-700"
                            >
                                다시 설정하기
                            </button>
                        </div>
                        <p className="text-center text-lg text-green-400">{t('mbtiInfo.rewardObtained')}</p>
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white transition-colors duration-200 hover:bg-blue-700"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                )}

                {!isSettingMbti && (hasMbti || showResult) && !showResult && (
                    <>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                            <p className="text-lg font-bold text-white">
                                나의 MBTI:{' '}
                                <span className="tabular-nums text-yellow-300">{currentUser?.mbti}</span>
                            </p>
                            <button
                                type="button"
                                onClick={handleStartMbtiSetting}
                                className="shrink-0 whitespace-nowrap rounded-lg bg-purple-600 px-3 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-purple-700"
                            >
                                다시 설정하기
                            </button>
                        </div>
                        <ul className="space-y-2 mt-4">
                            {MBTI_TYPES.map((type) => (
                                <li key={type} className="flex items-center gap-4 bg-gray-900/50 p-2 rounded-md">
                                    <span className="font-bold text-lg text-yellow-300 w-16">{type}</span>
                                    <span className="text-sm text-gray-300">{t(`mbtiInfo.${type.toLowerCase()}Desc`)}</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </DraggableWindow>
    );
};

export default MbtiInfoModal;
