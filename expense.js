import * as eStorage from './expense-storage.js';
import { formatDateJp } from './storage.js';
import { getCurrentUser } from './auth.js';

let currentDateStr = '';
const elements = {
    dateDisplay: document.getElementById('expense-date-display'),
    totalDisplay: document.getElementById('expense-total-display'),
    typeSelect: document.getElementById('expense-type-select'),
    itemInput: document.getElementById('expense-item-input'),
    amountInput: document.getElementById('expense-amount-input'),
    addBtn: document.getElementById('add-expense-btn'),
    list: document.getElementById('expense-list'),
};

export function initExpenses() {
    setupEventListeners();

    document.addEventListener('dateSelected', async (e) => {
        currentDateStr = e.detail.date;
        if (elements.dateDisplay) {
            elements.dateDisplay.textContent = `${formatDateJp(currentDateStr)} の家計簿`;
        }

        if (getCurrentUser()) {
            await renderDailyExpenses();
        }
    });

    document.addEventListener('monthChanged', async (e) => {
        if (getCurrentUser()) {
            await eStorage.fetchExpenseDataForMonth(e.detail.year, e.detail.month + 1);
            await renderDailyExpenses();
        }
    });
}

function setupEventListeners() {
    if (elements.addBtn) {
        elements.addBtn.addEventListener('click', handleAddExpense);
    }

    const handleEnter = (e) => {
        if (e.key === 'Enter') handleAddExpense();
    };
    if (elements.itemInput) elements.itemInput.addEventListener('keypress', handleEnter);
    if (elements.amountInput) elements.amountInput.addEventListener('keypress', handleEnter);
}

const typeLabels = {
    'cashless': '💳 キャッシュレス',
    'cash': '💴 現金'
};

const typeColors = {
    'cashless': '#3b82f6', // blue
    'cash': '#10b981'      // emerald
};

export async function renderDailyExpenses() {
    if (!currentDateStr || !elements.list) return;

    const expenses = eStorage.getExpenseRecords(currentDateStr);
    elements.list.innerHTML = '';

    let dailyTotal = 0;

    if (expenses.length === 0) {
        elements.list.innerHTML = '<li class="empty-message">支出記録はありません</li>';
    } else {
        expenses.forEach(exp => {
            dailyTotal += exp.amount;

            const li = document.createElement('li');
            li.className = 'task-item';
            li.style.justifyContent = 'space-between';
            li.style.flexWrap = 'nowrap';
            li.style.gap = '0.5rem';

            const amt = Number(exp.amount) || 0;
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; overflow: hidden;">
                    <span class="db-badge" style="background-color: ${typeColors[exp.type] || '#ccc'}">${typeLabels[exp.type] || exp.type}</span>
                    <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${exp.itemName}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                    <span style="color: var(--secondary-color); font-weight: 600;">${amt.toLocaleString()} 円</span>
                    <button class="icon-btn btn-danger btn-sm delete-btn" data-id="${exp.id}" title="削除">
                        <span class="material-icons-round">delete_outline</span>
                    </button>
                </div>
            `;

            li.querySelector('.delete-btn').addEventListener('click', () => handleDeleteExpense(exp.id));
            elements.list.appendChild(li);
        });
    }

    if (elements.totalDisplay) {
        elements.totalDisplay.textContent = `${dailyTotal.toLocaleString()} 円`;
    }
}

async function handleAddExpense() {
    const type = elements.typeSelect.value;
    const itemName = elements.itemInput.value.trim();
    const amountStr = elements.amountInput.value.trim();

    if (!itemName || !amountStr || !currentDateStr) return;

    elements.addBtn.disabled = true;

    const added = await eStorage.addExpense(currentDateStr, type, itemName, amountStr);

    if (added) {
        elements.itemInput.value = '';
        elements.amountInput.value = '';
        elements.itemInput.focus();

        await renderDailyExpenses();
        // Dispatch event for dashboard/calendar to re-render
        document.dispatchEvent(new CustomEvent('expenseUpdated'));
    } else {
        alert("支出の追加に失敗しました。ルールの設定等をご確認ください。");
    }

    elements.addBtn.disabled = false;
}

async function handleDeleteExpense(id) {
    if (!currentDateStr) return;
    if (confirm('この記録を削除しますか？')) {
        await eStorage.deleteExpense(id, currentDateStr);
        await renderDailyExpenses();
        document.dispatchEvent(new CustomEvent('expenseUpdated'));
    }
}
