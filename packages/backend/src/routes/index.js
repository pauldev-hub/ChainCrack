import express from 'express';
import authRoutes from './auth.js';
import gamesRoutes from './games.js';
import leaderboardRoutes from './leaderboard.js';
import matchesRoutes from './matches.js';
import playersRoutes from './players.js';
import statsRoutes from './stats.js';

const router = express.Router();

router.get('/', (req, res) => {
	res.status(200).json({
		success: true,
		data: {
			status: 'ok',
			timestamp: new Date().toISOString(),
			endpoints: [
				'/api/auth',
				'/api/games',
				'/api/leaderboard',
				'/api/matches',
				'/api/players',
				'/api/stats',
			],
		},
	});
});

router.use('/auth', authRoutes);
router.use('/games', gamesRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/matches', matchesRoutes);
router.use('/players', playersRoutes);
router.use('/stats', statsRoutes);

export default router;
