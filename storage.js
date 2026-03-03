// storage.js
import { db, collection, doc, setDoc, getDocs, deleteDoc, query, where } from './firebase-config.js';
import { getCurrentUser } from './auth.js';

const THEME_KEY = 'voice_diary_theme';

// In-memory cache for snappy UI
let entriesCache = {};
let currentLoadedMonth = '';

export async function loadMonthData(year, month) {
  const user = getCurrentUser();
  if (!user) return {};

  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  if (currentLoadedMonth === prefix) {
    return entriesCache; // Already loaded
  }

  try {
    const q = query(
      collection(db, `users/${user.uid}/entries`),
      where('monthPrefix', '==', prefix)
    );
    const querySnapshot = await getDocs(q);

    entriesCache = {};
    querySnapshot.forEach((docSnap) => {
      entriesCache[docSnap.id] = docSnap.data().content;
    });

    currentLoadedMonth = prefix;
    return entriesCache;
  } catch (error) {
    console.error("Error loading month data:", error);
    return {};
  }
}

export function getEntry(dateStr) {
  return entriesCache[dateStr] || '';
}

export async function saveEntry(dateStr, content) {
  const user = getCurrentUser();
  if (!user) return;

  if (content.trim() === '') {
    await deleteEntry(dateStr);
    return;
  }

  // Update cache immediately for snappy UI
  entriesCache[dateStr] = content;

  try {
    const monthPrefix = dateStr.substring(0, 7); // Extracts "YYYY-MM"
    const docRef = doc(db, `users/${user.uid}/entries`, dateStr);
    await setDoc(docRef, {
      content: content,
      monthPrefix: monthPrefix,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error saving entry:", error);
  }
}

export async function deleteEntry(dateStr) {
  const user = getCurrentUser();
  if (!user) return false;

  if (entriesCache[dateStr] !== undefined) {
    delete entriesCache[dateStr];
  }

  try {
    const docRef = doc(db, `users/${user.uid}/entries`, dateStr);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting entry:", error);
    return false;
  }
}

export function hasEntry(dateStr) {
  return !!entriesCache[dateStr];
}

export function getEntriesForMonth(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const result = {};
  for (const date in entriesCache) {
    if (date.startsWith(prefix)) {
      result[date] = entriesCache[date];
    }
  }
  return result;
}

export async function getEntriesForYear(year) {
  const user = getCurrentUser();
  if (!user) return {};

  try {
    const q = query(
      collection(db, `users/${user.uid}/entries`),
      where('monthPrefix', '>=', `${year}-01`),
      where('monthPrefix', '<=', `${year}-12`)
    );
    const querySnapshot = await getDocs(q);

    const yearEntries = {};
    querySnapshot.forEach((docSnap) => {
      yearEntries[docSnap.id] = docSnap.data().content;
    });

    return yearEntries;
  } catch (error) {
    console.error("Error loading year data:", error);
    return {};
  }
}

// Theme storage (keep in local storage)
export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

// Cleanup cache on logout
export function clearCache() {
  entriesCache = {};
  currentLoadedMonth = '';
}
