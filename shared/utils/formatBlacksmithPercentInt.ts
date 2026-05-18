/** 대장간 UI·확률 표기: % 값은 항상 정수로 표시 */
export function formatBlacksmithPercentInt(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return String(Math.round(value));
}
