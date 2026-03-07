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

function createCard(title, icon, contentHtml, emptyHtml, hasData, headerExtraHtml = '') {
    const card = document.createElement('div');
    card.className = 'dashboard-card';
    card.innerHTML = `
        <div class="dashboard-card-header" style="display: flex; align-items: center;">
            <div style="display: flex; align-items: center;">
                <span class="dashboard-card-icon">${icon}</span>
                <span class="dashboard-card-title">${title}</span>
            </div>
            ${headerExtraHtml}
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
    trainings.forEach((t, index) => {
        let details = '';
        if (t.category === 'weight' || t.type === 'weight') {
            details = `${t.weight}kg × ${t.reps}回 × ${t.sets}Set`;
        } else if (t.category === 'cardio' || t.type === 'cardio') {
            details = `${t.duration}分`;
        } else if (t.category === 'bodyweight' || t.type === 'bodyweight') {
            details = `${t.reps}回 × ${t.sets}Set`;
        }

        let isFullyCompleted = false;
        let checkboxesHTML = '';
        if (Array.isArray(t.completed)) {
            isFullyCompleted = t.completed.every(c => c);
            checkboxesHTML = `<div style="display: flex; gap: 0.2rem; align-items: center;">`;
            t.completed.forEach((c, setIdx) => {
                checkboxesHTML += `<span class="material-icons-round db-set-checkbox" data-index="${index}" data-setindex="${setIdx}" style="font-size: 1.1rem; cursor: pointer; color: ${c ? 'var(--secondary-color)' : '#d0d0d0'};">${c ? 'check_circle' : 'radio_button_unchecked'}</span>`;
            });
            checkboxesHTML += `</div>`;
        } else {
            isFullyCompleted = t.completed;
            checkboxesHTML = `<span class="material-icons-round db-single-checkbox" data-index="${index}" style="font-size: 1.2rem; cursor: pointer; color: ${isFullyCompleted ? 'var(--secondary-color)' : '#d0d0d0'};">${isFullyCompleted ? 'check_circle' : 'radio_button_unchecked'}</span>`;
        }

        trainingHtml += `<li class="${isFullyCompleted ? 'completed' : ''}" style="display:flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden;">
                                ${!Array.isArray(t.completed) ? checkboxesHTML : ''}
                                <strong style="font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${isFullyCompleted ? 'var(--text-light)' : 'var(--text-color)'};">${t.exName}</strong>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                <span class="db-detail" style="font-size: 0.8rem; color: var(--text-light); white-space: nowrap;">${details}</span>
                                ${Array.isArray(t.completed) ? checkboxesHTML : ''}
                            </div>
                        </li>`;
    });
    trainingHtml += '</ul>';


    const latestWeightData = await tStorage.getLatestBodyWeight(currentDateStr);
    let weightDisplay = '';
    if (latestWeightData) {
        const [y, m, d] = latestWeightData.date.split('-');
        const shortDate = `${parseInt(m)}/${parseInt(d)}`;
        weightDisplay = `<span style="font-size: 0.8rem; color: var(--secondary-color); font-weight: bold; margin-left: auto; background: rgba(0,255,136,0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">${shortDate} 体重 ${latestWeightData.weight}kg</span>`;
    }

    const trainingCard = createCard('運動', '🏋️', trainingHtml, '運動記録はありません', trainings.length > 0 || !!latestWeightData, weightDisplay);

    // 4. Diary
    const entryText = storage.getEntry(currentDateStr);
    let diaryHtml = '';
    if (entryText && typeof entryText === 'string' && entryText.trim() !== '') {
        // truncate text
        const snippet = entryText.length > 50 ? entryText.substring(0, 50) + '...' : entryText;
        diaryHtml = `<div class="db-diary-snippet">${snippet}</div>`;
    }
    const diaryCard = createCard('日記', '📖', diaryHtml, '日記はありません', !!(entryText && entryText.trim() !== ''));

    // 5. Expenses
    const monthlyExpenseTotal = eStorage.getMonthlyTotalExpense() || 0;

    let expenseHtml = '<div style="text-align:center; padding: 1rem 0;">';
    expenseHtml += `<div style="font-size:0.85rem; color:var(--text-light); margin-bottom:0.25rem;">今月の合計</div>`;
    expenseHtml += `<strong style="font-size: 1.5rem; color:var(--secondary-color);">${monthlyExpenseTotal.toLocaleString()} 円</strong>`;
    expenseHtml += '</div>';

    // Since it's a monthly total, it's generally good to always show the card if we logged in, but we can set condition to true so it always displays the monthly total.
    const expenseCard = createCard('家計簿', '💰', expenseHtml, '今月の支出記録はありません', true);

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

    // Attach event listeners for training toggling
    const trainingCheckboxes = trainingCard.querySelectorAll('.db-set-checkbox, .db-single-checkbox');
    trainingCheckboxes.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent event bubbling if necessary
            const indexStr = item.getAttribute('data-index');
            const setIndexStr = item.getAttribute('data-setindex');

            if (indexStr !== null) {
                const idx = parseInt(indexStr);
                const setIdx = setIndexStr !== null ? parseInt(setIndexStr) : null;
                // Add a new function or modify toggleTrainingStatus to handle specific sets
                await tStorage.toggleSpecificTrainingStatus(idx, currentDateStr, setIdx);
                document.dispatchEvent(new CustomEvent('trainingUpdated'));
            }
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
