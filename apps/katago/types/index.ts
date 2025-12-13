// KataGo service types
export enum Player {
  None = 0,
  Black = 1,
  White = 2,
}

export type Point = { x: number; y: number; };

export type RecommendedMove = {
  point: Point;
  score: number;
  visits: number;
  winrate: number;
};

export type AnalysisResult = {
  ownership: number[][];
  recommendedMoves: RecommendedMove[];
  blackConfirmed: Point[];
  whiteConfirmed: Point[];
  blackRight: Point[];
  whiteRight: Point[];
  blackLikely: Point[];
  whiteLikely: Point[];
  deadStones: Point[];
};

export type LiveGameSession = {
  id: string;
  settings: {
    boardSize: number;
    komi: number;
    [key: string]: any;
  };
  currentPlayer: Player;
  captures: { [key in Player]: number };
  [key: string]: any;
};

