import express from 'express';
import {
  createGuestProfile,
  getPlayerById,
} from '../services/player.js';
import { sendHttpError } from '../utils/http.js';

const router = express.Router();

router.post('/create', async (req, res) => {
  try {
    const data = createGuestProfile({ name: req.body?.name });
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    sendHttpError(res, error, 400);
  }
});

router.get('/:playerId', async (req, res) => {
  try {
    const player = await getPlayerById(req.params.playerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    res.status(200).json({ success: true, data: player });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export default router;
