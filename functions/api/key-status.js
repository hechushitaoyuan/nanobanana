export const onRequestGet = async ({ env }) => {
    // 检查在 Cloudflare Pages 环境变量中是否设置了 GOOGLE_API_KEYS
    const isSet = !!env.GOOGLE_API_KEYS;
    
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    };

    return new Response(JSON.stringify({ isSet }), { headers });
};
