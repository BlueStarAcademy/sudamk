import React from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { GameSettings } from '../../types/index.js';
import {
    TIME_LIMITS,
    BYOYOMI_TIMES,
    BYOYOMI_COUNTS,
    FISCHER_INCREMENT_SECONDS_OPTIONS,
    applyByoyomiTimeControl,
    applyFischerTimeControl,
    getFischerTimeLimitOptions,
    resolveTimeControlStyle,
    type MainTimeControlStyle,
} from '../../constants/gameSettings.js';

export function applyTimeControlStyleChange(
    settings: GameSettings,
    style: MainTimeControlStyle,
    isSpeed = false,
): GameSettings {
    return style === 'fischer' ? applyFischerTimeControl(settings, isSpeed) : applyByoyomiTimeControl(settings);
}

type StrategicTimeControlFieldsProps = {
    settings: GameSettings;
    onSettingsChange: (next: GameSettings) => void;
    isSpeed?: boolean;
    disabled?: boolean;
    /** NegotiationModal SettingRow 스타일 */
    variant?: 'negotiation' | 'grid' | 'custom';
    labelClassName?: string;
    selectClassName?: string;
    rowClassName?: string;
    labelStyle?: React.CSSProperties;
    selectStyle?: React.CSSProperties;
};

const NegotiationRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="grid grid-cols-2 gap-4 items-center">
        <label className="text-base font-semibold text-gray-300">{label}</label>
        {children}
    </div>
);

const StrategicTimeControlFields: React.FC<StrategicTimeControlFieldsProps> = ({
    settings,
    onSettingsChange,
    isSpeed = false,
    disabled = false,
    variant = 'negotiation',
    labelClassName = 'text-base font-semibold text-gray-300',
    selectClassName = 'w-full rounded-lg border border-gray-600 bg-gray-700 py-2.5 pl-2.5 pr-9 text-base text-white focus:border-blue-500 focus:ring-blue-500',
    rowClassName,
    labelStyle,
    selectStyle,
}) => {
    const style = resolveTimeControlStyle(settings);
    const timeLimits = style === 'fischer' ? getFischerTimeLimitOptions(isSpeed) : TIME_LIMITS;

    const patch = (partial: Partial<GameSettings>) => onSettingsChange({ ...settings, ...partial });

    const handleStyleChange = (nextStyle: MainTimeControlStyle) => {
        onSettingsChange(applyTimeControlStyleChange(settings, nextStyle, isSpeed));
    };

    const Row = variant === 'negotiation'
        ? NegotiationRow
        : ({ label, children }: { label: string; children: React.ReactNode }) => (
            <div className={rowClassName ?? 'grid min-w-0 grid-cols-[minmax(7.25rem,max-content)_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3'}>
                <label className={labelClassName} style={labelStyle}>{label}</label>
                {children}
            </div>
        );

    return (
        <>
            <Row label={tx("game:strategicTimeControl.timeMode")}>
                <select
                    value={style}
                    onChange={(e) => handleStyleChange(e.target.value as MainTimeControlStyle)}
                    disabled={disabled}
                    className={selectClassName}
                    style={selectStyle}
                >
                    <option value="byoyomi">{tx("game:strategicTimeControl.byoyomiOption")}</option>
                    <option value="fischer">{tx("game:strategicTimeControl.fischerOption")}</option>
                </select>
            </Row>
            <Row label={isSpeed ? tx('game:strategicTimeControl.mainTimeLimit') : tx('game:strategicTimeControl.timeLimit')}>
                <select
                    value={settings.timeLimit}
                    onChange={(e) => patch({ timeLimit: parseInt(e.target.value, 10) })}
                    disabled={disabled}
                    className={selectClassName}
                    style={selectStyle}
                >
                    {timeLimits.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </Row>
            {style === 'byoyomi' ? (
                <Row label={tx("game:strategicTimeControl.byoyomi")}>
                    <div className="flex gap-2">
                        <select
                            value={settings.byoyomiTime}
                            onChange={(e) => patch({ byoyomiTime: parseInt(e.target.value, 10) })}
                            disabled={disabled}
                            className={selectClassName}
                            style={selectStyle}
                        >
                            {BYOYOMI_TIMES.map((t) => (
                                <option key={t} value={t}>
                                    {t}초
                                </option>
                            ))}
                        </select>
                        <select
                            value={settings.byoyomiCount}
                            onChange={(e) => patch({ byoyomiCount: parseInt(e.target.value, 10) })}
                            disabled={disabled}
                            className={selectClassName}
                            style={selectStyle}
                        >
                            {BYOYOMI_COUNTS.map((c) => (
                                <option key={c} value={c}>
                                    {c}회
                                </option>
                            ))}
                        </select>
                    </div>
                </Row>
            ) : (
                <Row label={tx("game:strategicTimeControl.fischerIncrement")}>
                    <select
                        value={settings.timeIncrement ?? 5}
                        onChange={(e) => patch({ timeIncrement: parseInt(e.target.value, 10) })}
                        disabled={disabled}
                        className={selectClassName}
                        style={selectStyle}
                    >
                        {FISCHER_INCREMENT_SECONDS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                                {s}초
                            </option>
                        ))}
                    </select>
                </Row>
            )}
        </>
    );
};

export default StrategicTimeControlFields;
