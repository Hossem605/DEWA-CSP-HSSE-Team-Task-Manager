import React, { useEffect, useState } from 'react'

const defaultTask = {
  title: '',
  priority: 'Medium',
  update: '',
  startDate: '',
  dueDate: '',
  status: 'Open',
  responsible: ''
}

export default function TaskModal({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(defaultTask)

  useEffect(() => {
    if (initial) setForm({ ...defaultTask, ...initial })
    else setForm(defaultTask)
  }, [initial])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      title: form.title.trim(),
      priority: form.priority,
      update: form.update,
      startDate: form.startDate,
      dueDate: form.dueDate,
      status: form.status,
      responsible: form.responsible
    })
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3 style={{ marginTop: 0 }}>{initial ? 'Edit Task' : 'Add New Task'}</h3>
        <form onSubmit={submit}>
          <div className="form-row full">
            <div>
              <label className="label">Task & Description</label>
              <textarea
                className="textarea"
                style={{ minHeight: 140 }}
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Write the task title and description..."
              />
            </div>
          </div>

          <div className="form-row">
            <div>
              <label className="label">Priority</label>
              <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option>Open</option>
                <option>Pending</option>
                <option>Closed</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>

          <div className="form-row full">
            <div>
              <label className="label">Responsible Person</label>
              <input className="input" value={form.responsible} onChange={e => set('responsible', e.target.value)} placeholder="Name or email" />
            </div>
          </div>

          <div className="form-row full">
            <div>
              <label className="label">Update</label>
              <textarea className="textarea" value={form.update} onChange={e => set('update', e.target.value)} placeholder="Notes / updates"></textarea>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
            <button className="button" type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}