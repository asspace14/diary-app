// export.js
import * as storage from './storage.js';

export function exportDayData(dateStr) {
    const entry = storage.getEntry(dateStr);

    if (!entry) {
        return false;
    }

    const dateParts = dateStr.split('-');
    let text = `${dateParts[0]}年${parseInt(dateParts[1], 10)}月${parseInt(dateParts[2], 10)}日 日記データ\n`;
    text += "=========================================\n\n";
    text += `${entry}\n\n`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `diary_${dateStr}.txt`);
    return true;
}

export async function exportWeekData(dateStr) {
    const selectedDate = new Date(dateStr);
    const dayOfWeek = selectedDate.getDay(); // 0 is Sunday

    // Calculate start of week (Sunday)
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - dayOfWeek);

    // Calculate end of week (Saturday)
    const endOfWeek = new Date(selectedDate);
    endOfWeek.setDate(selectedDate.getDate() + (6 - dayOfWeek));

    // Format YYYY-MM-DD
    const formatDate = (date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const startStr = formatDate(startOfWeek);
    const endStr = formatDate(endOfWeek);

    const entries = await storage.getEntriesForDateRange(startStr, endStr);
    const keys = Object.keys(entries).sort();

    if (keys.length === 0) {
        return false;
    }

    let text = `${startStr} 〜 ${endStr} 日記データ\n`;
    text += "=========================================\n\n";

    keys.forEach(date => {
        text += `[${date}]\n`;
        text += `${entries[date]}\n\n`;
        text += "-----------------------------------------\n\n";
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `diary_week_${startStr}_to_${endStr}.txt`);
    return true;
}

export async function exportMonthData(year, month) {
    // Ensure data is loaded
    await storage.loadMonthData(year, month);
    const entries = storage.getEntriesForMonth(year, month);
    const keys = Object.keys(entries).sort();

    if (keys.length === 0) {
        return false;
    }

    let text = `${year}年${parseInt(month, 10)}月 日記データ\n`;
    text += "=========================================\n\n";

    keys.forEach(date => {
        text += `[${date}]\n`;
        text += `${entries[date]}\n\n`;
        text += "-----------------------------------------\n\n";
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `diary_${year}_${String(month).padStart(2, '0')}.txt`);
    return true;
}

export async function exportYearData(year) {
    const entries = await storage.getEntriesForYear(year);
    const keys = Object.keys(entries).sort();

    if (keys.length === 0) {
        return false;
    }

    let text = `${year}年 日記データ\n`;
    text += "=========================================\n\n";

    keys.forEach(date => {
        text += `[${date}]\n`;
        text += `${entries[date]}\n\n`;
        text += "-----------------------------------------\n\n";
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `diary_${year}.txt`);
    return true;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
