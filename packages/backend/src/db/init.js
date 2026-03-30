/**
 * Database initialization and migration
 * 
 * Sets up SQLite database schema and connection pool
 * Runs migrations on initialization
 * 
 * @file packages/backend/src/db/init.js
 */

import sqlite3 from 'sqlite3';

let db = null;

const REQUIRED_SCHEMA = {
	games: [
		'id',
		'code',
		'start_word',
		'end_word',
		'created_at',
		'started_at',
		'ended_at',
		'status',
		'phase',
		'max_players',
		'time_limit_seconds',
		'race_ends_at',
		'reveal_at',
		'vote_phase_ends_at',
		'chain_of_round_player_id',
	],
	players: ['id', 'game_id', 'name', 'joined_at', 'left_at', 'is_active'],
	word_chains: [
		'id',
		'game_id',
		'player_id',
		'step_number',
		'word',
		'explanation',
		'submitted_at',
		'is_valid',
		'ai_score',
		'ai_feedback',
		'auto_submitted',
	],
	submissions: [
		'id',
		'game_id',
		'player_id',
		'word_chain_id',
		'status',
		'submitted_at',
		'validated_at',
		'validation_ms',
		'provider_used',
	],
	scores: [
		'id',
		'game_id',
		'player_id',
		'total_score',
		'ai_score',
		'speed_bonus',
		'crowd_bonus',
		'chain_length',
		'time_taken_seconds',
		'rank',
		'finalized_at',
	],
	votes: [
		'id',
		'game_id',
		'voter_id',
		'voted_chain_owner_id',
		'created_at',
	],
};

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS games (
	id TEXT PRIMARY KEY,
	code TEXT NOT NULL UNIQUE,
	start_word TEXT NOT NULL,
	end_word TEXT NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	started_at TIMESTAMP,
	ended_at TIMESTAMP,
	status TEXT NOT NULL CHECK(status IN ('waiting', 'active', 'ended')),
	phase TEXT NOT NULL DEFAULT 'race' CHECK(phase IN ('race', 'reveal', 'vote', 'results')),
	max_players INTEGER NOT NULL DEFAULT 4 CHECK(max_players BETWEEN 2 AND 4),
	time_limit_seconds INTEGER NOT NULL DEFAULT 300,
	race_ends_at TIMESTAMP,
	reveal_at TIMESTAMP,
	vote_phase_ends_at TIMESTAMP,
	chain_of_round_player_id TEXT
);

CREATE TABLE IF NOT EXISTS players (
	id TEXT PRIMARY KEY,
	game_id TEXT NOT NULL,
	name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
	joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	left_at TIMESTAMP,
	is_active BOOLEAN NOT NULL DEFAULT 1,
	FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS word_chains (
	id TEXT PRIMARY KEY,
	game_id TEXT NOT NULL,
	player_id TEXT NOT NULL,
	step_number INTEGER NOT NULL,
	word TEXT NOT NULL,
	explanation TEXT NOT NULL CHECK(length(explanation) BETWEEN 10 AND 500),
	submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	is_valid BOOLEAN NOT NULL,
	ai_score INTEGER CHECK(ai_score BETWEEN 0 AND 100),
	ai_feedback TEXT,
	auto_submitted BOOLEAN NOT NULL DEFAULT 0,
	FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
	FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
	id TEXT PRIMARY KEY,
	game_id TEXT NOT NULL,
	player_id TEXT NOT NULL,
	word_chain_id TEXT NOT NULL,
	status TEXT NOT NULL CHECK(status IN ('pending', 'validated', 'rejected')),
	submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	validated_at TIMESTAMP,
	validation_ms INTEGER,
	provider_used TEXT CHECK(provider_used IN ('groq', 'gemini', 'llama')),
	FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
	FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
	FOREIGN KEY(word_chain_id) REFERENCES word_chains(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scores (
	id TEXT PRIMARY KEY,
	game_id TEXT NOT NULL,
	player_id TEXT NOT NULL,
	total_score INTEGER NOT NULL DEFAULT 0,
	ai_score INTEGER NOT NULL DEFAULT 0,
	speed_bonus INTEGER NOT NULL DEFAULT 0,
	crowd_bonus REAL NOT NULL DEFAULT 0,
	chain_length INTEGER NOT NULL DEFAULT 0,
	time_taken_seconds INTEGER,
	rank INTEGER,
	finalized_at TIMESTAMP,
	FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
	FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS votes (
	id TEXT PRIMARY KEY,
	game_id TEXT NOT NULL,
	voter_id TEXT NOT NULL,
	voted_chain_owner_id TEXT NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
	FOREIGN KEY(voter_id) REFERENCES players(id) ON DELETE CASCADE,
	FOREIGN KEY(voted_chain_owner_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_word_chain_step_per_game
ON word_chains(game_id, step_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_game_player
ON scores(game_id, player_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique_target
ON votes(game_id, voter_id, voted_chain_owner_id);

CREATE INDEX IF NOT EXISTS idx_votes_game
ON votes(game_id);
`;

function run(dbHandle, sql) {
	return new Promise((resolve, reject) => {
		dbHandle.run(sql, (error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

function exec(dbHandle, sql) {
	return new Promise((resolve, reject) => {
		dbHandle.exec(sql, (error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

function all(dbHandle, sql, params = []) {
	return new Promise((resolve, reject) => {
		dbHandle.all(sql, params, (error, rows) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(rows);
		});
	});
}

function get(dbHandle, sql, params = []) {
	return new Promise((resolve, reject) => {
		dbHandle.get(sql, params, (error, row) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(row ?? null);
		});
	});
}

function generateRoomCode(length = 6) {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let output = '';
	for (let index = 0; index < length; index += 1) {
		const randomIndex = Math.floor(Math.random() * alphabet.length);
		output += alphabet[randomIndex];
	}
	return output;
}

async function ensureGamesCodeColumn(dbHandle) {
	const gameColumns = await all(dbHandle, 'PRAGMA table_info(games);');
	const hasCode = gameColumns.some((column) => column.name === 'code');

	if (!hasCode) {
		await run(dbHandle, 'ALTER TABLE games ADD COLUMN code TEXT;');
	}

	const rows = await all(dbHandle, 'SELECT id, code FROM games;');
	const usedCodes = new Set(
		rows
			.map((row) => String(row.code || '').trim().toUpperCase())
			.filter(Boolean),
	);

	for (const row of rows) {
		const normalizedCode = String(row.code || '').trim().toUpperCase();
		if (normalizedCode && normalizedCode !== row.code) {
			await run(dbHandle, 'UPDATE games SET code = ? WHERE id = ?', [
				normalizedCode,
				row.id,
			]);
			continue;
		}

		if (normalizedCode) {
			continue;
		}

		let generatedCode = '';
		do {
			generatedCode = generateRoomCode();
		} while (usedCodes.has(generatedCode));

		usedCodes.add(generatedCode);
		await run(dbHandle, 'UPDATE games SET code = ? WHERE id = ?', [
			generatedCode,
			row.id,
		]);
	}

	await run(dbHandle, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_games_code ON games(code);');

	const nullCodeCount = await get(
		dbHandle,
		'SELECT COUNT(*) AS count FROM games WHERE code IS NULL OR code = "";',
	);

	if (Number(nullCodeCount?.count ?? 0) > 0) {
		throw new Error('Schema migration failed: some games rows are missing room code');
	}
}

async function ensureColumn(dbHandle, tableName, columnName, columnSql) {
	const rows = await all(dbHandle, `PRAGMA table_info(${tableName});`);
	const hasColumn = rows.some((column) => column.name === columnName);
	if (!hasColumn) {
		await run(dbHandle, `ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
	}
}

async function ensureGamesPhaseColumns(dbHandle) {
	await ensureColumn(
		dbHandle,
		'games',
		'phase',
		"phase TEXT NOT NULL DEFAULT 'race' CHECK(phase IN ('race', 'reveal', 'vote', 'results'))",
	);
	await ensureColumn(dbHandle, 'games', 'race_ends_at', 'race_ends_at TIMESTAMP');
	await ensureColumn(dbHandle, 'games', 'reveal_at', 'reveal_at TIMESTAMP');
	await ensureColumn(dbHandle, 'games', 'vote_phase_ends_at', 'vote_phase_ends_at TIMESTAMP');
	await ensureColumn(
		dbHandle,
		'games',
		'chain_of_round_player_id',
		'chain_of_round_player_id TEXT',
	);
}

async function ensureScoresBreakdownColumns(dbHandle) {
	await ensureColumn(dbHandle, 'scores', 'ai_score', 'ai_score INTEGER NOT NULL DEFAULT 0');
	await ensureColumn(
		dbHandle,
		'scores',
		'speed_bonus',
		'speed_bonus INTEGER NOT NULL DEFAULT 0',
	);
	await ensureColumn(
		dbHandle,
		'scores',
		'crowd_bonus',
		'crowd_bonus REAL NOT NULL DEFAULT 0',
	);
}

async function ensureVotesTable(dbHandle) {
	await exec(
		dbHandle,
		`CREATE TABLE IF NOT EXISTS votes (
			id TEXT PRIMARY KEY,
			game_id TEXT NOT NULL,
			voter_id TEXT NOT NULL,
			voted_chain_owner_id TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
			FOREIGN KEY(voter_id) REFERENCES players(id) ON DELETE CASCADE,
			FOREIGN KEY(voted_chain_owner_id) REFERENCES players(id) ON DELETE CASCADE
		);`,
	);

	await run(
		dbHandle,
		'CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique_target ON votes(game_id, voter_id, voted_chain_owner_id);',
	);
	await run(dbHandle, 'CREATE INDEX IF NOT EXISTS idx_votes_game ON votes(game_id);');
}

async function ensureWordChainsShape(dbHandle) {
	const wordChainsColumns = await all(dbHandle, 'PRAGMA table_info(word_chains);');
	const hasExplanation = wordChainsColumns.some((column) => column.name === 'explanation');
	const hasAutoSubmitted = wordChainsColumns.some((column) => column.name === 'auto_submitted');

	if (hasExplanation && hasAutoSubmitted) {
		return;
	}

	if (hasExplanation && !hasAutoSubmitted) {
		await ensureColumn(
			dbHandle,
			'word_chains',
			'auto_submitted',
			'auto_submitted BOOLEAN NOT NULL DEFAULT 0',
		);
		return;
	}

	await run(dbHandle, 'PRAGMA foreign_keys = OFF;');
	const explanationSelect = hasExplanation
		? `CASE
				WHEN length(trim(COALESCE(explanation, ''))) BETWEEN 10 AND 500
					THEN trim(explanation)
				WHEN length(trim(COALESCE(ai_feedback, ''))) BETWEEN 10 AND 500
					THEN trim(ai_feedback)
				ELSE 'No explanation provided.'
			END`
		: `CASE
				WHEN length(trim(COALESCE(ai_feedback, ''))) BETWEEN 10 AND 500
					THEN trim(ai_feedback)
				ELSE 'No explanation provided.'
			END`;
	const autoSubmittedSelect = hasAutoSubmitted ? 'COALESCE(auto_submitted, 0)' : '0';
	await exec(
		dbHandle,
		`BEGIN TRANSACTION;
		CREATE TABLE word_chains_migrated (
			id TEXT PRIMARY KEY,
			game_id TEXT NOT NULL,
			player_id TEXT NOT NULL,
			step_number INTEGER NOT NULL,
			word TEXT NOT NULL,
			explanation TEXT NOT NULL CHECK(length(explanation) BETWEEN 10 AND 500),
			submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			is_valid BOOLEAN NOT NULL,
			ai_score INTEGER CHECK(ai_score BETWEEN 0 AND 100),
			ai_feedback TEXT,
			auto_submitted BOOLEAN NOT NULL DEFAULT 0,
			FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
			FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
		);
		INSERT INTO word_chains_migrated (
			id,
			game_id,
			player_id,
			step_number,
			word,
			explanation,
			submitted_at,
			is_valid,
			ai_score,
			ai_feedback,
			auto_submitted
		)
		SELECT
			id,
			game_id,
			player_id,
			step_number,
			word,
			${explanationSelect},
			submitted_at,
			is_valid,
			ai_score,
			ai_feedback,
			${autoSubmittedSelect}
		FROM word_chains;
		DROP TABLE word_chains;
		ALTER TABLE word_chains_migrated RENAME TO word_chains;
		COMMIT;`,
	);
	await run(dbHandle, 'PRAGMA foreign_keys = ON;');
	await run(
		dbHandle,
		'CREATE UNIQUE INDEX IF NOT EXISTS idx_word_chain_step_per_game ON word_chains(game_id, step_number);',
	);
}

/**
 * Initializes the SQLite database connection and bootstraps schema.
 * @param {string} databasePath
 * @returns {Promise<sqlite3.Database>}
 */
export async function initDatabase(databasePath) {
	if (db) {
		return db;
	}

	db = await new Promise((resolve, reject) => {
		const handle = new sqlite3.Database(databasePath, (error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(handle);
		});
	});

	await run(db, 'PRAGMA foreign_keys = ON;');
	await run(db, 'PRAGMA journal_mode = WAL;');
	await run(db, 'PRAGMA busy_timeout = 3000;');
	await exec(db, CREATE_TABLES_SQL);
	await ensureGamesCodeColumn(db);
	await ensureGamesPhaseColumns(db);
	await ensureScoresBreakdownColumns(db);
	await ensureVotesTable(db);
	await ensureWordChainsShape(db);
	await verifySchema(db);

	return db;
}

/**
 * Verifies that required tables and columns exist before serving traffic.
 * @param {sqlite3.Database} dbHandle
 * @returns {Promise<void>}
 */
export async function verifySchema(dbHandle) {
	for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
		const rows = await all(dbHandle, `PRAGMA table_info(${tableName});`);
		if (!rows.length) {
			throw new Error(`Schema verification failed: table ${tableName} is missing`);
		}

		const existingColumns = new Set(rows.map((row) => row.name));
		for (const columnName of requiredColumns) {
			if (!existingColumns.has(columnName)) {
				throw new Error(
					`Schema verification failed: ${tableName}.${columnName} is missing`,
				);
			}
		}
	}
}

/**
 * Returns initialized sqlite handle.
 * @returns {sqlite3.Database}
 */
export function getDb() {
	if (!db) {
		throw new Error('Database not initialized');
	}
	return db;
}

/**
 * Closes the sqlite connection.
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
	if (!db) {
		return;
	}

	const handle = db;
	db = null;

	await new Promise((resolve, reject) => {
		handle.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

export default {
	initDatabase,
	verifySchema,
	getDb,
	closeDatabase,
};
