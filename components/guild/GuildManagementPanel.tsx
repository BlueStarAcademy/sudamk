import React, { useState, useMemo } from 'react';
import { Guild as GuildType, ServerAction, GuildMember, GuildMemberRole } from '../../types/index.js';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';

interface GuildManagementPanelProps {
    guild: GuildType;
    /** 모바일 길드홈 전체 화면: 패딩·타이포 축소 */
    compact?: boolean;
}

const GuildManagementPanel: React.FC<GuildManagementPanelProps> = ({ guild, compact = false }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
    const [announcement, setAnnouncement] = useState(guild.announcement || '');
    const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);

    const [description, setDescription] = useState(guild.description);
    const [isPublic, setIsPublic] = useState(guild.isPublic);
    const [joinType, setJoinType] = useState<'application' | 'free'>(guild.joinType || 'application');
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    const applicantsWithUserData = useMemo(() => {
        // This would ideally fetch user data for applicants, but for now we'll assume we don't have it
        // and just show IDs or a placeholder.
        return guild.applicants?.map((app: any) => {
            const userId = typeof app === 'string' ? app : app.userId;
            return {
                id: userId,
                nickname: `User-${userId.slice(0, 4)}`,
                appliedAt: typeof app === 'string' ? Date.now() : (app.appliedAt || Date.now())
            };
        }) || [];
    }, [guild.applicants]);

    const handleSaveAnnouncement = () => {
        handlers.handleAction({ type: 'GUILD_UPDATE_ANNOUNCEMENT', payload: { guildId: guild.id, announcement } });
        setIsEditingAnnouncement(false);
    };

    const handleSaveProfile = () => {
        handlers.handleAction({ type: 'GUILD_UPDATE_PROFILE', payload: { guildId: guild.id, description, isPublic, joinType } });
        setIsEditingProfile(false);
    };

    const handleApplicant = (applicantId: string, accept: boolean) => {
        const type = accept ? 'GUILD_ACCEPT_APPLICANT' : 'GUILD_REJECT_APPLICANT';
        handlers.handleAction({ type, payload: { guildId: guild.id, userId: applicantId, applicantId } });
    };

    return (
        <div
            className={`relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 shadow-2xl backdrop-blur-md ${
                compact ? 'gap-3 p-2' : 'gap-6 p-6'
            }`}
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10"></div>
            <div className="relative z-10 flex h-full flex-col">
                {isEditingProfile && (
                    <DraggableWindow
                        title="길드 정보 수정"
                        onClose={() => setIsEditingProfile(false)}
                        windowId={`guild-profile-edit-${guild.id}`}
                        initialWidth={compact ? 360 : 520}
                        initialHeight={compact ? 480 : 540}
                        mobileViewportFit={compact}
                        mobileViewportMaxHeightVh={92}
                        mobileViewportMaxHeightCss={compact ? '92dvh' : undefined}
                        bodyPaddingClassName={compact ? 'p-2' : 'p-3'}
                    >
                        <div className={`flex min-h-0 flex-col ${compact ? 'gap-2 p-1' : 'gap-4 p-2'}`}>
                            <div>
                                <label className={`block font-semibold text-highlight ${compact ? 'mb-1 text-xs' : 'mb-2 text-sm'}`}>길드 소개</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    maxLength={100}
                                    className={`w-full rounded-lg border-2 border-stone-600/50 bg-gradient-to-br from-stone-800/90 to-neutral-700/90 text-primary transition-all shadow-inner backdrop-blur-sm focus:border-cyan-500/60 focus:outline-none ${
                                        compact ? 'h-20 p-2 text-xs leading-snug' : 'h-24 p-3 text-sm'
                                    }`}
                                />
                            </div>
                            <div className={`flex items-center justify-between rounded-lg border border-stone-600/40 bg-gradient-to-r from-stone-800/60 to-neutral-700/60 ${compact ? 'p-2' : 'p-3'}`}>
                                <label className={`font-semibold text-highlight ${compact ? 'text-xs' : 'text-sm'}`}>공개 설정</label>
                                <ToggleSwitch checked={!!isPublic} onChange={setIsPublic} />
                            </div>
                            <div className={`rounded-lg border border-stone-600/40 bg-gradient-to-r from-stone-800/60 to-neutral-700/60 ${compact ? 'p-2' : 'p-3'}`}>
                                <label className={`block font-semibold text-highlight ${compact ? 'mb-1 text-xs' : 'mb-2 text-sm'}`}>가입 방식</label>
                                <div className={`flex ${compact ? 'gap-2' : 'gap-3'}`}>
                                    <button
                                        onClick={() => setJoinType('application')}
                                        className={`flex-1 rounded-lg font-semibold transition-all ${
                                            joinType === 'application'
                                                ? 'bg-gradient-to-r from-purple-600/90 to-indigo-600/90 text-white shadow-lg'
                                                : 'bg-stone-700/50 text-tertiary hover:bg-stone-700/70'
                                        } ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
                                    >
                                        신청가입
                                    </button>
                                    <button
                                        onClick={() => setJoinType('free')}
                                        className={`flex-1 rounded-lg font-semibold transition-all ${
                                            joinType === 'free'
                                                ? 'bg-gradient-to-r from-green-600/90 to-emerald-600/90 text-white shadow-lg'
                                                : 'bg-stone-700/50 text-tertiary hover:bg-stone-700/70'
                                        } ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
                                    >
                                        자유가입
                                    </button>
                                </div>
                                <p className={`text-tertiary ${compact ? 'mt-1 text-[10px] leading-tight' : 'mt-2 text-xs'}`}>
                                    {joinType === 'application' 
                                        ? '길드장 또는 부길드장이 승인해야 가입됩니다.'
                                        : '빈자리가 있으면 자동으로 가입됩니다.'}
                                </p>
                            </div>
                            <div className={`flex justify-end border-t border-stone-600/50 ${compact ? 'gap-2 pt-2' : 'gap-3 pt-3'}`}>
                                <Button onClick={() => setIsEditingProfile(false)} className={`border-2 border-stone-500/50 bg-gradient-to-r from-stone-700/90 to-neutral-700/90 text-white shadow-lg transition-all hover:shadow-xl ${compact ? '!px-3 !py-1.5 !text-xs' : ''}`}>취소</Button>
                                <Button onClick={handleSaveProfile} className={`border-2 border-green-500/50 bg-gradient-to-r from-green-600/90 to-emerald-600/90 text-white shadow-lg transition-all hover:shadow-xl ${compact ? '!px-3 !py-1.5 !text-xs' : ''}`}>저장</Button>
                            </div>
                        </div>
                    </DraggableWindow>
                )}

                <div
                    className={`relative overflow-hidden rounded-xl border-2 border-stone-600/50 bg-gradient-to-br from-stone-800/95 via-neutral-700/90 to-stone-800/95 shadow-2xl backdrop-blur-md ${
                        compact ? 'p-3' : 'p-7'
                    }`}
                >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10"></div>
                    <div className="relative z-10">
                        <div className={`flex items-start justify-between gap-2 ${compact ? 'mb-2' : 'mb-5'}`}>
                            <h3 className={`font-bold text-highlight drop-shadow-lg flex items-center gap-1 ${compact ? 'text-sm' : 'gap-2 text-2xl'}`}>
                                <span className={compact ? 'text-base' : 'text-2xl'}>📢</span>
                                <span>길드 공지</span>
                            </h3>
                            <Button 
                                onClick={() => setIsEditingAnnouncement(!isEditingAnnouncement)} 
                                className={`border-2 border-cyan-500/60 bg-gradient-to-r from-cyan-600/95 via-blue-600/95 to-indigo-600/95 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl ${
                                    compact ? '!px-2 !py-1 !text-[11px]' : 'hover:scale-105 !px-5 !py-2.5 !text-sm'
                                }`}
                            >
                                {isEditingAnnouncement ? '취소' : '편집'}
                            </Button>
                        </div>
                        {isEditingAnnouncement ? (
                            <div className={compact ? 'mt-2' : 'mt-5'}>
                                <textarea 
                                    value={announcement} 
                                    onChange={e => setAnnouncement(e.target.value)} 
                                    maxLength={150} 
                                    className={`w-full rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/95 to-neutral-800/95 text-primary shadow-inner backdrop-blur-md transition-all focus:border-cyan-500/70 focus:outline-none ${
                                        compact ? 'h-24 p-2 text-xs leading-snug' : 'h-36 p-4 text-sm leading-relaxed'
                                    }`}
                                />
                                <Button 
                                    onClick={handleSaveAnnouncement} 
                                    className={`mt-2 w-full border-2 border-green-500/60 bg-gradient-to-r from-green-600/95 via-emerald-600/95 to-teal-600/95 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl ${
                                        compact ? 'py-2 !text-xs' : 'mt-4 py-3 hover:scale-[1.02]'
                                    }`}
                                >
                                    저장
                                </Button>
                            </div>
                        ) : (
                            <div
                                className={`rounded-xl border-2 border-stone-600/50 bg-gradient-to-br from-stone-900/85 to-neutral-800/85 shadow-inner backdrop-blur-sm ${
                                    compact ? 'mt-2 min-h-[4.5rem] p-2' : 'mt-5 min-h-[120px] p-5'
                                }`}
                            >
                                <p className={`whitespace-pre-wrap text-primary drop-shadow-md ${compact ? 'text-xs leading-snug' : 'text-sm leading-relaxed'}`}>{guild.announcement || <span className="text-tertiary italic">등록된 공지사항이 없습니다.</span>}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-stone-600/50 bg-gradient-to-br from-stone-800/95 via-neutral-700/90 to-stone-800/95 shadow-2xl backdrop-blur-md ${
                        compact ? 'p-3' : 'p-7'
                    }`}
                >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10"></div>
                    <div className="relative z-10 flex h-full flex-col">
                        <div className={`flex flex-shrink-0 items-start justify-between gap-2 ${compact ? 'mb-2' : 'mb-5'}`}>
                            <h3 className={`font-bold text-highlight drop-shadow-lg flex items-center gap-1 ${compact ? 'text-sm' : 'gap-2 text-2xl'}`}>
                                <span className={compact ? 'text-base' : 'text-2xl'}>📝</span>
                                <span>가입 신청</span>
                            </h3>
                            <Button 
                                onClick={() => setIsEditingProfile(true)} 
                                className={`border-2 border-purple-500/60 bg-gradient-to-r from-purple-600/95 via-indigo-600/95 to-violet-600/95 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl ${
                                    compact ? '!px-2 !py-1 !text-[11px]' : 'hover:scale-105 !px-5 !py-2.5 !text-sm'
                                }`}
                            >
                                정보 수정
                            </Button>
                        </div>
                        <div className={`min-h-0 flex-grow overflow-y-auto ${compact ? 'pr-1' : 'pr-3'}`}>
                            {applicantsWithUserData.length > 0 ? (
                                <ul className={compact ? 'space-y-2' : 'space-y-4'}>
                                    {applicantsWithUserData.map(applicant => (
                                        <li 
                                            key={applicant.id} 
                                            className={`flex items-center justify-between rounded-xl border-2 border-stone-600/50 bg-gradient-to-r from-stone-800/95 via-neutral-700/90 to-stone-800/95 shadow-xl backdrop-blur-md transition-all duration-200 hover:border-stone-500/70 ${
                                                compact ? 'gap-1 px-2 py-1.5' : 'hover:-translate-y-0.5 hover:scale-[1.01] p-5 hover:shadow-2xl'
                                            }`}
                                        >
                                            <span className={`min-w-0 flex-1 truncate font-bold text-primary drop-shadow-lg ${compact ? 'text-xs' : 'text-lg'}`}>{applicant.nickname}</span>
                                            <div className={`flex shrink-0 ${compact ? 'gap-1' : 'gap-3'}`}>
                                                <Button 
                                                    onClick={() => handleApplicant(applicant.id, true)} 
                                                    className={`border-2 border-green-500/60 bg-gradient-to-r from-green-600/95 via-emerald-600/95 to-teal-600/95 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl ${
                                                        compact ? '!px-2 !py-1 !text-[10px]' : 'hover:scale-105 !px-5 !py-2.5 !text-xs'
                                                    }`}
                                                >
                                                    승인
                                                </Button>
                                                <Button 
                                                    onClick={() => handleApplicant(applicant.id, false)} 
                                                    className={`border-2 border-red-500/60 bg-gradient-to-r from-red-600/95 via-rose-600/95 to-pink-600/95 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl ${
                                                        compact ? '!px-2 !py-1 !text-[10px]' : 'hover:scale-105 !px-5 !py-2.5 !text-xs'
                                                    }`}
                                                >
                                                    거절
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <p
                                        className={`text-center text-tertiary ${
                                            compact
                                                ? 'rounded-lg border border-stone-600/40 bg-gradient-to-br from-stone-900/70 to-neutral-800/70 p-3 text-xs backdrop-blur-md shadow-inner'
                                                : 'rounded-xl border-2 border-stone-600/40 bg-gradient-to-br from-stone-900/70 to-neutral-800/70 p-8 text-sm backdrop-blur-md shadow-inner'
                                        }`}
                                    >
                                        가입 신청이 없습니다.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default GuildManagementPanel;