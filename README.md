# ContextGenie AI

## 📦 项目文件结构

本文件夹包含 ContextGenie AI 扩展的完整源代码：

```
01-交付作品/
├── manifest.json          # Chrome Extension V3 清单
├── popup.html             # 扩展弹窗页面
├── popup.js               # 弹窗逻辑（主题选择、转换触发）
├── background.js          # 后台 Service Worker
├── content.js             # 内容脚本（在 LeetCode 页面运行）
├── interests.json         # 用户兴趣数据（6 个主题）
├── main.py                # FastAPI 后端服务器
└── README.md              # 本文件
```

## 🚀 安装与运行

### 前置要求

- Python 3.12+
- Chrome 浏览器
- Gemini API Key（从 [Google AI Studio](https://aistudio.google.com) 获取）

### 步骤 1：安装后端依赖

```bash
# 进入项目目录
cd Context_Genie

# 创建并激活虚拟环境
python -m venv venv
# macOS/Linux:
source venv/bin/activate
# Windows:
.\venv\Scripts\activate

# 安装必要依赖
pip install fastapi uvicorn google-genai "pydantic>=2.0"
```

### 步骤 2：配置 API Key

```bash
# macOS/Linux
export GEMINI_API_KEY="your-api-key-here"

# Windows (PowerShell)
$env:GEMINI_API_KEY="your-api-key-here"

# Windows (CMD)
set GEMINI_API_KEY=your-api-key-here
```

### 步骤 3：启动后端

```bash
python main.py
```

后端将在 `http://127.0.0.1:8000` 启动。验证：访问 http://127.0.0.1:8000/health

### 步骤 4：加载 Chrome 插件

1. 打开 Chrome，进入 `chrome://extensions/`
2. 启用「开发者模式」（右上角）
3. 点击「加载已解压的扩展程序」
4. 选择 `01-交付作品` 文件夹
5. 插件安装完成 ✨

### 步骤 5：在 LeetCode 上使用

1. 访问任意 LeetCode 题目页面（如 https://leetcode.com/problems/two-sum/）
2. 点击浏览器右上角插件选项中的 ContextGenie 图标
3. 选择一个兴趣主题
4. 点击「✨ 开始改写」按钮
5. 等待 AI 完成改写
6. 改写的题目背景会显示在原题目上方的蓝色卡片中

## 📋 功能说明

### 支持的兴趣主题（interests.json）

| 主题     | 角色                     | 关键元素                                   |
| -------- | ------------------------ | ------------------------------------------ |
| **足球** | 内马尔和巴黎圣日耳曼粉丝 | 内马尔、大巴黎、法国、巴黎                 |
| **F1**   | 汉密尔顿粉丝             | 汉密尔顿、F1、赛车、梅赛德斯               |
| **文学** | 经典文学爱好者           | 荷马史诗、莎士比亚、菜根谭、经典文学       |
| **动画** | 动画迷                   | 马达加斯加的企鹅、变形金刚、小马宝莉、动画 |
| **音乐** | 多风格音乐爱好者         | Drake、德彪西、Chris Brown、音乐           |
| **城市** | 城市文化探索者           | 伦敦、巴黎、北京、苏州、洛杉矶             |

每个主题包含：

- **biography**: 用户对该主题的详细描述（2-3 句话）
- **keywords**: 关键元素数组（用于 Prompt 注入）

### 核心工作流

```
LeetCode 页面（题目显示）
    ↓ [点击扩展图标]
Popup（选择主题）
    ↓ [点击「开始改写」]
Content Script（提取题目 HTML）
    ↓ [POST /transform]
FastAPI Backend（调用 Gemini API）
    ↓ [使用用户兴趣信息改写]
Gemini 3.1 Flash Lite（4096 tokens 输出）
    ↓ [返回改写内容]
Content Script（搭建结果卡片）
    ↓ [注入蓝色卡片 + Markdown 渲染]
LeetCode 页面（显示个性化背景）
```

## 🎨 UI 特点

- **弹窗 UI**：紫色渐变背景，圆角设计，响应式布局
- **结果卡片**：蓝色卡片，展开/折叠功能（默认折叠）
- **Markdown 渲染**：
  - 标题、加粗、斜体、代码块
  - 列表项自动格式化
  - Example 编号自转换（Example 1 → 1.）
  - 变量映射显示（name → 描述）
- **错误处理**：用户友好的 429（配额超限）、503（服务繁忙）提示
- **交互高效**：最小化页面遮挡，可随时关闭卡片

## ⚙️ 后端 API

### GET /themes

获取所有可用主题。

```bash
curl http://127.0.0.1:8000/themes
```

Response:

```json
{
  "themes": ["足球", "F1", "文学", "动画", "音乐", "城市"]
}
```

### POST /transform

转换 LeetCode 题目。

```bash
curl -X POST http://127.0.0.1:8000/transform \
  -H "Content-Type: application/json" \
  -d '{
    "content": "<p>Given an array...</p>",
    "theme": "足球"
  }'
```

Response:

```json
{
  "original_content": "...",
  "transformed_content": "在一场足球比赛策略中...",
  "variable_mapping": {
    "theme": "足球",
    "keywords": ["内马尔", "大巴黎", ...],
    "biography": "用户是内马尔和巴黎圣日耳曼的粉丝..."
  },
  "theme_used": "足球"
}
```

### GET /health

健康检查。

```bash
curl http://127.0.0.1:8000/health
```

## 🔧 配置与定制

### 修改兴趣主题

编辑 `interests.json`：

```json
{
  "我的主题": {
    "biography": "我对该主题的描述...",
    "keywords": ["关键词1", "关键词2", "关键词3"]
  }
}
```

**关键提示**：

- biography 应为 2-3 句话，具体描述用户对该主题的兴趣
- keywords 数组有 3-5 个关键词，用于 Prompt 中的上下文注入
- 修改后重启后端，扩展会自动刷新主题列表

### 调整 Prompt 策略

编辑 `main.py` 中的 `system_prompt`：

```python
system_prompt = f"""你是LeetCode大师。将题目转换为{theme}背景...
【用户兴趣背景】
- 主题: {theme}
- 用户信息: {biography}
- 关键元素: {keywords_str}
...
"""
```

重要参数：

- `temperature=0.50`：平衡创意与准确性
- `max_output_tokens=4096`：最大输出长度（防止冗长）
- **核心约束**：禁止生成 Constraints、Follow-up、代码，确保质量

### 修改模型

`main.py` 第 153 行：

```python
response = client.models.generate_content(
    model="gemini-3.1-flash-lite-preview",  # 可改为其他模型
    ...
)
```

可用模型可在 https://aistudio.google.com/rate-limit?timeRange=last-28-days 页面查询

## 🐛 故障排除

| 问题                          | 解决方案                                                                 |
| ----------------------------- | ------------------------------------------------------------------------ |
| "无法连接后端"                | 确保 `python main.py` 已启动，且 GEMINI_API_KEY 已设置                   |
| "内容脚本未加载"              | 刷新 LeetCode 页面（F5），扩展会自动注入                                 |
| "转换失败 - 无法找到题目内容" | 确认在 LeetCode **题目详情页**（不是列表页）；如页面更新，可能选择器失效 |
| "AI 服务暂时繁忙 (503)"       | Gemini API 服务异常，请稍后重试                                          |
| "配额已用尽 (429)"            | 超过今日 500 请求限制，明天再试或升级 API Key                            |
| 扩展图标灰色                  | 当前页面非 LeetCode 题目页。进入题目详情页后图标会亮蓝色 ✨              |

## 📝 开发说明

### 文件职责

| 文件           | 职责                                   | 作者       | 修改日期 |
| -------------- | -------------------------------------- | ---------- | -------- |
| manifest.json  | 扩展配置、权限声明                     | -          | 2025-01  |
| popup.html/js  | 弹窗 UI、主题选择                      | -          | 2025-01  |
| content.js     | DOM 提取、结果注入、错误处理           | -          | 2025-01  |
| background.js  | 标签页监听、图标更新                   | -          | 2025-01  |
| main.py        | FastAPI 服务、Gemini 集成、Prompt 工程 | -          | 2025-01  |
| interests.json | 用户兴趣库                             | 用户自定义 | 动态     |

## 🤝 反馈与支持

如有问题或建议，欢迎反馈。

---

**Happy Learning! 祝你 LeetCode 刷题愉快！** ✨
