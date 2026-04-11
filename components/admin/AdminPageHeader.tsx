import React from 'react';
import { adminBackBtn, adminEyebrow, adminHero, adminSubtitle, adminTitle } from './adminChrome.js';

export interface AdminPageHeaderProps {
    title: string;
    subtitle?: string;
    eyebrow?: string;
    onBack: () => void;
    rightSlot?: React.ReactNode;
}

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
    title,
    subtitle,
    eyebrow = 'Admin',
    onBack,
    rightSlot,
}) => (
    <header className={adminHero}>
        <div className="min-w-0 flex-1">
            <p className={adminEyebrow}>{eyebrow}</p>
            <h1 className={adminTitle}>{title}</h1>
            {subtitle ? <p className={adminSubtitle}>{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            {rightSlot}
            <button type="button" onClick={onBack} className={adminBackBtn} aria-label="이전 화면">
                <img src="/images/button/back.png" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
            </button>
        </div>
    </header>
);

export default AdminPageHeader;
