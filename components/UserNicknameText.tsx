import React from 'react';
import {
    mergeStaffNicknameDisplayClass,
    type StaffNicknameStyleUser,
} from '../shared/utils/staffNicknameDisplay.js';

type Props = {
    user: StaffNicknameStyleUser;
    className?: string;
    as?: keyof JSX.IntrinsicElements;
    title?: string;
    style?: React.CSSProperties;
};

const UserNicknameText: React.FC<Props> = ({ user, className = '', as: Tag = 'span', title, style }) => {
    const cls = mergeStaffNicknameDisplayClass(user, className);
    return (
        <Tag className={cls} title={title} style={style}>
            {user.nickname}
        </Tag>
    );
};

export default React.memo(UserNicknameText);
