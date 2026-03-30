import express from 'express';
import { getLeaderboard } from '../services/stats.js';
import { parseBoundedInt, sendHttpError } from '../utils/http.js';

const router = express.Router();

/**
 * GET /api/leaderboard
 * Alias endpoint for leaderboard contract compatibility.
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseBoundedInt(req.query.limit, {
      defaultValue: 10,
      min: 1,
      max: 100,
    });

    const data = await getLeaderboard(limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export default router;
