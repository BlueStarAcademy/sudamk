# PVE / PVP bug register

Internal working list for sync/scoring debugging. Mode lobby cull is **out of scope**.

Last updated: 2026-07-31

## Priority

| ID | Pri | Axis | Symptom | Status | Primary files |
|----|-----|------|---------|--------|---------------|
| BR-01 | P0 | PVE | Item phase ends at turn cap but scoring never starts | Fixed | `pveAutoScoringTurnCap.ts`, `standard.ts`, `strategicItemPhaseTick.ts` |
| BR-02 | P0 | PVE | Adventure/guildwar/lobby AI hidden reveal finalize lacks turn-cap hook | Fixed | `towerStyleHiddenRevealAnimating.ts` |
| BR-03 | P0 | Common | WS 100ms throttle drops phase-only updates | Fixed | `hooks/useApp.ts` |
| BR-04 | P1 | Policy | `hiddenRevealPolicy` raw category flags | Fixed | `hiddenRevealPolicy.ts` |
| BR-05 | P1 | Common | Broadcast signature missing AI hidden anim / disconnect / totalTurns | Fixed | `liveGameBroadcastSignature.ts` |
| BR-06 | P1 | Merge | Optimistic merge helpers raw category flags | Fixed | `clientGameMergePolicy.ts` |
| BR-07 | P2 | PVP | PVP unstick without immediate broadcast | Fixed | `gameActions.ts` (item unstick → snapshot) |
| BR-08 | Done | PVE | Tower hidden reveal stale `totalTurns` skipped scoring | Fixed | `towerPlayerHidden.ts`, `pveAutoScoringTurnCap.test.ts` |
| BR-10 | P0 | Common | Scoring GAME_UPDATE omitted board for Kata PVE via `!isSinglePlayer` | Fixed | `boardBroadcastOmit.ts`, `pveAutoScoringTurnCap.ts`, `standard.ts` |
| BR-11 | P0 | Merge | Slim MH-ahead + empty board kept stale board / invisible stone | Fixed | `deferredWsBoardSnapshot.ts`, `clientGameMergePolicy.ts` |
| BR-12 | P0 | PVP | General HTTP unstick missing reveal status + PVP snapshot | Fixed | `gameActions.ts` |

## Repro notes

### BR-01
1. Tower/SP Mix with `autoScoringTurns` even; last stone then missile/scan.
2. Helper returns false while status is item-phase.
3. After → `playing`, no retry → UI shows 0 turns, no 계가.

### BR-02
1. Adventure AI last stone triggers `hidden_reveal_animating` at cap.
2. `tryFinalizeHiddenRevealItemPhase` uses tower-style path **without** `onPostTurnSwitch`.
3. Scoring only if AI is next and `goAiBot-preMove` runs.

### BR-03
1. Status transitions without `moveHistory.length` change within 100ms of prior `GAME_UPDATE`.
2. Client stays on old status (placing/scanning/wrong turn).

## Regression tests to add/extend

- Post-item-phase turn-cap → scoring
- Tower-style reveal without custom hook still enters scoring at cap
- Throttle bypass flags (unit or focused harness if available)
- `hiddenRevealPolicy` via `resolveArenaSessionPolicy`
- Signature includes `aiHiddenItemAnimationEndTime`, disconnect, `totalTurns`
