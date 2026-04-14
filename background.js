/**
 * ContextGenie Background Service Worker
 * Chrome Extension V3 要求的后台脚本
 */

// 监听扩展安装或更新事件
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('✨ ContextGenie AI 已安装');
        // 可选：打开欢迎页面
        // chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
    } else if (details.reason === 'update') {
        console.log('✨ ContextGenie AI 已更新');
    }
});

// 监听标签页更新事件，更新扩展图标状态
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('leetcode.com')) {
        // 可选：在 LeetCode 页面显示活跃状态
        chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
        chrome.action.setBadgeText({ text: '✨', tabId });
    } else {
        // 在非 LeetCode 页面移除标记
        chrome.action.setBadgeText({ text: '', tabId });
    }
});

console.log('✨ ContextGenie background service worker initialized');
