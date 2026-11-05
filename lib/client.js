window.__ModuleLoader__.load({
  id: 'dsh-think-flow',
  factory: (require) => {
    'use strict'

    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-think-flow'
    const ENDPOINT = '/think-flow/config'

    const GRANULARITIES = [
      { value: 'off', label: '关闭', hint: '不注入任何播报规则。' },
      { value: 'brief', label: '简洁', hint: '只报进展，不要求列编号计划。' },
      { value: 'standard', label: '标准', hint: '先列编号计划，每完成一步播报一次。' },
      { value: 'detailed', label: '详细', hint: '在标准之上注明关键参数与耗时。' },
    ]

    const LANGUAGES = [
      { value: 'auto', label: '跟随用户' },
      { value: 'zh', label: '中文' },
      { value: 'en', label: 'English' },
    ]

    const styles = {
      root: { display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '720px' },
      field: { display: 'flex', flexDirection: 'column', gap: '8px' },
      label: { fontSize: '13px', fontWeight: 600 },
      hint: { fontSize: '12px', opacity: 0.6, lineHeight: 1.5 },
      options: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
      option: (active) => ({
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: '10px',
        border: `1px solid ${active ? 'var(--dsh-accent, #4d6bfe)' : 'rgba(128,128,128,0.28)'}`,
        background: active ? 'rgba(77,107,254,0.08)' : 'transparent',
        cursor: 'pointer',
        color: 'inherit',
        font: 'inherit',
      }),
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 10px',
        borderRadius: '8px',
        border: '1px solid rgba(128,128,128,0.32)',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
      },
      actions: { display: 'flex', alignItems: 'center', gap: '12px' },
      button: {
        padding: '8px 18px',
        borderRadius: '8px',
        border: 'none',
        background: 'var(--dsh-accent, #4d6bfe)',
        color: '#fff',
        cursor: 'pointer',
        font: 'inherit',
      },
      status: { fontSize: '12px', opacity: 0.7 },
    }

    function Option(props) {
      return h(
        'button',
        {
          type: 'button',
          style: styles.option(props.active),
          onClick: props.onClick,
          'aria-pressed': props.active,
        },
        h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, props.label),
        h('div', { style: styles.hint }, props.hint),
      )
    }

    function ConfigPage() {
      const [config, setConfig] = React.useState(null)
      const [status, setStatus] = React.useState('')
      const [saving, setSaving] = React.useState(false)

      React.useEffect(() => {
        let alive = true
        fetch(ENDPOINT, { credentials: 'same-origin' })
          .then((response) => response.json())
          .then((data) => {
            if (!alive) return
            if (data && data.ok) setConfig(data.config)
            else setStatus('读取设置失败')
          })
          .catch(() => {
            if (alive) setStatus('读取设置失败')
          })
        return () => {
          alive = false
        }
      }, [])

      if (config === null) {
        return h('div', { style: styles.hint }, status || '读取设置中…')
      }

      const patch = (fields) => setConfig({ ...config, ...fields })

      const save = () => {
        setSaving(true)
        setStatus('')
        fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(config),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data && data.ok) {
              setConfig(data.config)
              setStatus('已保存，下一回合生效')
            } else {
              setStatus(`保存失败：${(data && data.error) || '未知错误'}`)
            }
          })
          .catch((error) => setStatus(`保存失败：${String(error.message || error)}`))
          .finally(() => setSaving(false))
      }

      return h(
        'div',
        { style: styles.root },
        h(
          'div',
          { style: styles.field },
          h('div', { style: styles.label }, '播报颗粒度'),
          h(
            'div',
            { style: styles.options },
            GRANULARITIES.map((item) =>
              h(Option, {
                key: item.value,
                label: item.label,
                hint: item.hint,
                active: config.granularity === item.value,
                onClick: () => patch({ granularity: item.value }),
              }),
            ),
          ),
          h('div', { style: styles.hint }, '决定 agent 在过程中说多少话；关闭后完全恢复 DSH 默认行为。'),
        ),

        h(
          'div',
          { style: styles.field },
          h('div', { style: styles.label }, '计划最多几步'),
          h('input', {
            type: 'number',
            min: 2,
            max: 12,
            step: 1,
            style: { ...styles.input, maxWidth: '120px' },
            value: config.maxSteps,
            onChange: (event) => patch({ maxSteps: Number(event.target.value) || 2 }),
          }),
          h('div', { style: styles.hint }, '开始时最多列出的编号步骤数（2–12）。'),
        ),

        h(
          'div',
          { style: styles.field },
          h('div', { style: styles.label }, '播报语言'),
          h(
            'select',
            {
              style: { ...styles.input, maxWidth: '200px' },
              value: config.language,
              onChange: (event) => patch({ language: event.target.value }),
            },
            LANGUAGES.map((item) => h('option', { key: item.value, value: item.value }, item.label)),
          ),
        ),

        h(
          'div',
          { style: styles.field },
          h('div', { style: styles.label }, '额外要求'),
          h('textarea', {
            rows: 3,
            style: { ...styles.input, resize: 'vertical' },
            placeholder: '例如：播报时不要贴文件路径，除非是最终产出。',
            value: config.extraInstructions,
            onChange: (event) => patch({ extraInstructions: event.target.value }),
          }),
          h('div', { style: styles.hint }, '追加到内置规则末尾，可留空。'),
        ),

        h(
          'div',
          { style: styles.actions },
          h(
            'button',
            { type: 'button', style: styles.button, disabled: saving, onClick: save },
            saving ? '保存中…' : '保存',
          ),
          h('span', { style: styles.status }, status),
        ),
      )
    }

    function apply(ctx) {
      if (typeof ctx.inject !== 'function') return
      ctx.inject(['slots'], (scoped) => {
        scoped.effect(() => {
          const slots = scoped.get ? scoped.get('slots') : scoped.slots
          if (slots === undefined) return
          return slots.inject('plugins.bundle.config', () =>
            slots.register(
              { name: 'plugins.bundle.config', key: NS },
              (props) =>
                props && props.view === 'summary'
                  ? '过程播报设置'
                  : h(ConfigPage, props),
            ),
          )
        }, 'dsh-think-flow: bundle config page')
      })
    }

    return { name: NS, inject: [], apply }
  },
})
