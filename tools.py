"""工具层：Agent 的"手"。

Agent 本身只会"想"，真正干活（查订单、查政策、建工单）靠这些普通函数。
大模型通过 function calling 选择调用哪个函数、传什么参数。

这些函数现在用的是写死的假数据 —— 先跑通整个流程。
以后把函数内部换成真实的数据库 / 接口查询即可，其他地方一行都不用改。
"""

import json
import datetime

# ---------- 假数据库：假装这是公司的订单表 ----------
ORDERS = {
    "SO20250101001": {"status": "已发货", "amount": 299.0, "city": "杭州"},
    "SO20250215002": {"status": "待付款", "amount": 1299.0, "city": "上海"},
    "SO20250320003": {"status": "已完成", "amount": 59.9, "city": "北京"},
}

# ---------- 假知识库：假装这是《售后政策》文档 ----------
# 每个元素是 (关键词, 政策内容)，search_policy 按关键词简单匹配
POLICIES = [
    ("退货", "7天无理由退货：签收后7天内、商品不影响二次销售即可申请。"),
    ("退款", "退款将在仓库签收退货后 1-3 个工作日原路退回。"),
    ("运费", "质量问题运费由商家承担；非质量问题由买家承担。"),
    ("发货", "现货商品下单后 48 小时内发货，节假日顺延。"),
    ("破损", "收到破损商品请拍照留存，联系客服补发或退款。"),
]


def get_order(order_id: str) -> str:
    """按订单号查询订单状态。"""
    order = ORDERS.get(order_id)
    if order is None:
        return "未找到该订单，请确认订单号是否正确。"
    return (
        f"订单 {order_id} 状态：{order['status']}，"
        f"金额：{order['amount']} 元，收货城市：{order['city']}。"
    )


def search_policy(query: str) -> str:
    """在售后政策里按关键词查找。"""
    hits = [text for kw, text in POLICIES if kw in query]
    if not hits:
        return "政策库中没有找到相关内容，建议创建工单转人工处理。"
    return "\n".join(hits)


def create_ticket(subject: str, body: str) -> str:
    """创建人工客服工单，并追加写入 tickets.txt 文件。"""
    ticket_id = f"T{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
    record = {
        "id": ticket_id,
        "subject": subject,
        "body": body,
        "time": datetime.datetime.now().isoformat(),
    }
    with open("tickets.txt", "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return f"工单已创建，工单号 {ticket_id}，人工客服会尽快处理。"


# 工具名 -> 函数 的映射，agent.py 靠它找到并执行对应函数
TOOL_FUNCTIONS = {
    "get_order": get_order,
    "search_policy": search_policy,
    "create_ticket": create_ticket,
}
