/**
 * token立省100% — Host half.
 *
 * Refuses every model request the conversation loop makes and substitutes the
 * configured reply, so a turn costs nothing. Chat titles, compaction and other
 * background requests keep working: they carry a `purpose`, which this plugin
 * leaves alone, and they are not what the user asked to block.
 *
 * The refusal point is the `llm/stream` waterfall: returning our own chunks
 * instead of calling `next()` means the adapter is never dispatched, while the
 * agent loop still receives a well-formed stream and commits a normal assistant
 * message — that is how the reply reaches the Chat flow.
 *
 * The saved-call counter is plugin-owned state on disk (a JSON file under the
 * Harness home) rather than plugin Config, because the Settings page only reads
 * it: configuration is for values the user tunes, and this one is written by the
 * plugin on every refusal. One same-origin route serves it to the browser half.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Loader entry id; also the Settings section id and the row this bundle inserts. */
const PLUGIN_ID = 'token-saver-100';
/** Same-origin route the Settings page polls for the current count. */
const STATE_ROUTE = '/token-saver-100/state';
/** The reply substituted for every refused model call. */
const REPLY = '恭喜你，又省下了token！';
/** Bumped when the stored shape changes. */
const STATE_VERSION = 1;

export const inject = ['webServer'];

export function apply(ctx) {
  const state = openState(process.env.DSH_HOME, (message) => ctx.logger.warn(message));

  /**
   * Admit a request to the refusal path.
   *
   * Only conversation traffic is refused: a request the agent loop assembled
   * carries the Session it belongs to and no `purpose`, whereas title
   * generation, compaction and review requests declare their purpose.
   * @param options - the request arriving at the `llm/stream` waterfall.
   * @returns whether this plugin should answer it instead of the adapter.
   */
  const shouldRefuse = (options) => {
    if (options === null || typeof options !== 'object') return false;
    if (options.purpose !== undefined) return false;
    return typeof options.sessionId === 'string' && options.sessionId !== '';
  };

  /**
   * Replace one request with a complete text-only stream.
   *
   * The chunks are the same shape an adapter emits, so the loop's assembler
   * builds an ordinary assistant message: one text block, then `stop`.
   * @param text - the reply committed as the assistant message.
   * @returns the chunk stream the loop consumes instead of a model response.
   */
  const refusal = async function* refusalStream(text) {
    yield { type: 'block-start', index: 0, blockType: 'text' };
    yield { type: 'text-delta', index: 0, text };
    yield { type: 'block-end', index: 0, block: { type: 'text', text } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  };

  ctx.effect(
    () =>
      ctx.on(
        'llm/stream',
        (options, next) => {
          if (!shouldRefuse(options)) return next();
          state.increment();
          return refusal(REPLY);
        },
        { prepend: true },
      ),
    `${PLUGIN_ID}: refuse model calls`,
  );

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: STATE_ROUTE,
        async handler(req, res) {
          const send = (status, payload) => {
            res.statusCode = status;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.end(JSON.stringify(payload));
          };
          try {
            if (req.method === 'GET' || req.method === 'HEAD') {
              send(200, state.snapshot());
              return;
            }
            send(405, { error: 'method not allowed' });
          } catch (error) {
            send(500, { error: String((error && error.message) || error) });
          }
        },
      }),
    `${PLUGIN_ID}: state route`,
  );
}

/**
 * Open the counter file and expose the two operations the plugin needs.
 *
 * Writes are atomic (temp file + rename) so an interrupted write cannot leave a
 * truncated document that would reset the count on the next start.
 * @param home - `DSH_HOME` when the Harness exports one.
 * @param warn - channel for a write that could not reach the disk.
 * @returns the counter handle.
 */
function openState(home, warn) {
  const root = typeof home === 'string' && home.trim() !== '' ? home.trim() : path.join(homedir(), '.dsh');
  const file = path.join(root, PLUGIN_ID, 'state.json');
  const value = load();

  function load() {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const count = Number(parsed.count);
        return {
          version: STATE_VERSION,
          count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
          updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        };
      }
    } catch (error) {
      // First run, or a document another tool damaged: start from zero rather
      // than failing the plugin that is supposed to answer every request.
    }
    return { version: STATE_VERSION, count: 0, updatedAt: null };
  }

  function persist() {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      renameSync(temporary, file);
    } catch (error) {
      // The in-memory count still drives the Settings page for this run.
      // `%s` rather than interpolation: the logger reads the first argument as a
      // printf-style format string, and a filesystem message may contain `%`.
      warn('%s', `${PLUGIN_ID}: cannot persist the saved-call count: ${error}`);
    }
  }

  return {
    increment() {
      value.count += 1;
      value.updatedAt = new Date().toISOString();
      persist();
    },
    snapshot() {
      return { count: value.count, updatedAt: value.updatedAt };
    },
  };
}
