import { useState } from 'react'
import { NotebookPen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NOTE_MAX, type Note } from '../data/notes'
import { pick } from '@/i18n'

const L = pick({
  vi: {
    add: 'Thêm ghi chú riêng',
    edit: 'Sửa ghi chú',
    label: 'Ghi chú riêng',
    placeholder: 'Ví dụ: cổng 2 hay lỗi, đỗ ở tầng B2, quán cà phê bên cạnh…',
    hint: 'Chỉ lưu trên máy này, đi kèm khi sao lưu / chuyển máy.',
    done: 'Xong',
    remove: 'Xoá',
  },
  en: {
    add: 'Add a private note',
    edit: 'Edit note',
    label: 'Private note',
    placeholder: 'e.g. port 2 is often faulty, park on level B2, café next door…',
    hint: 'Saved on this device only; included in backups.',
    done: 'Done',
    remove: 'Delete',
  },
})

/**
 * Ghi chú cá nhân trong bảng trạm. Gắn `key={entityId}` ở nơi dùng để đổi trạm là bỏ trạng
 * thái đang sửa của trạm trước.
 */
export function NoteBox({ note, onSave }: { note?: Note; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note?.text ?? '')

  function start() {
    setDraft(note?.text ?? '')
    setEditing(true)
  }

  function commit(text = draft) {
    onSave(text)
    setEditing(false)
  }

  if (editing) {
    return (
      <section data-vaul-no-drag className="mt-2 flex flex-col gap-1.5" aria-label={L.label}>
        <textarea
          autoFocus
          value={draft}
          maxLength={NOTE_MAX}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            // Bấm nút Xong / Xoá thì để nút xử lý — blur đến trước click.
            if (!(e.relatedTarget instanceof HTMLButtonElement && e.currentTarget.parentElement?.contains(e.relatedTarget))) commit()
          }}
          placeholder={L.placeholder}
          aria-label={L.label}
          className="w-full resize-none rounded-xl border border-brand bg-card px-3 py-2 text-sm outline-none ring-3 ring-brand/35"
        />
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-muted-foreground">
            {L.hint} {draft.length}/{NOTE_MAX}
          </span>
          {note && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => commit('')}>
              {L.remove}
            </Button>
          )}
          <Button variant="brand" size="sm" onClick={() => commit()}>
            {L.done}
          </Button>
        </div>
      </section>
    )
  }

  if (!note) {
    return (
      <button type="button" onClick={start} className="mt-2 flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
        <Plus className="size-4" aria-hidden />
        {L.add}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={L.edit}
      className="mt-2 flex w-full items-start gap-2 rounded-xl bg-[#F0A500]/12 px-3 py-2 text-left text-sm"
    >
      <NotebookPen className="mt-0.5 size-4 shrink-0 text-[#B45309] dark:text-[#F0A500]" aria-hidden />
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{note.text}</span>
    </button>
  )
}
