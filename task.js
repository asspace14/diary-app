import * as tskStorage from './task-storage.js';
import * as storage from './storage.js';

let currentDateStr = '';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;

const elements = {
    taskDateDisplay: document.getElementById('task-date-display'),
    taskInput: document.getElementById('new-task-input'),
    addTaskBtn: document.getElementById('add-task-btn'),
    taskList: document.getElementById('task-list')
};

export async function initTasks() {
    setupEventListeners();

    document.addEventListener('dateSelected', async (e) => {
        currentDateStr = e.detail.date;
        if (elements.taskDateDisplay) {
            elements.taskDateDisplay.textContent = `${storage.formatDateJp(currentDateStr)} のタスク`;
        }

        // Only load if Firebase is initialized
        if (tskStorage.auth && tskStorage.auth.currentUser) {
            await loadTasksForCurrentMonth();
        }
        renderDailyTasks();
    });

    document.addEventListener('monthChanged', async (e) => {
        currentYear = e.detail.year;
        currentMonth = e.detail.month;
        await loadTasksForCurrentMonth();
        renderDailyTasks();
    });
}

function setupEventListeners() {
    if (elements.addTaskBtn) {
        elements.addTaskBtn.addEventListener('click', handleAddTask);
    }

    if (elements.taskInput) {
        elements.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAddTask();
            }
        });
        elements.taskInput.addEventListener('input', () => {
            elements.addTaskBtn.disabled = elements.taskInput.value.trim() === '';
        });
    }
}

async function loadTasksForCurrentMonth() {
    await tskStorage.fetchTaskDataForMonth(currentYear, currentMonth);
}

async function handleAddTask() {
    const text = elements.taskInput.value.trim();
    if (!text || !currentDateStr) return;

    elements.addTaskBtn.disabled = true;

    const newTask = await tskStorage.addTask(currentDateStr, text);

    if (!newTask) {
        alert("追加に失敗しました。Firebaseのセキュリティルールの設定に追加（tasks）が必要です。");
        elements.addTaskBtn.disabled = false;
        return;
    }

    elements.taskInput.value = '';
    elements.addTaskBtn.disabled = true;
    renderDailyTasks();

    document.dispatchEvent(new CustomEvent('tasksUpdated'));
}

async function handleToggleCompletion(taskId, isCompleted) {
    if (!currentDateStr) return;
    await tskStorage.updateTaskCompletion(taskId, currentDateStr, isCompleted);
    renderDailyTasks();
    document.dispatchEvent(new CustomEvent('tasksUpdated'));
}

async function handleDeleteTask(taskId) {
    if (!currentDateStr) return;
    if (confirm('このタスクを削除しますか？')) {
        await tskStorage.deleteTask(taskId, currentDateStr);
        renderDailyTasks();
        document.dispatchEvent(new CustomEvent('tasksUpdated'));
    }
}

export function renderDailyTasks() {
    if (!currentDateStr || !elements.taskList) return;

    const tasks = tskStorage.getTaskRecords(currentDateStr) || [];
    elements.taskList.innerHTML = '';

    if (tasks.length === 0) {
        elements.taskList.innerHTML = '<li class="empty-message">タスクはありません</li>';
        return;
    }

    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;

        li.innerHTML = `
            <div class="task-item-content">
                <label class="task-checkbox-label">
                    <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <span class="task-text">${task.text}</span>
                </label>
            </div>
            <button class="icon-btn btn-danger btn-sm delete-task-btn" data-id="${task.id}">
                <span class="material-icons-round">close</span>
            </button>
        `;

        const checkbox = li.querySelector('.task-checkbox');
        checkbox.addEventListener('change', (e) => handleToggleCompletion(task.id, e.target.checked));

        const deleteBtn = li.querySelector('.delete-task-btn');
        deleteBtn.addEventListener('click', () => handleDeleteTask(task.id));

        elements.taskList.appendChild(li);
    });
}
