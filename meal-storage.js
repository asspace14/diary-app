import { db, auth } from './firebase-config.js';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// { 'YYYY-MM-DD': [{ id, type, text, calories, createdAt }, ...] }
let mealCache = {};
let currentLoadedMonth = '';

// { id, name, calories, createdAt }
export let mealMasterCache = [];

export function getMealRecords(dateStr) {
    return mealCache[dateStr] || [];
}

export function hasMeal(dateStr) {
    const records = getMealRecords(dateStr);
    return records && records.length > 0;
}

export async function fetchMealDataForMonth(year, month) {
    const user = auth.currentUser;
    if (!user) return;

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    if (currentLoadedMonth === monthStr) return;

    const startStr = `${monthStr}-01`;
    const endStr = `${monthStr}-31`;

    const q = query(
        collection(db, `users/${user.uid}/meals`),
        where("date", ">=", startStr),
        where("date", "<=", endStr)
    );

    try {
        const querySnapshot = await getDocs(q);
        const newData = {};

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const date = data.date;
            if (!newData[date]) {
                newData[date] = [];
            }
            newData[date].push({
                id: docSnap.id,
                ...data
            });
        });

        // Sort meals by createdAt
        Object.keys(newData).forEach(date => {
            newData[date].sort((a, b) => a.createdAt - b.createdAt);
        });

        // Merge fetched data into cache
        Object.keys(mealCache).forEach(date => {
            if (date.startsWith(monthStr)) {
                delete mealCache[date];
            }
        });
        Object.assign(mealCache, newData);
        currentLoadedMonth = monthStr;
    } catch (error) {
        console.error("Error fetching meal data:", error);
    }
}

export async function addMeal(dateStr, type, text, calories) {
    const user = auth.currentUser;
    if (!user) return null;

    const newMealRef = doc(collection(db, `users/${user.uid}/meals`));
    const mealData = {
        date: dateStr,
        type: type, // 'breakfast', 'lunch', 'dinner', 'snack'
        text: text,
        calories: Number(calories) || 0,
        createdAt: Date.now()
    };

    try {
        await setDoc(newMealRef, mealData);
        const newMeal = { id: newMealRef.id, ...mealData };
        if (!mealCache[dateStr]) {
            mealCache[dateStr] = [];
        }
        mealCache[dateStr].push(newMeal);
        return newMeal;
    } catch (error) {
        console.error("Error adding meal:", error);
        return null;
    }
}

export async function deleteMeal(mealId, dateStr) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        await deleteDoc(doc(db, `users/${user.uid}/meals`, mealId));

        if (mealCache[dateStr]) {
            mealCache[dateStr] = mealCache[dateStr].filter(m => m.id !== mealId);
        }
        return true;
    } catch (error) {
        console.error("Error deleting meal:", error);
        return false;
    }
}

export function clearMealCache() {
    mealCache = {};
    currentLoadedMonth = '';
}

// Analytics Helpers
export async function fetchDailyCalories(dateStr) {
    const user = auth.currentUser;
    if (!user) return 0;

    // Check cache first
    if (mealCache[dateStr]) {
        return mealCache[dateStr].reduce((sum, meal) => sum + meal.calories, 0);
    }

    const q = query(
        collection(db, `users/${user.uid}/meals`),
        where("date", "==", dateStr)
    );

    try {
        const querySnapshot = await getDocs(q);
        let total = 0;
        querySnapshot.forEach((docSnap) => {
            total += (Number(docSnap.data().calories) || 0);
        });
        return total;
    } catch (error) {
        console.error("Error fetching daily calories:", error);
        return 0;
    }
}

export async function fetchDateRangeCalories(startStr, endStr) {
    const user = auth.currentUser;
    if (!user) return 0;

    const q = query(
        collection(db, `users/${user.uid}/meals`),
        where("date", ">=", startStr),
        where("date", "<=", endStr)
    );

    try {
        const querySnapshot = await getDocs(q);
        let total = 0;
        querySnapshot.forEach((docSnap) => {
            total += (Number(docSnap.data().calories) || 0);
        });
        return total;
    } catch (error) {
        console.error("Error fetching date range calories:", error);
        return 0;
    }
}

// Master Presets
export async function loadMealMaster() {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, `users/${user.uid}/mealMaster`));
    try {
        const querySnapshot = await getDocs(q);
        mealMasterCache = [];
        querySnapshot.forEach((docSnap) => {
            mealMasterCache.push({ id: docSnap.id, ...docSnap.data() });
        });
        mealMasterCache.sort((a, b) => a.createdAt - b.createdAt);
    } catch (error) {
        console.error("Error loading meal master:", error);
    }
}

export async function addMealMaster(name, calories) {
    const user = auth.currentUser;
    if (!user) return null;

    const masterRef = doc(collection(db, `users/${user.uid}/mealMaster`));
    const masterData = {
        name: name,
        calories: Number(calories) || 0,
        createdAt: Date.now()
    };

    try {
        await setDoc(masterRef, masterData);
        const newItem = { id: masterRef.id, ...masterData };
        mealMasterCache.push(newItem);
        return newItem;
    } catch (error) {
        console.error("Error adding meal master:", error);
        return null;
    }
}

export async function deleteMealMaster(masterId) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        await deleteDoc(doc(db, `users/${user.uid}/mealMaster`, masterId));
        mealMasterCache = mealMasterCache.filter(item => item.id !== masterId);
        return true;
    } catch (error) {
        console.error("Error deleting meal master:", error);
        return false;
    }
}
