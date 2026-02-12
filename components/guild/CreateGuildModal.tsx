
import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { containsProfanity } from '../../profanity.js';
import { GUILD_CREATION_COST } from '../../constants/index.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';

interface CreateGuildModalProps {
    onClose: () => void;
}

const CreateGuildModal: React.FC<CreateGuildModalProps> = ({ onClose }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true); // 기본값: 공개
    const [joinType, setJoinType] = useState<'application' | 'free'>('free'); // 기본값: 자유가입
    const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

    // 다이아몬드 타입 변환 (BigInt일 수 있음)
    const userDiamonds = currentUserWithStatus 
        ? (typeof currentUserWithStatus.diamonds === 'bigint' 
            ? Number(currentUserWithStatus.diamonds) 
            : (typeof currentUserWithStatus.diamonds === 'number' 
                ? currentUserWithStatus.diamonds 
                : (parseInt(String(currentUserWithStatus.diamonds || 0), 10) || 0)))
        : 0;
    const canAfford = userDiamonds >= GUILD_CREATION_COST;

    const validateName = (value: string) => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            setErrors(prev => ({ ...prev, name: undefined }));
            return;
        }
        if (trimmed.length < 2 || trimmed.length > 6) {
            setErrors(prev => ({ ...prev, name: '길드 이름은 2~6자 사이여야 합니다.' }));
            return;
        }
        if (containsProfanity(trimmed)) {
            setErrors(prev => ({ ...prev, name: '부적절한 단어가 포함되어 있습니다.' }));
            return;
        }
        setErrors(prev => ({ ...prev, name: undefined }));
    };

    const validateDescription = (value: string) => {
        if (value.length > 200) {
            setErrors(prev => ({ ...prev, description: '길드 설명은 200자 이하여야 합니다.' }));
            return;
        }
        if (containsProfanity(value)) {
            setErrors(prev => ({ ...prev, description: '부적절한 단어가 포함되어 있습니다.' }));
            return;
        }
        setErrors(prev => ({ ...prev, description: undefined }));
    };

    const handleCreate = () => {
        const trimmedName = name.trim();
        const trimmedDescription = description.trim();

        // 유효성 검사
        if (trimmedName.length < 2 || trimmedName.length > 6) {
            setErrors({ name: '길드 이름은 2~6자 사이여야 합니다.' });
            return;
        }
        if (containsProfanity(trimmedName)) {
            setErrors({ name: '부적절한 단어가 포함되어 있습니다.' });
            return;
        }
        if (trimmedDescription && trimmedDescription.length > 200) {
            setErrors({ description: '길드 설명은 200자 이하여야 합니다.' });
            return;
        }
        if (trimmedDescription && containsProfanity(trimmedDescription)) {
            setErrors({ description: '부적절한 단어가 포함되어 있습니다.' });
            return;
        }
        if (!canAfford) {
            alert(`다이아가 부족합니다. (필요: ${GUILD_CREATION_COST}개, 보유: ${userDiamonds}개)`);
            return;
        }

        if (window.confirm(`다이아 ${GUILD_CREATION_COST}개를 사용하여 길드를 창설하시겠습니까?`)) {
            handlers.handleAction({ type: 'CREATE_GUILD', payload: { name: trimmedName, description: trimmedDescription, isPublic, joinType } });
            onClose();
        }
    };

    return (
        <DraggableWindow
            title="길드 창설"
            onClose={onClose}
            windowId="create-guild"
            variant="store"
            initialWidth={720}
        >
            <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
                    {/* 왼쪽: 이름 & 소개 */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-cyan-200 mb-1.5">
                                길드 이름 <span className="text-cyan-300/60 font-normal">(2~6자)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="예: 명월길드"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    validateName(e.target.value);
                                }}
                                className={`w-full bg-[#1a2342]/80 px-4 py-2.5 rounded-lg border-2 transition-all ${
                                    errors.name ? 'border-rose-500/60 focus:border-rose-400' : 'border-cyan-300/30 focus:border-cyan-400'
                                } text-cyan-100 placeholder:text-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30`}
                                maxLength={6}
                            />
                            {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name}</p>}
                            {name.trim().length > 0 && !errors.name && <p className="text-xs text-green-400 mt-1">✓ 사용 가능</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-cyan-200 mb-1.5">
                                길드 소개 <span className="text-cyan-300/60 font-normal">(선택, 200자)</span>
                            </label>
                            <textarea
                                placeholder="길드의 목표나 특징을 소개해주세요..."
                                value={description}
                                onChange={(e) => {
                                    setDescription(e.target.value);
                                    validateDescription(e.target.value);
                                }}
                                className={`w-full bg-[#1a2342]/80 px-4 py-2.5 rounded-lg border-2 transition-all resize-none ${
                                    errors.description ? 'border-rose-500/60 focus:border-rose-400' : 'border-cyan-300/30 focus:border-cyan-400'
                                } text-cyan-100 placeholder:text-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30`}
                                maxLength={200}
                                rows={4}
                            />
                            <div className="flex justify-between mt-1">
                                {errors.description && <p className="text-xs text-rose-400">{errors.description}</p>}
                                <p className="text-xs text-cyan-300/60 ml-auto">{description.length}/200</p>
                            </div>
                        </div>
                    </div>

                    {/* 오른쪽: 가입방식, 공개, 비용, 버튼 */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-[#1a2342]/60 rounded-xl p-3.5 border border-cyan-300/20">
                            <label className="block text-sm font-semibold text-cyan-200 mb-2.5">가입 방식</label>
                            <div className="space-y-1.5">
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    joinType === 'free' ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-cyan-300/30 hover:border-cyan-300/50'
                                }`}>
                                    <input type="radio" name="joinType" value="free" checked={joinType === 'free'} onChange={() => setJoinType('free')} className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-sm font-medium text-cyan-100">자유가입</span>
                                </label>
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    joinType === 'application' ? 'border-amber-400/60 bg-amber-500/10' : 'border-cyan-300/30 hover:border-cyan-300/50'
                                }`}>
                                    <input type="radio" name="joinType" value="application" checked={joinType === 'application'} onChange={() => setJoinType('application')} className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-sm font-medium text-cyan-100">신청가입</span>
                                </label>
                            </div>
                            <p className="text-xs text-cyan-300/70 mt-1.5">{joinType === 'free' ? '누구나 즉시 가입' : '길드장 승인 후 가입'}</p>
                        </div>

                        <div className="bg-[#1a2342]/60 rounded-xl p-3.5 border border-cyan-300/20">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-cyan-200">공개 설정</span>
                                <ToggleSwitch checked={isPublic} onChange={setIsPublic} />
                            </div>
                            <p className="text-xs text-cyan-300/70 mt-1">{isPublic ? '길드 목록에 표시' : '초대로만 가입 가능'}</p>
                        </div>

                        <div className="rounded-xl p-3.5 border bg-amber-900/20 border-amber-500/40">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-amber-200">창설 비용</span>
                                <span className="font-bold text-amber-300">{GUILD_CREATION_COST.toLocaleString()} 💎</span>
                            </div>
                            <div className="flex justify-between mt-1.5 text-xs text-amber-200/80">
                                <span>보유</span>
                                <span className={canAfford ? 'text-emerald-400' : 'text-rose-400'}>{userDiamonds.toLocaleString()}</span>
                            </div>
                            {!canAfford && <p className="text-xs text-rose-400 mt-1.5">부족: {(GUILD_CREATION_COST - userDiamonds).toLocaleString()}개</p>}
                        </div>

                        <div className="flex gap-2 mt-auto pt-2">
                            <Button onClick={onClose} colorScheme="gray" className="flex-1 py-2 text-sm font-medium">취소</Button>
                            <Button
                                onClick={handleCreate}
                                colorScheme={canAfford ? 'green' : 'gray'}
                                disabled={!canAfford || name.trim().length < 2 || !!errors.name || !!errors.description}
                                className="flex-1 py-2 text-sm font-medium"
                            >
                                {canAfford ? '길드 창설' : '다이아 부족'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default CreateGuildModal;