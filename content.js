/**
 * ContextGenie Content Script
 * 在 LeetCode 页面中运行，负责获取题目、调用后端、注入结果
 */

const BACKEND_URL = 'http://127.0.0.1:8000';
let messageListenerReady = false;

/**
 * 提取 LeetCode 题目的 HTML 内容
 */
function extractProblemContent() {
    // 尝试多个可能的选择器
    const selectors = [
        'div[data-track-load="description_content"]',
        'div[class*="css-1yprw65"]',  // LeetCode 常见类名格式
        'div[class*="description"]',
        'div[role="main"]',
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 0) {
            return element.innerHTML;
        }
    }

    throw new Error('无法找到题目内容。请确保在 LeetCode 题目页面使用此插件。');
}

/**
 * 创建加载状态占位符
 */
function createLoadingPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.id = 'contextgenie-loading';
    placeholder.style.cssText = `
        background-color: #f0f9ff;
        border: 2px solid #3b82f6;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        color: #3b82f6;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        animation: pulse-genie 1.5s ease-in-out infinite;
        z-index: 1000;
    `;
    placeholder.innerHTML = '✨ AI 正在为你重构语境...';
    return placeholder;
}

/**
 * 创建结果卡片
 */
function createResultCard(transformedContent) {
    const card = document.createElement('div');
    card.id = 'contextgenie-result';
    card.style.cssText = `
        background-color: #f0f9ff;
        border: 2px solid #3b82f6;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 20px;
        color: #1e293b;
        font-size: 14px;
        line-height: 1.6;
    `;

    // 添加标题和展开/折叠按钮
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        gap: 12px;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
        font-size: 16px;
        font-weight: 700;
        color: #3b82f6;
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
    `;
    title.innerHTML = '✨ AI 个性化语境';
    titleBar.appendChild(title);

    // 展开/折叠按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '▼ 展开';
    toggleBtn.style.cssText = `
        background-color: #e0f2fe;
        color: #3b82f6;
        border: 1px solid #3b82f6;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    `;
    toggleBtn.onmouseover = () => {
        toggleBtn.style.backgroundColor = '#0ea5e9';
        toggleBtn.style.color = '#ffffff';
        toggleBtn.style.borderColor = '#0ea5e9';
    };
    toggleBtn.onmouseout = () => {
        toggleBtn.style.backgroundColor = '#e0f2fe';
        toggleBtn.style.color = '#3b82f6';
        toggleBtn.style.borderColor = '#3b82f6';
    };

    titleBar.appendChild(toggleBtn);
    card.appendChild(titleBar);

    // 渲染 Markdown 内容（初始状态为折叠）
    const contentDiv = document.createElement('div');
    contentDiv.className = 'contextgenie-markdown';
    contentDiv.innerHTML = markdownToHtml(transformedContent);
    contentDiv.style.cssText = `
        word-break: break-word;
        overflow-wrap: break-word;
        max-height: 0px;
        overflow: hidden;
        transition: max-height 0.3s ease;
    `;
    card.appendChild(contentDiv);

    // 展开/折叠功能
    let isExpanded = false;
    toggleBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            contentDiv.style.maxHeight = '10000px';
            toggleBtn.innerHTML = '▲ 折叠';
            toggleBtn.style.color = '#ffffff';
        } else {
            contentDiv.style.maxHeight = '0px';
            toggleBtn.innerHTML = '▼ 展开';
            toggleBtn.style.color = '#3b82f6';
        }
    });

    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        font-size: 20px;
        color: #94a3b8;
        padding: 4px;
        transition: color 0.2s;
    `;
    closeBtn.innerHTML = '×';
    closeBtn.onmouseover = () => closeBtn.style.color = '#3b82f6';
    closeBtn.onmouseout = () => closeBtn.style.color = '#94a3b8';
    closeBtn.onclick = () => card.remove();
    titleBar.appendChild(closeBtn);

    return card;
}

/**
 * 简单的 Markdown 转 HTML
 * 支持标题、加粗、列表等基本格式
 */
function markdownToHtml(markdown) {
    let html = markdown;

    // 转义 HTML 特殊字符
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 一级标题
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size: 18px; font-weight: 700; margin: 20px 0 12px; color: #3b82f6;">$1</h1>');

    // 二级标题
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: 16px; font-weight: 700; margin: 16px 0 12px; color: #3b82f6;">$1</h2>');

    // 三级标题
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: 14px; font-weight: 600; margin: 12px 0 8px; color: #0ea5e9;">$1</h3>');

    // 加粗
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 700; color: #1e293b;">$1</strong>');

    // 斜体
    html = html.replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>');

    // 代码段（backtick）
    html = html.replace(/`(.+?)`/g, '<code style="background-color: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">$1</code>');

    // 处理列表项 - 支持 * 或 - 开头
    // 特殊处理 Example N: 格式，转换为序号格式（只显示数字）
    let exampleCount = 0;
    html = html.replace(/^\s*[-*] Example\s+\d+:\s*(.+)$/gm, (match, content) => {
        exampleCount++;
        return `<div class="contextgenie-list-item"><strong>${exampleCount}.</strong> ${content.trim()}</div>`;
    });
    
    // 处理带冒号的映射格式 (如 "变量名: 描述"，不是Example的)
    // 这个要在普通列表项之前处理
    html = html.replace(/^\s*[-*] ([^:]+):\s*(.+)$/gm, 
        '<div class="contextgenie-list-item"><span style="font-weight: 600; color: #0c4a6e;">$1</span><span style="margin: 0 2px; color: #3b82f6;">→</span><span>$2</span></div>');
    
    // 处理普通列表项
    html = html.replace(/^\s*[-*] (.+)$/gm, '<div class="contextgenie-list-item">$1</div>');

    // 换行符转 <br>
    html = html.replace(/\n\n/g, '</p><p style="margin: 12px 0;">');
    html = `<p style="margin: 12px 0;">${html}</p>`;

    // 清理多余的 <p> 标签
    html = html.replace(/<p style="[^"]*"><\/p>/g, '');

    return html;
}

/**
 * 在页面中注入结果
 */
async function injectResult(transformedContent) {
    try {
        const problemElement = document.querySelector('div[data-track-load="description_content"]') ||
                              document.querySelector('div[class*="description"]');

        if (!problemElement) {
            throw new Error('无法找到题目容器来注入结果');
        }

        // 移除加载占位符
        const loading = document.getElementById('contextgenie-loading');
        if (loading) loading.remove();

        // 创建并注入结果卡片
        const resultCard = createResultCard(transformedContent);
        problemElement.parentNode.insertBefore(resultCard, problemElement);

        // 添加样式表 (避免被外部样式覆盖)
        if (!document.getElementById('contextgenie-styles')) {
            const style = document.createElement('style');
            style.id = 'contextgenie-styles';
            style.textContent = `
                @keyframes pulse-genie {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 1; }
                }
                
                #contextgenie-result {
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15) !important;
                    backdrop-filter: blur(8px) !important;
                }
                
                #contextgenie-result:hover {
                    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.25) !important;
                }
                
                .contextgenie-markdown p {
                    margin: 8px 0 !important;
                }
                
                .contextgenie-markdown h2,
                .contextgenie-markdown h3 {
                    margin-top: 16px !important;
                    margin-bottom: 8px !important;
                }
                
                .contextgenie-list-item {
                    display: flex;
                    align-items: flex-start;
                    margin-left: 6px;
                    margin-bottom: 4px;
                    line-height: 1.5;
                    word-wrap: break-word;
                }
                
                .contextgenie-list-item::before {
                    content: '•';
                    color: #3b82f6;
                    font-weight: bold;
                    margin-right: 8px;
                    font-size: 14px;
                    flex-shrink: 0;
                }
            `;
            document.head.appendChild(style);
        }
    } catch (error) {
        console.error('Failed to inject result:', error);
        throw error;
    }
}

/**
 * 处理来自 popup.js 的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[ContextGenie] Received message:', request);
    
    if (request.action === 'ping') {
        // 快速响应心跳检查
        sendResponse({ success: true, ready: true });
    } else if (request.action === 'transform') {
        handleTransform(request.theme)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.error('Transform failed:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 保持消息通道打开以支持异步响应
    } else {
        sendResponse({ success: false, error: 'Unknown action' });
    }
});

messageListenerReady = true;
console.log('✨ ContextGenie message listener registered');

/**
 * 主转换流程
 */
async function handleTransform(theme) {
    try {
        // 清除之前的错误和结果卡片
        const oldError = document.getElementById('contextgenie-error');
        if (oldError) oldError.remove();
        const oldResult = document.getElementById('contextgenie-result');
        if (oldResult) oldResult.remove();
        
        // 1. 提取题目内容
        const problemContent = extractProblemContent();

        // 2. 显示加载状态
        const problemElement = document.querySelector('div[data-track-load="description_content"]') ||
                              document.querySelector('div[class*="description"]');

        if (!problemElement) {
            throw new Error('无法找到题目容器');
        }

        const loading = createLoadingPlaceholder();
        problemElement.parentNode.insertBefore(loading, problemElement);

        // 3. 调用后端 API
        const response = await fetch(`${BACKEND_URL}/transform`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: problemContent,
                theme: theme,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            
            // 处理特殊错误情况，显示友好提示
            if (response.status === 503) {
                throw new Error('AI 服务暂时繁忙，请稍后重试');
            } else if (response.status === 429) {
                throw new Error('请求过于频繁，请稍后再试');
            } else if (response.status === 500) {
                throw new Error('服务器错误，请稍后重试');
            }
            
            throw new Error(errorData.detail || `请求失败 (${response.status})`);
        }

        const data = await response.json();

        // 4. 注入结果
        await injectResult(data.transformed_content);

    } catch (error) {
        // 清理加载占位符
        const loading = document.getElementById('contextgenie-loading');
        if (loading) loading.remove();

        // 显示错误信息
        const errorCard = document.createElement('div');
        errorCard.id = 'contextgenie-error';
        errorCard.style.cssText = `
            background-color: #fee2e2;
            border: 2px solid #ef4444;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 20px;
            color: #991b1b;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
        `;
        
        // 错误信息内容
        const errorContent = document.createElement('div');
        errorContent.innerHTML = `
            <strong>❌ 转换失败</strong><br>
            ${error.message}
        `;
        errorCard.appendChild(errorContent);
        
        // 关闭按钮
        const closeErrorBtn = document.createElement('button');
        closeErrorBtn.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            font-size: 20px;
            color: #dc2626;
            padding: 0;
            min-width: 24px;
            transition: color 0.2s;
            flex-shrink: 0;
        `;
        closeErrorBtn.innerHTML = '×';
        closeErrorBtn.onmouseover = () => closeErrorBtn.style.color = '#991b1b';
        closeErrorBtn.onmouseout = () => closeErrorBtn.style.color = '#dc2626';
        closeErrorBtn.onclick = (e) => {
            e.preventDefault();
            errorCard.remove();
        };
        errorCard.appendChild(closeErrorBtn);

        const problemElement = document.querySelector('div[data-track-load="description_content"]') ||
                              document.querySelector('div[class*="description"]');
        if (problemElement) {
            problemElement.parentNode.insertBefore(errorCard, problemElement);
        }

        throw error;
    }
}

console.log('✨ ContextGenie content script loaded successfully');
