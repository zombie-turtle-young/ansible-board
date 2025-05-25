#!/bin/bash

# Docker容器初始化脚本
# 用于设置容器环境和启动服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 初始化SSH配置
init_ssh() {
    log_info "初始化SSH配置..."
    
    # 创建SSH目录
    mkdir -p /root/.ssh
    chmod 700 /root/.ssh
    
    # 生成SSH密钥（如果不存在）
    if [ ! -f /root/.ssh/id_rsa ]; then
        ssh-keygen -t rsa -b 2048 -f /root/.ssh/id_rsa -N ""
        log_success "SSH密钥生成完成"
    fi
    
    # 配置SSH客户端
    cat > /root/.ssh/config << EOF
Host *
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel ERROR
EOF
    
    chmod 600 /root/.ssh/config
    log_success "SSH配置完成"
}

# 初始化Ansible配置
init_ansible() {
    log_info "初始化Ansible配置..."
    
    # 创建Ansible配置目录
    mkdir -p /etc/ansible
    
    # 创建ansible.cfg配置文件
    cat > /etc/ansible/ansible.cfg << EOF
[defaults]
host_key_checking = False
timeout = 30
inventory = /app/ansible/hosts
remote_user = root
ask_pass = False
ask_sudo_pass = False
gathering = smart
fact_caching = memory
stdout_callback = yaml
bin_ansible_callbacks = True

[ssh_connection]
ssh_args = -o ControlMaster=auto -o ControlPersist=60s -o StrictHostKeyChecking=no
pipelining = True
EOF
    
    log_success "Ansible配置完成"
}

# 检查并创建必要目录
create_directories() {
    log_info "创建必要目录..."
    
    local dirs=(
        "/app/logs"
        "/app/data"
        "/app/backup"
        "/tmp/ansible"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "创建目录: $dir"
        fi
    done
    
    log_success "目录创建完成"
}

# 设置权限
set_permissions() {
    log_info "设置文件权限..."
    
    # 设置脚本执行权限
    find /app/scripts -name "*.sh" -exec chmod +x {} \;
    
    # 设置Ansible文件权限
    chmod 644 /app/ansible/hosts
    find /app/ansible/playbooks -name "*.yml" -exec chmod 644 {} \;
    
    log_success "权限设置完成"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    local required_commands=(
        "python3"
        "pip3"
        "ansible"
        "ansible-playbook"
        "ssh"
        "ping"
    )
    
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [ ${#missing_commands[@]} -eq 0 ]; then
        log_success "所有依赖检查通过"
    else
        log_error "缺少以下依赖: ${missing_commands[*]}"
        return 1
    fi
}

# 初始化Python环境
init_python() {
    log_info "初始化Python环境..."
    
    # 升级pip
    pip3 install --upgrade pip
    
    # 安装额外的Python包
    pip3 install --no-cache-dir \
        netaddr \
        jmespath \
        dnspython
    
    log_success "Python环境初始化完成"
}

# 测试Ansible连接
test_ansible() {
    log_info "测试Ansible配置..."
    
    # 测试ansible命令
    if ansible --version >/dev/null 2>&1; then
        log_success "Ansible版本: $(ansible --version | head -1)"
    else
        log_error "Ansible测试失败"
        return 1
    fi
    
    # 测试inventory文件
    if [ -f "/app/ansible/hosts" ]; then
        log_info "测试inventory文件..."
        ansible all -i /app/ansible/hosts --list-hosts 2>/dev/null || log_warning "Inventory文件可能需要配置"
    fi
}

# 启动网络扫描
run_network_scan() {
    log_info "执行网络扫描..."
    
    if [ -f "/app/scripts/scan_network.sh" ]; then
        bash /app/scripts/scan_network.sh
    else
        log_warning "网络扫描脚本不存在"
    fi
}

# 创建系统服务状态检查函数
check_system_status() {
    log_info "检查系统状态..."
    
    # 检查内存使用
    local mem_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    log_info "内存使用率: ${mem_usage}%"
    
    # 检查磁盘使用
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    log_info "磁盘使用率: ${disk_usage}%"
    
    # 检查网络连接
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        log_success "网络连接正常"
    else
        log_warning "网络连接异常"
    fi
}

# 创建健康检查端点
create_health_check() {
    log_info "创建健康检查端点..."
    
    cat > /app/health_check.py << 'EOF'
#!/usr/bin/env python3
import json
import subprocess
import sys
from datetime import datetime

def check_ansible():
    try:
        result = subprocess.run(['ansible', '--version'], 
                              capture_output=True, text=True, timeout=10)
        return result.returncode == 0
    except:
        return False

def check_flask():
    try:
        import flask
        return True
    except ImportError:
        return False

def get_system_info():
    try:
        # 获取系统负载
        with open('/proc/loadavg', 'r') as f:
            load = f.read().split()[0]
        
        # 获取内存信息
        with open('/proc/meminfo', 'r') as f:
            meminfo = f.read()
            
        return {
            "load_average": load,
            "memory_available": "meminfo" in meminfo
        }
    except:
        return {}

def main():
    health_status = {
        "timestamp": datetime.now().isoformat(),
        "status": "healthy",
        "checks": {
            "ansible": check_ansible(),
            "flask": check_flask(),
        },
        "system": get_system_info()
    }
    
    # 如果任何检查失败，标记为不健康
    if not all(health_status["checks"].values()):
        health_status["status"] = "unhealthy"
    
    print(json.dumps(health_status, indent=2))
    
    # 返回适当的退出码
    sys.exit(0 if health_status["status"] == "healthy" else 1)

if __name__ == "__main__":
    main()
EOF
    
    chmod +x /app/health_check.py
    log_success "健康检查端点创建完成"
}

# 主初始化函数
main() {
    log_info "开始Docker容器初始化..."
    
    # 执行初始化步骤
    create_directories
    init_ssh
    init_ansible
    set_permissions
    check_dependencies
    init_python
    test_ansible
    create_health_check
    check_system_status
    
    # 可选：运行网络扫描
    if [ "${RUN_NETWORK_SCAN:-false}" = "true" ]; then
        run_network_scan
    fi
    
    log_success "Docker容器初始化完成!"
    
    # 显示启动信息
    echo ""
    echo "=========================================="
    echo "  Ansible Dashboard 容器已就绪"
    echo "=========================================="
    echo "  Web界面: http://localhost:5000"
    echo "  默认登录: admin / admin123"
    echo "  健康检查: python3 /app/health_check.py"
    echo "=========================================="
    echo ""
}

# 如果直接执行此脚本
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi 