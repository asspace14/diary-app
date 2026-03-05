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
