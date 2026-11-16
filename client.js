/**
 * token立省100% — browser half.
 *
 * One Settings page showing the running total of refused model calls:
 * 「当前共省 n 次可能的token消耗」. The text is rendered as one sentence with
 * the number emphasized, so the figure reads at a glance and both language
 * variants keep the sentence the user asked for.
 *
 * The count comes from the plugin's own same-origin route (the Host half owns
 * it) and is refreshed on open, on a slow poll, and whenever the tab regains
 * focus, so a turn answered in another tab shows up here without a reload.
 */
window.__ModuleLoader__.load({
  id: 'dsh-token-saver-100',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useState } = React;

    const NS = 'tokenSaver100';
    const SECTION_ID = 'token-saver-100';
    const STATE_ROUTE = '/token-saver-100/state';
    /** Slow enough to stay invisible, fast enough to feel live after a turn. */
    const POLL_MS = 4000;

    const DICT = {
      zh: {
        nav: 'token立省100%',
        title: 'token立省100%',
        description: '每次你发起请求，插件都会拦下这次模型调用，直接回你一句「恭喜你，又省下了token！」——不消耗任何 token。',
        savedPrefix: '当前共省',
        savedUnit: '次可能的token消耗',
        idleHint: '还没有拦下过调用。发一条消息试试，这里就会开始计数。',
        updatedAt: '最近一次',
        loading: '读取中…',
        failed: '读取计数失败',
        retry: '重试',
        persistHint: '计数保存在 DSH 数据目录里，重启后继续累加。',
      },
      en: {
        nav: 'token立省100%',
        title: 'token立省100%',
        description: 'Every request you send is intercepted: the model call is refused and answered with “恭喜你，又省下了token！” instead, spending no tokens at all.',
        savedPrefix: 'So far you have saved',
        savedUnit: 'possible token-consuming call(s)',
        idleHint: 'No call refused yet. Send a message and the counter starts here.',
        updatedAt: 'Last refusal',
        loading: 'Loading…',
        failed: 'Could not read the count',
        retry: 'Retry',
        persistHint: 'The count is stored under the DSH data directory and keeps accumulating across restarts.',
      },
    };

    const CSS = `
.ts100-page { display: flex; flex-direction: column; gap: 16px; width: 100%; }
.ts100-head { display: flex; flex-direction: column; gap: 6px; }
.ts100-title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.ts100-desc { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.ts100-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px; border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px; background: var(--dsw-alias-bg-layer-1);
}
.ts100-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px;
  font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary);
}
.ts100-count {
  font-size: 22px; line-height: 28px; font-weight: 600;
  color: var(--dsw-alias-brand-primary); font-variant-numeric: tabular-nums;
}
.ts100-meta { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.ts100-note { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.ts100-error { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }
.ts100-retry {
  margin: 0; padding: 2px 8px; border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; line-height: 18px; cursor: pointer;
}
.ts100-retry:hover { background: var(--dsw-alias-bg-layer-2); }
.ts100-retry:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
`;

    /**
     * Read the counter from the Host half.
     * @returns the payload the route serves.
     */
    async function readState() {
      const response = await fetch(STATE_ROUTE, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    /**
     * Render the saved-call total.
     * @param props - the settings section owner props plus the injected locale.
     * @returns the settings page for this plugin.
     */
    function TokenSaverPage({ t }) {
      const [state, setState] = useState({ status: 'loading' });
      const load = useCallback(() => {
        let alive = true;
        readState()
          .then((data) => {
            if (alive) setState({ status: 'ready', count: Number(data?.count ?? 0), updatedAt: data?.updatedAt ?? null });
          })
          .catch((error) => {
            if (alive) setState((current) => ({ status: 'error', message: String((error && error.message) || error), count: current.count }));
          });
        return () => {
          alive = false;
        };
      }, []);

      useEffect(() => {
        const dispose = load();
        const timer = setInterval(() => load(), POLL_MS);
        const onVisible = () => {
          if (document.visibilityState === 'visible') load();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
          dispose();
          clearInterval(timer);
          document.removeEventListener('visibilitychange', onVisible);
        };
      }, [load]);

      const count = state.count;
      const sentence = h(
        'div',
        { className: 'ts100-line' },
        h('span', null, t('savedPrefix')),
        count === undefined ? h('span', { className: 'ts100-count' }, '—') : h('span', { className: 'ts100-count' }, String(count)),
        h('span', null, t('savedUnit')),
      );

      return h(
        'div',
        { className: 'ts100-page' },
        h('style', { key: 'ts100-style' }, CSS),
        h(
          'div',
          { className: 'ts100-head' },
          h('div', { className: 'ts100-title' }, t('title')),
          h('div', { className: 'ts100-desc' }, t('description')),
        ),
        h(
          'div',
          { className: 'ts100-card' },
          state.status === 'loading' && count === undefined ? h('div', { className: 'ts100-note' }, t('loading')) : sentence,
          state.status === 'error'
            ? h(
                'div',
                { className: 'ts100-error', role: 'alert' },
                h('span', null, `${t('failed')}: ${state.message}`),
                h('button', { type: 'button', className: 'ts100-retry', onClick: () => load() }, t('retry')),
              )
            : null,
          count === 0 ? h('div', { className: 'ts100-note' }, t('idleHint')) : null,
          state.updatedAt ? h('div', { className: 'ts100-meta' }, `${t('updatedAt')} · ${formatTime(state.updatedAt)}`) : null,
          h('div', { className: 'ts100-note' }, t('persistHint')),
        ),
      );
    }

    /**
     * Render one stored timestamp for the current locale.
     * @param iso - ISO-8601 instant recorded by the Host half.
     * @returns the localized date and time, or the raw value when unparsable.
     */
    function formatTime(iso) {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return String(iso);
      try {
        return date.toLocaleString();
      } catch (error) {
        return String(iso);
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(
          () => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }),
          'token-saver-100: dictionaries',
        );
        ctx.effect(
          () =>
            ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: SECTION_ID,
                  order: 60,
                  label: () => t('nav'),
                  locale: NS,
                },
                (props) => h(TokenSaverPage, { ...props, t }),
              ),
            ),
          'token-saver-100: settings page',
        );
      },
    };
  },
});
