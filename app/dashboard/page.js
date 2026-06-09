'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../../lib/firebase'
import {
  subscribeToReservations,
  confirmReservation,
  deleteReservation,
  cancelReservation,
  completeReservation,
  assignTableNumber,
  markArrivedReservation,
  markRunningLate,
} from '../../lib/reservations'
import styles from './dashboard.module.css'

const today = new Date().toISOString().split('T')[0]
const TOTAL_TABLES = 20
const TABLE_NUMBERS = Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1)

function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m === 0 ? '00' : m} ${ampm}`
}

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Login Screen ──────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shaking, setShaking] = useState(false)

  async function handleLogin() {
    if (!email || !password) return setError('Please enter your email and password.')
    setLoading(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // onAuthStateChanged in the parent will automatically switch to dashboard
    } catch (err) {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('Incorrect email or password.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.')
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className={styles.loginPage}>
      <div className={`${styles.loginCard} ${shaking ? styles.shake : ''}`}>
        <div className={styles.loginLogo}>NOVA</div>
        <div className={styles.loginEyebrow}>Staff Access Only</div>
        <h2 className={styles.loginTitle}>Reception Dashboard</h2>
        <p className={styles.loginSub}>Sign in with your staff account</p>

        <div className={styles.loginField}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            onKeyDown={handleKey}
            className={styles.loginInput}
            autoFocus
          />
        </div>

        <div className={styles.loginField}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            onKeyDown={handleKey}
            className={styles.loginInput}
          />
        </div>

        {error && <p className={styles.loginError}>{error}</p>}

        <button className={styles.loginBtn} onClick={handleLogin} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <Link href="/" className={styles.loginBack}>
          ← Back to reservation page
        </Link>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────
export default function DashboardPage() {
  const [user, setUser] = useState(undefined) // undefined = still checking auth
  const [reservations, setReservations] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRequests, setExpandedRequests] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Firebase auth state — persists across refreshes automatically
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null)
    })
    return () => unsub()
  }, [])

  // Subscribe to reservations immediately, even before login state resolves
  useEffect(() => {
    const unsub = subscribeToReservations((data) => {
      setReservations(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleSearch() {
    setSearchQuery(searchInput.trim())
  }

  function toggleRequest(id) {
    setExpandedRequests((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleConfirm(id) {
    await confirmReservation(id)
    showToast('Reservation confirmed ✓')
  }

  async function handleArrived(id) {
    await markArrivedReservation(id)
    showToast('Guest marked arrived ✓')
  }

  async function handleLate(id) {
    await markRunningLate(id)
    showToast('Guest marked running late')
  }

  async function handleDelete(id) {
    if (!confirm('Delete this reservation?')) return
    await deleteReservation(id)
    showToast('Reservation deleted')
  }

  async function handleCancel(id) {
    if (!confirm('Cancel this reservation?')) return
    await cancelReservation(id)
    showToast('Reservation cancelled')
  }

  async function handleComplete(id) {
    if (!confirm('Mark this table free?')) return
    await completeReservation(id)
    showToast('Table returned to free status ✓')
  }

  async function handleAssignTable(id, tableNumber) {
    if (!tableNumber) return
    await assignTableNumber(id, Number(tableNumber))
    showToast(`Table ${tableNumber} assigned ✓`)
  }

  async function handleLogout() {
    await signOut(auth)
  }

  // Still checking auth — render nothing to avoid flash
  if (user === undefined) return null

  // Not logged in — show login screen
  if (!user) return <LoginScreen />

  // ── Logged in — show dashboard ────────────────────────
  const todayRes = reservations.filter((r) => r.date === today)
  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const pending = reservations.filter((r) => r.status === 'pending')
  const tonightGuests = todayRes.reduce((a, r) => a + (typeof r.party === 'number' ? r.party : 6), 0)

  const todayAssignedReservations = reservations.filter((r) => r.date === today && r.status !== 'cancelled' && r.status !== 'completed' && r.tableNumber)
  const activeAssignedTableNumbers = Array.from(new Set(todayAssignedReservations.map((r) => Number(r.tableNumber))))
  const arrivedCount = reservations.filter((r) => r.date === today && r.status === 'arrived' && r.tableNumber).length
  const takenTables = arrivedCount
  const reservedTables = Math.max(0, activeAssignedTableNumbers.length - takenTables)
  const freeTables = Math.max(0, TOTAL_TABLES - activeAssignedTableNumbers.length)

  const filtered = reservations
    .filter((r) => {
      if (filter === 'confirmed') return r.status === 'confirmed'
      if (filter === 'pending') return r.status === 'pending'
      if (filter === 'tonight') return r.date === today
      return true
    })
    .filter((r) => {
      if (!searchQuery) return true
      return r.name.toLowerCase().includes(searchQuery.toLowerCase())
    })

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.logo}>NOVA</div>
        <div className={styles.navRight}>
          <span className={styles.liveBadge}>● LIVE</span>
          <span className={styles.loggedInAs}>{user.email}</span>
          <Link href="/" className={styles.backLink}>← Guest Page</Link>
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </nav>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Reception · Live View</div>
          <h1 className={styles.title}>Reservations</h1>
          <p className={styles.subtitle}>
            {loading ? 'Loading…' : `${reservations.length} reservation${reservations.length !== 1 ? 's' : ''} on record`}
          </p>
        </div>
        <div className={styles.dateBlock}>{todayFormatted}</div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Bookings</div>
          <div className={styles.statValue}>{reservations.length}</div>
          <div className={styles.statSub}>All time</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Tonight</div>
          <div className={styles.statValue}>{todayRes.length}</div>
          <div className={styles.statSub}>Reservations today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Guests Expected</div>
          <div className={styles.statValue}>{tonightGuests}</div>
          <div className={styles.statSub}>Tonight&apos;s covers</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Confirmed</div>
          <div className={styles.statValue}>{confirmed.length}</div>
          <div className={styles.statSub}>
            Awaiting <strong>{pending.length}</strong> pending
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Tables</div>
          <div className={styles.statValue}>{takenTables + reservedTables}</div>
          <div className={styles.statSub}>
            Taken <strong>{takenTables}</strong> · Reserved <strong>{reservedTables}</strong> · Free <strong>{freeTables}</strong>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>All Reservations</div>
          <div className={styles.filters}>
            {['all', 'confirmed', 'pending', 'tonight'].map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.searchRow}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by guest name"
            className={styles.searchInput}
          />
          <button type="button" className={styles.searchBtn} onClick={handleSearch}>
            Search
          </button>
          {(searchQuery || searchInput) && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => { setSearchInput(''); setSearchQuery('') }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Loading reservations…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📅</div>
            <p className={styles.emptyText}>No reservations found</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Date & Time</th>
                  <th>Party</th>
                  <th>Occasion</th>
                  <th>Special Requests</th>
                  <th>Table</th>
                  <th>Status</th>
                  <th>Ref</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className={styles.guestName}>{r.name}</div>
                      <div className={styles.guestPhone}>{r.phone}</div>
                    </td>
                    <td>
                      <div className={styles.dateBadge}>{formatDate(r.date)}</div>
                      <div className={styles.timeText}>{formatTime(r.time)}</div>
                    </td>
                    <td>
                      <span className={styles.partyPill}>👥 {r.party}</span>
                    </td>
                    <td>
                      <span className={styles.occasionText}>{r.occasion || '—'}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.requestText} ${expandedRequests[r.id] ? styles.expandedRequestText : ''}`}
                        title={r.requests}
                      >
                        {r.requests
                          ? expandedRequests[r.id]
                            ? r.requests
                            : `${r.requests.slice(0, 36)}${r.requests.length > 36 ? '…' : ''}`
                          : '—'}
                      </span>
                      {r.requests && r.requests.length > 36 && (
                        <button
                          type="button"
                          className={styles.requestToggleBtn}
                          onClick={() => toggleRequest(r.id)}
                        >
                          {expandedRequests[r.id] ? '▲ View less' : '▼ View more'}
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${
                        r.status === 'confirmed' ? styles.confirmed
                        : r.status === 'late' ? styles.late
                        : r.status === 'arrived' ? styles.arrived
                        : r.status === 'completed' ? styles.completed
                        : r.status === 'cancelled' ? styles.cancelled
                        : styles.pending
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {r.tableNumber ? (
                        <span className={styles.tablePill}>Table {r.tableNumber}</span>
                      ) : (
                        <select
                          className={styles.tableSelect}
                          value=""
                          onChange={(e) => handleAssignTable(r.id, e.target.value)}
                        >
                          <option value="">Assign table</option>
                          {TABLE_NUMBERS.map((table) => {
                            const takenByOther = activeAssignedTableNumbers.includes(table) && Number(r.tableNumber) !== table
                            return (
                              <option key={table} value={table} disabled={takenByOther}>
                                {takenByOther ? `Table ${table} (taken)` : `Table ${table}`}
                              </option>
                            )
                          })}
                        </select>
                      )}
                    </td>
                    <td>
                      <span className={styles.refCode}>{r.ref}</span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {r.status === 'pending' && (
                          <button className={`${styles.actionBtn} ${styles.confirmBtn}`} onClick={() => handleConfirm(r.id)} title="Confirm reservation">✓</button>
                        )}
                        {(r.status === 'confirmed' || r.status === 'late') && (
                          <button className={`${styles.actionBtn} ${styles.arrivedBtn}`} onClick={() => handleArrived(r.id)} title="Mark arrived">✔</button>
                        )}
                        {r.status === 'confirmed' && (
                          <button className={`${styles.actionBtn} ${styles.lateBtn}`} onClick={() => handleLate(r.id)} title="Mark running late">⏱</button>
                        )}
                        {(r.status === 'pending' || r.status === 'confirmed' || r.status === 'late') && (
                          <button className={`${styles.actionBtn} ${styles.cancelBtn}`} onClick={() => handleCancel(r.id)} title="Cancel reservation">X</button>
                        )}
                        {r.status === 'arrived' && (
                          <button className={`${styles.actionBtn} ${styles.completeBtn}`} onClick={() => handleComplete(r.id)} title="Free table">🍽️</button>
                        )}
                        <button className={`${styles.actionBtn} ${styles.deleteBtn} ${styles.trashBtn}`} onClick={() => handleDelete(r.id)} title="Delete reservation">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
