import * as mStorage from './meal-storage.js';
import * as storage from './storage.js';
import { mealAI } from './meal-ai.js';

let currentDateStr = '';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;

const elements = {
    // Top summary
    dateDisplay: document.getElementById('meal-date-display'),
    prevDayCal: document.getElementById('prev-day-cal'),
    prevWeekCal: document.getElementById('prev-week-cal'),
    currentDayCal: document.getElementById('current-day-cal'),

    // Input form
    mealTypeSelect: document.getElementById('meal-type-select'),
    mealPresetSelect: document.getElementById('meal-preset-select'),
    mealInput: document.getElementById('new-meal-input'),
    mealCalInput: document.getElementById('manual-cal-input'),
    aiBtn: document.getElementById('ai-estimate-btn'),
    aiImageBtn: document.getElementById('ai-image-btn'),
    imageInput: document.getElementById('meal-image-input'),
    addMealBtn: document.getElementById('add-meal-btn'),
    mealList: document.getElementById('meal-list'),

    // Master Modal
    masterBtn: document.getElementById('meal-master-btn'),
    masterModal: document.getElementById('meal-master-modal'),
    masterList: document.getElementById('meal-master-list'),
    newMasterName: document.getElementById('new-meal-master-name'),
    newMasterCal: document.getElementById('new-meal-master-cal'),
    addMasterBtn: document.getElementById('add-meal-master-btn'),
    closeMasterBtn: document.getElementById('close-meal-master-btn'),

    // Settings Modal
    settingsBtn: document.getElementById('meal-settings-btn'),
    settingsModal: document.getElementById('meal-settings-modal'),
    apiKeyInput: document.getElementById('gemini-api-key'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    closeSettingsBtn: document.getElementById('close-settings-btn')
};

export async function initMeals() {
    setupEventListeners();

    document.addEventListener('dateSelected', async (e) => {
        currentDateStr = e.detail.date;
        if (elements.dateDisplay) {
            elements.dateDisplay.textContent = `${storage.formatDateJp(currentDateStr)} の食事記録`;
        }

        if (mStorage.auth && mStorage.auth.currentUser) {
            await Promise.all([
                loadMealsForCurrentMonth(),
                mStorage.loadMealMaster()
            ]);
            updatePresetDropdown();
        }
        await renderDailyMeals();
    });

    document.addEventListener('monthChanged', async (e) => {
        currentYear = e.detail.year;
        currentMonth = e.detail.month;
        if (mStorage.auth && mStorage.auth.currentUser) {
            await loadMealsForCurrentMonth();
        }
        await renderDailyMeals();
    });
}

function setupEventListeners() {
    // Add Meal buttons
    if (elements.addMealBtn) elements.addMealBtn.addEventListener('click', handleAddMeal);
    if (elements.aiBtn) elements.aiBtn.addEventListener('click', handleAIEstimate);

    // Image Upload Handlers
    if (elements.aiImageBtn && elements.imageInput) {
        elements.aiImageBtn.addEventListener('click', () => {
            if (!mealAI.hasApiKey()) {
                alert("Gemini APIキーが設定されていません。右上の歯車アイコンから設定してください。");
                elements.settingsModal.classList.remove('hidden');
                return;
            }
            elements.imageInput.click();
        });

        elements.imageInput.addEventListener('change', handleImageUpload);
    }

    // Enter key support for quick add (only for manual calorie if filled, else rely on button for AI)
    if (elements.mealCalInput) {
        elements.mealCalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAddMeal();
        });
    }

    // Preset Select Change
    if (elements.mealPresetSelect) {
        elements.mealPresetSelect.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            if (!selectedId) return;

            const preset = mStorage.mealMasterCache.find(item => item.id === selectedId);
            if (preset) {
                elements.mealInput.value = preset.name;
                elements.mealCalInput.value = preset.calories;
            }
            // Reset to default option after selection
            e.target.value = '';
        });
    }

    // Modal Triggers
    if (elements.masterBtn) {
        elements.masterBtn.addEventListener('click', () => {
            renderMasterList();
            elements.masterModal.classList.remove('hidden');
        });
    }
    if (elements.closeMasterBtn) {
        elements.closeMasterBtn.addEventListener('click', () => {
            elements.masterModal.classList.add('hidden');
        });
    }

    // Master Add Input Handling
    if (elements.newMasterName && elements.newMasterCal) {
        const checkInputs = () => {
            const hasName = elements.newMasterName.value.trim().length > 0;
            const hasCal = elements.newMasterCal.value.trim().length > 0;
            elements.addMasterBtn.disabled = !(hasName && hasCal);
        };
        elements.newMasterName.addEventListener('input', checkInputs);
        elements.newMasterCal.addEventListener('input', checkInputs);

        // Enter key to submit
        const handleEnter = (e) => {
            if (e.key === 'Enter' && !elements.addMasterBtn.disabled) {
                handleAddMaster();
            }
        }
        elements.newMasterName.addEventListener('keypress', handleEnter);
        elements.newMasterCal.addEventListener('keypress', handleEnter);
    }

    if (elements.addMasterBtn) {
        elements.addMasterBtn.addEventListener('click', handleAddMaster);
    }

    // Settings Modal
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => {
            elements.apiKeyInput.value = mealAI.apiKey;
            elements.settingsModal.classList.remove('hidden');
        });
    }
    if (elements.closeSettingsBtn) {
        elements.closeSettingsBtn.addEventListener('click', () => {
            elements.settingsModal.classList.add('hidden');
        });
    }
    if (elements.saveSettingsBtn) {
        elements.saveSettingsBtn.addEventListener('click', () => {
            mealAI.setApiKey(elements.apiKeyInput.value);
            elements.settingsModal.classList.add('hidden');
        });
    }
}

// UI Updaters
function updatePresetDropdown() {
    if (!elements.mealPresetSelect) return;
    elements.mealPresetSelect.innerHTML = '<option value="">(プリセットから選ぶ)</option>';

    mStorage.mealMasterCache.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = `${preset.name} (${preset.calories} kcal)`;
        elements.mealPresetSelect.appendChild(option);
    });
}

function renderMasterList() {
    if (!elements.masterList) return;
    elements.masterList.innerHTML = '';

    if (mStorage.mealMasterCache.length === 0) {
        elements.masterList.innerHTML = '<li class="empty-message">プリセットはありません</li>';
        return;
    }

    mStorage.mealMasterCache.forEach(preset => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.style.justifyContent = 'space-between';

        li.innerHTML = `
            <div style="display: flex; gap: 1rem; align-items: center;">
                <span style="font-weight: 500;">${preset.name}</span>
                <span style="color: var(--text-secondary); font-size: 0.9em;">${preset.calories} kcal</span>
            </div>
            <button class="icon-btn btn-danger btn-sm" data-id="${preset.id}" title="削除">
                <span class="material-icons-round">delete_outline</span>
            </button>
        `;

        li.querySelector('button').addEventListener('click', async () => {
            if (confirm(`「${preset.name}」をプリセットから削除しますか？`)) {
                await handleDeleteMaster(preset.id);
            }
        });

        elements.masterList.appendChild(li);
    });
}

// Master Handlers
async function handleAddMaster() {
    const name = elements.newMasterName.value.trim();
    const calories = elements.newMasterCal.value.trim();

    if (!name || !calories) return;

    elements.addMasterBtn.disabled = true;
    const added = await mStorage.addMealMaster(name, calories);

    if (added) {
        elements.newMasterName.value = '';
        elements.newMasterCal.value = '';
        renderMasterList();
        updatePresetDropdown();
    } else {
        alert("追加に失敗しました。Firebaseのルール設定を確認してください。");
        elements.addMasterBtn.disabled = false;
    }
}

async function handleDeleteMaster(id) {
    const success = await mStorage.deleteMealMaster(id);
    if (success) {
        renderMasterList();
        updatePresetDropdown();
    } else {
        alert("削除に失敗しました。");
    }
}

async function loadMealsForCurrentMonth() {
    await mStorage.fetchMealDataForMonth(currentYear, currentMonth);
}

// AI Estimation Logic
async function handleAIEstimate() {
    const text = elements.mealInput.value.trim();
    if (!text) {
        alert("食事内容を入力してください。");
        return;
    }

    if (!mealAI.hasApiKey()) {
        alert("Gemini APIキーが設定されていません。右上の歯車アイコンから設定してください。");
        elements.settingsModal.classList.remove('hidden');
        return;
    }

    elements.aiBtn.disabled = true;
    const originalText = elements.aiBtn.textContent;
    elements.aiBtn.textContent = '計算中...';

    try {
        const estimatedCalories = await mealAI.estimateCalories(text);
        if (estimatedCalories > 0) {
            elements.mealCalInput.value = estimatedCalories;
        } else {
            alert('カロリーを推測できませんでした。手動で入力してください。');
        }
    } catch (error) {
        alert(error.message || 'カロリー計算中にエラーが発生しました。');
    } finally {
        elements.aiBtn.disabled = false;
        elements.aiBtn.textContent = originalText;
    }
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input so the same file can be selected again if needed
    e.target.value = '';

    elements.aiImageBtn.disabled = true;
    const originalText = elements.aiImageBtn.textContent;
    elements.aiImageBtn.textContent = '解析中...';

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const dataUrl = event.target.result;
            // Parse data:image/jpeg;base64,... format
            const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9]+);base64,(.+)$/);

            if (!mimeMatch) {
                throw new Error("画像の読み込みに失敗しました。");
            }

            const mimeType = mimeMatch[1];
            const base64Data = mimeMatch[2];

            const result = await mealAI.analyzeImage(base64Data, mimeType);

            if (result.name) {
                elements.mealInput.value = result.name;
            }
            if (result.calories > 0) {
                elements.mealCalInput.value = result.calories;
            } else if (!result.name && result.calories === 0) {
                alert("食べ物を認識できませんでした。");
            }

        } catch (error) {
            alert(error.message || '画像解析中にエラーが発生しました。');
        } finally {
            elements.aiImageBtn.disabled = false;
            elements.aiImageBtn.textContent = originalText;
        }
    };

    reader.onerror = () => {
        alert("画像の読み込みに失敗しました。");
        elements.aiImageBtn.disabled = false;
        elements.aiImageBtn.textContent = originalText;
    };

    reader.readAsDataURL(file);
}

async function handleAddMeal() {
    const text = elements.mealInput.value.trim();
    const type = elements.mealTypeSelect.value;
    const calories = elements.mealCalInput.value.trim();

    if (!text || !currentDateStr) return;
    if (!calories) {
        alert('カロリーを入力するか、AI算出ボタンを押してください。');
        return;
    }

    elements.addMealBtn.disabled = true;

    const newMeal = await mStorage.addMeal(currentDateStr, type, text, calories);

    if (!newMeal) {
        alert("追加に失敗しました。Firebaseのセキュリティルールの設定に追加（meals）が必要です。");
        elements.addMealBtn.disabled = false;
        return;
    }

    elements.mealInput.value = '';
    elements.mealCalInput.value = '';
    elements.addMealBtn.disabled = false;

    await renderDailyMeals();
    document.dispatchEvent(new CustomEvent('mealsUpdated'));
}

async function handleDeleteMeal(mealId) {
    if (!currentDateStr) return;
    if (confirm('この食事記録を削除しますか？')) {
        await mStorage.deleteMeal(mealId, currentDateStr);
        await renderDailyMeals();
        document.dispatchEvent(new CustomEvent('mealsUpdated'));
    }
}

const mealTypeLabels = {
    'breakfast': '朝食',
    'lunch': '昼食',
    'dinner': '夕食',
    'snack': '間食'
};

const mealTypeColors = {
    'breakfast': '#f59e0b', // Amber
    'lunch': '#10b981',    // Emerald
    'dinner': '#3b82f6',   // Blue
    'snack': '#8b5cf6'     // Purple
};

export async function renderDailyMeals() {
    if (!currentDateStr || !elements.mealList) return;

    const meals = mStorage.getMealRecords(currentDateStr) || [];
    elements.mealList.innerHTML = '';

    let dailyTotal = 0;

    if (meals.length === 0) {
        elements.mealList.innerHTML = '<li class="empty-message">食事記録はありません</li>';
    } else {
        meals.forEach(meal => {
            dailyTotal += meal.calories;

            const li = document.createElement('li');
            li.className = `meal-item`;

            li.innerHTML = `
                <div class="meal-item-content">
                    <span class="meal-badge" style="background-color: ${mealTypeColors[meal.type]}">${mealTypeLabels[meal.type]}</span>
                    <div class="meal-details">
                        <span class="meal-text">${meal.text}</span>
                        <span class="meal-cal">${meal.calories} kcal</span>
                    </div>
                </div>
                <button class="icon-btn btn-danger btn-sm delete-meal-btn" data-id="${meal.id}">
                    <span class="material-icons-round">close</span>
                </button>
            `;

            const deleteBtn = li.querySelector('.delete-meal-btn');
            deleteBtn.addEventListener('click', () => handleDeleteMeal(meal.id));

            elements.mealList.appendChild(li);
        });
    }

    // Update today's total
    if (elements.currentDayCal) {
        elements.currentDayCal.textContent = `${dailyTotal} kcal`;
    }

    // Update historical summaries
    await updateHistoricalSummaries();
}

async function updateHistoricalSummaries() {
    if (!currentDateStr) return;

    // Calculate previous day date
    const dateObj = new Date(currentDateStr);
    dateObj.setDate(dateObj.getDate() - 1);
    const prevDayStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

    // Calculate 1 week ago date
    const weekAgoObj = new Date(currentDateStr);
    weekAgoObj.setDate(weekAgoObj.getDate() - 7);
    const prevWeekStr = `${weekAgoObj.getFullYear()}-${String(weekAgoObj.getMonth() + 1).padStart(2, '0')}-${String(weekAgoObj.getDate()).padStart(2, '0')}`;

    // Ensure auth is loaded before fetching db
    if (mStorage.auth && mStorage.auth.currentUser) {
        const prevDayTotal = await mStorage.fetchDailyCalories(prevDayStr);
        // Getting total sum of the previous 7 days
        const prevWeekTotal = await mStorage.fetchDateRangeCalories(prevWeekStr, prevDayStr);

        if (elements.prevDayCal) elements.prevDayCal.textContent = `${prevDayTotal} kcal`;
        if (elements.prevWeekCal) elements.prevWeekCal.textContent = `${prevWeekTotal} kcal`;
    }
}
