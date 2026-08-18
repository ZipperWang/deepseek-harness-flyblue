// PlanReviewPanel: the composer takeover for a question carrying the
// `plan-review` presentation intent. A plan under review is one decision over
// one body of markdown, so it takes the waiting-approval card shape — tinted
// strip, content, right-aligned action row — instead of the generic question
// flow's pager, numbered options, skip and custom-answer affordances, which
// read as a quiz the user is being graded on.
//
// Discuss dismisses the request so the composer returns. Refine stays in plan
// mode. Each approve label leaves plan mode on a different execution path.

import { useState } from 'react'
import { Button, IconEditOutline16, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PendingQuestion, PlanReview, QuestionComposerProps } from './contract/slots.ts'
import css from './PlanReviewPanel.module.css'

/** The panel's own props: the question domain face, the narrowed review, and the locale seat. */
export type PlanReviewPanelProps =
  { pending: PendingQuestion; review: PlanReview } & Pick<QuestionComposerProps, 't'>

/** Localise a known execution-path label; unknown labels use the generic approve copy. */
function approveCopy(label: string, t: PlanReviewPanelProps['t']): string {
  switch (label) {
    case 'Approve and execute':
      return t('plan.approve.execute')
    case 'Approve and compact context':
      return t('plan.approve.compact')
    case 'Approve and keep context':
      return t('plan.approve.keep')
    default:
      return t('plan.approve')
  }
}

/**
 * Optional-prop spread for a decision button's tooltip: `title` is optional on
 * the DOM props, and exactOptionalPropertyTypes rejects an explicit undefined.
 *
 * @param description - the asker's option description, when it carries one.
 * @returns The `title` prop to spread, or nothing.
 */
function tooltip(description: string | undefined): { title?: string } {
  return description === undefined ? {} : { title: description }
}

/**
 * Render a plan review as a decision card.
 *
 * @param props - the question domain face, the narrowed plan review, and `t`.
 * @returns The plan-review takeover for this request.
 */
export function PlanReviewPanel({ pending, review, t }: PlanReviewPanelProps) {
  // One-shot latch shaped like the approval takeover's: the panel leaves only
  // when the host's resolved frame lands, so until then a second click must
  // not re-fire. A failed send (rejected receipt / transport) re-arms it and
  // shows why, since nothing else would tell the user the click was lost.
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const settle = (send: () => Promise<void>): void => {
    setBusy(true)
    setError(null)
    void send().catch((cause: unknown) => {
      setBusy(false)
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }
  const decide = (label: string): void => {
    settle(() => pending.answer({ answers: [{ id: review.id, selected: [label] }] }))
  }
  const refine = review.refine

  return (
    <div className={css.frame} data-plan-review-key={pending.key}>
      <section className={css.card} aria-label={review.question}>
        <div className={css.strip}>
          <span className={css.dot} />
          {t('plan.header')}
        </div>
        <div className={css.body} data-plan-review-scroll>
          <MarkdownText text={review.plan} />
        </div>
        <div className={css.footer}>
          <div className={css.feedback} role="status">{error}</div>
          <div className={css.actions}>
            <Button
              variant="ghost" className={css.discuss} icon={<IconEditOutline16 size={14} />}
              disabled={busy} onClick={() => { settle(() => pending.cancel()) }}
            >
              {t('plan.discuss')}
            </Button>
            {refine !== undefined && (
              <Button
                variant="outline" {...tooltip(refine.description)}
                disabled={busy} onClick={() => { decide(refine.label) }}
              >
                {t('plan.refine')}
              </Button>
            )}
            {review.approves.map((option, index) => (
              <Button
                key={option.label}
                variant={index === review.approves.length - 1 ? 'primary' : 'outline'}
                {...tooltip(option.description)}
                disabled={busy} onClick={() => { decide(option.label) }}
              >
                {approveCopy(option.label, t)}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
