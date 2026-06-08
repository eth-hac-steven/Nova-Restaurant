import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from './firebase'

const COLLECTION = 'reservations'

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '')
}

// Generate a human-readable reference ID like NOV-0042
function generateRef(count) {
  return 'NOV-' + String(count).padStart(4, '0')
}

// Add a new reservation
export async function addReservation(data) {
  const snapshot = await getDocs(collection(db, COLLECTION))
  const ref = generateRef(snapshot.size + 1)
  const normalizedPhone = normalizePhone(data.phone)

  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    ref,
    normalizedPhone,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return { id: docRef.id, ref }
}

export async function getReservationsByPhone(phone) {
  const normalizedPhone = normalizePhone(phone)
  const q = query(collection(db, COLLECTION), where('normalizedPhone', '==', normalizedPhone))
  const snapshot = await getDocs(q)
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
}

// Real-time listener for the dashboard — calls onChange whenever data changes
export function subscribeToReservations(onChange) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const reservations = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    onChange(reservations)
  })
}

// Fetch all reservations once (used for stats)
export async function fetchReservations() {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Confirm a reservation
export async function confirmReservation(id) {
  await updateDoc(doc(db, COLLECTION, id), { status: 'confirmed' })
}

export async function markArrivedReservation(id) {
  await updateDoc(doc(db, COLLECTION, id), { status: 'arrived' })
}

export async function markRunningLate(id) {
  await updateDoc(doc(db, COLLECTION, id), { status: 'late' })
}

// Delete a reservation
export async function deleteReservation(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

// Cancel a reservation (sets status to cancelled but keeps the record)
export async function cancelReservation(id) {
  await updateDoc(doc(db, COLLECTION, id), { status: 'cancelled' })
}

// Mark an arrived reservation complete and free the table
export async function completeReservation(id) {
  await updateDoc(doc(db, COLLECTION, id), { status: 'completed' })
}
