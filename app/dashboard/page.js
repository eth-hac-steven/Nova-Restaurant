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
  markArrivedReservation,
  markRunningLate,
} from '../../lib/reservations'
import styles from './dashboard.module.css'

const today = new Date().toISOString().split('T')[0]
const TOTAL_TABLES = 20

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
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
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
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
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
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [reservations, setReservations] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRequests, setExpandedRequests] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Firebase auth — persists across refreshes automatically
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null)
    })
    return () => unsub()
  }, [])

  // Only load reservations when logged in
  useEffect(() => {
    if (!user) return
    const unsub = subscribeToReservations((data) => {
      setReservations(data)
      setLoading(false)
    })
    return () => unsub()
  }, [user])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
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

  async function handleLogout() {
    await signOut(auth)
  }

  // Still checking auth — render nothing to avoid flash
  if (user === undefined) return null

  // Not logged in — show login screen
  if (!user) return <LoginScreen />

  // ── Logged in ─────────────────────────────────────────
  const todayRes = reservations.filter((r) => r.date === today)
  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const pending = reservations.filter((r) => r.status === 'pending')
  const tonightGuests = todayRes.reduce((a, r) => a + (typeof r.party === 'number' ? r.party : 6), 0)

  const arrivedCount = reservations.filter((r) => r.date === today && r.status === 'arrived').length
  const confirmedCount = reservations.filter((r) => r.date === today && r.status === 'confirmed').length
  const takenTables = arrivedCount
  const reservedTables = confirmedCount
  const freeTables = Math.max(0, TOTAL_TABLES - (takenTables + reservedTables))

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

      <nav className={styles.nav}>
        <div className={styles.logo}>NOVA</div>
        <div className={styles.navRight}>
          <span className={styles.liveBadge}>● LIVE</span>
          <span className={styles.loggedInAs}>{user.email}</span>
          <Link href="/" className={styles.backLink}>← Guest Page</Link>
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </nav>

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
          <div className={styles.statSub}>Awaiting <strong>{pending.length}</strong> pending</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Tables</div>
          <div className={styles.statValue}>{takenTables + reservedTables}</div>
          <div className={styles.statSub}>
            Taken <strong>{takenTables}</strong> · Reserved <strong>{reservedTables}</strong> · Free <strong>{freeTables}</strong>
          </div>
        </div>
      </div>

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
            onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(searchInput.trim())}
            placeholder="Search by guest name"
            className={styles.searchInput}
          />
          <button type="button" className={styles.searchBtn} onClick={() => setSearchQuery(searchInput.trim())}>
            Search
          </button>
          {(searchQuery || searchInput) && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => { setSearchInput(''); setSearchQuery('') }}
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
                    <td><span className={styles.partyPill}>👥 {r.party}</span></td>
                    <td><span className={styles.occasionText}>{r.occasion || '—'}</span></td>
                    <td>
                      <span className={`${styles.requestText} ${expandedRequests[r.id] ? styles.expandedRequestText : ''}`}>
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
                          onClick={() => setExpandedRequests((p) => ({ ...p, [r.id]: !p[r.id] }))}
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
                    <td><span className={styles.refCode}>{r.ref}</span></td>
                    <td>
                      <div className={styles.actions}>
                        {r.status === 'pending' && (
                          <button className={`${styles.actionBtn} ${styles.confirmBtn}`} onClick={() => handleConfirm(r.id)} title="Confirm">✓</button>
                        )}
                        {(r.status === 'confirmed' || r.status === 'late') && (
                          <button className={`${styles.actionBtn} ${styles.arrivedBtn}`} onClick={() => handleArrived(r.id)} title="Mark arrived">✔</button>
                        )}
                        {r.status === 'confirmed' && (
                          <button className={`${styles.actionBtn} ${styles.lateBtn}`} onClick={() => handleLate(r.id)} title="Mark late">⏱</button>
                        )}
                        {(r.status === 'pending' || r.status === 'confirmed' || r.status === 'late') && (
                          <button className={`${styles.actionBtn} ${styles.cancelBtn}`} onClick={() => handleCancel(r.id)} title="Cancel">Cancel</button>
                        )}
                        {r.status === 'arrived' && (
                          <button className={`${styles.actionBtn} ${styles.completeBtn}`} onClick={() => handleComplete(r.id)} title="Free table">Free Table</button>
                        )}
                        <button className={`${styles.actionBtn} ${styles.deleteBtn} ${styles.trashBtn}`} onClick={() => handleDelete(r.id)} title="Delete">🗑️</button>
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
