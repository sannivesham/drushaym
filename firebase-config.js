import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHqAEDlcAS-6t8Ib9Wyr5VwmjVRdr75D8",
  authDomain: "drushyam-app.firebaseapp.com",
  projectId: "drushyam-app",
  storageBucket: "drushyam-app.firebasestorage.app",
  messagingSenderId: "188339609305",
  appId: "1:188339609305:web:b0083d8cb7ede7bab6e8c8",
  measurementId: "G-7MFLBW4KC3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
