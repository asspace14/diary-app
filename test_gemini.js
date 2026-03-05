const fs = require('fs');
const readline = require('readline');

async function testCalorieEstimation(apiKey) {
    const foodText = `豚のかしら35ｇ\n鶏むね肉90ｇ\nオリーブオイル5ｇ\n辛みそだれ10ｇ`;

    // Original prompt from meal-ai.js
    const prompt = `
以下の食事内容から、おおよその合計カロリー（kcal）を推測してください。
結果はカロリーの数値をカンマなしの半角数字のみで返答してください。単位や説明文は一切不要です。<食事内容>がない場合や推測不可能な場合は0を返してください。

<食事内容>
${foodText}
`;

    console.log("Sending prompt:\n", prompt);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
                    maxOutputTokens: 10
                }
            })
        });

        const data = await response.json();
        console.log("Raw API Response:", JSON.stringify(data, null, 2));

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '0';
        console.log("Extracted Reply:", reply);

        const cleanReply = reply.replace(/,/g, '');
        const numbers = cleanReply.match(/\d+/g);
        let finalValue = 0;
        if (numbers && numbers.length > 0) {
            finalValue = parseInt(numbers[0], 10);
        }
        console.log("Parsed Final Value:", finalValue);

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

// Read API key from user's storage if we could, but I can't easily read localStorage from node.
// I'll leave the API key blank for the user to run it themselves, or I can try parsing localStorage from Chrome profile? No.
// Let me just check the meal.js logic instead, wait. 
