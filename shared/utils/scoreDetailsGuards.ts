import type { AnalysisResult } from '../types/index.js';

/** 계가 UI에 표시할 수 있는 완전한 scoreDetails인지 (부분 분석·null total 방지) */
export function hasRenderableScoreDetails(analysis: AnalysisResult | null | undefined): boolean {
    const sd = analysis?.scoreDetails;
    if (!sd?.black || !sd?.white) return false;
    const bt = sd.black.total;
    const wt = sd.white.total;
    return Number.isFinite(bt) && Number.isFinite(wt);
}

export function formatScoreDetailNumber(value: unknown, fractionDigits: number): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(fractionDigits);
}
