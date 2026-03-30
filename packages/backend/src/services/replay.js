import { getGameState, getScoresByGameId } from '../db/queries.js';
import { isValidUuid } from '../utils/validation.js';

function buildReplayTimeline(state) {
  const playersById = new Map(state.players.map((player) => [player.id, player]));
  const submissionsByWordChainId = new Map(
    state.submissions
      .filter((submission) => submission.word_chain_id)
      .map((submission) => [submission.word_chain_id, submission]),
  );

  return state.wordChains.map((step) => {
    const player = playersById.get(step.player_id);
    const submission = submissionsByWordChainId.get(step.id);

    return {
      stepNumber: step.step_number,
      wordChainId: step.id,
      submissionId: submission?.id || null,
      playerId: step.player_id,
      playerName: player?.name || 'Unknown',
      word: step.word,
      explanation: step.explanation,
      isValid: Boolean(step.is_valid),
      aiScore: Number(step.ai_score ?? 0),
      aiFeedback: step.ai_feedback || '',
      status: submission?.status || (step.is_valid ? 'validated' : 'rejected'),
      submittedAt: step.submitted_at,
      validatedAt: submission?.validated_at || null,
      validationMs: submission?.validation_ms || null,
      providerUsed: submission?.provider_used || null,
    };
  });
}

/**
 * Builds replay payload for one completed or in-progress match.
 * @param {{gameId: string}} payload
 * @returns {Promise<object|null>}
 */
export async function getMatchReplay(payload) {
  const gameId = payload?.gameId;
  if (!isValidUuid(gameId)) {
    const error = new Error('gameId must be a valid UUID');
    error.statusCode = 400;
    throw error;
  }

  const state = await getGameState(gameId);
  if (!state) {
    return null;
  }

  const scores = await getScoresByGameId(gameId);
  const timeline = buildReplayTimeline(state);

  return {
    game: state.game,
    players: state.players,
    scores,
    timeline,
    wordChains: state.wordChains,
    submissions: state.submissions,
  };
}

export default {
  getMatchReplay,
};
