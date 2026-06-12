# Nova Restaurant — Reservation System

A live two-sided reservation platform:
- **`/`** — Public guest reservation form
- **`/dashboard`** — Reception staff dashboard with real-time updates

**Stack:** Next.js 14 · Firebase Firestore · Vercel

---

## Step 1 — Set Up Firebase

### 1.1 Create a Firestore Database

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Open your project (or create a new one)
3. In the left sidebar → **Build → Firestore Database**
4. Click **Create database**
5. Choose **Start in production mode** → select a region close to Nigeria (e.g. `europe-west1`) → **Enable**

### 1.2 Set Firestore Security Rules

In Firestore → **Rules** tab, paste this and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reservations/{doc} {
      // Anyone can create a reservation (guests)
      allow create: true;
      // Only allow reads, updates, deletes from your domain
      // (For production, add proper auth — see note below)
      allow read, update, delete: true;
    }
  }
}
```

> **Production tip:** Protect `/dashboard` with Firebase Auth (email/password for staff)
> so only your team can confirm/delete reservations. See the Auth section below.

### 1.3 Get Your Firebase Config

1. Firebase Console → **Project Settings** (gear icon) → **General**
2. Scroll to **Your apps** → click your web app (or **Add app → Web**)
3. Copy the config object — you'll need all 6 values

---

## Step 2 — Run Locally

```bash
# Clone / unzip the project
cd nova-restaurant

# Install dependencies
npm install

# Create your local env file
cp .env.local.example .env.local
```

Open `.env.local` and fill in your Firebase values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123
# (Optional) Google reCAPTCHA v3 — client site key for the browser
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
# (Required on server) reCAPTCHA secret key (keep this private)
RECAPTCHA_SECRET_KEY=your-recaptcha-secret
```

```bash
# Start the dev server
npm run dev
```

Visit:
- Guest page → http://localhost:3000
- Dashboard  → http://localhost:3000/dashboard

---

## Step 3 — Deploy to Vercel

### 3.1 Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Nova reservation system"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/nova-restaurant.git
git push -u origin main
```

### 3.2 Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Click **Import** next to your `nova-restaurant` GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Click **Environment Variables** → add all 6 `NEXT_PUBLIC_FIREBASE_*` variables
   (same values as your `.env.local` — paste them one by one)
5. Click **Deploy**

Vercel will build and give you a live URL like `nova-restaurant.vercel.app`.

### 3.3 Add a Custom Domain (optional)

Vercel Dashboard → your project → **Settings → Domains** → add your domain.

---

## Project Structure

```
nova-restaurant/
├── app/
│   ├── layout.js          # Root layout, fonts
│   ├── globals.css        # Shared CSS variables & resets
│   ├── page.js            # Home → renders reservation page
│   ├── reservation/
│   │   ├── page.js        # Guest-facing reservation form
│   │   └── reservation.module.css
│   └── dashboard/
│       ├── page.js        # Reception dashboard (real-time)
│       └── dashboard.module.css
├── lib/
│   ├── firebase.js        # Firebase app init
│   └── reservations.js   # Firestore helpers (add, confirm, delete, listen)
├── .env.local.example     # Template — copy to .env.local
├── .gitignore             # Keeps .env.local out of git
└── package.json
```

---

## Adding Staff Authentication (Recommended)

To protect the dashboard so only your team can access it:

1. Firebase Console → **Build → Authentication → Get started**
2. Enable **Email/Password** provider
3. Add staff email accounts under **Users**
4. In `app/dashboard/page.js`, wrap the page with a Firebase Auth check

This prevents guests from accessing `/dashboard` directly.

---

## Firestore Data Shape

Each reservation document in the `reservations` collection:

```json
{
  "ref": "NOV-0001",
  "name": "Amara Okafor",
  "phone": "+234 812 345 6789",
  "date": "2026-06-05",
  "time": "19:00",
  "party": 2,
  "occasion": "Anniversary",
  "requests": "Window seat if possible",
  "status": "pending",
  "createdAt": "<Firestore Timestamp>"
}
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `npm start` | Run production build locally |
