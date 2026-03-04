import * as tStorage from './training-storage.js';
import { getCurrentUser } from './auth.js';

let currentDateStr = '';
let timerInterval = null;
let timerSeconds = 0;

const elements = {
    view: document.getElementById('training-view'),
    dateDisplay: document.getElementById('training-date-display'),

    // Master
    masterBtn: document.getElementById('master-btn'),
    masterModal: document.getElementById('master-modal'),
    closeMasterBtn: document.getElementById('close-master-btn'),
    masterList: document.getElementById('master-list'),
    newExName: document.getElementById('new-exercise-name'),
    newExCat: document.getElementById('new-exercise-category'),
    addMasterBtn: document.getElementById('add-master-btn'),

    // Copy
    copyBtn: document.getElementById('copy-history-btn'),
    copyModal: document.getElementById('copy-modal'),
    closeCopyBtn: document.getElementById('close-copy-btn'),
    executeCopyBtn: document.getElementById('execute-copy-btn'),
    copyDateInput: document.getElementById('copy-date-input'),

    // Form
    exSelect: document.getElementById('exercise-select'),
    weightRepsGroup: document.getElementById('weight-reps-inputs'),
    cardioGroup: document.getElementById('cardio-inputs'),
    weightInput: document.getElementById('weight-input'),
    repsInput: document.getElementById('reps-input'),
    setsInput: document.getElementById('sets-input'),
    durationInput: document.getElementById('duration-input'),
    addRecordBtn: document.getElementById('add-training-btn'),

    // List
    trainingList: document.getElementById('training-list'),

    // Timer
    timerContainer: document.getElementById('interval-timer-container'),
    timerDisplay: document.getElementById('timer-display'),
    timerStopBtn: document.getElementById('timer-stop-btn')
};

export async function initTraining() {
    setupEventListeners();
}

export async function onTrainingAuthChange(user) {
    if (user) {
        await tStorage.loadMasterExercises();
        updateExerciseSelect();
        renderMasterList();
    } else {
        tStorage.clearTrainingCache();
        if (elements.trainingList) elements.trainingList.innerHTML = '';
    }
}

export function selectTrainingDate(dateStr, dateObj) {
    currentDateStr = dateStr;
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    if (elements.dateDisplay) {
        elements.dateDisplay.textContent = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 (${days[dateObj.getDay()]})`;
    }
    renderDailyRecords();
}

function setupEventListeners() {
    // Master Modal
    if (elements.masterBtn) elements.masterBtn.addEventListener('click', () => elements.masterModal.classList.remove('hidden'));
    if (elements.closeMasterBtn) elements.closeMasterBtn.addEventListener('click', () => elements.masterModal.classList.add('hidden'));
    if (elements.addMasterBtn) elements.addMasterBtn.addEventListener('click', handleAddMaster);

    // Form category switch
    if (elements.exSelect) elements.exSelect.addEventListener('change', handleExerciseSelect);

    // Inputs validation
    if (elements.weightInput) elements.weightInput.addEventListener('input', validateForm);
    if (elements.repsInput) elements.repsInput.addEventListener('input', validateForm);
    if (elements.setsInput) elements.setsInput.addEventListener('input', validateForm);
    if (elements.durationInput) elements.durationInput.addEventListener('input', validateForm);

    // Add record
    if (elements.addRecordBtn) elements.addRecordBtn.addEventListener('click', handleAddRecord);

    // Copy Modal
    if (elements.copyBtn) elements.copyBtn.addEventListener('click', () => elements.copyModal.classList.remove('hidden'));
    if (elements.closeCopyBtn) elements.closeCopyBtn.addEventListener('click', () => elements.copyModal.classList.add('hidden'));
    if (elements.executeCopyBtn) elements.executeCopyBtn.addEventListener('click', handleCopyHistory);

    // Timer buttons
    if (elements.timerStopBtn) elements.timerStopBtn.addEventListener('click', stopTimer);
}

async function handleAddMaster() {
    const name = elements.newExName.value.trim();
    const cat = elements.newExCat.value;
    if (!name) return;

    elements.addMasterBtn.disabled = true;
    const result = await tStorage.addMasterExercise(name, cat);

    if (result) {
        elements.newExName.value = '';
        updateExerciseSelect();
        renderMasterList();
    } else {
        alert("追加に失敗しました。Firebaseのセキュリティルールの設定を確認してください。");
    }
    elements.addMasterBtn.disabled = false;
}

async function handleDeleteMaster(id) {
    if (confirm('この種目を削除しますか？')) {
        await tStorage.deleteMasterExercise(id);
        updateExerciseSelect();
        renderMasterList();
    }
}

function renderMasterList() {
    const masters = tStorage.getMasterExercises();
    elements.masterList.innerHTML = '';
    masters.forEach(ex => {
        const li = document.createElement('li');
        li.className = 'master-item';
        li.innerHTML = `
      <div class="master-item-info">
        <span class="master-item-name">${ex.name}</span>
        <span class="master-item-category ${ex.category}">${ex.category === 'weight' ? 'ウェイト' : '有酸素'}</span>
      </div>
      <button class="icon-btn btn-danger btn-sm delete-master-btn"><span class="material-icons-round">close</span></button>
    `;
        li.querySelector('.delete-master-btn').addEventListener('click', () => handleDeleteMaster(ex.id));
        elements.masterList.appendChild(li);
    });
}

function updateExerciseSelect() {
    const masters = tStorage.getMasterExercises();
    const currentVal = elements.exSelect.value;
    elements.exSelect.innerHTML = '<option value="">種目を選択...</option>';
    masters.forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.dataset.category = ex.category;
        opt.textContent = ex.name;
        elements.exSelect.appendChild(opt);
    });
    if (currentVal) elements.exSelect.value = currentVal;
}

// --- Form Logic ---
function handleExerciseSelect() {
    const opt = elements.exSelect.options[elements.exSelect.selectedIndex];
    if (!opt.value) {
        elements.weightRepsGroup.classList.add('hidden');
        elements.cardioGroup.classList.add('hidden');
    } else if (opt.dataset.category === 'weight') {
        elements.weightRepsGroup.classList.remove('hidden');
        elements.cardioGroup.classList.add('hidden');
    } else {
        elements.weightRepsGroup.classList.add('hidden');
        elements.cardioGroup.classList.remove('hidden');
    }
    validateForm();
}

function validateForm() {
    const opt = elements.exSelect.options[elements.exSelect.selectedIndex];
    let isValid = false;
    if (opt.value) {
        if (opt.dataset.category === 'weight') {
            isValid = elements.weightInput.value !== '' && elements.repsInput.value !== '' && elements.setsInput.value !== '';
        } else {
            isValid = elements.durationInput.value !== '';
        }
    }
    elements.addRecordBtn.disabled = !isValid;
}

async function handleAddRecord() {
    const opt = elements.exSelect.options[elements.exSelect.selectedIndex];
    if (!opt.value) return;

    elements.addRecordBtn.disabled = true;

    const records = [...tStorage.getTrainingRecords(currentDateStr)];
    const newRecord = {
        id: Date.now().toString() + Math.random().toString().substring(2, 6),
        exId: opt.value,
        exName: opt.text,
        category: opt.dataset.category
    };

    if (opt.dataset.category === 'weight') {
        newRecord.weight = parseFloat(elements.weightInput.value);
        newRecord.reps = parseInt(elements.repsInput.value);
        newRecord.sets = parseInt(elements.setsInput.value);
        newRecord.completed = Array(newRecord.sets).fill(false);
    } else {
        newRecord.duration = parseInt(elements.durationInput.value);
        newRecord.completed = false;
    }

    records.push(newRecord);
    await tStorage.saveTrainingRecords(currentDateStr, records);

    document.dispatchEvent(new CustomEvent('trainingUpdated'));

    renderDailyRecords();
    elements.addRecordBtn.disabled = false;

    if (opt.dataset.category === 'weight') {
        elements.repsInput.value = '';
        elements.setsInput.value = '';
    } else {
        elements.durationInput.value = '';
    }
    validateForm();
}

// --- Daily List Logic ---
function renderDailyRecords() {
    if (!currentDateStr) return;
    const records = tStorage.getTrainingRecords(currentDateStr);
    elements.trainingList.innerHTML = '';

    records.forEach((rec, index) => {
        const li = document.createElement('li');

        let isFullyCompleted = false;
        if (Array.isArray(rec.completed)) {
            isFullyCompleted = rec.completed.every(c => c);
        } else {
            isFullyCompleted = rec.completed;
        }

        li.className = `training-item ${isFullyCompleted ? 'completed' : ''}`;

        let detailText = '';
        if (rec.category === 'weight') {
            detailText = `${rec.weight} kg × ${rec.reps} 回${rec.sets ? ` × ${rec.sets} セット` : ''}`;
        } else {
            detailText = `${rec.duration} 分`;
        }

        let checkboxesHTML = '';
        if (Array.isArray(rec.completed)) {
            rec.completed.forEach((c, setIdx) => {
                checkboxesHTML += `<label class="set-checkbox-label"><input type="checkbox" class="set-checkbox" data-setindex="${setIdx}" ${c ? 'checked' : ''}> ${setIdx + 1}セット目</label>`;
            });
        } else {
            checkboxesHTML = `<label class="set-checkbox-label"><input type="checkbox" class="single-checkbox" ${rec.completed ? 'checked' : ''}> 完了</label>`;
        }

        li.innerHTML = `
      <div class="item-main-content">
          <div class="item-text-group">
              <span class="item-title">${rec.exName}</span>
              <span class="item-details">${detailText}</span>
          </div>
          <button class="icon-btn btn-danger btn-sm delete-record-btn"><span class="material-icons-round">close</span></button>
      </div>
      <div class="item-checkboxes">
          ${checkboxesHTML}
      </div>
    `;

        li.querySelectorAll('.set-checkbox, .single-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const setIdx = e.target.dataset.setindex;
                toggleRecordCompletion(index, e.target.checked, setIdx !== undefined ? parseInt(setIdx) : null);
            });
        });
        li.querySelector('.delete-record-btn').addEventListener('click', () => handleDeleteRecord(index));

        elements.trainingList.appendChild(li);
    });
}

async function toggleRecordCompletion(index, checkedStatus, setIndex = null) {
    const records = [...tStorage.getTrainingRecords(currentDateStr)];
    if (setIndex !== null && Array.isArray(records[index].completed)) {
        records[index].completed[setIndex] = checkedStatus;
    } else {
        records[index].completed = checkedStatus;
    }
    await tStorage.saveTrainingRecords(currentDateStr, records);
    renderDailyRecords();

    if (checkedStatus) {
        elements.timerContainer.classList.remove('hidden');
        startTimer(3);
    }
}

async function handleDeleteRecord(index) {
    if (confirm('この記録を削除しますか？')) {
        const records = [...tStorage.getTrainingRecords(currentDateStr)];
        records.splice(index, 1);
        await tStorage.saveTrainingRecords(currentDateStr, records);
        document.dispatchEvent(new CustomEvent('trainingUpdated'));
        renderDailyRecords();
    }
}

// --- Copy Logic ---
async function handleCopyHistory() {
    const sourceDate = elements.copyDateInput.value;
    if (!sourceDate) {
        alert('日付を選択してください');
        return;
    }

    elements.executeCopyBtn.disabled = true;
    const success = await tStorage.copyTrainingData(sourceDate, currentDateStr);

    if (success) {
        document.dispatchEvent(new CustomEvent('trainingUpdated'));
        renderDailyRecords();
        elements.copyModal.classList.add('hidden');

        const toast = document.getElementById('toast');
        toast.textContent = 'コピーしました';
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    } else {
        alert('選択した日付にトレーニングデータがありません。');
    }
    elements.executeCopyBtn.disabled = false;
}

// --- Timer Logic ---
function startTimer(minutes) {
    stopTimer();
    timerSeconds = minutes * 60;
    updateTimerDisplay();
    elements.timerStopBtn.classList.remove('hidden');

    timerInterval = setInterval(() => {
        timerSeconds--;
        if (timerSeconds <= 0) {
            stopTimer();
            alert('休憩終了です！');
        } else {
            updateTimerDisplay();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerSeconds = 0;
    elements.timerDisplay.textContent = '03:00';
    elements.timerStopBtn.classList.add('hidden');
}

function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    elements.timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
