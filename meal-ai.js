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

        const prompt = `
以下の食事内容から、おおよその合計カロリー（kcal）を推測してください。
結果はカロリーの数値（半角数字のみ）だけで返答してください。単位や説明文は一切不要です。<食事内容>がない場合や推測不可能な場合は0を返してください。

<食事内容>
${foodText}
`;

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
                        temperature: 0.1, // Low temperature for consistent formatting
                        maxOutputTokens: 10
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
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '0';

            // Extract number from the reply just in case the model added extra text
            const numbers = reply.match(/\d+/g);
            if (numbers && numbers.length > 0) {
                // Return the first contiguous number found (or join them if expected to be comma separated, but usually it's just the value)
                return parseInt(numbers[0], 10);
            }

            return 0;

        } catch (error) {
            console.error("Error estimating calories:", error);
            throw error;
        }
    }
}

export const mealAI = new MealAI();
