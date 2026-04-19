/**
 * Map an SDK error (or any Error) to a concise, actionable message.
 *
 * @param {Error & { status?: number }} err
 * @returns {string}
 */
export function getFriendlyError(err) {
    const status = err && err.status;
    if (status === 400) {
        return 'Bad request — verify the configured memory backend settings, headers, and request payload.';
    }
    if (status === 401) {
        return 'Authentication failed — verify the configured memory backend API key.';
    }
    if (status === 403) {
        return 'Permission denied — the configured memory backend rejected this operation.';
    }
    if (status === 404) {
        return 'No memories were found for this scope yet.';
    }
    if (status === 429) {
        return 'Rate limited — too many requests. Will retry next session.';
    }
    if (typeof status === 'number' && status >= 500) {
        return 'The memory backend is temporarily unavailable. Will retry next session.';
    }
    const message = (err && err.message) || '';
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
        return 'Memory backend is unreachable — check the configured base URL and whether the service is running.';
    }
    return message || 'Unknown error';
}

/**
 * Should the caller consider retrying this request later?
 *
 * Returns true for rate-limit (429), server errors (5xx), and
 * network/connection errors (no HTTP status at all).
 *
 * @param {Error & { status?: number }} err
 * @returns {boolean}
 */
export function isRetryableError(err) {
    const status = err && err.status;
    if (status === 429) return true;
    if (typeof status === 'number' && status >= 500) return true;
    if (status === undefined || status === null) return true;
    return false;
}

/**
 * Is this error expected / harmless?
 *
 * 404 means the user simply has no data yet. Connection and timeout errors
 * (no HTTP status) are transient network blips.
 *
 * @param {Error & { status?: number }} err
 * @returns {boolean}
 */
export function isBenignError(err) {
    const status = err && err.status;
    if (status === 404) return true;
    if (status === undefined || status === null) return true;
    return false;
}

export default {
    getFriendlyError,
    isRetryableError,
    isBenignError,
};
