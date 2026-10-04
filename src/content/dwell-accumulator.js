/**
 * Pure dwell-time bookkeeping (no DOM, no timers, no chrome). Time is passed
 * in explicitly so the logic is deterministic and unit-testable.
 *
 * Dwell accrues for every post currently "visible" while the page is active
 * (tab visible and window focused) and the user is not idle. Idle means no
 * input for `idleMs`: accrual stops at the idle deadline, not at the moment
 * we notice, so a long gap never over-credits.
 */

/**
 * @param {object} [options]
 * @param {number} [options.idleMs] Inactivity that pauses accrual.
 * @param {number} [options.now] Initial clock value (epoch ms).
 */
export function createDwellAccumulator({ idleMs = 30_000, now = Date.now() } = {}) {
  let lastTick = now;
  let lastActivity = now;
  let pageActive = true;
  /** id -> post metadata, for every post that has been visible since the last collect. */
  const posts = new Map();
  const visible = new Set();

  /** Credits elapsed time up to `t` to all visible posts (while active and not idle). */
  function advance(t) {
    if (t <= lastTick) return;
    if (pageActive && visible.size > 0) {
      const creditedUntil = Math.min(t, lastActivity + idleMs);
      const elapsed = creditedUntil - lastTick;
      if (elapsed > 0) {
        for (const id of visible) posts.get(id).dwellMs += elapsed;
      }
    }
    lastTick = t;
  }

  return {
    /**
     * Marks a post as visible (or not) at time `t`. `meta` is the post data
     * (id, text, author, ...) and is refreshed each time it is passed.
     */
    setVisible(id, isVisible, t, meta) {
      advance(t);
      if (isVisible) {
        const entry = posts.get(id) ?? { dwellMs: 0, visits: 0, firstSeen: t, lastSeen: t };
        posts.set(id, { ...entry, ...meta, id, lastSeen: t });
        if (!visible.has(id)) {
          visible.add(id);
          posts.get(id).visits += 1;
        }
      } else if (visible.delete(id)) {
        posts.get(id).lastSeen = t;
      }
    },

    /** Tab visible and window focused (false pauses accrual). */
    setPageActive(active, t) {
      advance(t);
      pageActive = active;
      if (active) lastActivity = Math.max(lastActivity, t); // returning counts as activity
    },

    /** Any scroll/mouse/key/touch input. */
    noteActivity(t) {
      advance(t);
      lastActivity = t;
    },

    /**
     * Drains accumulated data for posts with dwell, then resets the counters. Posts still visible stay tracked (with zeroed
     * counters) so their time keeps accruing into the next batch.
     * @param {number} t
     * @returns {{id: string, dwellMs: number, visits: number, firstSeen: number, lastSeen: number}[]}
     */
    collect(t) {
      advance(t);
      const batch = [];
      for (const [id, post] of posts) {
        const stillVisible = visible.has(id);
        if (stillVisible) post.lastSeen = t;
        if (post.dwellMs > 0) {
          batch.push({ ...post });
          if (stillVisible) posts.set(id, { ...post, dwellMs: 0, visits: 0, firstSeen: t });
        }
        if (!stillVisible) posts.delete(id);
      }
      return batch;
    },

    /** Ids currently counted as visible (for tests/debugging). */
    get visibleCount() {
      return visible.size;
    },
  };
}
