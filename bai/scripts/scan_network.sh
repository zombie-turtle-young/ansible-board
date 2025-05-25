#!/bin/bash

# 网络自动扫描和配置脚本
# 用于Docker环境中的网络自动化配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 获取当前网络信息
get_network_info() {
    log_info "获取当前网络配置信息..."
    
    # 获取默认网关
    DEFAULT_GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
    
    # 获取主要网络接口
    MAIN_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
    
    # 获取当前IP地址
    CURRENT_IP=$(ip addr show $MAIN_INTERFACE | grep "inet " | awk '{print $2}' | cut -d'/' -f1)
    
    # 获取网络段
    NETWORK_SEGMENT=$(ip route | grep $MAIN_INTERFACE | grep -v default | awk '{print $1}' | head -1)
    
    # 获取DNS服务器
    DNS_SERVERS=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}' | tr '\n' ' ')
    
    log_success "网络信息获取完成:"
    echo "  主接口: $MAIN_INTERFACE"
    echo "  当前IP: $CURRENT_IP"
    echo "  网络段: $NETWORK_SEGMENT"
    echo "  网关: $DEFAULT_GATEWAY"
    echo "  DNS: $DNS_SERVERS"
}

# 扫描网络中的活跃主机
scan_active_hosts() {
    log_info "扫描网络中的活跃主机..."
    
    if [ -z "$NETWORK_SEGMENT" ]; then
        log_error "无法确定网络段"
        return 1
    fi
    
    # 创建临时文件存储扫描结果
    SCAN_RESULT="/tmp/network_scan_$(date +%s).txt"
    
    # 使用nmap扫描网络（如果可用）
    if command -v nmap >/dev/null 2>&1; then
        log_info "使用nmap扫描网络段: $NETWORK_SEGMENT"
        nmap -sn $NETWORK_SEGMENT | grep "Nmap scan report" | awk '{print $5}' > $SCAN_RESULT
    else
        # 使用ping扫描
        log_info "使用ping扫描网络段: $NETWORK_SEGMENT"
        NETWORK_BASE=$(echo $NETWORK_SEGMENT | cut -d'/' -f1 | cut -d'.' -f1-3)
        
        for i in {1..254}; do
            IP="$NETWORK_BASE.$i"
            if ping -c 1 -W 1 $IP >/dev/null 2>&1; then
                echo $IP >> $SCAN_RESULT
            fi
        done
    fi
    
    if [ -f "$SCAN_RESULT" ] && [ -s "$SCAN_RESULT" ]; then
        ACTIVE_HOSTS=$(cat $SCAN_RESULT | wc -l)
        log_success "发现 $ACTIVE_HOSTS 个活跃主机:"
        cat $SCAN_RESULT | while read host; do
            echo "  - $host"
        done
        
        # 返回扫描结果文件路径
        echo $SCAN_RESULT
    else
        log_warning "未发现活跃主机"
        return 1
    fi
}

# 自动配置Docker网络
configure_docker_network() {
    log_info "配置Docker网络..."
    
    # 检查Docker是否运行
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker未运行或无法访问"
        return 1
    fi
    
    # 创建自定义网络（如果不存在）
    NETWORK_NAME="ansible-dashboard-net"
    
    if ! docker network ls | grep -q $NETWORK_NAME; then
        log_info "创建Docker网络: $NETWORK_NAME"
        
        # 计算可用的子网
        DOCKER_SUBNET="172.20.0.0/16"
        DOCKER_GATEWAY="172.20.0.1"
        
        docker network create \
            --driver bridge \
            --subnet=$DOCKER_SUBNET \
            --gateway=$DOCKER_GATEWAY \
            $NETWORK_NAME
        
        log_success "Docker网络创建成功"
    else
        log_info "Docker网络 $NETWORK_NAME 已存在"
    fi
    
    # 输出网络配置信息
    docker network inspect $NETWORK_NAME --format='{{json .IPAM.Config}}' | jq '.'
}

# 更新Ansible hosts文件
update_ansible_hosts() {
    local scan_result_file=$1
    local hosts_file="/app/ansible/hosts"
    
    if [ ! -f "$scan_result_file" ]; then
        log_error "扫描结果文件不存在"
        return 1
    fi
    
    log_info "更新Ansible hosts文件..."
    
    # 备份原有hosts文件
    if [ -f "$hosts_file" ]; then
        cp "$hosts_file" "${hosts_file}.backup.$(date +%s)"
        log_info "已备份原hosts文件"
    fi
    
    # 创建新的hosts文件
    cat > "$hosts_file" << EOF
# 自动生成的Ansible hosts文件
# 生成时间: $(date)

[discovered_hosts]
EOF
    
    # 添加扫描到的主机
    while read -r host; do
        if [ ! -z "$host" ] && [ "$host" != "$CURRENT_IP" ]; then
            echo "$host ansible_user=root ansible_ssh_pass=password" >> "$hosts_file"
        fi
    done < "$scan_result_file"
    
    # 添加通用配置
    cat >> "$hosts_file" << EOF

[all:vars]
ansible_ssh_common_args='-o StrictHostKeyChecking=no'
ansible_python_interpreter=/usr/bin/python3
EOF
    
    log_success "Ansible hosts文件更新完成"
    log_info "新hosts文件内容:"
    cat "$hosts_file"
}

# 测试网络连通性
test_connectivity() {
    log_info "测试网络连通性..."
    
    # 测试外网连通性
    if ping -c 3 8.8.8.8 >/dev/null 2>&1; then
        log_success "外网连通性正常"
    else
        log_warning "外网连通性异常"
    fi
    
    # 测试DNS解析
    if nslookup google.com >/dev/null 2>&1; then
        log_success "DNS解析正常"
    else
        log_warning "DNS解析异常"
    fi
    
    # 测试网关连通性
    if [ ! -z "$DEFAULT_GATEWAY" ]; then
        if ping -c 3 $DEFAULT_GATEWAY >/dev/null 2>&1; then
            log_success "网关连通性正常"
        else
            log_warning "网关连通性异常"
        fi
    fi
}

# 生成网络配置报告
generate_report() {
    local report_file="/tmp/network_report_$(date +%s).json"
    
    log_info "生成网络配置报告..."
    
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "network_info": {
        "interface": "$MAIN_INTERFACE",
        "current_ip": "$CURRENT_IP",
        "network_segment": "$NETWORK_SEGMENT",
        "gateway": "$DEFAULT_GATEWAY",
        "dns_servers": "$DNS_SERVERS"
    },
    "docker_network": {
        "name": "ansible-dashboard-net",
        "subnet": "172.20.0.0/16",
        "gateway": "172.20.0.1"
    },
    "scan_summary": {
        "active_hosts": $(cat $SCAN_RESULT 2>/dev/null | wc -l || echo 0),
        "scan_time": "$(date)"
    }
}
EOF
    
    log_success "网络配置报告已生成: $report_file"
    cat "$report_file"
}

# 主函数
main() {
    log_info "开始网络自动化配置..."
    
    # 检查必要工具
    for tool in ip ping docker; do
        if ! command -v $tool >/dev/null 2>&1; then
            log_error "缺少必要工具: $tool"
            exit 1
        fi
    done
    
    # 执行网络配置步骤
    get_network_info
    
    # 扫描网络
    SCAN_RESULT=$(scan_active_hosts)
    
    if [ $? -eq 0 ] && [ ! -z "$SCAN_RESULT" ]; then
        # 更新Ansible配置
        update_ansible_hosts "$SCAN_RESULT"
        
        # 清理临时文件
        rm -f "$SCAN_RESULT"
    fi
    
    # 配置Docker网络
    configure_docker_network
    
    # 测试连通性
    test_connectivity
    
    # 生成报告
    generate_report
    
    log_success "网络自动化配置完成!"
}

# 脚本入口
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi 