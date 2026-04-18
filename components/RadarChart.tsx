import React from 'react';
import { CoreStat } from '../types.js';

interface RadarChartDataset {
    stats: Record<string, number>;
    color: string;
    fill: string;
}

interface RadarChartProps {
    datasets: RadarChartDataset[];
    maxStatValue?: number;
    size?: number;
}

const RadarChart: React.FC<RadarChartProps> = ({ datasets, maxStatValue = 200, size = 250 }) => {
    const center = size / 2;
    /** viewBox 바깥으로 라벨·선이 나가도 잘리지 않게 여백 (비율) */
    const viewPad = size * 0.12;
    /** 데이터·축 끝 — 라벨보다 안쪽에 두어 색인이 바깥에 오도록 */
    const R_DATA = center * 0.62;
    const statKeys = Object.values(CoreStat);
    const numAxes = statKeys.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    const getPoint = (value: number, index: number): { x: number; y: number } => {
        const angle = angleSlice * index - Math.PI / 2;
        const radius = (Math.min(value, maxStatValue) / maxStatValue) * R_DATA;
        return {
            x: center + radius * Math.cos(angle),
            y: center + radius * Math.sin(angle),
        };
    };

    const getLabelPoint = (index: number): { x: number; y: number } => {
        const angle = angleSlice * index - Math.PI / 2;
        const radius = R_DATA * 1.26;
        return {
            x: center + radius * Math.cos(angle),
            y: center + radius * Math.sin(angle),
        };
    };

    const axisLines = [];
    const labels = [];
    const gridLines = [];

    /** 큰 차트(능력치 분배 등)에서 색인이 잘 보이도록 size 비례, 상한으로 과도한 확대 방지 */
    const labelFontSize = Math.max(12, Math.min(36, Math.round(size * 0.042)));

    for (let i = 0; i < numAxes; i++) {
        const endPoint = getPoint(maxStatValue, i);
        axisLines.push(
            <line
                key={`axis-${i}`}
                x1={center}
                y1={center}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="1"
            />
        );

        const labelPoint = getLabelPoint(i);
        labels.push(
            <text
                key={`label-${i}`}
                x={labelPoint.x}
                y={labelPoint.y}
                fontSize={labelFontSize}
                fill="rgba(248, 250, 252, 0.95)"
                stroke="rgba(9, 10, 16, 0.92)"
                strokeWidth={Math.max(2.5, labelFontSize * 0.2)}
                paintOrder="stroke fill"
                textAnchor="middle"
                dy=".35em"
                style={{ fontWeight: 600 }}
            >
                {statKeys[i]}
            </text>
        );
    }
    
    for (let i = 1; i <= 4; i++) {
        const percentage = i * 0.25;
        const gridPoints = statKeys.map((_, j) => getPoint(maxStatValue * percentage, j));
        gridLines.push(
            <polygon
                key={`grid-${i}`}
                points={gridPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="0.5"
            />
        );
    }


    return (
        <svg
            viewBox={`${-viewPad} ${-viewPad} ${size + 2 * viewPad} ${size + 2 * viewPad}`}
            width="100%"
            height="100%"
            overflow="visible"
        >
            <g>
                {gridLines}
                {axisLines}
                {labels}
            </g>
            {datasets.map((dataset, i) => {
                const statPoints = statKeys.map((key, j) => getPoint(dataset.stats[key] || 0, j));
                const statPath = statPoints.map(p => `${p.x},${p.y}`).join(' ');

                return (
                    <polygon
                        key={`dataset-${i}`}
                        points={statPath}
                        fill={dataset.fill}
                        stroke={dataset.color}
                        strokeWidth="2"
                    />
                );
            })}
        </svg>
    );
};

export default RadarChart;