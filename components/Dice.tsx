import React, { useState, useEffect } from 'react';

interface DiceProps {
    value: number | null;
    isRolling: boolean;
    sides?: 6;
    size?: number;
    onClick?: () => void;
    disabled?: boolean;
    displayText?: string;
    color?: 'blue' | 'yellow' | 'gray' | 'luxuryOdd' | 'luxuryEven' | 'luxuryLow' | 'luxuryHigh';
    /** 바깥 컨테이너에 추가 클래스 (예: 주사위 바둑 홀·짝 아이템 고급 스타일) */
    outerClassName?: string;
}

const Dot: React.FC<{ pos: string }> = ({ pos }) => (
    <div className={`w-[22%] h-[22%] bg-black rounded-full absolute ${pos}`}></div>
);

const DiceFace: React.FC<{ value: number }> = ({ value }) => {
    const positions: { [key: number]: string[] } = {
        1: ['top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'],
        2: ['top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2', 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2'],
        3: ['top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2', 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2'],
        4: ['top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2', 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2', 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2', 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2'],
        5: ['top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2', 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2', 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2', 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2'],
        6: ['top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2', 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2', 'top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2', 'top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2', 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2', 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2'],
    };
    return <div className="w-full h-full relative">{positions[value]?.map((pos, i) => <Dot key={i} pos={pos} />)}</div>;
};

const Dice: React.FC<DiceProps> = ({ value, isRolling, sides = 6, size = 60, onClick, disabled = false, displayText, color = 'gray', outerClassName = '' }) => {
    const [displayValue, setDisplayValue] = useState(value || 1);
    const [rollRotation, setRollRotation] = useState({ x: 0, y: 0, z: 0 });
    const isClickable = !disabled && !isRolling && onClick;

    useEffect(() => {
        let intervalId: number | undefined;
        if (isRolling) {
            // 굴림 중에는 실제 룰렛처럼 면과 각도를 계속 바꾼다.
            intervalId = window.setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * sides) + 1);
                setRollRotation((prev) => ({
                    x: prev.x + 55 + Math.floor(Math.random() * 45),
                    y: prev.y + 65 + Math.floor(Math.random() * 55),
                    z: prev.z + 40 + Math.floor(Math.random() * 35),
                }));
            }, 70);
        } else {
            setDisplayValue(value != null && value >= 1 && value <= sides ? value : 1);
            setRollRotation({ x: 0, y: 0, z: 0 });
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isRolling, value, sides]);

    const colorClasses = {
        gray: 'bg-gray-100 hover:bg-white text-black',
        blue: 'bg-blue-400 hover:bg-blue-300 text-white',
        yellow: 'bg-yellow-400 hover:bg-yellow-300 text-black',
        luxuryOdd:
            'border border-cyan-200/55 bg-gradient-to-br from-slate-50 via-cyan-50/95 to-sky-100 text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-10px_20px_rgba(8,47,73,0.06)] hover:border-cyan-300/70 hover:shadow-[0_12px_28px_-8px_rgba(34,211,238,0.35)] hover:brightness-[1.03]',
        luxuryEven:
            'border border-amber-200/60 bg-gradient-to-br from-amber-50 via-yellow-50/95 to-amber-100 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),inset_0_-10px_20px_rgba(146,64,14,0.06)] hover:border-amber-300/75 hover:shadow-[0_12px_28px_-8px_rgba(251,191,36,0.38)] hover:brightness-[1.03]',
        luxuryLow:
            'border border-violet-200/55 bg-gradient-to-br from-slate-50 via-violet-50/95 to-indigo-100 text-violet-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-10px_20px_rgba(91,33,182,0.07)] hover:border-violet-300/70 hover:shadow-[0_12px_28px_-8px_rgba(167,139,250,0.38)] hover:brightness-[1.03]',
        luxuryHigh:
            'border border-rose-200/55 bg-gradient-to-br from-rose-50 via-orange-50/90 to-red-100 text-rose-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-10px_20px_rgba(190,18,60,0.07)] hover:border-rose-300/70 hover:shadow-[0_12px_28px_-8px_rgba(251,113,133,0.38)] hover:brightness-[1.03]',
    };

    return (
        <div
            onClick={isClickable ? onClick : undefined}
            className={`dice-outer flex items-center justify-center rounded-xl p-1
                ${isClickable ? `cursor-pointer hover:shadow-xl hover:-translate-y-0.5 ${colorClasses[color]}` : `${colorClasses[color]}`}
                ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                ${isRolling ? 'dice-rolling-vivid shadow-[0_8px_28px_-6px_rgba(251,191,36,0.55)]' : 'shadow-md transition-all duration-200'}
                ${outerClassName}`.trim()}
            style={{ width: size, height: size }}
        >
            <div
                className="flex h-full w-full items-center justify-center rounded-lg overflow-hidden"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: `perspective(${size * 3}px) rotateX(${rollRotation.x}deg) rotateY(${rollRotation.y}deg) rotateZ(${rollRotation.z}deg)`,
                    transition: isRolling ? 'transform 70ms linear' : 'transform 180ms ease-out',
                }}
            >
                {displayText ? (
                    <span
                        className="select-none font-extrabold text-center leading-tight px-0.5"
                        style={{
                            fontSize:
                                displayText.length <= 2
                                    ? size * 0.42
                                    : displayText.length <= 4
                                      ? size * 0.34
                                      : size * 0.26,
                        }}
                    >
                        {displayText}
                    </span>
                ) : (
                    <DiceFace value={displayValue} />
                )}
            </div>
        </div>
    );
};

export default Dice;
