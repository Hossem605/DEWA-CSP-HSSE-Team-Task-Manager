import React, { useEffect, useMemo, useState } from 'react'
import TaskModal from '../ui/TaskModal.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import * as XLSX from 'xlsx'
import { db } from '../firebase'
import { collection, query as fsQuery, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'

// Table row click will open edit modal; actions column keeps edit/delete buttons
export default function Dashboard() {
  const { user, logout, isFirebaseConfigured } = useAuth()
  const [tasks, setTasks] = useState(() => {
    const raw = localStorage.getItem('gtm_tasks')
    return raw ? JSON.parse(raw) : []
  })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Persist tasks to localStorage ONLY in demo mode
  useEffect(() => {
    if (!isFirebaseConfigured) {
      localStorage.setItem('gtm_tasks', JSON.stringify(tasks))
    }
  }, [tasks, isFirebaseConfigured])

  // Firestore real-time subscription (when configured)
  useEffect(() => {
    if (!isFirebaseConfigured || !user?.uid) return
    const colRef = collection(db, 'users', user.uid, 'tasks')
    const q = fsQuery(colRef, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTasks(items)
    })
    return () => unsub()
  }, [isFirebaseConfigured, user?.uid])

  // Migrate legacy tasks (demo mode only)
  useEffect(() => {
    if (isFirebaseConfigured) return
    let changed = false
    const next = tasks.map(t => {
      if (!t) return t
      if (!Array.isArray(t.updateHistory) && t.update && String(t.update).trim()) {
        changed = true
        const at = t.lastUpdated || new Date().toLocaleString()
        return { ...t, updateHistory: [{ note: String(t.update).trim(), at, type: 'manual' }], update: '' }
      }
      return t
    })
    if (changed) setTasks(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openNew = () => { setEditing(null); setShowModal(true) }
  const openEdit = (t) => { setEditing(t); setShowModal(true) }

  const removeTask = async (id) => {
    if (isFirebaseConfigured && user?.uid) {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id))
    } else {
      setTasks(prev => prev.filter(t => t.id !== id))
    }
  }

  const upsertTask = async (data) => {
    const stamp = new Date().toLocaleString()
    if (editing) {
      const prev = editing
      let next = { ...prev, ...data }
      // Build update history
      let history = Array.isArray(prev.updateHistory) ? [...prev.updateHistory] : []
  
      // Manual notes: split by new lines into separate points
      if (data.update && data.update.trim()) {
        const points = data.update.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        for (const p of points) history.push({ note: p, at: stamp, type: 'manual', by: user?.name || user?.email || 'Unknown' })
      }
  
      // Auto note on status change
      if (prev.status !== data.status) {
        history.push({ note: `[Auto] Status changed to ${data.status} `, at: stamp, type: 'auto', by: user?.name || user?.email || 'System' })
      }
  
      next.updateHistory = history
      next.lastUpdated = history.length ? history[history.length - 1].at : prev.lastUpdated || stamp
      // Clear flat update field to avoid confusion (we now use structured history)
      next.update = ''
  
      if (isFirebaseConfigured && user?.uid) {
        const ref = doc(db, 'users', user.uid, 'tasks', prev.id)
        await updateDoc(ref, { ...next })
      } else {
        setTasks(prevState => prevState.map(t => t.id === prev.id ? next : t))
      }
    } else {
      // Creating new task
      let history = []
      if (data.update && data.update.trim()) {
        const points = data.update.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        for (const p of points) history.push({ note: p, at: stamp, type: 'manual', by: user?.name || user?.email || 'Unknown' })
      }
      const next = {
        // id handled by Firestore; demo mode uses crypto
        ...data,
        updateHistory: history,
        lastUpdated: history.length ? stamp : stamp,
        update: '',
        createdAt: isFirebaseConfigured ? serverTimestamp() : Date.now()
      }
      if (isFirebaseConfigured && user?.uid) {
        await addDoc(collection(db, 'users', user.uid, 'tasks'), next)
      } else {
        setTasks(prev => [{ id: crypto.randomUUID(), ...next }, ...prev])
      }
    }
    setShowModal(false)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let items = tasks
    if (statusFilter && statusFilter !== 'All') {
      items = items.filter(t => (t.status || '').toLowerCase() === statusFilter.toLowerCase())
    }
    if (!q) return items
    return items.filter(t =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.responsible && t.responsible.toLowerCase().includes(q)) ||
      (t.status && t.status.toLowerCase().includes(q)) ||
      (t.priority && t.priority.toLowerCase().includes(q)) ||
      (Array.isArray(t.updateHistory) && t.updateHistory.some(u => u.note && u.note.toLowerCase().includes(q)))
    )
  }, [tasks, query, statusFilter])

  const stats = useMemo(() => {
    const s = { Open: 0, Pending: 0, Closed: 0 }
    for (const t of tasks) s[t.status] = (s[t.status] || 0) + 1
    return s
  }, [tasks])

  const maxUpdates = useMemo(() => tasks.reduce((m, t) => Math.max(m, (t.updateHistory?.length || 0)), 0), [tasks])

  const exportToExcel = () => {
    const headers = ['#','Task','Priority','Responsible','Start','Due','Status','Last Updated']
    for (let i = 0; i < maxUpdates; i++) {
      headers.push(`Update ${i + 1}`)
      headers.push(`Update ${i + 1} At`)
    }

    const rows = tasks.map((t, idx) => {
      const history = Array.isArray(t.updateHistory) ? t.updateHistory : []
      const base = [idx + 1, t.title || '', t.priority || '', t.responsible || '', t.startDate || '', t.dueDate || '', t.status || '', t.lastUpdated || '']
      for (let i = 0; i < maxUpdates; i++) {
        const entry = history[i]
        base.push(entry ? entry.note : '')
        base.push(entry ? entry.at : '')
      }
      return base
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks')
    XLSX.writeFile(wb, 'tasks.xlsx')
  }

  const header = useMemo(() => (
    <div className="header">
      <h1>DEWA CSP HSSE Team Task Manager</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="search"
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="secondary" onClick={exportToExcel}>Export Excel</button>
        <div className="small" style={{ marginRight: 8 }}>
          {user?.name ? (
            <>
              <strong>{user.name}</strong>{user?.position ? ` — ${user.position}` : ''}
            </>
          ) : (
            <span>Signed in as {user?.email}</span>
          )}
        </div>
        <button className="secondary" onClick={logout}>Logout</button>
        <button className="button" onClick={openNew}>Add New Task</button>
      </div>
    </div>
  ), [user, query, tasks, maxUpdates])

  return (
    <div className="container">
      {header}
      <div className="stats">
        <div className="stat open float-1">Open: {stats.Open}</div>
        <div className="stat pending float-2">Pending: {stats.Pending}</div>
        <div className="stat closed float-3">Closed: {stats.Closed}</div>
      </div>

      <div className="table-wrap">
        <table className="tasks-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Task</th>
              <th>Priority</th>
              <th>Responsible</th>
              <th>Start</th>
              <th>Due</th>
              <th>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Status</span>
                  <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option>All</option>
                    <option>Open</option>
                    <option>Pending</option>
                    <option>Closed</option>
                  </select>
                </div>
              </th>
              <th>Last Updated</th>
              {/* Dynamic update history columns - last column will always be the latest update */}
              {Array.from({ length: maxUpdates }, (_, i) => (
                <th key={i}>Update {i + 1}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, idx) => {
              const statusClass = t.status === 'Open' ? 'open' : t.status === 'Pending' ? 'pending' : 'closed'
              const history = Array.isArray(t.updateHistory) ? t.updateHistory : []
              return (
                <tr key={t.id} className={statusClass} onClick={() => openEdit(t)} style={{ cursor: 'pointer' }}>
                  <td>{idx + 1}</td>
                  <td>{t.title}</td>
                  <td>{t.priority}</td>
                  <td>{t.responsible}</td>
                  <td>{t.startDate || '-'}</td>
                  <td>{t.dueDate || '-'}</td>
                  <td>
                    <span className={`status ${statusClass}`}>{t.status}</span>
                  </td>
                  <td>{t.lastUpdated || '-'}</td>
                  {Array.from({ length: maxUpdates }, (_, i) => {
                    const entry = history[i]
                    return (
                      <td key={i} className="update-cell">
                        {entry ? (
                          <div>
                            <div className="update-note">{entry.note}</div>
                            <div className="update-time small">{entry.at}{entry.by ? ` — ${entry.by}` : ''}</div>
                          </div>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                    )
                  })}
                  <td onClick={e => e.stopPropagation()}>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button className="secondary" onClick={() => openEdit(t)}>Edit</button>
                      <button className="delete" onClick={() => removeTask(t.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <TaskModal
          initial={editing}
          onCancel={() => setShowModal(false)}
          onSave={upsertTask}
        />
      )}
    </div>
  )
}