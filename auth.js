import { auth, provider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

export function login() {
    return signInWithPopup(auth, provider);
}

export function logout() {
    return signOut(auth);
}

export function onAuthChange(callback) {
    onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
    return auth.currentUser;
}
