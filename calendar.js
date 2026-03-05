import { getDiaryEntriesForMonth } from './storage.js';
import { getTrainingEntriesForMonth } from './training-storage.js';
import { getTaskRecords } from './task-storage.js';
import { getMealRecords } from './meal-storage.js';
import { getExpenseRecords } from './expense-storage.js';

export class Calendar {
    constructor(containerId, titleId, onDateSelected, onMonthChange) {
        this.container = document.getElementById(containerId);
        this.titleElement = document.getElementById(titleId);
        this.onDateSelected = onDateSelected;
        this.onMonthChange = onMonthChange;

        this.currentDate = new Date();
        this.selectedDate = new Date(); // Start with today selected

        // Bind methods
        this.render = this.render.bind(this);
        this.prevMonth = this.prevMonth.bind(this);
        this.nextMonth = this.nextMonth.bind(this);

        // Initial render
        this.render();
    }

    getYearMonth() {
        return {
            year: this.currentDate.getFullYear(),
            month: this.currentDate.getMonth()
        };
    }

    async prevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        if (this.onMonthChange) {
            await this.onMonthChange(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1);
        }
        this.render();
    }

    async nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        if (this.onMonthChange) {
            await this.onMonthChange(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1);
        }
        this.render();
    }

    // Format date as YYYY-MM-DD
    formatDate(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Update title
        this.titleElement.textContent = `${year}年${month + 1}月`;

        // Clear container
        this.container.innerHTML = '';

        // Get first day of month and total days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Today for highlighting
        const today = new Date();
        const todayStr = this.formatDate(today.getFullYear(), today.getMonth(), today.getDate());

        // Currently selected date for highlighting
        const selectedStr = this.formatDate(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), this.selectedDate.getDate());

        // Empty cells for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-cell empty';
            this.container.appendChild(emptyCell);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';

            const cellText = document.createElement('span');
            cellText.textContent = day;
            cellText.className = 'calendar-day-text';
            cell.appendChild(cellText);

            const markers = document.createElement('div');
            markers.className = 'calendar-markers';
            cell.appendChild(markers);

            const dateStr = this.formatDate(year, month, day);

            // Add classes for styling
            if (dateStr === todayStr) {
                cell.classList.add('today');
            }
            if (dateStr === selectedStr) {
                cell.classList.add('selected');
            }
            // Add marker dots
            if (getDiaryEntriesForMonth(dateStr).length > 0) { // Changed from storage.hasEntry
                const dot = document.createElement('span');
                dot.className = 'marker-dot entry';
                markers.appendChild(dot);
            }
            if (getTrainingEntriesForMonth(dateStr).length > 0) { // Changed from tStorage.hasTraining
                const dot = document.createElement('span');
                dot.className = 'marker-dot training';
                markers.appendChild(dot);
            }
            if (getTaskRecords(dateStr).length > 0) { // Changed from tskStorage.hasTask
                const dot = document.createElement('span');
                dot.className = 'marker-dot task';
                markers.appendChild(dot);
            }
            if (getMealRecords(dateStr).length > 0) { // Changed from mStorage.hasMeal
                const dot = document.createElement('span');
                dot.className = 'marker-dot meal';
                markers.appendChild(dot);
            }
            // Expense Marker
            const expenses = getExpenseRecords(dateStr) || [];
            if (expenses.length > 0) {
                const dot = document.createElement('span');
                dot.className = 'marker-dot';
                dot.style.backgroundColor = '#3b82f6'; // blue
                markers.appendChild(dot);
            }

            // Click handler
            cell.addEventListener('click', () => {
                // Update selected date internally
                this.selectedDate = new Date(year, month, day);

                // Re-render to update highlights visually
                this.render();

                // Trigger callback
                if (this.onDateSelected) {
                    this.onDateSelected(dateStr, this.selectedDate);
                }
            });

            this.container.appendChild(cell);
        }
    }
}
