import { useState } from 'react'
import { EyeOff, Flag, Loader2, MessageSquare, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from 'cn'
import { savedNickname, type Review, type ReviewInput, type ReviewsState } from '../data/reviews'
import { useTurnstile } from '@/lib/turnstile'
import { LOCALE, pick } from '@/i18n'

const BODY_MAX = 500

const L = pick({
  vi: {
    title: 'Đánh giá',
    summary: (n: number) => `${n} đánh giá`,
    empty: 'Chưa có đánh giá nào — hãy là người đầu tiên.',
    write: 'Viết đánh giá',
    mine: 'Đánh giá của bạn',
    hiddenMine: 'Đang bị ẩn do bị báo cáo — chỉ bạn thấy.',
    edit: 'Sửa',
    remove: 'Xoá',
    confirmRemove: 'Bấm lần nữa để xoá',
    rating: 'Số sao',
    star: (n: number) => `${n} sao`,
    nickname: 'Biệt danh',
    nicknameHint: 'Hiện công khai, 2–30 ký tự.',
    body: 'Bình luận (không bắt buộc)',
    bodyPlaceholder: 'Trạm có dễ tìm không, cổng nào hay lỗi, có mái che / WC không…',
    rules: 'Bình luận công khai. Không đăng link, email hay số điện thoại.',
    cancel: 'Huỷ',
    send: 'Gửi',
    report: 'Báo cáo',
    reportAsk: 'Báo cáo bình luận này là spam / không phù hợp?',
    reportSend: 'Gửi báo cáo',
    reported: 'Đã báo cáo',
    more: 'Xem thêm',
    retry: 'Thử lại',
    edited: ' · đã sửa',
  },
  en: {
    title: 'Reviews',
    summary: (n: number) => `${n} ${n === 1 ? 'review' : 'reviews'}`,
    empty: 'No reviews yet — be the first.',
    write: 'Write a review',
    mine: 'Your review',
    hiddenMine: 'Hidden after reports — only you can see it.',
    edit: 'Edit',
    remove: 'Delete',
    confirmRemove: 'Tap again to delete',
    rating: 'Rating',
    star: (n: number) => `${n} ${n === 1 ? 'star' : 'stars'}`,
    nickname: 'Nickname',
    nicknameHint: 'Shown publicly, 2–30 characters.',
    body: 'Comment (optional)',
    bodyPlaceholder: 'Easy to find? Any faulty ports? Shelter / toilets?',
    rules: 'Comments are public. No links, emails or phone numbers.',
    cancel: 'Cancel',
    send: 'Post',
    report: 'Report',
    reportAsk: 'Report this comment as spam / inappropriate?',
    reportSend: 'Send report',
    reported: 'Reported',
    more: 'Show more',
    retry: 'Retry',
    edited: ' · edited',
  },
})

const fmtDate = (t: number) => new Date(t).toLocaleDateString(LOCALE, { day: 'numeric', month: 'numeric', year: 'numeric' })
const fmtAvg = (v: number) => v.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

type Reviews = ReviewsState & {
  reload: () => void
  loadMore: () => Promise<void>
  save: (input: ReviewInput) => Promise<void>
  remove: () => Promise<void>
  report: (id: number, turnstile?: string | null) => Promise<{ hidden: boolean; already?: boolean }>
}

/** Khối "Đánh giá" trong bảng trạm: điểm TB + phân bố, bài của tôi, form, danh sách, báo cáo. */
export function ReviewsSection({ reviews, theme }: { reviews: Reviews; theme: 'light' | 'dark' }) {
  const [editing, setEditing] = useState(false)
  const { page } = reviews
  if (reviews.disabled) return null

  const items = page ? [...page.items, ...reviews.more] : []

  return (
    <section className="mt-3 flex flex-col gap-2.5 rounded-xl bg-muted px-3 py-2.5" aria-label={L.title}>
      <header className="flex items-center gap-2 text-sm">
        <MessageSquare className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="font-semibold">{L.title}</span>
        {page && page.count > 0 && page.avg !== null && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Star className="size-3.5 fill-[#F0A500] text-[#F0A500]" aria-hidden />
            <span className="font-semibold text-foreground tabular-nums">{fmtAvg(page.avg)}</span>· {L.summary(page.count)}
          </span>
        )}
        {reviews.loading && <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" aria-hidden />}
      </header>

      {reviews.error && (
        <p className="flex items-center gap-2 text-xs text-destructive">
          {reviews.error}
          <button type="button" className="font-medium underline" onClick={reviews.reload}>
            {L.retry}
          </button>
        </p>
      )}

      {page && page.count > 0 && <Distribution dist={page.dist} count={page.count} />}

      {page &&
        (editing ? (
          <ReviewForm
            initial={page.mine}
            theme={theme}
            onCancel={() => setEditing(false)}
            onSave={async (input) => {
              await reviews.save(input)
              setEditing(false)
            }}
          />
        ) : page.mine ? (
          <MyReview review={page.mine} onEdit={() => setEditing(true)} onRemove={reviews.remove} />
        ) : (
          <Button variant="outline" size="sm" className="self-start bg-card" onClick={() => setEditing(true)}>
            <Star />
            {L.write}
          </Button>
        ))}

      {page && items.length === 0 && !page.mine && <p className="text-xs text-muted-foreground">{L.empty}</p>}

      {items.length > 0 && (
        <ul className="flex flex-col">
          {items.map((r) => (
            <ReviewItem key={r.id} review={r} theme={theme} onReport={reviews.report} />
          ))}
        </ul>
      )}

      {reviews.next !== null && (
        <Button variant="ghost" size="sm" className="self-start" disabled={reviews.loadingMore} onClick={() => void reviews.loadMore()}>
          {reviews.loadingMore && <Loader2 className="animate-spin" />}
          {L.more}
        </Button>
      )}
    </section>
  )
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('flex shrink-0 gap-px', className)} role="img" aria-label={L.star(value)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('size-3.5', i <= value ? 'fill-[#F0A500] text-[#F0A500]' : 'text-muted-foreground/40')} aria-hidden />
      ))}
    </span>
  )
}

function Distribution({ dist, count }: { dist: number[]; count: number }) {
  return (
    <div className="flex flex-col gap-0.5" aria-hidden>
      {[5, 4, 3, 2, 1].map((s) => (
        <div key={s} className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
          <span className="w-2 text-right">{s}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
            <span className="block h-full rounded-full bg-[#F0A500]" style={{ width: `${(dist[s - 1] / count) * 100}%` }} />
          </span>
          <span className="w-6 text-right">{dist[s - 1]}</span>
        </div>
      ))}
    </div>
  )
}

function MyReview({ review, onEdit, onRemove }: { review: Review; onEdit: () => void; onRemove: () => Promise<void> }) {
  const [arming, setArming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{L.mine}</span>
        <Stars value={review.rating} />
      </div>
      {review.hidden && (
        <p className="flex items-center gap-1 text-xs text-[#B45309] dark:text-[#F0A500]">
          <EyeOff className="size-3.5" aria-hidden />
          {L.hiddenMine}
        </p>
      )}
      {review.body && <p className="whitespace-pre-wrap break-words text-sm">{review.body}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {L.edit}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onBlur={() => setArming(false)}
          onClick={async () => {
            if (!arming) return setArming(true)
            try {
              await onRemove()
            } catch (e) {
              setError((e as Error).message)
              setArming(false)
            }
          }}
        >
          {arming ? L.confirmRemove : L.remove}
        </Button>
      </div>
    </div>
  )
}

function ReviewForm({
  initial,
  theme,
  onCancel,
  onSave,
}: {
  initial: Review | null
  theme: 'light' | 'dark'
  onCancel: () => void
  onSave: (input: ReviewInput) => Promise<void>
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [nickname, setNickname] = useState(() => initial?.nickname ?? savedNickname())
  const [body, setBody] = useState(initial?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ts = useTurnstile(true, theme)

  const nickOk = nickname.trim().length >= 2 && nickname.trim().length <= 30
  const ready = rating >= 1 && nickOk && !busy && (!ts.needed || ts.token !== null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ rating, nickname: nickname.trim(), body: body.trim(), turnstile: ts.token })
    } catch (e) {
      setError((e as Error).message)
      ts.reset()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      data-vaul-no-drag
      className="flex flex-col gap-2 rounded-lg bg-card px-3 py-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) void submit()
      }}
    >
      <div role="radiogroup" aria-label={L.rating} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={L.star(i)}
            onClick={() => setRating(i)}
            className="rounded-md p-0.5 outline-none focus-visible:ring-3 focus-visible:ring-brand/35"
          >
            <Star className={cn('size-7', i <= rating ? 'fill-[#F0A500] text-[#F0A500]' : 'text-muted-foreground/40')} />
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {L.nickname}
        <Input value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} className="text-foreground" />
        <span>{L.nicknameHint}</span>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {L.body}
        <textarea
          value={body}
          maxLength={BODY_MAX}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          placeholder={L.bodyPlaceholder}
          className="w-full resize-none rounded-xl border border-transparent bg-muted px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-brand focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-brand/35"
        />
        <span className="flex justify-between">
          <span>{L.rules}</span>
          <span className="tabular-nums">
            {body.length}/{BODY_MAX}
          </span>
        </span>
      </label>
      {ts.needed && <div ref={ts.ref} />}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {L.cancel}
        </Button>
        <Button type="submit" variant="brand" size="sm" disabled={!ready}>
          {busy && <Loader2 className="animate-spin" />}
          {L.send}
        </Button>
      </div>
    </form>
  )
}

function ReviewItem({
  review,
  theme,
  onReport,
}: {
  review: Review
  theme: 'light' | 'dark'
  onReport: (id: number, turnstile?: string | null) => Promise<{ hidden: boolean }>
}) {
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ts = useTurnstile(asking, theme)

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await onReport(review.id, ts.token)
      setDone(true)
      setAsking(false)
    } catch (e) {
      setError((e as Error).message)
      ts.reset()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-1 border-b border-background py-2 last:border-b-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate font-semibold text-foreground">{review.nickname}</span>
        <Stars value={review.rating} />
        <span className="ml-auto shrink-0">
          {fmtDate(review.createdAt)}
          {review.updatedAt - review.createdAt > 60_000 ? L.edited : ''}
        </span>
      </div>
      {review.body && <p className="whitespace-pre-wrap break-words text-sm">{review.body}</p>}
      {done ? (
        <span className="text-[11px] text-muted-foreground">{L.reported}</span>
      ) : asking ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-card px-2.5 py-2 text-xs">
          <span>{L.reportAsk}</span>
          {ts.needed && <div ref={ts.ref} />}
          {error && <span className="text-destructive">{error}</span>}
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
              {L.cancel}
            </Button>
            <Button variant="outline" size="sm" disabled={busy || (ts.needed && !ts.token)} onClick={() => void send()}>
              {L.reportSend}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Flag className="size-3" aria-hidden />
          {L.report}
        </button>
      )}
    </li>
  )
}
