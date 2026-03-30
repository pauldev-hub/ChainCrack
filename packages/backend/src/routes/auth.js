import express from 'express';
import { createGuestProfile } from '../services/player.js';
import { sendHttpError } from '../utils/http.js';

const router = express.Router();

/**
 * POST /api/auth/guest
 * Accepts a generated UUID from the client and validates guest profile payload.
 */
router.post('/guest', async (req, res) => {
  try {
    const data = createGuestProfile({
      playerId: req.body?.playerId,
      name: req.body?.name,
    });

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    sendHttpError(res, error, 400);
  }
});

export default router;
