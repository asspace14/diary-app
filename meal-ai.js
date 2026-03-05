export class MealAI {
    constructor() {
        this.apiKey = localStorage.getItem('gemini_api_key') || '';
    }

    setApiKey(key) {
        this.apiKey = key.trim();
        if (this.apiKey) {
            localStorage.setItem('gemini_api_key', this.apiKey);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
    }

    hasApiKey() {
        return !!this.apiKey;
    }

    async estimateCalories(foodText) {
        if (!this.hasApiKey()) {
            throw new Error("Gemini APIキーが設定されていません。先の設定画面から登録してください。");
        }

        const prompt = `以下の食事内容から、おおよその合計カロリー（kcal）を推測し、必ず以下の形式のJSONのみを出力してください。結果のカロリーは数値型にしてください。
{
    "calories": 250
}

<食事内容>
${foodText}`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Gemini API Error:", errorData);
                if (response.status === 400 && errorData.error && errorData.error.message.includes('API key not valid')) {
                    throw new Error("APIキーが無効です。正しいキーを設定してください。");
                }
                throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

            try {
                const parsed = JSON.parse(reply);
                return parseInt(parsed.calories, 10) || 0;
            } catch (e) {
                console.error("Failed to parse JSON for text estimation", e, reply);
                return 0;
            }

        } catch (error) {
            console.error("Error estimating calories:", error);
            throw error;
        }
    }

    async analyzeImage(base64Data, mimeType) {
        if (!this.hasApiKey()) {
            throw new Error("Gemini APIキーが設定されていません。右上の歯車アイコンから登録してください。");
        }

        const prompt = `画像に写っている料理や食べ物をすべて推測し、それらの合計カロリー（kcal）と、代表的な料理名をJSON形式で返答してください。回答はマークダウン等を含めず、必ず以下の形式のJSONのみを出力してください。カロリーの値にはカンマ(,)を含めない数値型にしてください。
{
    "name": "推測した料理名",
    "calories": 500
}`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Gemini API Error:", errorData);
                if (response.status === 400 && errorData.error && errorData.error.message.includes('API key not valid')) {
                    throw new Error("APIキーが無効です。正しいキーを設定してください。");
                }
                throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

            try {
                const parsed = JSON.parse(reply);
                const calStr = String(parsed.calories || '0').replace(/,/g, '');
                return {
                    name: parsed.name || '',
                    calories: parseInt(calStr, 10) || 0
                };
            } catch (e) {
                console.error("Failed to parse JSON", e, reply);
                throw new Error("解析結果のフォーマットが不正です。");
            }
        } catch (error) {
            console.error("Error analyzing image:", error);
            throw error;
        }
    }
}

export const mealAI = new MealAI();
