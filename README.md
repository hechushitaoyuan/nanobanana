# Nano Banana 🍌

一个简洁、高效的前端应用，专注于利用 Google Gemini 模型实现图文生成功能。

## 项目目标

创建一个轻量级的 Web 界面，用户可以通过输入文本提示词，并可选择性地上传图片，来调用背后由 Cloudflare Workers 驱动的 Gemini API 服务，从而生成新的图片。

## 核心功能

1.  **界面简洁**：
    *   移除所有非核心的UI元素，只保留一个清晰的标题 "Nano Banana"。
    *   一个用于输入 API 密钥的设置区域。
    *   一个可选的图片上传区域。
    *   一个文本提示词输入框。
    *   一个“生成”按钮。
    *   一个用于展示生成结果的区域。

2.  **核心模型**：
    *   直接调用 Google Gemini 的官方模型（例如 `gemini-pro-vision` 或其他支持图片生成的最新官方模型），不再使用自定义或非官方的模型名称。

3.  **技术栈**：
    *   **前端**：使用原生 HTML, CSS, 和 JavaScript 构建，确保应用的轻量和高性能。
    *   **后端**：利用 Cloudflare Workers 作为服务端，处理对 Google Gemini API 的请求，隐藏API密钥，并处理跨域问题。

## 文件结构

```
.
├── index.html         # 应用主页面
├── style.css          # 样式文件
├── script.js          # 前端交互逻辑
└── functions/
    └── generate.js    # Cloudflare Worker 后端函数，用于调用 Gemini API
```

## 开发步骤指南

1.  **构建前端界面 (`index.html`, `style.css`)**：
    *   创建 `index.html`，包含标题、设置区、图片上传区、提示词输入框、生成按钮和结果显示区。
    *   使用 `style.css` 对页面进行美化，使其布局简洁美观。

2.  **实现前端逻辑 (`script.js`)**：
    *   监听“生成”按钮的点击事件。
    *   获取用户输入的 API 密钥、提示词以及上传的图片（如果有）。
    *   将这些数据发送到 Cloudflare Worker 后端。
    *   接收后端的返回结果，并将其展示在结果区域。

3.  **开发后端服务 (`functions/generate.js`)**：
    *   创建一个 Cloudflare Worker 函数。
    *   该函数接收前端发送的请求。
    *   使用正确的 Gemini 模型名称（如 `gemini-pro-vision`）构造对 Google Gemini API 的请求。
    *   将用户的 API 密钥安全地添加到请求头中。
    *   将 Gemini API 的响应返回给前端。

这个 `README.md` 文件现在清晰地定义了新项目的范围和技术实现路径。当您在新的仓库中开始时，可以把这个文件交给 AI，并让它根据这些要求来生成代码。
