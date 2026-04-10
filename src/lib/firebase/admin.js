import admin from 'firebase-admin';

// Initialize once per process. Only requires projectId for token verification —
// no service account JSON needed (Firebase fetches Google's public keys).
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

/**
 * Verifies a Firebase ID token from an Authorization: Bearer header.
 * Returns the decoded token (contains uid, email, etc.) or throws on failure.
 */
export async function verifyIdToken(token) {
  return admin.auth().verifyIdToken(token);
}
