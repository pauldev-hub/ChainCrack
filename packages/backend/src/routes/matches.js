import express from 'express';
import { getMatchReplay } from '../services/replay.js';
import { sendHttpError } from '../utils/http.js';

const router = express.Router();

/**
 * GET /api/matches/:id/replay
 * Returns replay-ready game timeline from persisted game state.
 */
router.get('/:id/replay', async (req, res) => {
  try {
    const data = await getMatchReplay({ gameId: req.params.id });
    if (!data) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export default router;
