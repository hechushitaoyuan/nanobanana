export const onRequestGet = async ({ env }) => {
    // 检查在 Cloudflare Pages 环境变量中是否设置了 MODELSCOPE_API_KEY
    const isSet = !!env.MODELSCOPE_API_KEY;
    
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    };

    return new Response(JSON.stringify({ isSet }), { headers });
};
