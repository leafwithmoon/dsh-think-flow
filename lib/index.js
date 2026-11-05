/**
 * dsh-think-flow — Codex 风格的过程播报。
 *
 * 往系统提示里注册一段可配置的行为规则，让 agent 在工具调用之间用正文
 * 说明「正在做什么、做到哪一步、结果如何」，而不是只在回合结束时汇报。
 *
 * 颗粒度等设置由插件自己的配置页（`plugins.bundle.config` 槽）编辑，
 * 通过同源 `/think-flow/config` 路由落到 `$DSH_HOME/think-flow.json`，
 * 每个回合组装系统提示时重新读取，改完立即生效。
 *
 * @module dsh-think-flow
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import z from '@deepseek-ai/schemastery'

/** Loader entry / plugin name. */
export const name = 'dsh-think-flow'

/** The prompt registry must exist before the section can be registered. */
export const inject = ['systemPrompt']

/** Behaviour presets, from quietest to most chatty. */
export const GRANULARITIES = ['off', 'brief', 'standard', 'detailed']

/** Languages the narration can be written in. */
const LANGUAGES = ['auto', 'zh', 'en']

/** Built-in defaults used when neither the settings file nor the loader config sets a field. */
export const DEFAULTS = Object.freeze({
  granularity: 'standard',
  maxSteps: 6,
  language: 'auto',
  extraInstructions: '',
})

/** Settings form: every field here renders in the plugin settings page. */
export const Config = z.object({
  granularity: z
    .union(GRANULARITIES)
    .default(DEFAULTS.granularity)
    .description(
      '播报颗粒度。off：完全不注入；brief：只报进展、不列计划；standard：先列编号计划、每完成一步播报一次（推荐）；detailed：更细，允许注明关键参数与耗时。',
    ),
  maxSteps: z
    .number()
    .min(2)
    .max(12)
    .step(1)
    .default(DEFAULTS.maxSteps)
    .description('开始时最多列几个编号步骤。'),
  language: z
    .union(LANGUAGES)
    .default(DEFAULTS.language)
    .description('过程播报使用的语言。auto 跟随用户消息。'),
  extraInstructions: z
    .string()
    .default(DEFAULTS.extraInstructions)
    .description('追加到内置规则末尾的自定义要求，可留空。'),
})

/** Absolute path of the JSON file the settings page writes. */
export function settingsPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'think-flow.json')
}

/** Coerce one raw settings object into a valid config, dropping junk. */
export function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const granularity = GRANULARITIES.includes(source.granularity)
    ? source.granularity
    : DEFAULTS.granularity
  const maxStepsRaw = Number(source.maxSteps)
  const maxSteps = Number.isFinite(maxStepsRaw)
    ? Math.min(12, Math.max(2, Math.round(maxStepsRaw)))
    : DEFAULTS.maxSteps
  const language = LANGUAGES.includes(source.language) ? source.language : DEFAULTS.language
  const extraInstructions =
    typeof source.extraInstructions === 'string'
      ? source.extraInstructions.slice(0, 2000).trim()
      : DEFAULTS.extraInstructions
  return { granularity, maxSteps, language, extraInstructions }
}

/** Read the settings file; a missing or broken file falls back to defaults. */
export function readStoredConfig() {
  try {
    return normalizeConfig(JSON.parse(readFileSync(settingsPath(), 'utf8')))
  } catch {
    return { ...DEFAULTS }
  }
}

/** Persist the settings file atomically. */
export function writeStoredConfig(config) {
  const file = settingsPath()
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(normalizeConfig(config), null, 2)}\n`, 'utf8')
  renameSync(tmp, file)
}

/** Merge defaults, the loader-entry config, and the settings page's file. */
export function effectiveConfig(loaderConfig = {}) {
  return normalizeConfig({
    ...DEFAULTS,
    ...normalizeConfig(loaderConfig),
    ...readStoredConfig(),
  })
}

/** Resolve the language instruction for the configured mode. */
function languageLine(language) {
  if (language === 'zh') return '过程播报使用中文。'
  if (language === 'en') return 'Write every progress update in English.'
  return '过程播报使用与用户消息相同的语言。'
}

/** Render the custom suffix, tolerating an empty value. */
function extraLine(extraInstructions) {
  const extra = typeof extraInstructions === 'string' ? extraInstructions.trim() : ''
  return extra ? `\n\n额外要求：\n${extra}` : ''
}

/**
 * Build the prompt section text for one configuration.
 * @param config - validated plugin config.
 * @returns the section text, or an empty string when narration is off.
 */
export function buildSectionText(config = {}) {
  const { granularity, maxSteps, language, extraInstructions } = normalizeConfig(config)
  if (granularity === 'off') return ''

  const languageText = languageLine(language)
  const extra = extraLine(extraInstructions)
  const heading = '# 过程播报：让用户看见你在做什么'

  if (granularity === 'brief') {
    return `${heading}

用户希望在执行任务时看到你的进展，而不是只在最后一次性给结果。${languageText}

- 动手前用一句话说明你打算做什么。
- 每完成一个关键步骤（写完文件、跑完命令、查到关键结果），立刻用一行正文播报结果，再继续下一步。
- 每条过程播报只写 1 句话，不复述工具输出、不贴日志；细节留给最终回答。
- 不要连续多个工具调用都保持沉默；一段工作超过 20 秒没有正文时，先补一句当前进展。
- 最终回答给出结论与产出（文件路径等）。${extra}`
  }

  if (granularity === 'detailed') {
    return `${heading}

用户希望在对话里实时看到你的思考步骤，而不是只看到「深度探索中」。${languageText}

1. 动手前，用 2–${maxSteps} 条编号步骤说明计划，每条一句话写清「做什么 + 为什么」。
2. 每完成一个关键步骤（写完文件、跑完命令、查到关键结果、做出决定），立刻用一行编号正文播报结果，并注明关键参数（命令、文件、查询条件）或大致耗时，再进入下一步。
3. 过程播报可以写成 1–2 句，但不要复述工具完整输出、不贴大段日志；细节留给最终回答。
4. 计划有变时说明原因，并更新步骤编号。
5. 需要审批、需要用户确认或卡在外部条件时，明确说在等什么、为什么等。
6. 最终回答给出结论与产出（文件路径等），并说明哪些步骤完成、失败或跳过。${extra}`
  }

  return `${heading}

用户希望在对话里实时看到你的思考步骤，而不是只看到「深度探索中」。${languageText}

1. 动手前，用 2–${maxSteps} 条编号步骤说明计划，每条一句话写清「做什么 + 为什么」。
2. 每完成一个关键步骤（写完文件、跑完命令、查到关键结果、做出决定），立刻用一行编号正文播报结果（例：「2. 文件已写入，我检查一下大小和首尾。」），再进入下一步。不要把多个步骤攒到最后一起说。
3. 每条过程播报只写 1 句话，不复述工具输出、不贴日志；细节留给最终回答。
4. 计划有变时说明原因，并更新步骤编号。
5. 需要审批、需要用户确认或卡在外部条件时，明确说在等什么。
6. 最终回答给出结论与产出（文件路径等），并说明哪些步骤完成、失败或跳过。

一步就能完成的小任务可以不编号，但仍要有开头一句和结尾一句。${extra}`
}

/** Read a small JSON request body. */
async function readJsonBody(req, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (size === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Write one JSON response. */
function sendJson(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

/**
 * Register the narration section and its settings route. Config changes are
 * picked up on the next assembly because the section text is a provider.
 * @param ctx - host cordis context.
 * @param config - plugin config from the loader entry.
 */
export function apply(ctx, config = {}) {
  const read = () => effectiveConfig(config)

  let order = 499
  try {
    order = ctx.systemPrompt.getSectionOrder('PLAN_POLICY') - 1
  } catch {
    // Fall back to a fixed slot if the placement name is unavailable.
  }

  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: 'think-flow',
      order,
      text: () => buildSectionText(read()),
      interpolate: false,
    }),
  )

  ctx.inject(['webServer'], (web) => {
    web.effect(() =>
      web.webServer.register({
        kind: 'exact',
        path: '/think-flow/config',
        handler: async (req, res) => {
          const origin = req.headers.origin
          if (origin !== undefined) {
            let sameOrigin = false
            try {
              sameOrigin = new URL(origin).host === req.headers.host
            } catch {
              sameOrigin = false
            }
            if (!sameOrigin) {
              sendJson(res, 403, { ok: false, error: 'forbidden' })
              return
            }
          }

          if (req.method === 'GET') {
            sendJson(res, 200, { ok: true, config: read(), defaults: DEFAULTS })
            return
          }

          if (req.method !== 'POST') {
            sendJson(res, 405, { ok: false, error: 'method not allowed' })
            return
          }

          try {
            const body = await readJsonBody(req)
            const next = normalizeConfig({ ...read(), ...body })
            writeStoredConfig(next)
            sendJson(res, 200, { ok: true, config: next })
          } catch (error) {
            sendJson(res, 400, { ok: false, error: String(error?.message ?? error) })
          }
        },
      }),
    )
  })
}
