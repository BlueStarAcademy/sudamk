/**
 * 믹스룰 하위 규칙 표시용: `따내기 바둑` → `따내기` (끝의 공백+`바둑` 제거)
 */
export function mixSubRuleDisplayName(fullName: string): string {
    return String(fullName ?? '')
        .replace(/\s*바둑\s*$/u, '')
        .trim();
}
