"""评测脚本：每次改完 agent.py / tools.py / config.py 后跑一遍，看有没有改坏。

用法：python eval.py

它检查两件事：
1. 工具选对了吗（单元层）：该查订单的有没有调 get_order
2. 答案对吗（端到端层）：最终回答里有没有关键信息

通过率从 50% 迭代到 90%+，就是第 1-2 周的主要工作。
"""

from agent import run_agent

# 评测用例：
#   query           用户问什么
#   expect_tool     应该调用哪个工具（None 表示不该调用任何工具）
#   answer_contains 答案里必须"全部"出现的关键词（AND）
#   answer_any      答案里"至少出现一个"的关键词（OR，与 answer_contains 可同时用）
CASES = [
    {"id": 1, "query": "查一下订单 SO20250101001 到哪了", "expect_tool": "get_order", "answer_contains": ["已发货"]},
    {"id": 2, "query": "订单 SO20250999999 的状态", "expect_tool": "get_order", "answer_any": ["未找到", "查询不到", "不存在", "没有找到", "未查询到"]},
    {"id": 3, "query": "我不想要了，能退吗", "expect_tool": "search_policy", "answer_any": ["7天", "七天"]},
    {"id": 4, "query": "快递把东西弄丢了，帮我开个工单", "expect_tool": "create_ticket", "answer_contains": ["工单"]},
    {"id": 5, "query": "明天杭州天气怎么样", "expect_tool": None, "answer_contains": None},
]


def run():
    passed = 0
    for c in CASES:
        answer, trace = run_agent(c["query"])
        called = [t["tool"] for t in trace if "tool" in t]

        tool_ok = (c["expect_tool"] is None and not called) or (c["expect_tool"] in called)

        # 答案检查：contains 要全部命中（AND），any 至少命中一个（OR）
        ans_ok = True
        if c.get("answer_contains"):
            ans_ok = all(k in (answer or "") for k in c["answer_contains"])
        if ans_ok and c.get("answer_any"):
            ans_ok = any(k in (answer or "") for k in c["answer_any"])

        ok = tool_ok and ans_ok

        if ok:
            passed += 1
        print(f'[{c["id"]}] {"PASS" if ok else "FAIL"} | 调用了: {called} | 回答: {answer}')

    print(f"\n通过率: {passed}/{len(CASES)}")
    print("提示: FAIL 的用例先看'调用了'对不对 —— 工具没选对，答案一定不对。")


if __name__ == "__main__":
    run()
