import type { Context } from '@deepseek-ai/cordis'
import type z from '@deepseek-ai/schemastery'

export declare const name = 'dsh-think-flow'

export declare const inject: string[]

export declare const GRANULARITIES: readonly ['off', 'brief', 'standard', 'detailed']

export declare const Config: z<{
  granularity?: 'off' | 'brief' | 'standard' | 'detailed'
  maxSteps?: number
  language?: 'auto' | 'zh' | 'en'
  extraInstructions?: string
}>

export declare function buildSectionText(config?: {
  granularity?: string
  maxSteps?: number
  language?: string
  extraInstructions?: string
}): string

export declare function apply(ctx: Context, config?: unknown): void
