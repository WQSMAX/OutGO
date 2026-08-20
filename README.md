# 电商客服 Agent（零框架入门版）

一个用 **手写核心循环 + DeepSeek API** 搭的最小电商客服 Agent，没有用任何 Agent 框架，
整个"大脑"只有 `agent.py` 里的一个循环。

## 它能干什么

- `get_order`：查订单状态
- `search_policy`：查退换货/退款/运费等售后政策
- `create_ticket`：建人工客服工单（写入 `tickets.txt`）

数据都是写死的假数据（`tools.py` 里），先跑通流程，以后再换成真实数据库。

## 快速开始（5 步）

### 1. 安装依赖

> 提示：当前工作区已经建好虚拟环境 `.venv` 并装好了依赖，**跳过这一步**，直接从第 2 步开始。
> 只有换电脑或目录整体移动后，才需要重新执行下面的命令。

```powershell
cd ecommerce-support-agent
python -m venv .venv
.venv\Scripts\Activate.ps1     # PowerShell；CMD 用 .venv\Scripts\activate.bat
pip install -r requirements.txt
```

激活失败的备选：如果 `Activate.ps1` 报"禁止运行脚本"，不用激活，
直接把后面命令里的 `python` 都换成 `.venv\Scripts\python`，效果一样。

### 2. 拿到 API Key

去 [DeepSeek 开放平台](https://platform.deepseek.com) 注册，创建一个 API Key（新用户有免费额度）。
打开项目里的 `.env` 文件，把 key 粘贴到等号后面：

```
DEEPSEEK_API_KEY=sk-你的key
```

key 放在 `.env` 里而不是代码里：`.env` 已被 `.gitignore` 排除，代码分享/提交 git 时不会泄露密钥。

### 3. 先跑离线测试（不需要 key，确认环境没问题）

```powershell
python test_tools.py
```

5 个 PASS 就说明环境 OK。

### 4. 跑评测集

```powershell
python eval.py
```

5 条用例会逐一跑过，最后输出通过率。第一次跑，通过率大概在 4/5 左右，
失败的那条正是你要动手优化的地方。

### 5. 和它聊天

```powershell
python chat.py
```

试试：
- `查订单 SO20250101001`
- `我不想要了能退吗`
- `快递弄丢了帮我开个工单`
- `明天杭州天气怎么样`（看它会不会瞎编）
- 输入 `/v` 看它每一轮调了什么工具

## 项目结构

```
.env             ← 你的 API key 放这里（已被 .gitignore 排除，不会泄露）
.env.example     ← .env 的模板，不小心删了 .env 就从它复制
config.py        ← 读取 .env 的配置入口（一般不用改）
tools.py         ← 三个工具函数 + 假数据
agent.py         ← 核心循环（整个 Agent 的本质，重点读）
eval.py          ← 评测集，每次改动后跑一遍
chat.py          ← 交互式聊天入口
test_tools.py    ← 离线测试（不调大模型、不花钱）
tickets.txt      ← 运行时自动生成，工单记录
```

## 建议的动手顺序（照着上一轮"具体步骤"走）

1. 跑通 `chat.py`，感受"它能自己决定调哪个工具"；
2. 打开 `agent.py` 的 `TOOL_SCHEMAS`，试着改某个工具的 `description`，跑 `python eval.py` 看通过率变化；
3. 在 `tools.py` 里加一个你自己的工具（比如 `check_refund_progress`），然后在 `agent.py` 的
   `TOOL_SCHEMAS` 和 `TOOL_FUNCTIONS` 里各登记一行，再在 `eval.py` 加一条用例；
4. 把 `tools.py` 里的假数据换成真实数据源（数据库查询 / 接口调用），其他文件不用动。

## 常见报错

| 报错 | 原因 | 解法 |
|---|---|---|
| `ModuleNotFoundError: No module named 'openai'` | 没装依赖 | `pip install -r requirements.txt` |
| `[配置错误] 没找到 API Key` | `.env` 不存在或 key 为空 | 打开 `.env`，在 `DEEPSEEK_API_KEY=` 后粘贴 key |
| `401 Authentication Fails` | API key 填错或额度用完 | 检查 `.env`，key 要以 `sk-` 开头、前后无空格 |
| pip 下载报 `403` / 超时 | 镜像源被限制或不稳定 | 换官方源重试：`pip install -i https://pypi.org/simple -r requirements.txt` |
| `Connection error` / 超时 | 网络不通或 base_url 写错 | 检查 `.env` 里的 `DEEPSEEK_BASE_URL` |
| `[exit code: ...]` 编码乱码 | 控制台编码问题 | 在 PowerShell 执行 `chcp 65001` 后再跑 |
