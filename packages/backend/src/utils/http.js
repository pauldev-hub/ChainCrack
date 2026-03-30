/**
 * Shared HTTP response helpers.
 * @file packages/backend/src/utils/http.js
 */

/**
 * Sends a standardized JSON error response.
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {number} fallbackStatus
 * @returns {void}
 */
export function sendHttpError(res, error, fallbackStatus = 500) {
  const status = Number(error?.statusCode || fallbackStatus);
  res.status(status).json({
    success: false,
    error: error?.message || 'Internal server error',
  });
}

/**
 * Parses a positive integer query parameter with bounds.
 * @param {unknown} value
 * @param {{defaultValue?: number, min?: number, max?: number}} options
 * @returns {number}
 */
export function parseBoundedInt(
  value,
  { defaultValue = 10, min = 1, max = 100 } = {},
) {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isInteger(parsed) || parsed < min) {
    return defaultValue;
  }

  return Math.min(parsed, max);
}

export default {
  sendHttpError,
  parseBoundedInt,
};
