import json

from config import API_KEY, BASE_URL, MODEL, MAX_STEPS
from openai import OpenAI
from tools import TOOL_FUNCTIONS

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

SYSTEM_PROMPT = """你是"小买"电商平台的客服助手，负责售前售后咨询。
你有三个工具：get_order（查订单）、search_policy（查售后政策）、create_ticket（建人工工单）。
规则：
- 回答简洁，用中文，绝不编造数据；
- 查不到就说查不到，并建议创建工单转人工；
- 用户问"能退吗/怎么退款/运费谁出"等政策问题时，直接调用 search_policy——政策是通用规则，不需要订单号；
- 用户明确要求"开工单/转人工/投诉"时，立即调用 create_ticket，不要先去查政策；
- 一次只调用一个工具，拿到结果后再决定下一步。"""

# 告诉大模型"我有哪些工具、每个工具怎么用"。
# description 写得越清楚，模型调用得越准 —— 这部分是最重要的"提示词"。
TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_order",
            "description": "按订单号查询订单状态。当用户询问某个订单的状态、物流、金额时使用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "订单号，如 SO20250101001",
                    }
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_policy",
            "description": "查询退换货、退款、运费、发货、破损等售后政策。政策是通用规则，查询不需要订单号；用户问'能退吗'就把 query 传成'退货'。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "用户关心的政策关键词，如'退货'",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_ticket",
            "description": "创建人工客服工单。当问题无法在线解决、或用户明确说'开工单/转人工/投诉'时立即调用，不要先查政策；缺少的细节（如订单号）在工单内容里写'未提供'，不要反复追问。",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {
                        "type": "string",
                        "description": "问题的一句话概括",
                    },
                    "body": {
                        "type": "string",
                        "description": "问题详细描述，包含订单号等关键信息",
                    },
                },
                "required": ["subject", "body"],
            },
        },
    },
]


def run_agent(user_query, verbose=False):
    """把用户问题交给 Agent，返回 (最终回答, 执行轨迹)。

    执行轨迹 trace 记录每一步：模型想调什么工具、参数是什么、结果是什么。
    这是后面排查问题最重要的依据。
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_query},
    ]
    trace = []

    for step in range(MAX_STEPS):
        # 第 1 步：把到目前为止的对话发给大模型
        resp = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOL_SCHEMAS,
        )
        msg = resp.choices[0].message
        messages.append(msg)  # 把模型这轮的回复记进对话历史

        if msg.tool_calls:
            # 第 2 步：模型想调工具 -> 逐个执行
            if verbose:
                print(f"[第{step + 1}轮] 模型想调用: {[tc.function.name for tc in msg.tool_calls]}")
            trace.append({
                "step": step,
                "calls": [tc.function.name for tc in msg.tool_calls],
            })

            for tc in msg.tool_calls:
                fn = tc.function
                args = json.loads(fn.arguments)  # 模型给的参数是 JSON 字符串，转成字典
                try:
                    result = TOOL_FUNCTIONS[fn.name](**args)
                except Exception as e:
                    # 工具执行出错时，把错误告诉模型，让它自己想办法
                    result = f"工具执行出错: {e}"
                if verbose:
                    print(f"  调用 {fn.name}{args}")
                    print(f"  结果: {result}")
                trace.append({"tool": fn.name, "args": args, "result": result})
                # 关键一步：把工具结果"回填"给模型，下一轮它就能看到结果
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })
        else:
            # 第 3 步：模型决定不再调工具，直接给出最终回答
            return msg.content, trace

    # 达到最大轮数还没结束（比如一直循环调用），强制终止
    return "达到最大执行轮数，已终止。", trace
