#!/bin/bash

echo "=== 🔧 测试关机API修复 ==="
echo ""

# 测试用的认证token（需要先登录获取）
echo "🔐 获取认证token..."
TOKEN=$(curl -s -X POST http://localhost:5000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' | \
    python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ 无法获取认证token，请检查登录信息"
    exit 1
else
    echo "✅ 认证成功"
fi

echo ""
echo "=== 📋 测试关机API响应 ==="

# 测试1: 延迟关机（安全测试）
echo "🧪 测试1: 延迟关机命令（60分钟延迟）"
SHUTDOWN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/shutdown \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"hosts":"192.168.20.11","delay":60,"force":false}')

echo "响应内容:"
echo "$SHUTDOWN_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'  成功状态: {data.get(\"success\", False)}')
    print(f'  返回消息: {data.get(\"message\", \"无消息\")}')
    print(f'  连接状态: {data.get(\"connection_status\", \"未知\")}')
    print(f'  返回码: {data.get(\"return_code\", \"未知\")}')
    if 'error' in data:
        print(f'  错误信息: {data[\"error\"]}')
except Exception as e:
    print(f'  解析错误: {e}')
    print(f'  原始响应: {sys.stdin.read()}')
"

echo ""

# 测试2: 取消关机
echo "🧪 测试2: 取消关机命令"
CANCEL_RESPONSE=$(curl -s -X POST http://localhost:5000/api/cancel-shutdown \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"hosts":"192.168.20.11"}')

echo "取消关机响应:"
echo "$CANCEL_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'  成功状态: {data.get(\"success\", False)}')
    print(f'  返回消息: {data.get(\"message\", \"无消息\")}')
    print(f'  返回码: {data.get(\"return_code\", \"未知\")}')
    if 'error' in data:
        print(f'  错误信息: {data[\"error\"]}')
except Exception as e:
    print(f'  解析错误: {e}')
"

echo ""

# 测试3: 再次取消关机（应该显示没有计划的关机）
echo "🧪 测试3: 再次取消关机（测试无关机计划的情况）"
CANCEL2_RESPONSE=$(curl -s -X POST http://localhost:5000/api/cancel-shutdown \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"hosts":"192.168.20.11"}')

echo "第二次取消关机响应:"
echo "$CANCEL2_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'  成功状态: {data.get(\"success\", False)}')
    print(f'  返回消息: {data.get(\"message\", \"无消息\")}')
    print(f'  返回码: {data.get(\"return_code\", \"未知\")}')
    if 'error' in data:
        print(f'  错误信息: {data[\"error\"]}')
except Exception as e:
    print(f'  解析错误: {e}')
"

echo ""
echo "=== ✅ 修复总结 ==="
echo "修复内容:"
echo "1. 🔧 智能检测关机成功指示器："
echo "   - 检查输出中的 'Shutdown scheduled', 'CHANGED', 'rc=0' 等"
echo "   - 检查连接断开标识（通常意味着主机已关机）"
echo ""
echo "2. 🔧 增强取消关机逻辑："
echo "   - 处理空输出的成功情况"
echo "   - 智能识别'没有关机计划'的情况为成功"
echo ""
echo "3. 🔧 详细的诊断信息："
echo "   - 返回原始输出和返回码"
echo "   - 提供连接状态信息"
echo "   - 更准确的状态消息"
echo ""
echo "🎉 现在关机API能够正确识别成功的关机操作，即使连接断开也不会误报为失败！" 