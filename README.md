# Refer2Result — AI 风格迁移工具

基于 Gemini 图像模型的风格迁移应用。上传目标图和参考图，AI 会将参考图的艺术风格迁移到目标图上，同时严格保留目标图中角色的原始外貌。

## 项目结构

```
refer2result/
├── backend/            # FastAPI 后端
│   ├── main.py         # API 服务（模型调用、风格迁移）
│   └── requirements.txt
├── frontend/           # React + Vite 前端
│   └── src/
│       ├── App.jsx
│       └── components/
│           └── ImageUploader.jsx
├── .env                # 环境变量（BASE_URL）
└── goals.txt           # 项目需求文档
```

## 技术栈

- 前端：React 19 + Vite 8
- 后端：Python + FastAPI + LangChain
- 模型：gemini-3-pro-image / gemini-3.1-flash-image-preview（通过 OpenAI 兼容接口调用）

## 快速开始

### 1. 环境变量

项目根目录 `.env` 文件：

```env
BASE_URL=https://your-api-endpoint/v1
```

### 2. 后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

后端默认运行在 `http://localhost:8000`。

### 3. 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`。

## API 接口

### GET `/api/models`

返回可用模型列表。

### POST `/api/transfer`

执行风格迁移。

请求体：

```json
{
  "target_image": "base64 或 data URL",
  "refer_image": "base64 或 data URL",
  "model": "gemini-3-pro-image",
  "api_key": "your-api-key"
}
```

## 已知问题修复

### 依赖冲突（已修复）

`langchain-openai==0.3.0` 内部依赖 `langchain-core>=0.3.15`，与之前手动指定的 `langchain-core==0.3.0` 冲突。

修复方式：将 `langchain-core` 的版本约束改为 `>=0.3.15,<0.4.0`，允许 pip 自动解析兼容版本。
