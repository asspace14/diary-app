import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCpbdOSmGNGZw5loxmOke3cfJPEbH56eNo",
    authDomain: "deary-app.firebaseapp.com",
    projectId: "deary-app",
    storageBucket: "deary-app.firebasestorage.app",
    messagingSenderId: "1006324785655",
    appId: "1:1006324785655:web:66af68d06703f9a19b8ef2",
    measurementId: "G-Q28LFVHV55"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Export firestore functions for storage.js
export { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where };
