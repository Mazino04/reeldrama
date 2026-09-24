/**
 * ReelDrama - Firebase Configuration & Authentication
 * 
 * ─────────────────────────────────────────────────────────────────────────────
 * SETUP INSTRUCTIONS:
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Select or create your Firebase project.
 * 3. Add a Web App (</>) and copy the `firebaseConfig` object values below.
 * 4. In Firebase Console, go to Build > Authentication > Sign-in method:
 *    - Enable "Google" provider.
 * 5. In Firebase Console, go to Build > Firestore Database:
 *    - Create Database (start in test mode or with the rules provided in the guide).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const firebaseConfig = {
  apiKey: "AIzaSyBhGNUNP635RbItGJeZIhQCaUBJpo6lwO4",
  authDomain: "short-reels-c938b.firebaseapp.com",
  databaseURL: "https://short-reels-c938b-default-rtdb.firebaseio.com",
  projectId: "short-reels-c938b",
  storageBucket: "short-reels-c938b.firebasestorage.app",
  messagingSenderId: "482772508607",
  appId: "1:482772508607:web:6283b09d138818934d8b0a",
};

// Internal Firebase state
let firebaseAuth = null;
let firestoreDb = null;
let realtimeDb = null;
let googleAuthProvider = null;
let isFirebaseInitialized = false;

/**
 * Check if the user has replaced placeholder values with real Firebase credentials
 */
function isFirebaseConfigured() {
    return Boolean(
        firebaseConfig.apiKey &&
        !firebaseConfig.apiKey.includes('YOUR_') &&
        firebaseConfig.projectId &&
        !firebaseConfig.projectId.includes('YOUR_')
    );
}

/**
 * Initialize Firebase Application
 */
function initFirebaseApp() {
    if (isFirebaseInitialized) return true;

    if (typeof firebase === 'undefined') {
        console.warn('[Firebase] Firebase SDK scripts not loaded yet.');
        return false;
    }

    if (!isFirebaseConfigured()) {
        console.info('[Firebase] Configuration is using placeholder values. Please update firebase-config.js with your project credentials.');
        return false;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        firebaseAuth = firebase.auth();

        // Initialize Realtime Database if SDK is loaded
        if (typeof firebase.database === 'function') {
            try {
                // Force pure WebSockets transport to eliminate Quirks Mode .lp fallback iframe and synchronous unload XHR
                if (firebase.database.INTERNAL && typeof firebase.database.INTERNAL.forceWebSockets === 'function') {
                    firebase.database.INTERNAL.forceWebSockets();
                }
                realtimeDb = firebase.database();
                console.log('[Firebase] Realtime Database initialized (WebSockets forced).');
            } catch (rtdbErr) {
                console.warn('[Firebase] Realtime Database init notice:', rtdbErr);
            }
        }

        // Initialize Firestore if SDK is loaded
        if (typeof firebase.firestore === 'function') {
            try {
                firestoreDb = firebase.firestore();
                console.log('[Firebase] Cloud Firestore initialized.');
            } catch (fsErr) {
                console.warn('[Firebase] Cloud Firestore init notice:', fsErr);
            }
        }

        googleAuthProvider = new firebase.auth.GoogleAuthProvider();
        googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
        
        firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
            console.warn('[Firebase] Auth persistence warning:', err);
        });

        isFirebaseInitialized = true;
        console.log('[Firebase] Initialized successfully.');
        return true;
    } catch (error) {
        console.error('[Firebase] Initialization error:', error);
        return false;
    }
}

// Auto-initialize when script loads
if (typeof firebase !== 'undefined') {
    initFirebaseApp();
}

/**
 * Firebase Service Wrapper
 */
const FirebaseService = {
    isConfigured() {
        return isFirebaseConfigured();
    },

    isReady() {
        if (!isFirebaseInitialized) {
            initFirebaseApp();
        }
        return isFirebaseInitialized && Boolean(firebaseAuth && (realtimeDb || firestoreDb));
    },

    getAuth() {
        if (!isFirebaseInitialized) initFirebaseApp();
        return firebaseAuth;
    },

    getRtdb() {
        if (!isFirebaseInitialized) initFirebaseApp();
        return realtimeDb;
    },

    getDb() {
        if (!isFirebaseInitialized) initFirebaseApp();
        return firestoreDb;
    },

    getCurrentUser() {
        return firebaseAuth ? firebaseAuth.currentUser : null;
    },

    /**
     * Sign in with Google Popup
     */
    async signInWithGoogle() {
        if (!this.isReady()) {
            if (!this.isConfigured()) {
                throw new Error('CONFIG_MISSING');
            }
            throw new Error('Firebase could not be initialized.');
        }

        try {
            const result = await firebaseAuth.signInWithPopup(googleAuthProvider);
            return result.user;
        } catch (error) {
            // If popup was blocked or closed by user, don't crash
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                console.info('[Firebase Auth] Sign in popup closed by user.');
                return null;
            }
            console.error('[Firebase Auth] Google sign in error:', error);
            throw error;
        }
    },

    /**
     * Sign out current user
     */
    async signOut() {
        if (!firebaseAuth) return;
        try {
            await firebaseAuth.signOut();
            console.log('[Firebase Auth] User signed out successfully.');
        } catch (error) {
            console.error('[Firebase Auth] Sign out error:', error);
            throw error;
        }
    },

    /**
     * Register authentication state change listener
     */
    onAuthStateChanged(callback) {
        if (typeof firebase === 'undefined' || !this.isReady()) {
            // Check again when window loads or if config gets added
            window.addEventListener('load', () => {
                if (this.isReady() && firebaseAuth) {
                    firebaseAuth.onAuthStateChanged(callback);
                } else {
                    callback(null);
                }
            });
            callback(null);
            return () => {};
        }
        return firebaseAuth.onAuthStateChanged(callback);
    }
};

window.FirebaseService = FirebaseService;

