import { db } from './firebase-config.js';
import { collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getCurrentUser } from './auth.js';

let expenseCache = {};

export async function fetchExpenseDataForMonth(year, month) {
    const user = getCurrentUser();
    if (!user) return;

    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const q = query(collection(db, `users/${user.uid}/expenses`), where('monthPrefix', '==', prefix));

    try {
        const querySnapshot = await getDocs(q);
        expenseCache = {}; // Reset cache
        querySnapshot.forEach((docSnap) => {
            expenseCache[docSnap.id] = docSnap.data().records || [];
        });
    } catch (error) {
        console.error("Error fetching expense data:", error);
    }
}

export function getExpenseRecords(dateStr) {
    return expenseCache[dateStr] || [];
}

export function getMonthlyTotalExpense() {
    let monthlyTotal = 0;
    for (const dateStr in expenseCache) {
        const records = expenseCache[dateStr];
        records.forEach(r => {
            monthlyTotal += (Number(r.amount) || 0);
        });
    }
    return monthlyTotal;
}

export async function addExpense(dateStr, type, itemName, amount) {
    const user = getCurrentUser();
    if (!user) return null;

    const dateObj = new Date(dateStr);
    const monthPrefix = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const docRef = doc(db, `users/${user.uid}/expenses`, dateStr);

    const newRecord = {
        id: Date.now().toString() + Math.random().toString().substring(2, 6),
        type,      // "cash" or "cashless"
        itemName,
        amount: parseInt(amount, 10),
        timestamp: new Date().toISOString()
    };

    let currentRecords = expenseCache[dateStr] || [];
    currentRecords.push(newRecord);

    try {
        await setDoc(docRef, {
            records: currentRecords,
            monthPrefix: monthPrefix,
            lastUpdated: new Date().toISOString()
        }, { merge: true });

        expenseCache[dateStr] = currentRecords;
        return newRecord;
    } catch (error) {
        console.error("Error adding expense:", error);
        return null;
    }
}

export async function deleteExpense(recordId, dateStr) {
    const user = getCurrentUser();
    if (!user) return false;

    let currentRecords = expenseCache[dateStr] || [];
    const updatedRecords = currentRecords.filter(r => r.id !== recordId);

    try {
        const docRef = doc(db, `users/${user.uid}/expenses`, dateStr);
        if (updatedRecords.length === 0) {
            await deleteDoc(docRef);
        } else {
            await setDoc(docRef, { records: updatedRecords }, { merge: true });
        }

        expenseCache[dateStr] = updatedRecords;
        return true;
    } catch (error) {
        console.error("Error deleting expense:", error);
        return false;
    }
}

export function clearExpenseCache() {
    expenseCache = {};
}
