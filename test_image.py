import base64
import os
from io import BytesIO
from PIL import Image

# LangChain Google GenAI 模块
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_core.messages import HumanMessage, AIMessage

# ============================================
# 配置部分
# ============================================

# 设置 API Key（建议使用环境变量）
os.environ["GOOGLE_API_KEY"] = "your-google-api-key-here"

# 模型名称：gemini-2.0-flash-image-preview
MODEL_NAME = "gemini-2.0-flash-preview-05-20"

# ============================================
# 图像处理辅助函数
# ============================================

def encode_image_to_base64(image_path: str) -> str:
    """将图像文件转为 base64 字符串"""
    with open(image_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
    return encoded_string

def load_image_from_path(image_path: str) -> Image.Image:
    """加载图像文件"""
    return Image.open(image_path)

def save_base64_to_image(base64_string: str, output_path: str):
    """将 base64 字符串保存为图像文件"""
    image_data = base64.b64decode(base64_string)
    image = Image.open(BytesIO(image_data))
    image.save(output_path)
    print(f"✅ 图像已保存到: {output_path}")

def encode_image_to_data_url(image_path: str) -> str:
    """将图像转为 data URL 格式（LangChain 推荐格式）"""
    ext = os.path.splitext(image_path)[1].lower()
    mime_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", 
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif"
    }.get(ext, "image/jpeg")
    
    with open(image_path, "rb") as f:
        base64_data = base64.b64encode(f.read()).decode("utf-8")
    
    return f"data:{mime_type};base64,{base64_data}"

# ============================================
# 初始化模型
# ============================================

llm = ChatGoogleGenerativeAI(
    model=MODEL_NAME,
    google_api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
    max_tokens=2048,
    convert_system_message_to_human=True,  # 重要：允许图像输入
)

# ============================================
# 示例 1：单图编辑
# ============================================

def edit_single_image():
    """单图编辑示例"""
    print("\n" + "="*50)
    print("📷 示例 1：单图图像编辑")
    print("="*50)
    
    # 图像路径
    image_path = "input_image.jpg"  # 替换为你的图像路径
    
    # 构造多模态消息
    messages = [
        HumanMessage(
            content=[
                {
                    "type": "image_url",
                    "image_url": {
                        "url": encode_image_to_data_url(image_path)
                    }
                },
                {
                    "type": "text",
                    "text": "请将图片中的天空换成日落效果，让色调更温暖"
                }
            ]
        )
    ]
    
    # 调用模型
    response = llm.invoke(messages)
    
    # 处理响应
    print(f"📝 响应内容: {response.content}")
    
    # 如果返回的是图像（某些模式下会返回）
    if hasattr(response, "additional_kwargs"):
        if "image" in response.additional_kwargs:
            image_data = response.additional_kwargs["image"]
            save_base64_to_image(image_data, "output_edited.jpg")

# ============================================
# 示例 2：多图编辑与比较
# ============================================

def edit_multiple_images():
    """多图编辑示例 - 参考风格应用到目标图像"""
    print("\n" + "="*50)
    print("🖼️ 示例 2：多图编辑（风格迁移）")
    print("="*50)
    
    # 风格参考图
    style_image_path = "style_reference.jpg"  # 替换为风格参考图
    # 目标编辑图
    target_image_path = "target_image.jpg"    # 替换为要编辑的图
    
    messages = [
        HumanMessage(
            content=[
                # 第一张图：风格参考
                {
                    "type": "image_url",
                    "image_url": {
                        "url": encode_image_to_data_url(style_image_path)
                    }
                },
                # 第二张图：目标图
                {
                    "type": "image_url", 
                    "image_url": {
                        "url": encode_image_to_data_url(target_image_path)
                    }
                },
                {
                    "type": "text",
                    "text": "请将第二张图片应用第一张图片的油画风格，保持第二张图片的主体内容不变"
                }
            ]
        )
    ]
    
    response = llm.invoke(messages)
    print(f"📝 响应: {response.content}")

# ============================================
# 示例 3：多图场景识别与批量处理
# ============================================

def analyze_multiple_images():
    """多图场景识别示例"""
    print("\n" + "="*50)
    print("🔍 示例 3：多图场景识别")
    print("="*50)
    
    image_paths = [
        "image1.jpg",
        "image2.jpg", 
        "image3.jpg"
    ]  # 替换为你的图像路径
    
    # 构建多图消息
    content = []
    
    for img_path in image_paths:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": encode_image_to_data_url(img_path)
            }
        })
    
    content.append({
        "type": "text",
        "text": "请描述这三张图片的内容，并说明它们之间的关联"
    })
    
    messages = [HumanMessage(content=content)]
    
    response = llm.invoke(messages)
    print(f"📝 场景分析结果:\n{response.content}")

# ============================================
# 示例 4：图像编辑 + 详细指令
# ============================================

def edit_with_detailed_instructions():
    """详细指令的图像编辑"""
    print("\n" + "="*50)
    print("✏️ 示例 4：详细指令图像编辑")
    print("="*50)
    
    image_path = "portrait.jpg"  # 人像照片
    
    messages = [
        HumanMessage(
            content=[
                {
                    "type": "image_url",
                    "image_url": {
                        "url": encode_image_to_data_url(image_path)
                    }
                },
                {
                    "type": "text",
                    "text": """请对这张照片进行以下编辑：
1. 将背景调整为模糊效果（景深效果）
2. 增加整体亮度
3. 色调偏冷色调
4. 保持人物清晰
5. 不要改变人物的面部特征"""
                }
            ]
        )
    ]
    
    response = llm.invoke(messages)
    print(f"📝 响应: {response.content}")

# ============================================
# 运行示例
# ============================================

if __name__ == "__main__":
    # 运行各个示例（请先准备对应的图像文件）
    # edit_single_image()
    # edit_multiple_images()
    # analyze_multiple_images()
    # edit_with_detailed_instructions()
    
    print("⚠️ 请先准备图像文件，然后取消注释相应的函数调用")
    print("📌 需要的依赖包已在上方列出")