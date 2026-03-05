// training-storage.js
import { db, collection, doc, setDoc, getDocs, deleteDoc, getDoc, query, where } from './firebase-config.js';
import { getCurrentUser } from './auth.js';

let trainingCache = {};
let currentLoadedMonth = '';
let masterExercises = []; // Array of { id, name, category }

// Master Exercises
export async function loadMasterExercises() {
    const user = getCurrentUser();
    if (!user) return [];

    try {
        const q = query(collection(db, `users/${user.uid}/trainingMaster`));
        const querySnapshot = await getDocs(q);

        masterExercises = [];
        querySnapshot.forEach((docSnap) => {
            masterExercises.push({ id: docSnap.id, ...docSnap.data() });
        });
        return masterExercises;
    } catch (error) {
        console.error("Error loading master exercises:", error);
        return [];
    }
}

export function getMasterExercises() {
    return masterExercises;
}

export async function addMasterExercise(name, category) {
    const user = getCurrentUser();
    if (!user || !name) return null;

    try {
        const id = Date.now().toString();
        const newExercise = { name, category, createdAt: new Date().toISOString() };
        const docRef = doc(db, `users/${user.uid}/trainingMaster`, id);
        await setDoc(docRef, newExercise);

        const result = { id, ...newExercise };
        masterExercises.push(result);
        return result;
    } catch (error) {
        console.error("Error adding master exercise:", error);
        return null;
    }
}

export async function deleteMasterExercise(id) {
    const user = getCurrentUser();
    if (!user) return false;

    try {
        const docRef = doc(db, `users/${user.uid}/trainingMaster`, id);
        await deleteDoc(docRef);
        masterExercises = masterExercises.filter(ex => ex.id !== id);
        return true;
    } catch (error) {
        console.error("Error deleting master exercise:", error);
        return false;
    }
}

// Daily Logs
export async function loadMonthTrainingData(year, month) {
    const user = getCurrentUser();
    if (!user) return {};

    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    if (currentLoadedMonth === prefix) {
        return trainingCache;
    }

    try {
        const q = query(
            collection(db, `users/${user.uid}/trainingRecords`),
            where('monthPrefix', '==', prefix)
        );
        const querySnapshot = await getDocs(q);

        trainingCache = {};
        querySnapshot.forEach((docSnap) => {
            trainingCache[docSnap.id] = docSnap.data().records || [];
        });

        currentLoadedMonth = prefix;
        return trainingCache;
    } catch (error) {
        console.error("Error loading month training data:", error);
        return {};
    }
}

export function getTrainingRecords(dateStr) {
    return trainingCache[dateStr] || [];
}

export async function saveTrainingRecords(dateStr, records) {
    const user = getCurrentUser();
    if (!user) return;

    if (!records || records.length === 0) {
        await deleteTrainingDay(dateStr);
        return;
    }

    trainingCache[dateStr] = records;

    try {
        const monthPrefix = dateStr.substring(0, 7);
        const docRef = doc(db, `users/${user.uid}/trainingRecords`, dateStr);
        await setDoc(docRef, {
            records: records,
            monthPrefix: monthPrefix,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error saving training records:", error);
    }
}

export async function deleteTrainingDay(dateStr) {
    const user = getCurrentUser();
    if (!user) return false;

    if (trainingCache[dateStr] !== undefined) {
        delete trainingCache[dateStr];
    }

    try {
        const docRef = doc(db, `users/${user.uid}/trainingRecords`, dateStr);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting training day:", error);
        return false;
    }
}

export function hasTraining(dateStr) {
    return trainingCache[dateStr] && trainingCache[dateStr].length > 0;
}

export async function copyTrainingData(sourceDateStr, targetDateStr) {
    const user = getCurrentUser();
    if (!user) return false;

    try {
        const docRef = doc(db, `users/${user.uid}/trainingRecords`, sourceDateStr);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists() || !docSnap.data().records || docSnap.data().records.length === 0) {
            return false;
        }

        const sourceRecords = docSnap.data().records;
        const newRecords = sourceRecords.map(r => {
            const newRecord = { ...r, id: Date.now().toString() + Math.random().toString().substring(2, 6) };
            if (r.category === 'weight' && r.sets) {
                newRecord.completed = Array(r.sets).fill(false);
            } else {
                newRecord.completed = false;
            }
            return newRecord;
        });

        await saveTrainingRecords(targetDateStr, newRecords);
        return true;
    } catch (error) {
        console.error("Error copying training data:", error);
        return false;
    }
}

export function getTrainingEntriesForMonth(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const result = {};
    for (const date in trainingCache) {
        if (date.startsWith(prefix) && trainingCache[date].length > 0) {
            result[date] = trainingCache[date];
        }
    }
    return result;
}

export async function getTrainingEntriesForDateRange(startDateStr, endDateStr) {
    const user = getCurrentUser();
    if (!user) return {};

    try {
        const startMonth = startDateStr.substring(0, 7);
        const endMonth = endDateStr.substring(0, 7);

        const fetchMonth = async (prefix) => {
            const q = query(collection(db, `users/${user.uid}/trainingRecords`), where('monthPrefix', '==', prefix));
            const snap = await getDocs(q);
            const data = {};
            snap.forEach(doc => { data[doc.id] = doc.data().records || []; });
            return data;
        };

        const data1 = await fetchMonth(startMonth);
        const data2 = startMonth !== endMonth ? await fetchMonth(endMonth) : {};

        const allData = { ...data1, ...data2 };
        const result = {};
        for (const date in allData) {
            if (date >= startDateStr && date <= endDateStr) {
                result[date] = allData[date];
            }
        }
        return result;
    } catch (error) {
        console.error("Error loading date range data:", error);
        return {};
    }
}

export async function getTrainingEntriesForYear(year) {
    const user = getCurrentUser();
    if (!user) return {};

    try {
        const q = query(
            collection(db, `users/${user.uid}/trainingRecords`),
            where('monthPrefix', '>=', `${year}-01`),
            where('monthPrefix', '<=', `${year}-12`)
        );
        const querySnapshot = await getDocs(q);

        const yearEntries = {};
        querySnapshot.forEach((docSnap) => {
            yearEntries[docSnap.id] = docSnap.data().records || [];
        });

        return yearEntries;
    } catch (error) {
        console.error("Error loading year data:", error);
        return {};
    }
}

export function clearTrainingCache() {
    trainingCache = {};
    currentLoadedMonth = '';
    masterExercises = [];
}

// --- Export Functions ---
function generateText(textContent) {
    const blob = new Blob(['\uFEFF' + textContent], { type: 'text/plain;charset=utf-8;' });
    return URL.createObjectURL(blob);
}

function downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function formatRecordsAsText(dateStr, records) {
    if (!records || records.length === 0) return '';
    let text = `【${dateStr}】\n`;
    records.forEach(r => {
        let detail = '';
        if (r.category === 'weight') {
            detail = `${r.weight}kg x ${r.reps}回${r.sets ? ` x ${r.sets}セット` : ''}`;
        } else if (r.category === 'cardio') {
            detail = `${r.duration}分`;
        } else {
            detail = '-';
        }

        let status = '未完了';
        if (Array.isArray(r.completed)) {
            const completedSets = r.completed.filter(c => c).length;
            if (completedSets === r.sets) {
                status = '完了';
            } else if (completedSets > 0) {
                status = `一部完了 (${completedSets}/${r.sets})`;
            }
        } else {
            status = r.completed ? '完了' : '未完了';
        }

        text += `・${r.exName}: ${detail} [${status}]\n`;
    });
    return text + '\n';
}

export async function exportTrainingDayData(dateStr) {
    const records = getTrainingRecords(dateStr);
    if (!records || records.length === 0) return false;

    const content = formatRecordsAsText(dateStr, records);
    const url = generateText(content);
    downloadFile(url, `training_${dateStr}.txt`);
    return true;
}

export async function exportTrainingWeekData(dateStr) {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    const startDate = new Date(dateObj);
    startDate.setDate(dateObj.getDate() - dayOfWeek);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const data = await getTrainingEntriesForDateRange(startStr, endStr);
    if (Object.keys(data).length === 0) return false;

    let content = `筋トレ記録 (${startStr} ～ ${endStr})\n==============================\n\n`;
    const sortedDates = Object.keys(data).sort();
    sortedDates.forEach(date => {
        content += formatRecordsAsText(date, data[date]);
    });

    const url = generateText(content);
    downloadFile(url, `training_week_${startStr}_to_${endStr}.txt`);
    return true;
}

export async function exportTrainingMonthData(year, month) {
    const data = getTrainingEntriesForMonth(year, month);
    if (Object.keys(data).length === 0) return false;

    const monthStr = String(month).padStart(2, '0');
    let content = `筋トレ記録 (${year}年${monthStr}月)\n==============================\n\n`;
    const sortedDates = Object.keys(data).sort();
    sortedDates.forEach(date => {
        content += formatRecordsAsText(date, data[date]);
    });

    const url = generateText(content);
    downloadFile(url, `training_${year}_${monthStr}.txt`);
    return true;
}

export async function exportTrainingYearData(year) {
    const data = await getTrainingEntriesForYear(year);
    if (Object.keys(data).length === 0) return false;

    let content = `筋トレ記録 (${year}年)\n==============================\n\n`;
    const sortedDates = Object.keys(data).sort();
    sortedDates.forEach(date => {
        content += formatRecordsAsText(date, data[date]);
    });

    const url = generateText(content);
    downloadFile(url, `training_${year}.txt`);
    return true;
}
