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
    const pendingTasks = tasks.filter(t => !t.completed);

    pendingTasks.forEach(t => {
        taskHtml += `<li class="${t.completed ? 'completed' : ''} db-task-item" data-id="${t.id}" style="cursor:pointer; display:flex; align-items:center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);"><span class="material-icons-round" style="font-size: 1.2rem; margin-right: 0.5rem; color: ${t.completed ? 'var(--secondary-color)' : '#999'};">${t.completed ? 'check_circle' : 'radio_button_unchecked'}</span>${t.text}</li>`;
    });

    if (totalTasks > 0 && pendingTasks.length === 0) {
        taskHtml += `<li style="text-align:center; padding: 1rem 0; color: var(--text-light); border-bottom: none;"><span class="material-icons-round" style="font-size: 2rem; color: var(--secondary-color); margin-bottom: 0.5rem; display: block;">celebration</span>すべてのタスクが完了しました！</li>`;
    }
    taskHtml += '</ul>';

    const taskCard = createCard('タスク', '📝', taskHtml, 'タスクはありません', totalTasks > 0);

    // 2. Meals
    const meals = mStorage.getMealRecords(currentDateStr) || [];
    const mealTypeLabels = { 'breakfast': '朝', 'lunch': '昼', 'dinner': '夕', 'snack': '間' };

    let mealHtml = '<div style="text-align:center; padding: 1rem 0;">';
    meals.forEach(m => {
        const cals = Number(m.calories) || 0;
        totalCals += cals;
    });

    // Calculate yesterday's calories
    const dateObj = new Date(currentDateStr);
    dateObj.setDate(dateObj.getDate() - 1);
    const yesterdayStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const prevMeals = mStorage.getMealRecords(yesterdayStr) || [];
    let prevCals = 0;
    prevMeals.forEach(m => { prevCals += (Number(m.calories) || 0); });

    mealHtml += `<div style="display:flex; justify-content:space-around; align-items:center;">`;
    mealHtml += `<div><div style="font-size:0.85rem; color:var(--text-light); margin-bottom:0.25rem;">前日</div><strong style="font-size: 1.2rem; color:var(--text-light);">${prevCals} kcal</strong></div>`;
    mealHtml += `<div><div style="font-size:0.85rem; color:var(--text-light); margin-bottom:0.25rem;">当日</div><strong style="font-size: 1.5rem; color:var(--secondary-color);">${totalCals} kcal</strong></div>`;
    mealHtml += `</div></div>`;

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
    let expenseHtml = '<div style="text-align:center; padding: 1rem 0;">';
    let totalExpense = 0;
    expenses.forEach(e => {
        const amt = Number(e.amount) || 0;
        totalExpense += amt;
    });
    expenseHtml += `<strong style="font-size: 1.5rem; color:var(--secondary-color);">${totalExpense.toLocaleString()} 円</strong>`;
    expenseHtml += '</div>';

    const expenseCard = createCard('家計簿', '💰', expenseHtml, '支出記録はありません', expenses.length > 0);

    // Append to DOM
    elements.content.appendChild(taskCard);
    elements.content.appendChild(mealCard);
    elements.content.appendChild(trainingCard);
    elements.content.appendChild(expenseCard);
    elements.content.appendChild(diaryCard);

    // Attach event listeners for task toggling
    const taskItems = taskCard.querySelectorAll('.db-task-item');
    taskItems.forEach(item => {
        item.addEventListener('click', async () => {
            const taskId = item.getAttribute('data-id');
            await tskStorage.toggleTaskStatus(taskId, currentDateStr);
            // Re-render dashboard or trigger event
            document.dispatchEvent(new CustomEvent('tasksUpdated'));
        });
    });

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
