from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gemini-2.5-flash",
    base_url="https://www.ggwk1.online/v1",  # 中转 API 的端点
    api_key="sk-WmNgdudXOtNekmfHorsS2CjBizDFIGo9615WCoH4z4xhtyIG",                  # 你的 API 密钥
    timeout=30,
    max_retries=3
)

# 调用模型
response = llm.invoke("简要高效地描述图像中的人物外貌特征")
print(response.content)