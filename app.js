import * as storage from './storage.js';
import * as tStorage from './training-storage.js';
import * as tskStorage from './task-storage.js';
import { Calendar } from './calendar.js';
import { SpeechApp } from './speech.js';
import { exportDayData, exportWeekData, exportMonthData, exportYearData } from './export.js';
import { login, logout, onAuthChange, getCurrentUser } from './auth.js';
import { initTraining, onTrainingAuthChange, selectTrainingDate } from './training.js';
import { initTasks } from './task.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        // Mode Switcher
        modeTaskBtn: document.getElementById('mode-task-btn'),
        modeDiaryBtn: document.getElementById('mode-diary-btn'),
        modeTrainingBtn: document.getElementById('mode-training-btn'),
        taskView: document.getElementById('task-view'),
        diaryView: document.getElementById('diary-view'),
        trainingView: document.getElementById('training-view'),

        themeBtn: document.getElementById('theme-btn'),
        exportBtn: document.getElementById('export-btn'),
        prevMonthBtn: document.getElementById('prev-month'),
        nextMonthBtn: document.getElementById('next-month'),

        dateDisplay: document.getElementById('selected-date-display'),
        saveStatus: document.getElementById('save-status'),

        micBtn: document.getElementById('mic-btn'),
        clearBtn: document.getElementById('clear-btn'),
        textarea: document.getElementById('diary-textarea'),

        // Modal
        exportModal: document.getElementById('export-modal'),
        exportDayBtn: document.getElementById('export-day-btn'),
        exportWeekBtn: document.getElementById('export-week-btn'),
        exportMonthBtn: document.getElementById('export-month-btn'),
        exportYearBtn: document.getElementById('export-year-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),

        // Auth UI
        authBtn: document.getElementById('auth-btn'),
        userInfo: document.getElementById('user-info'),
        userAvatar: document.getElementById('user-avatar'),
        userName: document.getElementById('user-name'),
        authOverlay: document.getElementById('auth-overlay'),
        appMain: document.getElementById('app-main'),
        loginOverlayBtn: document.getElementById('login-overlay-btn'),

        toast: document.getElementById('toast'),
        body: document.body
    };

    // State
    let currentDateStr = '';
    let saveTimeout = null;
    let calendar;
    let speechApp;

    // --- Initialization ---
    initTheme();
    initAuth();
    initCalendar();
    initSpeech();
    initTraining();
    initTasks();
    initEventListeners();

    // Select today initially
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    selectDate(todayStr, today);

    // --- Core Functions ---

    function initAuth() {
        onAuthChange(async (user) => {
            if (user) {
                // Logged in
                elements.authOverlay.classList.add('hidden');
                elements.appMain.classList.remove('hidden');

                // Initialize Training Auth
                onTrainingAuthChange(user);

                // Update Header UI
                elements.authBtn.textContent = 'ログアウト';
                elements.userInfo.classList.remove('hidden');
                elements.userName.textContent = user.displayName || 'ユーザー';
                if (user.photoURL) {
                    elements.userAvatar.src = user.photoURL;
                }

                // We'll reload data from Firestore here later
                if (calendar) {
                    const { year, month } = calendar.getYearMonth();
                    await Promise.all([
                        storage.loadMonthData(year, month + 1),
                        tStorage.loadMonthTrainingData(year, month + 1),
                        tskStorage.fetchTaskDataForMonth(year, month + 1)
                    ]);

                    calendar.render();
                    if (currentDateStr) {
                        selectDate(currentDateStr, new Date(currentDateStr));
                    }
                }

            } else {
                // Not logged in
                elements.authOverlay.classList.remove('hidden');
                elements.appMain.classList.add('hidden');
                onTrainingAuthChange(null);
                tskStorage.clearTaskCache();

                // Update Header UI
                elements.authBtn.textContent = 'ログイン';
                elements.userInfo.classList.add('hidden');
            }
        });
    }

    async function handleAuthClick() {
        const user = getCurrentUser();
        try {
            if (user) {
                await logout();
                showToast('ログアウトしました');
            } else {
                await login();
                showToast('ログインしました');
            }
        } catch (error) {
            console.error("Auth error", error);
            showToast('認証エラーが発生しました');
        }
    }

    function initTheme() {
        const theme = storage.getTheme();
        if (theme === 'dark') {
            elements.body.setAttribute('data-theme', 'dark');
            elements.themeBtn.querySelector('span').textContent = 'light_mode';
        }
    }

    function toggleTheme() {
        const isDark = elements.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            elements.body.removeAttribute('data-theme');
            storage.saveTheme('light');
            elements.themeBtn.querySelector('span').textContent = 'dark_mode';
        } else {
            elements.body.setAttribute('data-theme', 'dark');
            storage.saveTheme('dark');
            elements.themeBtn.querySelector('span').textContent = 'light_mode';
        }
    }

    function initCalendar() {
        calendar = new Calendar(
            'calendar-dates-container',
            'current-month-year',
            selectDate,
            async (year, month) => {
                if (getCurrentUser()) {
                    await Promise.all([
                        storage.loadMonthData(year, month),
                        tStorage.loadMonthTrainingData(year, month),
                        tskStorage.fetchTaskDataForMonth(year, month)
                    ]);
                }
            }
        );
    }

    function initSpeech() {
        let textBeforeRecording = '';

        speechApp = new SpeechApp(
            // onResult
            (finalTranscript, interimTranscript) => {
                const newText = textBeforeRecording + (textBeforeRecording && finalTranscript ? '\n' : '') + finalTranscript + interimTranscript;
                elements.textarea.value = newText;

                if (finalTranscript) {
                    textBeforeRecording = elements.textarea.value;
                    autoSave();
                }
            },
            // onEnd
            () => {
                updateMicBtnState(false);
                showToast('音声入力を終了しました');
                autoSave();
            },
            // onError
            (error) => {
                showToast(`音声入力エラー: ${error}`);
                updateMicBtnState(false);
            }
        );

        if (!speechApp.supported) {
            elements.micBtn.style.display = 'none';
        }
    }

    function updateMicBtnState(isRecording) {
        const icon = elements.micBtn.querySelector('.material-icons-round');
        const text = elements.micBtn.querySelector('.btn-text');

        if (isRecording) {
            elements.micBtn.classList.add('recording');
            icon.textContent = 'mic_off';
            text.textContent = '停止';
        } else {
            elements.micBtn.classList.remove('recording');
            icon.textContent = 'mic';
            text.textContent = '音声入力';
        }
    }

    function toggleSpeech() {
        if (!currentDateStr) return;

        if (speechApp.isRecording) {
            speechApp.stop();
        } else {
            // Check if we can start
            if (speechApp.start()) {
                updateMicBtnState(true);
                showToast('音声入力を開始しました。お話しください...');
            } else {
                showToast('マイクのアクセスが許可されていないか、対応していないブラウザです。');
            }
        }
    }

    function selectDate(dateStr, dateObj) {
        currentDateStr = dateStr;

        // Update UI
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const dayName = days[dateObj.getDay()];
        elements.dateDisplay.textContent = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 (${dayName})`;

        // Enable editor and load data
        elements.textarea.disabled = false;
        elements.textarea.value = storage.getEntry(dateStr);

        // Update Training Date
        selectTrainingDate(dateStr, dateObj);

        // Dispatch event for task.js
        document.dispatchEvent(new CustomEvent('dateSelected', { detail: { date: dateStr, dateObj: dateObj } }));

        // Stop recording if active
        if (speechApp && speechApp.isRecording) {
            speechApp.stop();
        }

        // Clear status
        elements.saveStatus.classList.remove('visible');
    }

    function autoSave() {
        if (!currentDateStr) return;

        // Show saving status
        elements.saveStatus.textContent = '保存中...';
        elements.saveStatus.classList.remove('success');
        elements.saveStatus.classList.add('visible');

        // Debounce actual save
        if (saveTimeout) clearTimeout(saveTimeout);

        saveTimeout = setTimeout(() => {
            storage.saveEntry(currentDateStr, elements.textarea.value);

            // Re-render calendar to show/hide entry indicator
            calendar.render();

            elements.saveStatus.textContent = '保存しました';
            elements.saveStatus.classList.add('success');

            setTimeout(() => {
                elements.saveStatus.classList.remove('visible');
            }, 2000);

        }, 500);
    }

    function clearEntry() {
        if (!currentDateStr) return;
        if (confirm('この日の日記を削除しますか？')) {
            storage.deleteEntry(currentDateStr);
            elements.textarea.value = '';
            calendar.render();
            showToast('削除しました');
        }
    }

    function openExportModal() {
        if (!currentDateStr) {
            showToast('日付を選択してください');
            return;
        }
        elements.exportModal.classList.remove('hidden');
    }

    function closeExportModal() {
        elements.exportModal.classList.add('hidden');
    }

    function getActiveMode() {
        if (elements.modeTaskBtn.classList.contains('active')) return 'task';
        if (elements.modeDiaryBtn.classList.contains('active')) return 'diary';
        return 'training';
    }

    async function handleExportDay() {
        const mode = getActiveMode();
        if (mode === 'diary') {
            const success = exportDayData(currentDateStr);
            if (success) showToast(`${currentDateStr}の日記データを出力しました`);
            else showToast(`${currentDateStr}の日記データがありません`);
        } else {
            const success = await tStorage.exportTrainingDayData(currentDateStr);
            if (success) showToast(`${currentDateStr}の筋トレデータを出力しました`);
            else showToast(`${currentDateStr}の筋トレデータがありません`);
        }
        closeExportModal();
    }

    async function handleExportWeek() {
        showToast('データを取得中...');
        const mode = getActiveMode();
        if (mode === 'diary') {
            const success = await exportWeekData(currentDateStr);
            if (success) showToast(`週の日記データを出力しました`);
            else showToast(`選択した週の日記データがありません`);
        } else {
            const success = await tStorage.exportTrainingWeekData(currentDateStr);
            if (success) showToast(`週の筋トレデータを出力しました`);
            else showToast(`選択した週の筋トレデータがありません`);
        }
        closeExportModal();
    }

    async function handleExportMonth() {
        showToast('データを取得中...');
        const { year, month } = calendar.getYearMonth();
        const mode = getActiveMode();

        if (mode === 'diary') {
            const success = await exportMonthData(year, month + 1);
            if (success) showToast(`${year}年${month + 1}月の日記データを出力しました`);
            else showToast(`${year}年${month + 1}月の日記データがありません`);
        } else {
            const success = await tStorage.exportTrainingMonthData(year, month + 1);
            if (success) showToast(`${year}年${month + 1}月の筋トレデータを出力しました`);
            else showToast(`${year}年${month + 1}月の筋トレデータがありません`);
        }
        closeExportModal();
    }

    async function handleExportYear() {
        showToast('データを取得中...');
        const { year } = calendar.getYearMonth();
        const mode = getActiveMode();

        if (mode === 'diary') {
            const success = await exportYearData(year);
            if (success) showToast(`${year}年の日記データを出力しました`);
            else showToast(`${year}年の日記データがありません`);
        } else {
            const success = await tStorage.exportTrainingYearData(year);
            if (success) showToast(`${year}年の筋トレデータを出力しました`);
            else showToast(`${year}年の筋トレデータがありません`);
        }
        closeExportModal();
    }

    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.remove('hidden');

        setTimeout(() => {
            elements.toast.classList.add('hidden');
        }, 3000);
    }

    function switchMode(mode) {
        // Reset all buttons and views
        elements.modeTaskBtn.classList.remove('active');
        elements.modeDiaryBtn.classList.remove('active');
        elements.modeTrainingBtn.classList.remove('active');

        elements.taskView.classList.add('hidden');
        elements.diaryView.classList.add('hidden');
        elements.trainingView.classList.add('hidden');

        if (mode === 'task') {
            elements.modeTaskBtn.classList.add('active');
            elements.taskView.classList.remove('hidden');
            document.querySelector('.app-title').textContent = 'タスク管理';
        } else if (mode === 'diary') {
            elements.modeDiaryBtn.classList.add('active');
            elements.diaryView.classList.remove('hidden');
            document.querySelector('.app-title').textContent = 'ボイス日記';
        } else {
            elements.modeTrainingBtn.classList.add('active');
            elements.trainingView.classList.remove('hidden');
            document.querySelector('.app-title').textContent = '筋トレ管理';
        }
    }

    // --- Event Listeners Integration ---
    function initEventListeners() {
        // Mode Switcher
        elements.modeTaskBtn.addEventListener('click', () => switchMode('task'));
        elements.modeDiaryBtn.addEventListener('click', () => switchMode('diary'));
        elements.modeTrainingBtn.addEventListener('click', () => switchMode('training'));

        // Auth
        elements.authBtn.addEventListener('click', handleAuthClick);
        elements.loginOverlayBtn.addEventListener('click', handleAuthClick);

        // Theme
        elements.themeBtn.addEventListener('click', toggleTheme);

        // Export Modal
        elements.exportBtn.addEventListener('click', openExportModal);
        elements.closeModalBtn.addEventListener('click', closeExportModal);
        elements.exportDayBtn.addEventListener('click', handleExportDay);
        elements.exportWeekBtn.addEventListener('click', handleExportWeek);
        elements.exportMonthBtn.addEventListener('click', handleExportMonth);
        elements.exportYearBtn.addEventListener('click', handleExportYear);

        // Close modal when clicking outside
        elements.exportModal.addEventListener('click', (e) => {
            if (e.target === elements.exportModal) {
                closeExportModal();
            }
        });

        // Calendar formatting
        elements.prevMonthBtn.addEventListener('click', () => calendar.prevMonth());
        elements.nextMonthBtn.addEventListener('click', () => calendar.nextMonth());

        // Editor
        elements.textarea.addEventListener('input', autoSave);
        elements.clearBtn.addEventListener('click', clearEntry);

        // Speech
        elements.micBtn.addEventListener('click', toggleSpeech);

        // Custom Event from training.js and task.js
        document.addEventListener('trainingUpdated', () => {
            calendar.render();
        });
        document.addEventListener('tasksUpdated', () => {
            calendar.render();
        });
    }
});
