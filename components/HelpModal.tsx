import React from 'react';
import { GameMode } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { GAME_RULES } from '../gameRules.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';

interface HelpModalProps {
    mode: GameMode | 'strategic' | 'playful' | 'guild';
    onClose: () => void;
}

const STRATEGIC_LOBBY_HELP = {
    title: '전략바둑',
    sections: [
        {
            subtitle: '전략바둑 개요',
            content: [
                '전략바둑은 전통적인 바둑 규칙을 기반으로 한 다양한 변형 게임 모드들입니다.',
                '각 모드마다 고유한 규칙과 전략이 있어 깊이 있는 게임플레이를 즐길 수 있습니다.',
            ],
        },
        {
            subtitle: '게임 모드 종류',
            content: [
                '정통 바둑: 가장 기본적인 바둑으로, 더 많은 집을 차지하여 승리합니다.',
                '따내기 바둑: 정해진 개수의 돌을 먼저 따내면 승리합니다.',
                '스피드 바둑: 피셔 방식 시간제를 사용하며, 남은 시간으로 보너스 점수를 얻습니다.',
                '베이스 바둑: 비밀리에 베이스돌을 배치하고 입찰을 통해 흑백을 결정합니다.',
                '히든 바둑: 상대에게 보이지 않는 히든돌을 사용하는 심리전 바둑입니다.',
                '미사일 바둑: 미사일 아이템으로 돌을 이동시켜 전략적인 행마를 구사합니다.',
                '믹스룰 바둑: 여러 규칙을 조합하여 플레이하는 복합 모드입니다.',
            ],
        },
        {
            subtitle: '대기실 이용 방법',
            content: [
                '대기실에서 다른 플레이어와 대국을 신청하거나, AI 봇과 연습할 수 있습니다.',
                '진행 중인 게임 목록을 확인하고 관전할 수 있습니다.',
                '채팅을 통해 다른 플레이어와 소통할 수 있습니다.',
                '랭킹 보드를 통해 자신의 순위와 전적을 확인할 수 있습니다.',
            ],
        },
        {
            subtitle: '게임 신청 방법',
            content: [
                '플레이어 목록에서 원하는 상대를 선택하고 대국 신청을 보냅니다.',
                '상대가 수락하면 게임이 시작됩니다.',
                'AI 봇과의 연습 게임도 가능합니다.',
            ],
        },
    ],
};

const GUILD_HELP = {
    title: '길드',
    sections: [
        {
            subtitle: '길드 개요',
            content: [
                '길드는 플레이어들이 함께 모여 협력하는 커뮤니티입니다.',
                '길드원들과 함께 보스전, 전쟁, 미션 등을 통해 길드를 성장시킬 수 있습니다.',
                '길드 레벨이 올라갈수록 더 많은 혜택을 받을 수 있습니다.',
            ],
        },
        {
            subtitle: '길드 기부',
            content: [
                '골드 또는 다이아몬드를 기부하여 길드 코인과 연구 포인트를 획득할 수 있습니다.',
                '기부를 통해 길드 경험치와 기여도를 올릴 수 있습니다.',
                '일일 기부 한도가 있으며, 매일 초기화됩니다.',
            ],
        },
        {
            subtitle: '길드 보스전',
            content: [
                '주간 보스전에 참여하여 피해량을 기록하고 보상을 받을 수 있습니다.',
                '보스는 매주 월요일 0시(한국시간)에 교체됩니다.',
                '연구소 스킬을 통해 보스전에서 더 강력한 효과를 발휘할 수 있습니다.',
            ],
        },
        {
            subtitle: '길드 전쟁',
            content: [
                '다른 길드와 전쟁을 통해 영토를 점령하고 보상을 받을 수 있습니다.',
                '점령률에 따라 승패가 결정됩니다.',
                '전쟁 기간 동안 길드원들이 협력하여 최선의 결과를 만들어야 합니다.',
            ],
        },
        {
            subtitle: '길드 연구소',
            content: [
                '연구 포인트를 사용하여 다양한 연구를 진행할 수 있습니다.',
                '연구를 통해 길드원들의 능력치를 향상시키거나 보스전에서 유리한 효과를 얻을 수 있습니다.',
                '연구는 시간이 소요되며, 완료되면 즉시 적용됩니다.',
            ],
        },
        {
            subtitle: '길드 미션',
            content: [
                '길드 미션을 완료하여 개인 보상과 길드 보상을 받을 수 있습니다.',
                '미션은 주기적으로 갱신되며, 다양한 목표를 달성해야 합니다.',
                '길드원들이 함께 미션을 완료하면 더 큰 보상을 받을 수 있습니다.',
            ],
        },
    ],
};

const PLAYFUL_LOBBY_HELP = {
    title: '놀이바둑',
    sections: [
        {
            subtitle: '놀이바둑 개요',
            content: [
                '놀이바둑은 바둑의 기본 규칙을 활용한 재미있고 다양한 변형 게임 모드들입니다.',
                '전략바둑보다 더 경쾌하고 재미있는 게임플레이를 제공합니다.',
            ],
        },
        {
            subtitle: '게임 모드 종류',
            content: [
                '주사위 바둑: 주사위를 굴려 나온 수만큼 돌을 놓아 백돌을 따내는 라운드제 게임입니다.',
                '도둑과 경찰: 도둑과 경찰 역할을 번갈아 맡으며 점수를 획득하는 게임입니다.',
                '알까기: 상대의 돌을 바둑판 밖으로 쳐내는 액션 게임입니다.',
                '바둑 컬링: 컬링의 규칙을 바둑판에 적용한 정확도와 전략이 중요한 게임입니다.',
            ],
        },
        {
            subtitle: '대기실 이용 방법',
            content: [
                '대기실에서 다른 플레이어와 대국을 신청하거나, AI 봇과 연습할 수 있습니다.',
                '진행 중인 게임 목록을 확인하고 관전할 수 있습니다.',
                '채팅을 통해 다른 플레이어와 소통할 수 있습니다.',
                '랭킹 보드를 통해 자신의 순위와 전적을 확인할 수 있습니다.',
            ],
        },
        {
            subtitle: '게임 신청 방법',
            content: [
                '플레이어 목록에서 원하는 상대를 선택하고 대국 신청을 보냅니다.',
                '상대가 수락하면 게임이 시작됩니다.',
                'AI 봇과의 연습 게임도 가능합니다.',
            ],
        },
    ],
};

const HelpModal: React.FC<HelpModalProps> = ({ mode, onClose }) => {
    // 길드 도움말인 경우
    if (mode === 'guild') {
        return (
            <DraggableWindow title={`${GUILD_HELP.title} 도움말`} onClose={onClose} windowId={`help-${mode}`} initialWidth={700}>
                <div className="max-h-[70vh] overflow-y-auto pr-2 text-gray-300">
                    <div className="space-y-4">
                        {GUILD_HELP.sections.map((section, index) => (
                            <div key={index} className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                                {index === 0 && <img src="/images/guild/profile/icon1.png" alt="길드" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                {index === 1 && <div className="w-32 h-32 bg-gradient-to-br from-amber-600 to-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <span className="text-4xl">💎</span>
                                </div>}
                                {index === 2 && <img src="/images/guild/button/bossraid1.png" alt="보스전" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                {index === 3 && <img src="/images/guild/button/guildwar.png" alt="전쟁" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                {index === 4 && <img src="/images/guild/button/guildlab.png" alt="연구소" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                {index === 5 && <img src="/images/guild/button/guildmission.png" alt="미션" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-yellow-300 mb-2">{section.subtitle}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        {section.content.map((point, i) => (
                                            <li key={i}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DraggableWindow>
        );
    }
    
    // 전략바둑 또는 놀이바둑 대기실인 경우
    if (mode === 'strategic') {
        return (
            <DraggableWindow title={`${STRATEGIC_LOBBY_HELP.title} 대기실 도움말`} onClose={onClose} windowId={`help-${mode}`} initialWidth={700}>
                <div className="max-h-[70vh] overflow-y-auto pr-2 text-gray-300">
                    <div className="space-y-4">
                        {STRATEGIC_LOBBY_HELP.sections.map((section, index) => (
                            <div key={index} className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                                {index === 0 && <img src="/images/bg/strategicbg.png" alt="전략바둑" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                {index === 1 && <div className="flex flex-wrap gap-2 flex-shrink-0 w-32">
                                    {SPECIAL_GAME_MODES.slice(0, 4).map((gm) => (
                                        <img key={gm.mode} src={gm.image} alt={gm.name} className="w-16 h-16 object-cover rounded-lg" />
                                    ))}
                                </div>}
                                {index === 2 && <img src="/images/PlayingArena.png" alt="대기실" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                {index === 3 && <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <span className="text-4xl">👥</span>
                                </div>}
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-yellow-300 mb-2">{section.subtitle}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        {section.content.map((point, i) => (
                                            <li key={i}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                        {/* 각 게임 모드별 상세 설명 추가 */}
                        {SPECIAL_GAME_MODES.map((gameMode) => {
                            const rules = GAME_RULES[gameMode.mode];
                            if (!rules) return null;
                            return (
                                <div key={gameMode.mode} className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <img src={gameMode.image} alt={rules.title} className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-blue-300 mb-2">{rules.title}</h3>
                                        {rules.sections.map((section, idx) => (
                                            <div key={idx} className="mb-3">
                                                <h4 className="font-semibold text-cyan-300 text-sm mb-1">{section.subtitle}</h4>
                                                <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 ml-2">
                                                    {section.content.map((point, i) => (
                                                        <li key={i}>{point}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DraggableWindow>
        );
    }

    if (mode === 'playful') {
        return (
            <DraggableWindow title={`${PLAYFUL_LOBBY_HELP.title} 대기실 도움말`} onClose={onClose} windowId={`help-${mode}`} initialWidth={700}>
                <div className="max-h-[70vh] overflow-y-auto pr-2 text-gray-300">
                    <div className="space-y-4">
                        {PLAYFUL_LOBBY_HELP.sections.map((section, index) => (
                            <div key={index} className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                                {index === 0 && <img src="/images/bg/playfulbg.png" alt="놀이바둑" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                {index === 1 && <div className="flex flex-wrap gap-2 flex-shrink-0 w-32">
                                    {PLAYFUL_GAME_MODES.slice(0, 4).map((gm) => (
                                        <img key={gm.mode} src={gm.image} alt={gm.name} className="w-16 h-16 object-cover rounded-lg" />
                                    ))}
                                </div>}
                                {index === 2 && <img src="/images/PlayingArena.png" alt="대기실" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                                {index === 3 && <div className="w-32 h-32 bg-gradient-to-br from-pink-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <span className="text-4xl">👥</span>
                                </div>}
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-yellow-300 mb-2">{section.subtitle}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        {section.content.map((point, i) => (
                                            <li key={i}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                        {/* 각 게임 모드별 상세 설명 추가 */}
                        {PLAYFUL_GAME_MODES.map((gameMode) => {
                            const rules = GAME_RULES[gameMode.mode];
                            if (!rules) return null;
                            return (
                                <div key={gameMode.mode} className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <img src={gameMode.image} alt={rules.title} className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-purple-300 mb-2">{rules.title}</h3>
                                        {rules.sections.map((section, idx) => (
                                            <div key={idx} className="mb-3">
                                                <h4 className="font-semibold text-pink-300 text-sm mb-1">{section.subtitle}</h4>
                                                <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 ml-2">
                                                    {section.content.map((point, i) => (
                                                        <li key={i}>{point}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DraggableWindow>
        );
    }

    // 일반 게임 모드인 경우
    const rules = GAME_RULES[mode as GameMode];

    if (!rules) {
        return (
            <DraggableWindow title="도움말" onClose={onClose} windowId={`help-${mode}`} initialWidth={500}>
                <p className="text-center text-gray-400">이 게임 모드에 대한 도움말을 찾을 수 없습니다.</p>
            </DraggableWindow>
        );
    }
    
    // 게임 모드 이미지 찾기
    const gameModeImage = SPECIAL_GAME_MODES.find(gm => gm.mode === mode)?.image || 
                          PLAYFUL_GAME_MODES.find(gm => gm.mode === mode)?.image || 
                          '/images/simbols/simbol1.png';

    return (
        <DraggableWindow title={`${rules.title} 게임 방법`} onClose={onClose} windowId={`help-${mode}`} initialWidth={650}>
            <div className="max-h-[70vh] overflow-y-auto pr-2 text-gray-300">
                <div className="space-y-4">
                    {rules.sections.map((section, index) => (
                        <div key={index} className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-lg">
                            {index === 0 && <img src={gameModeImage} alt={rules.title} className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />}
                            <div className="flex-1">
                                <h3 className="font-bold text-lg text-yellow-300 mb-2">{section.subtitle}</h3>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    {section.content.map((point, i) => (
                                        <li key={i}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default HelpModal;