// Local grading provider for the Career Simulator preview. It is the ONLY
// module that imports the answer keys, and it is itself loaded with a dynamic
// import() so the keys sit in their own chunk. The production design swaps
// this for server RPCs (start_shift / submit_decision / end_shift) with the
// same shape; nothing in the UI depends on where the keys live.

import { SIM_KEYS } from '../data/sim/keys';
import {
  evaluateTriage, evaluateEngagement, evaluateBoard, resolveStep, choiceMeterEffect,
  activeFlagNotes, effectiveExposure,
} from './simEngine';

const keyFor = (packId) => SIM_KEYS[packId];

export const simProvider = {
  meterEffect: (packId, choice) => choiceMeterEffect(keyFor(packId), choice),
  evaluateTriage: (pack, decisions, opts) => evaluateTriage(pack, keyFor(pack.id), decisions, opts),
  resolveStep: (pack, flags, techniqueId, targetId, state) => resolveStep(pack, keyFor(pack.id), flags, techniqueId, targetId, state),
  evaluateEngagement: (pack, run) => evaluateEngagement(pack, keyFor(pack.id), run),
  evaluateBoard: (pack, flags, credits, input) => evaluateBoard(pack, keyFor(pack.id), flags, credits, input),
  flagNotes: (pack, flags) => activeFlagNotes(keyFor(pack.id), flags),
  exposureFor: (pack, flags, nodeId) => effectiveExposure(keyFor(pack.id), flags, nodeId),
  auditFeedback: (pack, id) => keyFor(pack.id).audit[id],
  boardFeedback: (pack, id) => keyFor(pack.id).board[id],
};
