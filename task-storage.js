import { db, auth } from './firebase-config.js';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// { 'YYYY-MM-DD': [{ id, text, completed, createdAt }, ...] }
let taskCache = {};
let currentLoadedMonth = '';

export function getTaskRecords(dateStr) {
    return taskCache[dateStr] || [];
}

export function hasTask(dateStr) {
    const records = getTaskRecords(dateStr);
    return records && records.length > 0;
}

export async function fetchTaskDataForMonth(year, month) {
    const user = auth.currentUser;
    if (!user) return;

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    if (currentLoadedMonth === monthStr) return;

    const startStr = `${monthStr}-01`;
    const endStr = `${monthStr}-31`;

    const q = query(
        collection(db, `users/${user.uid}/tasks`),
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

        // Sort tasks by createdAt within each date
        Object.keys(newData).forEach(date => {
            newData[date].sort((a, b) => a.createdAt - b.createdAt);
        });

        // Merge fetched data into cache
        Object.keys(taskCache).forEach(date => {
            if (date.startsWith(monthStr)) {
                delete taskCache[date];
            }
        });
        Object.assign(taskCache, newData);
        currentLoadedMonth = monthStr;
    } catch (error) {
        console.error("Error fetching task data:", error);
    }
}

export async function addTask(dateStr, text) {
    const user = auth.currentUser;
    if (!user) return null;

    const newTaskRef = doc(collection(db, `users/${user.uid}/tasks`));
    const taskData = {
        date: dateStr,
        text: text,
        completed: false,
        createdAt: Date.now()
    };

    try {
        await setDoc(newTaskRef, taskData);
        const newTask = { id: newTaskRef.id, ...taskData };
        if (!taskCache[dateStr]) {
            taskCache[dateStr] = [];
        }
        taskCache[dateStr].push(newTask);
        return newTask;
    } catch (error) {
        console.error("Error adding task:", error);
        return null;
    }
}

export async function updateTaskCompletion(taskId, dateStr, completed) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        await updateDoc(doc(db, `users/${user.uid}/tasks`, taskId), {
            completed: completed
        });

        if (taskCache[dateStr]) {
            const task = taskCache[dateStr].find(t => t.id === taskId);
            if (task) {
                task.completed = completed;
            }
        }
        return true;
    } catch (error) {
        console.error("Error updating task:", error);
        return false;
    }
}

export async function toggleTaskStatus(taskId, dateStr) {
    if (taskCache[dateStr]) {
        const task = taskCache[dateStr].find(t => t.id === taskId);
        if (task) {
            return await updateTaskCompletion(taskId, dateStr, !task.completed);
        }
    }
    return false;
}

export async function deleteTask(taskId, dateStr) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        await deleteDoc(doc(db, `users/${user.uid}/tasks`, taskId));

        if (taskCache[dateStr]) {
            taskCache[dateStr] = taskCache[dateStr].filter(t => t.id !== taskId);
        }
        return true;
    } catch (error) {
        console.error("Error deleting task:", error);
        return false;
    }
}

export function clearTaskCache() {
    taskCache = {};
    currentLoadedMonth = '';
}

export async function getTaskEntriesForDateRange(startDateStr, endDateStr) {
    const user = auth.currentUser;
    if (!user) return {};

    try {
        const q = query(
            collection(db, `users/${user.uid}/tasks`),
            where("date", ">=", startDateStr),
            where("date", "<=", endDateStr)
        );

        const querySnapshot = await getDocs(q);
        const newData = {};

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const date = data.date;
            if (!newData[date]) newData[date] = [];
            newData[date].push({ id: docSnap.id, ...data });
        });

        Object.keys(newData).forEach(date => {
            newData[date].sort((a, b) => a.createdAt - b.createdAt);
        });

        return newData;
    } catch (error) {
        console.error("Error loading date range task data:", error);
        return {};
    }
}

export async function getTaskEntriesForYear(year) {
    const user = auth.currentUser;
    if (!user) return {};

    try {
        const q = query(
            collection(db, `users/${user.uid}/tasks`),
            where("date", ">=", `${year}-01-01`),
            where("date", "<=", `${year}-12-31`)
        );
        const querySnapshot = await getDocs(q);

        const yearEntries = {};
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const date = data.date;
            if (!yearEntries[date]) yearEntries[date] = [];
            yearEntries[date].push({ id: docSnap.id, ...data });
        });

        Object.keys(yearEntries).forEach(date => {
            yearEntries[date].sort((a, b) => a.createdAt - b.createdAt);
        });

        return yearEntries;
    } catch (error) {
        console.error("Error loading year task data:", error);
        return {};
    }
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

function formatTaskRecordsAsText(dateStr, records) {
    if (!records || records.length === 0) return '';
    let text = `【${dateStr}】\n`;
    records.forEach(r => {
        text += `・[${r.completed ? 'x' : ' '}] ${r.text}\n`;
    });
    return text + '\n';
}

export async function exportTaskDayData(dateStr) {
    const records = getTaskRecords(dateStr);
    if (!records || records.length === 0) return false;

    const content = formatTaskRecordsAsText(dateStr, records);
    const url = generateText(content);
    downloadFile(url, `task_${dateStr}.txt`);
    return true;
}

export async function exportTaskWeekData(dateStr) {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    const startDate = new Date(dateObj);
    startDate.setDate(dateObj.getDate() - dayOfWeek);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const data = await getTaskEntriesForDateRange(startStr, endStr);
    if (Object.keys(data).length === 0) return false;

    let content = `タスク記録 (${startStr} ～ ${endStr})\n==============================\n\n`;
    const sortedDates = Object.keys(data).sort();
    sortedDates.forEach(date => {
        content += formatTaskRecordsAsText(date, data[date]);
    });

    const url = generateText(content);
    downloadFile(url, `task_week_${startStr}_to_${endStr}.txt`);
    return true;
}

export async function exportTaskMonthData(year, month) {
    const monthStr = String(month).padStart(2, '0');
    const startStr = `${year}-${monthStr}-01`;
    const endStr = `${year}-${monthStr}-31`;

    // Using date range fetcher instead since month prefix alone isn't cached if not active
    const data = await getTaskEntriesForDateRange(startStr, endStr);
    if (Object.keys(data).length === 0) return false;

    let content = `タスク記録 (${year}年${monthStr}月)\n==============================\n\n`;
    const sortedDates = Object.keys(data).sort();
    sortedDates.forEach(date => {
        content += formatTaskRecordsAsText(date, data[date]);
    });

    const url = generateText(content);
    downloadFile(url, `task_${year}_${monthStr}.txt`);
    return true;
}

export async function exportTaskYearData(year) {
    const data = await getTaskEntriesForYear(year);
    if (Object.keys(data).length === 0) return false;

    let content = `タスク記録 (${year}年)\n==============================\n\n`;
    const sortedDates = Object.keys(data).sort();
    sortedDates.forEach(date => {
        content += formatTaskRecordsAsText(date, data[date]);
    });

    const url = generateText(content);
    downloadFile(url, `task_${year}.txt`);
    return true;
}
