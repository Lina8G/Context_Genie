/**
 * ContextGenie Popup Script
 * 负责弹窗 UI 初始化和主题选择
 */

const BACKEND_URL = 'http://127.0.0.1:8000';

// DOM Elements
const themeSelect = document.getElementById('themeSelect');
const transformBtn = document.getElementById('transformBtn');
const statusDiv = document.getElementById('status');

/**
 * 从后端获取主题列表
 */
async function loadThemes() {
    try {
        statusDiv.textContent = '';
        const response = await fetch(`${BACKEND_URL}/themes`);

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const data = await response.json();
        const themes = data.themes || [];

        // 清空现有选项
        themeSelect.innerHTML = '';

        if (themes.length === 0) {
            themeSelect.innerHTML = '<option value="">无可用主题</option>';
            transformBtn.disabled = true;
            statusDiv.textContent = '❌ 后端无主题数据';
            statusDiv.className = 'status error';
            return;
        }

        // 添加选项
        themes.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme;
            option.textContent = theme;
            themeSelect.appendChild(option);
        });

        // 随机选择一个主题
        const randomTheme = themes[Math.floor(Math.random() * themes.length)];
        themeSelect.value = randomTheme;
        transformBtn.disabled = false;
        statusDiv.textContent = `✓ 已加载 ${themes.length} 个主题`;
        statusDiv.className = 'status success';
    } catch (error) {
        console.error('Failed to load themes:', error);
        themeSelect.innerHTML = '<option value="">连接失败</option>';
        transformBtn.disabled = true;
        statusDiv.textContent = `❌ 无法连接后端: ${error.message}`;
        statusDiv.className = 'status error';
    }
}

/**
 * 处理转换按钮点击事件
 */
async function handleTransform() {
    const selectedTheme = themeSelect.value;

    if (!selectedTheme) {
        statusDiv.textContent = '❌ 请先选择主题';
        statusDiv.className = 'status error';
        return;
    }

    // 禁用按钮并显示加载状态
    transformBtn.disabled = true;
    statusDiv.textContent = '⏳ 正在检查 LeetCode 页面...';
    statusDiv.className = 'status loading';

    try {
        // 获取当前活跃标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            throw new Error('未找到活跃标签页');
        }

        // 检查是否在 LeetCode 页面
        if (!tab.url.includes('leetcode.com')) {
            statusDiv.textContent = '❌ 请在 LeetCode 题目页面使用';
            statusDiv.className = 'status error';
            transformBtn.disabled = false;
            return;
        }

        // 先 ping content.js，检查是否已加载
        statusDiv.textContent = '⏳ 检查内容脚本...';
        
        const pingResponse = await pingContentScript(tab.id);
        
        if (!pingResponse) {
            statusDiv.textContent = '⚠️ 内容脚本未加载，请刷新页面后重试';
            statusDiv.className = 'status error';
            transformBtn.disabled = false;
            return;
        }

        // 发送转换请求
        statusDiv.textContent = '⏳ 正在向当前页面发送转换请求...';
        
        sendTransformMessage(tab.id, selectedTheme)
            .then((response) => {
                if (response.success) {
                    statusDiv.textContent = '✓ 转换成功！查看 LeetCode 页面';
                    statusDiv.className = 'status success';
                } else {
                    const errorMsg = response?.error || '未知错误';
                    statusDiv.textContent = `❌ ${errorMsg}`;
                    statusDiv.className = 'status error';
                }
                transformBtn.disabled = false;
            })
            .catch((error) => {
                console.error('Transform error:', error);
                statusDiv.textContent = `❌ ${error.message}`;
                statusDiv.className = 'status error';
                transformBtn.disabled = false;
            });

    } catch (error) {
        console.error('Transform error:', error);
        statusDiv.textContent = `❌ ${error.message}`;
        statusDiv.className = 'status error';
        transformBtn.disabled = false;
    }
}

/**
 * Ping content.js 以检查是否已加载
 */
function pingContentScript(tabId) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('Ping timeout for tab', tabId);
            resolve(false);
        }, 2000);

        chrome.tabs.sendMessage(
            tabId,
            { action: 'ping' },
            (response) => {
                clearTimeout(timeout);
                
                if (chrome.runtime.lastError) {
                    console.error('Ping error:', chrome.runtime.lastError);
                    resolve(false);
                } else if (response && response.ready) {
                    console.log('Content script is ready');
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        );
    });
}

/**
 * 发送转换消息到 content.js
 */
function sendTransformMessage(tabId, theme) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('转换请求超时，请检查后端是否运行'));
        }, 60000); // 60 秒超时

        chrome.tabs.sendMessage(
            tabId,
            { action: 'transform', theme: theme },
            (response) => {
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    console.error('Message error:', chrome.runtime.lastError);
                    reject(new Error('内容脚本通信失败，请刷新页面'));
                } else if (response) {
                    resolve(response);
                } else {
                    reject(new Error('未收到来自内容脚本的响应'));
                }
            }
        );
    });
}

/**
 * 初始化事件监听
 */
function initEventListeners() {
    transformBtn.addEventListener('click', handleTransform);

    // 主题下拉框变化时清空状态
    themeSelect.addEventListener('change', () => {
        if (statusDiv.className === 'status success') {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }
    });
}

/**
 * 页面加载时初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadThemes();
});
