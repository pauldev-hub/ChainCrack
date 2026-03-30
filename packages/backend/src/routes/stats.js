import express from 'express';
import {
  getLeaderboard,
  getPlayerStats,
  getGameStats,
} from '../services/stats.js';
import { parseBoundedInt, sendHttpError } from '../utils/http.js';

const router = express.Router();

router.get('/leaderboard', async (req, res) => {
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

router.get('/player/:playerId', async (req, res) => {
  try {
    const data = await getPlayerStats(req.params.playerId);
    if (!data) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    sendHttpError(res, error);
  }
});

router.get('/game/:gameId', async (req, res) => {
  try {
    const data = await getGameStats(req.params.gameId);
    if (!data) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export default router;
