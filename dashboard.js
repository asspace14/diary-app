import * as storage from './storage.js';
import * as tStorage from './training-storage.js';
import * as tskStorage from './task-storage.js';
import * as mStorage from './meal-storage.js';
import * as eStorage from './expense-storage.js';
import { formatDateJp } from './storage.js';

let currentDateStr = '';
const elements = {
    dateDisplay: document.getElementById('dashboard-date-display'),
    content: document.getElementById('dashboard-content'),
    totalCalBadge: document.getElementById('dashboard-total-cal-badge')
};

export function initDashboard() {
    document.addEventListener('dateSelected', async (e) => {
        currentDateStr = e.detail.date;
        if (elements.dateDisplay) {
            elements.dateDisplay.textContent = `${formatDateJp(currentDateStr)} の記録`;
        }
        await renderDashboard();
    });

    // Re-render dashboard when any sub-data changes
    ['tasksUpdated', 'trainingUpdated', 'mealsUpdated', 'diaryUpdated', 'expenseUpdated'].forEach(event => {
        document.addEventListener(event, () => {
            // Only re-render if we are currently viewing the selected date
            // (Assuming data changes happen on the currently selected date in other tabs)
            if (currentDateStr) {
                renderDashboard();
            }
        });
    });
}

function createCard(title, icon, contentHtml, emptyHtml, hasData) {
    const card = document.createElement('div');
    card.className = 'dashboard-card';
    card.innerHTML = `
        <div class="dashboard-card-header">
            <span class="dashboard-card-icon">${icon}</span>
            <span class="dashboard-card-title">${title}</span>
        </div>
        <div class="dashboard-card-body">
            ${hasData ? contentHtml : `<div class="dashboard-empty">${emptyHtml}</div>`}
        </div>
    `;
    return card;
}

export async function renderDashboard() {
    if (!currentDateStr || !elements.content) return;

    elements.content.innerHTML = '';

    let totalCals = 0;

    // 1. Tasks
    const tasks = tskStorage.getTaskRecords(currentDateStr) || [];
    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const taskStatus = totalTasks > 0 ? `${completedTasks} / ${totalTasks} 完了` : '';

    let taskHtml = '<ul class="dashboard-list">';
    tasks.forEach(t => {
        taskHtml += `<li class="${t.completed ? 'completed' : ''}"><span class="material-icons-round" style="font-size: 1rem; margin-right: 0.25rem;">${t.completed ? 'check_circle' : 'radio_button_unchecked'}</span>${t.text}</li>`;
    });
    taskHtml += '</ul>';

    const taskCard = createCard('タスク', '📝', taskHtml, 'タスクはありません', totalTasks > 0);

    // 2. Meals
    const meals = mStorage.getMealRecords(currentDateStr) || [];
    const mealTypeLabels = { 'breakfast': '朝', 'lunch': '昼', 'dinner': '夕', 'snack': '間' };

    let mealHtml = '<ul class="dashboard-list mb-2">';
    meals.forEach(m => {
        totalCals += m.calories;
        mealHtml += `<li><span class="db-badge">${mealTypeLabels[m.type]}</span> ${m.text} <span class="db-cal">${m.calories} kcal</span></li>`;
    });
    mealHtml += '</ul>';

    const mealCard = createCard('食事', '🍽️', mealHtml, '食事記録はありません', meals.length > 0);

    // 3. Training
    const trainings = tStorage.getTrainingRecords(currentDateStr) || [];
    let trainingHtml = '<ul class="dashboard-list">';
    trainings.forEach(t => {
        let details = '';
        if (t.category === 'weight' || t.type === 'weight') {
            details = `${t.weight}kg × ${t.reps}回 × ${t.sets}Set`;
        } else if (t.category === 'cardio' || t.type === 'cardio') {
            details = `${t.duration}分`;
        } else if (t.category === 'bodyweight' || t.type === 'bodyweight') {
            details = `${t.reps}回 × ${t.sets}Set`;
        }

        trainingHtml += `<li><strong>${t.exName}</strong> <span class="db-detail">${details}</span></li>`;
    });
    trainingHtml += '</ul>';

    const trainingCard = createCard('筋トレ', '🏋️', trainingHtml, 'トレーニング記録はありません', trainings.length > 0);

    // 4. Diary
    const entry = storage.getEntry(currentDateStr);
    let diaryHtml = '';
    if (entry && entry.text) {
        // truncate text
        const snippet = entry.text.length > 50 ? entry.text.substring(0, 50) + '...' : entry.text;
        diaryHtml = `<div class="db-diary-snippet">${snippet}</div>`;
    }
    const diaryCard = createCard('日記', '📖', diaryHtml, '日記はありません', !!(entry && entry.text));

    // 5. Expenses
    const expenses = eStorage.getExpenseRecords(currentDateStr) || [];
    let expenseHtml = '<ul class="dashboard-list">';
    let totalExpense = 0;
    expenses.forEach(e => {
        totalExpense += e.amount;
        const icon = e.type === 'cashless' ? '💳' : '💴';
        expenseHtml += `<li><span style="font-size:1.1rem;margin-right:0.25rem;">${icon}</span> <strong>${e.itemName}</strong> <span class="db-cal">${e.amount.toLocaleString()} 円</span></li>`;
    });
    if (totalExpense > 0) {
        expenseHtml += `<li style="margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border-color);"><strong style="margin-left:auto;">合計: <span style="color:var(--secondary-color);">${totalExpense.toLocaleString()} 円</span></strong></li>`;
    }
    expenseHtml += '</ul>';

    const expenseCard = createCard('家計簿', '💰', expenseHtml, '支出記録はありません', expenses.length > 0);

    // Append to DOM
    elements.content.appendChild(taskCard);
    elements.content.appendChild(mealCard);
    elements.content.appendChild(trainingCard);
    elements.content.appendChild(expenseCard);
    elements.content.appendChild(diaryCard);

    // Update total calories badge
    if (elements.totalCalBadge) {
        if (totalCals > 0) {
            elements.totalCalBadge.textContent = `${totalCals} kcal`;
            elements.totalCalBadge.classList.remove('hidden');
        } else {
            elements.totalCalBadge.classList.add('hidden');
        }
    }
}
