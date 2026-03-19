import os
import base64
import re
import logging

from dotenv import load_dotenv
from pydantic import SecretStr
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ========== 日志配置（仅控制台） ==========
logger = logging.getLogger("refer2result")
logger.setLevel(logging.DEBUG)

_console = logging.StreamHandler()
_console.setLevel(logging.INFO)
_console.setFormatter(
    logging.Formatter("[%(asctime)s] %(levelname)s  %(message)s", datefmt="%H:%M:%S")
)
logger.addHandler(_console)

app = FastAPI(title="Refer2Result Style Transfer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AVAILABLE_MODELS = [
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
]

# 可用于识别的文本模型列表
AVAILABLE_RECOGNIZE_MODELS = [
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash",
]

# 第一步：识别目标图人物外貌的提示词
RECOGNIZE_PROMPT = "简要高效地描述图像中的人物外貌特征"

# 第二步：风格迁移提示词模板（goals.txt 原文，"target_image" 会被第一步的识别结果替换）
STYLE_TRANSFER_PROMPT_TEMPLATE = """目标图："{target_image}"
请基于参考图的风格对目标图进行重绘，使两者在以下三个维度保持一致：
艺术风格与流派 — 包括画风、色彩倾向、笔触质感、渲染方式等
构图与视觉引导 — 包括画面布局、视觉重心、景深层次、留白比例等
线条艺术 — 包括线条粗细、勾勒方式、描边风格、线条疏密等
约束条件（最高优先级）：
严格保留目标图中角色的原始外貌，不做任何修改
不引入参考图中任何角色的外貌特征
仅迁移风格，不迁移内容
简而言之：只改"怎么画"，不改"画的是谁"。
输出要求：图像比例 {aspect_ratio}，分辨率 {quality}。"""

ASPECT_RATIOS = [
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
]
QUALITY_LEVELS = ["512px", "1K", "2K", "4K"]


class TransferRequest(BaseModel):
    target_image: str  # base64 or data URL
    refer_image: str  # base64 or data URL
    model: str = AVAILABLE_MODELS[0]
    api_key: str = ""
    recognize_model: str = AVAILABLE_RECOGNIZE_MODELS[0]
    recognize_api_key: str = ""
    aspect_ratio: str = "1:1"
    quality: str = "1K"


def ensure_data_url(image_data: str, default_mime: str = "image/png") -> str:
    """Ensure image data is in data URL format."""
    if image_data.startswith("data:"):
        return image_data
    return f"data:{default_mime};base64,{image_data}"


def extract_image_from_response(response) -> str | None:
    """Extract base64 image data from LangChain response."""
    if isinstance(response.content, list):
        for block in response.content:
            if isinstance(block, dict):
                if block.get("type") == "image_url":
                    url = block.get("image_url", {}).get("url", "")
                    if url.startswith("data:"):
                        return url
                    return url
                if block.get("type") == "image" and block.get("data"):
                    mime = block.get("mime_type", "image/png")
                    return f"data:{mime};base64,{block['data']}"

    if hasattr(response, "additional_kwargs"):
        kwargs = response.additional_kwargs
        if "image" in kwargs:
            return f"data:image/png;base64,{kwargs['image']}"

    if isinstance(response.content, str):
        b64_pattern = r"data:image/[^;]+;base64,[A-Za-z0-9+/=]+"
        match = re.search(b64_pattern, response.content)
        if match:
            return match.group(0)

        try:
            if len(response.content) > 100:
                base64.b64decode(response.content[:100])
                return f"data:image/png;base64,{response.content}"
        except Exception:
            pass

    return None


@app.get("/api/models")
async def get_models():
    """Return available models."""
    return {
        "models": AVAILABLE_MODELS,
        "recognize_models": AVAILABLE_RECOGNIZE_MODELS,
        "aspect_ratios": ASPECT_RATIOS,
        "quality_levels": QUALITY_LEVELS,
    }


@app.post("/api/transfer")
async def style_transfer(req: TransferRequest):
    """Perform style transfer: recognize target → build prompt → generate."""
    if not req.api_key:
        raise HTTPException(status_code=400, detail="API key is required")
    if not req.recognize_api_key:
        raise HTTPException(status_code=400, detail="识别模型 API key is required")
    if req.model not in AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail="无效的绘图模型")
    if req.recognize_model not in AVAILABLE_RECOGNIZE_MODELS:
        raise HTTPException(status_code=400, detail="无效的识别模型")

    base_url = os.getenv("BASE_URL", "")
    if not base_url:
        raise HTTPException(status_code=500, detail="BASE_URL not configured in .env")

    try:
        target_url = ensure_data_url(req.target_image)
        refer_url = ensure_data_url(req.refer_image)

        # ========== 第一步：用文本模型识别目标图人物外貌 ==========
        recognize_llm = ChatOpenAI(
            model=req.recognize_model,
            base_url=base_url,
            api_key=SecretStr(req.recognize_api_key),
            timeout=60,
            max_retries=2,
        )

        recognize_messages = [
            HumanMessage(
                content=[
                    {
                        "type": "image_url",
                        "image_url": {"url": target_url},
                    },
                    {
                        "type": "text",
                        "text": RECOGNIZE_PROMPT,
                    },
                ]
            )
        ]

        recognize_response = recognize_llm.invoke(recognize_messages)
        target_description = recognize_response.content
        if isinstance(target_description, list):
            # 如果返回的是结构化内容，提取文本部分
            target_description = " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in target_description
            )

        logger.info("第一步完成 — 目标图识别结果:\n%s", target_description)

        # ========== 第二步：构建提示词并发起风格迁移 ==========
        style_prompt = STYLE_TRANSFER_PROMPT_TEMPLATE.format(
            target_image=target_description,
            aspect_ratio=req.aspect_ratio,
            quality=req.quality,
        )

        logger.info("第二步 — 拼接后的完整提示词:\n%s", style_prompt)

        image_llm = ChatOpenAI(
            model=req.model,
            base_url=base_url,
            api_key=SecretStr(req.api_key),
            timeout=120,
            max_retries=2,
        )

        transfer_messages = [
            HumanMessage(
                content=[
                    {
                        "type": "image_url",
                        "image_url": {"url": target_url},
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": refer_url},
                    },
                    {
                        "type": "text",
                        "text": style_prompt,
                    },
                ]
            )
        ]

        response = image_llm.invoke(transfer_messages)
        result_image = extract_image_from_response(response)

        logger.info(
            "风格迁移完成 — 模型: %s | 返回图像: %s | 返回文本长度: %d",
            req.model,
            "有" if result_image else "无",
            len(response.content) if isinstance(response.content, str) else 0,
        )

        return {
            "success": True,
            "image": result_image,
            "text": response.content if isinstance(response.content, str) else None,
            "target_description": target_description,
        }

    except Exception as e:
        logger.error("风格迁移失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
