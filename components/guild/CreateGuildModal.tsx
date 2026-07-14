
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { containsProfanity } from '../../profanity.js';
import { GUILD_CREATION_COST } from '../../constants/index.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';
import { resourceIcons } from '../resourceIcons.js';

interface CreateGuildModalProps {
    onClose: () => void;
}

const CreateGuildModal: React.FC<CreateGuildModalProps> = ({ onClose }) => {
    const { t } = useTranslation(['guild', 'common']);
    const { handlers, currentUserWithStatus } = useAppContext();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [joinType, setJoinType] = useState<'application' | 'free'>('free');
    const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

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
            setErrors(prev => ({ ...prev, name: t('createModal.errors.nameLength') }));
            return;
        }
        if (containsProfanity(trimmed)) {
            setErrors(prev => ({ ...prev, name: t('createModal.errors.profanity') }));
            return;
        }
        setErrors(prev => ({ ...prev, name: undefined }));
    };

    const validateDescription = (value: string) => {
        if (value.length > 200) {
            setErrors(prev => ({ ...prev, description: t('createModal.errors.descriptionLength') }));
            return;
        }
        if (containsProfanity(value)) {
            setErrors(prev => ({ ...prev, description: t('createModal.errors.profanity') }));
            return;
        }
        setErrors(prev => ({ ...prev, description: undefined }));
    };

    const handleCreate = () => {
        const trimmedName = name.trim();
        const trimmedDescription = description.trim();

        if (trimmedName.length < 2 || trimmedName.length > 6) {
            setErrors({ name: t('createModal.errors.nameLength') });
            return;
        }
        if (containsProfanity(trimmedName)) {
            setErrors({ name: t('createModal.errors.profanity') });
            return;
        }
        if (trimmedDescription && trimmedDescription.length > 200) {
            setErrors({ description: t('createModal.errors.descriptionLength') });
            return;
        }
        if (trimmedDescription && containsProfanity(trimmedDescription)) {
            setErrors({ description: t('createModal.errors.profanity') });
            return;
        }
        if (!canAfford) {
            alert(t('createModal.errors.insufficientDiamonds', { required: GUILD_CREATION_COST, owned: userDiamonds }));
            return;
        }

        if (window.confirm(t('createModal.confirmSpend', { cost: GUILD_CREATION_COST }))) {
            handlers.handleAction({ type: 'CREATE_GUILD', payload: { name: trimmedName, description: trimmedDescription, isPublic, joinType } });
            onClose();
        }
    };

    return (
        <DraggableWindow
            title={t('createModal.title')}
            onClose={onClose}
            windowId="create-guild"
            variant="store"
            initialWidth={720}
        >
            <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-cyan-200 mb-1.5">
                                {t('createModal.nameLabel')} <span className="text-cyan-300/60 font-normal">{t('createModal.nameLengthHint')}</span>
                            </label>
                            <input
                                type="text"
                                placeholder={t('createModal.namePlaceholder')}
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
                            {name.trim().length > 0 && !errors.name && <p className="text-xs text-green-400 mt-1">{t('createModal.nameAvailable')}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-cyan-200 mb-1.5">
                                {t('createModal.descriptionLabel')} <span className="text-cyan-300/60 font-normal">{t('createModal.descriptionOptionalHint')}</span>
                            </label>
                            <textarea
                                placeholder={t('createModal.descriptionPlaceholder')}
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

                    <div className="flex flex-col gap-4">
                        <div className="bg-[#1a2342]/60 rounded-xl p-3.5 border border-cyan-300/20">
                            <label className="block text-sm font-semibold text-cyan-200 mb-2.5">{t('createModal.joinMethod')}</label>
                            <div className="space-y-1.5">
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    joinType === 'free' ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-cyan-300/30 hover:border-cyan-300/50'
                                }`}>
                                    <input type="radio" name="joinType" value="free" checked={joinType === 'free'} onChange={() => setJoinType('free')} className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-sm font-medium text-cyan-100">{t('createModal.freeJoin')}</span>
                                </label>
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    joinType === 'application' ? 'border-amber-400/60 bg-amber-500/10' : 'border-cyan-300/30 hover:border-cyan-300/50'
                                }`}>
                                    <input type="radio" name="joinType" value="application" checked={joinType === 'application'} onChange={() => setJoinType('application')} className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-sm font-medium text-cyan-100">{t('createModal.applicationJoin')}</span>
                                </label>
                            </div>
                            <p className="text-xs text-cyan-300/70 mt-1.5">{joinType === 'free' ? t('createModal.freeJoinHint') : t('createModal.applicationJoinHint')}</p>
                        </div>

                        <div className="bg-[#1a2342]/60 rounded-xl p-3.5 border border-cyan-300/20">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-cyan-200">{t('createModal.publicSetting')}</span>
                                <ToggleSwitch checked={isPublic} onChange={setIsPublic} />
                            </div>
                            <p className="text-xs text-cyan-300/70 mt-1">{isPublic ? t('createModal.publicHint') : t('createModal.privateHint')}</p>
                        </div>

                        <div className="rounded-xl p-3.5 border bg-amber-900/20 border-amber-500/40">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-amber-200">{t('createModal.creationCost')}</span>
                                <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                                    {GUILD_CREATION_COST.toLocaleString()}
                                    <img src={resourceIcons.diamonds} alt="" className="h-4 w-4 object-contain" />
                                </span>
                            </div>
                            <div className="flex justify-between mt-1.5 text-xs text-amber-200/80">
                                <span>{t('createModal.owned')}</span>
                                <span className={canAfford ? 'text-emerald-400' : 'text-rose-400'}>{userDiamonds.toLocaleString()}</span>
                            </div>
                            {!canAfford && <p className="text-xs text-rose-400 mt-1.5">{t('createModal.shortage', { count: (GUILD_CREATION_COST - userDiamonds).toLocaleString() })}</p>}
                        </div>

                        <div className="flex gap-2 mt-auto pt-2">
                            <Button onClick={onClose} colorScheme="gray" className="flex-1 py-2 text-sm font-medium">{t('common:actions.cancel')}</Button>
                            <Button
                                onClick={handleCreate}
                                colorScheme={canAfford ? 'green' : 'gray'}
                                disabled={!canAfford || name.trim().length < 2 || !!errors.name || !!errors.description}
                                className="flex-1 py-2 text-sm font-medium"
                            >
                                {canAfford ? t('createModal.title') : t('createModal.insufficientDiamonds')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default CreateGuildModal;
