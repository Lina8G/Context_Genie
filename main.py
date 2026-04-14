import json
import os
import random
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from google.genai.errors import ServerError, ClientError
from pydantic import BaseModel

# Initialize FastAPI app
app = FastAPI(title="ContextGenie AI Backend")

# Add CORS middleware to allow Chrome Extension access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load interests.json
INTERESTS_FILE = Path(__file__).parent / "interests.json"


def load_interests() -> dict:
    """Load interests from interests.json file."""
    if not INTERESTS_FILE.exists():
        raise FileNotFoundError(f"interests.json not found at {INTERESTS_FILE}")
    with open(INTERESTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# Initialize Gemini API
def init_gemini() -> genai.Client:
    """Initialize Gemini API client with API key from environment."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    return genai.Client(api_key=api_key)


# Request/Response Models
class TransformRequest(BaseModel):
    """Request model for /transform endpoint."""
    content: str  # HTML content of LeetCode problem
    theme: Optional[str] = None  # Optional theme choice


class TransformResponse(BaseModel):
    """Response model for /transform endpoint."""
    original_content: str
    transformed_content: str
    variable_mapping: dict
    theme_used: str


class ThemesResponse(BaseModel):
    """Response model for /themes endpoint."""
    themes: list[str]


# Endpoints
@app.get("/themes", response_model=ThemesResponse)
async def get_themes():
    """
    GET /themes - Retrieve all available themes/interests.
    Returns the keys from interests.json.
    """
    try:
        interests = load_interests()
        themes = list(interests.keys())
        return ThemesResponse(themes=themes)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transform", response_model=TransformResponse)
async def transform(request: TransformRequest):
    """
    POST /transform - Transform LeetCode problem based on user interests.
    
    Logic:
    1. Load interests.json
    2. Select theme (user-provided or random)
    3. Retrieve biography and keywords for the theme
    4. Build system prompt with user preferences
    5. Call Gemini API to transform the problem
    6. Return transformed content with variable mapping
    """
    try:
        client = init_gemini()
        interests = load_interests()
        
        # Select theme (user choice or random)
        if request.theme and request.theme in interests:
            theme = request.theme
        elif request.theme:
            raise HTTPException(
                status_code=400,
                detail=f"Theme '{request.theme}' not found. Available themes: {list(interests.keys())}"
            )
        else:
            theme = random.choice(list(interests.keys()))
        
        # Get interest data for the selected theme
        interest_data = interests[theme]
        biography = interest_data["biography"]
        keywords = interest_data["keywords"]
        keywords_str = ", ".join(keywords)
        
        # Build system prompt with user preferences
        system_prompt = f"""你是LeetCode大师。将题目转换为{theme}背景的个性化版本，保留所有原始变量名。

【用户兴趣背景】
- 主题: {theme}
- 用户信息: {biography}
- 关键元素: {keywords_str}

【核心任务】
用{theme}的故事背景重写题目，融入上述用户的具体兴趣信息，但保留原始变量名不变。

【输出格式】（必须按此格式）

2-3句话，融入{theme}的有趣背景和用户的具体兴趣，保留原题中的变量名。
示例：原题是Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
改编示例：在一场足球比赛策略中，教练需要从球员能力值列表nums中找出两个不同球员，他们的能力值之和恰好等于预设的理想组合值target。每个球员只能被选一次，你需要返回这两个球员在列表中的索引。

## Examples解释
- Example 1: [简洁说明，MAX 30字]
- Example 2: [简洁说明，MAX 30字]
- Example 3: [简洁说明，MAX 30字]

## 变量映射
- nums: [含义，MAX 10字]
- target: [含义，MAX 10字]

【核心约束】
✅ 必须保留变量名：nums、target等原始名称
✅ 问题描述要有灵气，充分融入用户兴趣信息
✅ Examples解释必须是列表格式，每项MAX 30字
✅ 变量映射必须是列表格式，值MAX 10字  
✅ 禁止：Constraints、Follow-up、代码段、额外内容
"""
        
        # Call Gemini API using the latest google.genai SDK
        client = init_gemini()
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=request.content,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.50,
                max_output_tokens=4096,
            ),
        )
        
        if not response.text:
            raise ValueError("Gemini returned empty response. Check if content was filtered or API quota exceeded.")
        
        transformed_content = response.text
        
        # Log for debugging
        print(f"[DEBUG] Transformed content length: {len(transformed_content)} characters")
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason'):
                print(f"[DEBUG] Finish reason: {candidate.finish_reason}")
        
        # Parse variable mapping from response (simplified extraction)
        variable_mapping = {
            "theme": theme,
            "keywords": keywords,
            "biography": biography
        }
        
        return TransformResponse(
            original_content=request.content,
            transformed_content=transformed_content,
            variable_mapping=variable_mapping,
            theme_used=theme
        )
    
    except ValueError as e:
        print(f"[ERROR] ValueError in transform: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except ClientError as e:
        # Handle Gemini API client errors (429, etc.)
        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
            print(f"[ERROR] Gemini quota exceeded (429): {str(e)}")
            raise HTTPException(status_code=429, detail="免费配额已用尽，请升级API Key或明天再试")
        else:
            print(f"[ERROR] Gemini client error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"请求出错: {str(e)}")
    except ServerError as e:
        # Handle Gemini API server errors (503, etc.)
        if "503" in str(e):
            print(f"[ERROR] Gemini service unavailable (503): {str(e)}")
            raise HTTPException(status_code=503, detail="AI 服务暂时繁忙，请稍后重试")
        else:
            print(f"[ERROR] Gemini API error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"AI服务出错: {str(e)}")
    except Exception as e:
        print(f"[ERROR] Unexpected error in transform: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error during transformation: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
