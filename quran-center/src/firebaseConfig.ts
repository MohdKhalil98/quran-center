export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyAzuUaEDEGen1rWbPV7sZMRAO_9vbk4ju4',
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'halqatmoza.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'halqatmoza',
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'halqatmoza.firebasestorage.app',
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ||
    '149349937676',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:149349937676:web:8aec0888ccfbf070bf7429'
};

