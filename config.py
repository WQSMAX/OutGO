"""配置文件：API key 放在 .env 文件里，不要把 key 写进代码。

第一步：打开项目里的 .env 文件（记事本即可）
第二步：把你的 DeepSeek API Key 粘贴到 DEEPSEEK_API_KEY= 等号后面，保存
第三步：去跑 python test_tools.py 和 python eval.py

为什么放 .env 而不是写进代码：
1. 代码可以分享、提交 git，而 .env 已被 .gitignore 排除，key 不会泄露；
2. 换 key、换模型只需要改 .env，一行代码都不用碰。
"""

import os
from pathlib import Path


def load_env(path=".env"):
    """极简 .env 解析器：读取 `KEY=VALUE` 行，加载到环境变量。

    规则：跳过空行和 # 注释行；不覆盖已经存在的环境变量。
    """
    env_file = Path(__file__).parent / path
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


load_env()

# 读取配置。优先级：系统环境变量 > .env 文件 > 这里的默认值
API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

# Agent 最多"思考 + 调工具"几轮，防止死循环
MAX_STEPS = int(os.environ.get("MAX_STEPS", "5"))

if not API_KEY:
    raise SystemExit(
        "\n[配置错误] 没找到 API Key。\n"
        "1. 打开项目里的 .env 文件\n"
        "2. 填成: DEEPSEEK_API_KEY=sk-你注册到的key（等号后不要留空格）\n"
        "3. 保存后重新运行。注册地址: https://platform.deepseek.com\n"
    )
