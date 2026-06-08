'use client'

import { useState } from 'react'
import { addReservation, getReservationsByPhone, deleteReservation } from '../../lib/reservations'
import styles from './reservation.module.css'

const TIMES = [
  { label: '5:00 PM', value: '17:00' },
  { label: '5:30 PM', value: '17:30' },
  { label: '6:00 PM', value: '18:00' },
  { label: '6:30 PM', value: '18:30' },
  { label: '7:00 PM', value: '19:00' },
  { label: '7:30 PM', value: '19:30' },
  { label: '8:00 PM', value: '20:00' },
  { label: '8:30 PM', value: '20:30' },
]

const PARTIES = [1, 2, 3, 4, 5, '6+']

const today = new Date().toISOString().split('T')[0]

export default function ReservationPage() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    date: today,
    occasion: '',
    requests: '',
  })
  const [selectedTime, setSelectedTime] = useState('')
  const [selectedParty, setSelectedParty] = useState(null)
  const [agreeLatePolicy, setAgreeLatePolicy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(null)
  const [cancelList, setCancelList] = useState([])
  const [cancelError, setCancelError] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState('')

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setCancelSuccess('')
    setCancelError('')
  }

  function isPastTime(date, time) {
    if (!date || !time) return false
    const [hours, minutes] = time.split(':').map(Number)
    const reservationDate = new Date(date)
    reservationDate.setHours(hours, minutes, 0, 0)
    return reservationDate <= new Date()
  }

  function normalizePhoneNumber(value) {
    return String(value || '').replace(/\D/g, '')
  }

  const isToday = form.date === today
  const showTodayExpired = isToday && TIMES.every((t) => isPastTime(form.date, t.value))

  async function handleSubmit() {
    setError('')
    if (!form.name.trim()) return setError('Please enter your name.')
    if (!form.phone.trim()) return setError('Please enter your phone number.')
    const phoneDigits = normalizePhoneNumber(form.phone)
    if (phoneDigits.length !== 11) return setError('Phone number must contain exactly 11 digits.')
    if (!form.date) return setError('Please select a date.')
    if (!selectedTime) return setError('Please choose a preferred time.')
    if (!selectedParty) return setError('Please select your party size.')
    if (!agreeLatePolicy) return setError('Please acknowledge the late arrival policy before confirming.')
    if (isPastTime(form.date, selectedTime)) {
      return setError('Please choose a future time for today.')
    }

    setLoading(true)
    try {
      const { ref } = await addReservation({
        name: form.name.trim(),
        phone: form.phone.trim(),
        date: form.date,
        time: selectedTime,
        party: selectedParty,
        occasion: form.occasion,
        requests: form.requests.trim(),
      })
      setConfirmed({ ...form, time: selectedTime, party: selectedParty, ref })
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setForm({ name: '', phone: '', date: today, occasion: '', requests: '' })
    setSelectedTime('')
    setSelectedParty(null)
    setAgreeLatePolicy(false)
    setConfirmed(null)
    setError('')
    setCancelList([])
    setCancelError('')
    setCancelSuccess('')
  }

  async function handleFindReservation() {
    setCancelError('')
    setCancelSuccess('')
    setCancelList([])
    if (!form.phone.trim()) {
      return setCancelError('Please enter your phone number to find your reservation.')
    }
    const phoneDigits = normalizePhoneNumber(form.phone)
    if (phoneDigits.length !== 11) {
      return setCancelError('Phone number must contain exactly 11 digits.')
    }

    setCancelLoading(true)
    try {
      const reservations = await getReservationsByPhone(form.phone.trim())
      if (!reservations.length) {
        setCancelError('No reservation found for that phone number.')
        return
      }
      setCancelList(reservations)
    } catch (err) {
      console.error(err)
      setCancelError('Unable to find reservations. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleCancelReservation(id) {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) {
      return
    }
    setCancelError('')
    setCancelSuccess('')
    setCancelLoading(true)
    try {
      await deleteReservation(id)
      setCancelList((list) => list.filter((item) => item.id !== id))
      setCancelSuccess('Reservation canceled successfully.')
    } catch (err) {
      console.error(err)
      setCancelError('Unable to cancel reservation. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }

  function formatDate(d) {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  function formatTime(t) {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${m === 0 ? '00' : m} ${ampm}`
  }

  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.logo}>NOVA</div>
      </nav>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.eyebrow}>Fine Dining · Est. 2022</div>
        <h1 className={styles.heroTitle}>
          Reserve Your<br /><em>Evening</em>
        </h1>
        <p className={styles.heroSub}>An intimate experience crafted for you</p>
      </div>

      {/* Form or Success */}
      {confirmed ? (
        <div className={styles.successWrap}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>You&apos;re Confirmed</h2>
          <p className={styles.successDetail}>
            {confirmed.name}<br />
            {formatDate(confirmed.date)}<br />
            {formatTime(confirmed.time)} · Party of {confirmed.party}
            {confirmed.occasion && <><br />{confirmed.occasion}</>}
          </p>
          <p className={styles.successRef}>Reference: {confirmed.ref}</p>
          <div className={styles.callInfo} style={{ marginTop: '20px' }}>
            <p className={styles.callLabel}>Need to call us?</p>
            <p>
              If you&apos;re running late, call <a href="tel:+2340000000000">+234 000 0000 000</a>.
            </p>
          </div>
          <button className={styles.submitBtn} onClick={handleReset}>
            Make Another Reservation
          </button>
        </div>
      ) : (
        <div className={styles.formWrap}>
          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <div className={styles.dividerDiamond} />
            <div className={styles.dividerLine} />
          </div>

          {/* Name + Phone */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Personal/Business Name" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone Number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="08012345678"
                type="tel"
                inputMode="tel"
              />
            </div>
          </div>

          {/* Date + Occasion */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Date</label>
              <input name="date" value={form.date} onChange={handleChange} type="date" min={today} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                Occasion <span className={styles.optional}>(optional)</span>
              </label>
              <select name="occasion" value={form.occasion} onChange={handleChange}>
                <option value="">Select occasion</option>
                <option>Birthday Celebration</option>
                <option>Marriage Proposal</option>
                <option>Anniversary</option>
                <option>Business Dinner</option>
                <option>Date Night</option>
                <option>Family Gathering</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          {/* Time */}
          <div className={styles.field} style={{ marginBottom: '20px' }}>
            <label className={styles.label}>Preferred Time</label>
            <div className={styles.timeGrid}>
              {TIMES.map((t) => {
                const disabled = isToday && isPastTime(form.date, t.value)
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={`${styles.timeBtn} ${selectedTime === t.value ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
                    onClick={() => !disabled && setSelectedTime(t.value)}
                    disabled={disabled}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            {showTodayExpired && (
              <p className={styles.error} style={{ marginTop: '12px' }}>
                Today&apos;s available times have already passed. Please choose another date.
              </p>
            )}
          </div>

          {/* Party Size */}
          <div className={styles.field} style={{ marginBottom: '20px' }}>
            <label className={styles.label}>Party Size</label>
            <div className={styles.partyGrid}>
              {PARTIES.map((p) => (
                <button
                  key={p}
                  className={`${styles.partyBtn} ${selectedParty === p ? styles.selected : ''}`}
                  onClick={() => setSelectedParty(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Special Requests */}
          <div className={styles.field}>
            <label className={styles.label}>
              Special Requests <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              name="requests"
              value={form.requests}
              onChange={handleChange}
              placeholder="Dietary restrictions, seating preferences, accessibility needs…"
            />
          </div>

          <div className={styles.policyRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={agreeLatePolicy}
                onChange={(e) => setAgreeLatePolicy(e.target.checked)}
                className={styles.checkboxInput}
              />
              I understand that if I am more than 45 minutes late, my reservation may be canceled and the table reassigned.
            </label>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Confirming…' : 'Confirm Reservation'}
          </button>

          <div className={styles.secondarySection}>
            <div className={styles.callInfo}>
              <p className={styles.callLabel}>Running late?</p>
              <p>
                Call us at <a href="tel:+2349039986098">+234 903 998 6098</a> so we can hold your table.
              </p>
            </div>

            <div className={styles.cancelSection}>
              <p className={styles.callLabel}>Cancel a reservation</p>
              <p>Use the same phone number from your booking to find and cancel your reservation.</p>
              <div className={styles.cancelRow}>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+234 000 0000 000"
                  type="tel"
                  className={styles.cancelInput}
                />
                <button
                  type="button"
                  className={styles.cancelSearchBtn}
                  onClick={handleFindReservation}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? 'Searching…' : 'Find reservation'}
                </button>
              </div>
              {cancelError && <p className={styles.error}>{cancelError}</p>}
              {cancelSuccess && <p className={styles.successMessage}>{cancelSuccess}</p>}
              {cancelList.length > 0 && (
                <div className={styles.reservationList}>
                  {cancelList.map((reservation) => (
                    <div key={reservation.id} className={styles.reservationCard}>
                      <div>
                        <p className={styles.reservationRef}>{reservation.ref}</p>
                        <p>{formatDate(reservation.date)} · {formatTime(reservation.time)}</p>
                        <p>Status: {reservation.status || 'pending'}</p>
                      </div>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => handleCancelReservation(reservation.id)}
                        disabled={cancelLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
