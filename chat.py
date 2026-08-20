"""和你的客服 Agent 聊天。

用法：python chat.py
- 直接输入问题，回车
- 输入 /v 开关详细模式（能看到它每轮想调什么工具）
- 输入 q 退出
"""

from agent import run_agent

print("=== 电商客服 Agent ===")
print("输入问题开始聊天 | 输入 /v 看工具调用过程 | 输入 q 退出")
print('可以试试："查订单 SO20250101001"、"能退货吗"、"帮我开个工单"\n')

verbose = False
while True:
    q = input("你: ").strip()
    if q.lower() in ("q", "quit", "退出"):
        print("再见！")
        break
    if q == "/v":
        verbose = not verbose
        print(f"详细模式: {'开' if verbose else '关'}\n")
        continue
    if not q:
        continue

    answer, _ = run_agent(q, verbose=verbose)
    print(f"客服: {answer}\n")
