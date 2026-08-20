"""离线测试：不调用大模型、不需要 API key，检查三个工具本身对不对。

用法：python test_tools.py
建议每次改完 tools.py 都跑一遍。
"""

from tools import get_order, search_policy, create_ticket


def check(name, condition):
    print(f"[{'PASS' if condition else 'FAIL'}] {name}")
    return bool(condition)


results = []
results.append(check("查存在的订单", "已发货" in get_order("SO20250101001")))
results.append(check("查不存在的订单", "未找到" in get_order("SO12345678999")))
results.append(check("政策关键词命中", "7天" in search_policy("怎么退货")))
results.append(check("政策未命中兜底", "工单" in search_policy("外星人入侵怎么办")))
results.append(check("建工单", "工单已创建" in create_ticket("测试", "这是一条测试工单")))

print(f"\n通过 {sum(results)}/{len(results)}")
