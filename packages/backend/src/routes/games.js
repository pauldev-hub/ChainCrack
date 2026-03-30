import express from 'express';
import {
  createGame,
  getGameDetails,
  requestGameState,
  endGame,
  requestScores,
} from '../services/game/index.js';
import { sendHttpError } from '../utils/http.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { startWord, endWord, maxPlayers } = req.body || {};
    const data = await createGame({ startWord, endWord, maxPlayers });
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

router.get('/:gameId', async (req, res) => {
  try {
    const data = await getGameDetails({ gameId: req.params.gameId });
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

router.get('/:gameId/state', async (req, res) => {
  try {
    const data = await requestGameState({ gameId: req.params.gameId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendHttpError(res, error);
  }
});

router.get('/:gameId/scores', async (req, res) => {
  try {
    const data = await requestScores({ gameId: req.params.gameId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendHttpError(res, error);
  }
});

router.post('/:gameId/end', async (req, res) => {
  try {
    const { winnerId } = req.body || {};
    const data = await endGame({ gameId: req.params.gameId, winnerId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export default router;
