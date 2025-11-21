// --- 辅助函数：创建 JSON 错误响应 ---
function createJsonErrorResponse(message, statusCode = 500) {
    return new Response(JSON.stringify({ error: message }), {
        status: statusCode,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}

// --- 辅助函数：休眠/等待 ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =======================================================
// 模块 1: Google AI API 调用逻辑
// =======================================================
async function callGoogleAI(model, messages, apiKey) {
    if (!apiKey) { throw new Error("callGoogleAI received an empty apiKey."); }

    // Google AI API 的 URL 结构是 https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // 构造请求体
    const payload = {
        contents: messages,
        // 在这里可以添加 generationConfig 等参数
    };

    console.log(`Sending payload to Google AI (${model}):`, JSON.stringify(payload, null, 2));

    const apiResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        throw new Error(`Google AI API error: ${apiResponse.status} ${apiResponse.statusText} - ${errorBody}`);
    }

    const responseData = await apiResponse.json();
    console.log("Google AI Response:", JSON.stringify(responseData, null, 2));

    // Google AI API 的响应结构与 OpenRouter 不同，需要解析
    // 注意：Google AI 的图像生成模型（如 Imagen）的 API 和响应结构可能与 Gemini 不同。
    // 此处假设使用的是 Gemini 系列模型，它可能不直接返回图片 URL，而是返回可用于生成图片的数据或文本。
    // 为了演示，我们假设它返回一个可识别的文本或标识符。
    const content = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) {
        // 这是一个临时的处理方式，实际的图像模型 API 响应需要具体适配
        return { type: 'text', content: content };
    }
    
    return { type: 'text', content: "[模型没有返回有效内容]" };
}

// =======================================================
// 模块 2: ModelScope API 调用逻辑
// =======================================================
async function callModelScope(model, apikey, parameters, timeoutSeconds) {
    const base_url = 'https://api-inference.modelscope.cn/';
    const common_headers = {
        "Authorization": `Bearer ${apikey}`,
        "Content-Type": "application/json",
    };
    console.log(`[ModelScope] Submitting task for model: ${model}`);
    const generationResponse = await fetch(`${base_url}v1/images/generations`, {
        method: "POST",
        headers: { ...common_headers, "X-ModelScope-Async-Mode": "true" },
        body: JSON.stringify({ model, ...parameters }),
    });
    if (!generationResponse.ok) {
        const errorBody = await generationResponse.text();
        throw new Error(`ModelScope API Error (Generation): ${generationResponse.status} - ${errorBody}`);
    }
    const { task_id } = await generationResponse.json();
    if (!task_id) { throw new Error("ModelScope API did not return a task_id."); }
    console.log(`[ModelScope] Task submitted. Task ID: ${task_id}`);
    
    const pollingIntervalSeconds = 5;
    const maxRetries = Math.ceil(timeoutSeconds / pollingIntervalSeconds);
    console.log(`[ModelScope] Task timeout set to ${timeoutSeconds}s, polling a max of ${maxRetries} times.`);

    for (let i = 0; i < maxRetries; i++) {
        await sleep(pollingIntervalSeconds * 1000);
        console.log(`[ModelScope] Polling task status... Attempt ${i + 1}/${maxRetries}`);
        const statusResponse = await fetch(`${base_url}v1/tasks/${task_id}`, { headers: { ...common_headers, "X-ModelScope-Task-Type": "image_generation" } });
        if (!statusResponse.ok) {
            console.error(`[ModelScope] Failed to get task status. Status: ${statusResponse.status}`);
            continue;
        }
        const data = await statusResponse.json();
        if (data.task_status === "SUCCEED") {
            console.log("[ModelScope] Task Succeeded.");
            if (data.output?.images?.[0]?.url) {
                return { imageUrl: data.output.images[0].url };
            } else if (data.output_images?.[0]) {
                return { imageUrl: data.output_images[0] };
            } else {
                throw new Error("ModelScope task succeeded but returned no images.");
            }
        } else if (data.task_status === "FAILED") {
            console.error("[ModelScope] Task Failed.", data);
            throw new Error(`ModelScope task failed: ${data.message || 'Unknown error'}`);
        }
    }
    throw new Error(`ModelScope task timed out after ${timeoutSeconds} seconds.`);
}

// =======================================================
// Cloudflare Worker 入口点
// =======================================================
export const onRequestPost = async ({ request, env }) => {
    if (request.method === 'OPTIONS') { 
        return new Response(null, { 
            status: 204, 
            headers: { 
                "Access-Control-Allow-Origin": "*", 
                "Access-Control-Allow-Methods": "POST, OPTIONS", 
                "Access-Control-Allow-Headers": "Content-Type, Authorization" 
            } 
        }); 
    }

    try {
        const requestData = await request.json();
        const { model, apikey, prompt, images, parameters, timeout } = requestData;

        if (model.startsWith('gemini-')) { // 检查模型名称是否以 'gemini-' 开头
            const googleApiKeys = (apikey || env.GOOGLE_API_KEYS || "").split(',').filter(k => k.trim());
            if (googleApiKeys.length === 0) { return createJsonErrorResponse("Google AI API key is not set.", 500); }
            
            // 多密钥负载均衡：随机选择一个密钥
            const apiKey = googleApiKeys[Math.floor(Math.random() * googleApiKeys.length)];

            if (!prompt) { return createJsonErrorResponse("Prompt is required.", 400); }
            
            // 构造 Google AI API 的 "contents" 格式
            const parts = [{ text: prompt }];
            if (images && Array.isArray(images) && images.length > 0) {
                images.forEach(imgDataUrl => {
                    const mimeType = imgDataUrl.match(/data:(.*?);/)[1];
                    const base64Data = imgDataUrl.split(',')[1];
                    parts.push({
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    });
                });
            }
            const messages = [{ role: "user", parts }];

            const result = await callGoogleAI(model, messages, apiKey);

            // 临时处理：由于 Gemini API 可能不直接返回图片 URL，我们将返回文本结果用于测试
            // 在实际的图像模型集成中，这里需要处理图像数据
            return new Response(JSON.stringify({ textResult: result.content }), { 
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
            });
        } else {
            const modelscopeApiKey = apikey || env.MODELSCOPE_API_KEY;
            if (!modelscopeApiKey) { return createJsonErrorResponse("ModelScope API key is not set.", 401); }
            if (!parameters?.prompt) { return createJsonErrorResponse("Positive prompt is required for ModelScope models.", 400); }
            
            const timeoutSeconds = timeout || (model.includes('Qwen') ? 120 : 180); 
            const result = await callModelScope(model, modelscopeApiKey, parameters, timeoutSeconds);

            return new Response(JSON.stringify(result), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }
    } catch (error) {
        console.error("Error handling /generate request:", error);
        return createJsonErrorResponse(error.message, 500);
    }
};
