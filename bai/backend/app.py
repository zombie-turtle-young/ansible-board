from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import os
import json
import re
import time
import hashlib
from werkzeug.utils import secure_filename
from utils.ansible_runner import AnsibleRunner
from utils.auth import auth_manager, require_auth

app = Flask(__name__, 
           template_folder='../frontend/templates',
           static_folder='../frontend/static')
CORS(app)

# 配置
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = '/app/uploads'

# 创建上传目录
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'zip', 'tar', 'gz', 'sh', 'py', 'conf', 'log'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 初始化Ansible运行器
ansible_runner = AnsibleRunner()

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "用户名和密码不能为空"}), 400
    
    result = auth_manager.authenticate(username, password)
    
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 401

@app.route('/api/logout', methods=['POST'])
@require_auth
def logout():
    """用户登出"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    auth_manager.logout(token)
    return jsonify({"message": "登出成功"})

@app.route('/api/ping', methods=['GET'])
def ping_hosts():
    """ping所有主机"""
    result = ansible_runner.ping_all_hosts()
    
    # 即使有主机离线(返回码非0)，只要有输出就尝试解析
    if result["stdout"].strip():
        try:
            hosts_status = ansible_runner.parse_ping_results(result["stdout"])
            return jsonify({
                "success": True,
                "hosts": hosts_status,
                "raw_output": result["stdout"],
                "return_code": result["return_code"]
            })
        except Exception as e:
            app.logger.error(f"解析ping结果失败: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"解析ping结果失败: {str(e)}",
                "raw_output": result["stdout"]
            }), 500
    else:
        return jsonify({
            "success": False,
            "error": result["stderr"] or "没有ping输出结果",
            "raw_output": result["stdout"]
        }), 500

@app.route('/api/ping/host/<host_ip>', methods=['GET'])
def ping_single_host(host_ip):
    """检查单个主机的连通性"""
    try:
        import subprocess
        import time
        
        start_time = time.time()
        result = subprocess.run(
            ['ping', '-c', '1', '-W', '2', host_ip],
            capture_output=True,
            text=True,
            timeout=3
        )
        end_time = time.time()
        
        response_time = round((end_time - start_time) * 1000, 2)  # 毫秒
        
        if result.returncode == 0:
            status = "online"
            raw_status = "SUCCESS"
        else:
            status = "offline"
            raw_status = "UNREACHABLE"
            
        return jsonify({
            "success": True,
            "host": host_ip,
            "status": status,
            "raw_status": raw_status,
            "response_time": response_time,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": True,
            "host": host_ip,
            "status": "offline",
            "raw_status": "TIMEOUT",
            "response_time": 3000,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "host": host_ip
        }), 500

@app.route('/api/hosts', methods=['GET'])
def get_hosts():
    """获取主机列表及详细信息"""
    try:
        hosts_detail = []
        
        # 读取inventory文件解析主机信息
        with open(ansible_runner.inventory_path, 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        current_group = 'ungrouped'
        
        for line in lines:
            line = line.strip()
            if line.startswith('[') and line.endswith(']'):
                # 这是一个组名
                current_group = line[1:-1]
                if current_group.endswith(':vars'):
                    current_group = 'vars'
            elif line and not line.startswith('#') and current_group != 'vars':
                # 这是一个主机行
                if ' ' in line:
                    parts = line.split(' ')
                    host_ip = parts[0]
                    
                    # 解析主机参数
                    host_info = {
                        'ip': host_ip,
                        'group': current_group,
                        'username': 'root',  # 默认值
                        'description': f'主机 {host_ip}'
                    }
                    
                    # 解析ansible参数
                    for part in parts[1:]:
                        if '=' in part:
                            key, value = part.split('=', 1)
                            if key == 'ansible_user':
                                host_info['username'] = value
                            elif key == 'ansible_ssh_pass':
                                host_info['has_password'] = True  # 不返回实际密码
                    
                    hosts_detail.append(host_info)
                elif line:  # 只有IP没有参数的情况
                    hosts_detail.append({
                        'ip': line,
                        'group': current_group,
                        'username': 'root',
                        'description': f'主机 {line}',
                        'has_password': False
                    })
        
        return jsonify({
            "success": True,
            "hosts": hosts_detail,
            "total": len(hosts_detail)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "hosts": []
        }), 500

@app.route('/api/hosts', methods=['POST'])
@require_auth
def add_host():
    """添加主机"""
    data = request.get_json()
    host_ip = data.get('host_ip')
    username = data.get('username', 'root')
    password = data.get('password')
    group = data.get('group', 'webservers')
    
    if not host_ip or not password:
        return jsonify({"error": "主机IP和密码不能为空"}), 400
    
    try:
        # 读取现有的hosts文件
        with open(ansible_runner.inventory_path, 'r') as f:
            content = f.read()
        
        # 检查主机是否已存在
        if host_ip in content:
            return jsonify({"error": f"主机 {host_ip} 已存在"}), 400
        
        # 构建新的主机条目
        new_host_line = f"{host_ip} ansible_user={username} ansible_ssh_pass={password}"
        
        # 查找对应的组
        group_pattern = f"\\[{group}\\]"
        if re.search(group_pattern, content):
            # 组存在，在组下添加主机
            lines = content.split('\n')
            new_lines = []
            group_found = False
            
            for line in lines:
                new_lines.append(line)
                if line.strip() == f"[{group}]":
                    group_found = True
                    new_lines.append(new_host_line)
            
            content = '\n'.join(new_lines)
        else:
            # 组不存在，创建新组
            if not content.endswith('\n'):
                content += '\n'
            content += f"\n[{group}]\n{new_host_line}\n"
        
        # 写回文件
        with open(ansible_runner.inventory_path, 'w') as f:
            f.write(content)
        
        app.logger.info(f"Successfully added host {host_ip} to group {group}")
        
        return jsonify({
            "message": "主机添加成功",
            "host": host_ip,
            "group": group
        })
    
    except Exception as e:
        app.logger.error(f"Failed to add host {host_ip}: {str(e)}")
        return jsonify({"error": f"添加主机失败: {str(e)}"}), 500

@app.route('/api/hosts/<host_ip>', methods=['GET'])
def get_host_detail(host_ip):
    """获取单个主机的详细信息"""
    try:
        with open(ansible_runner.inventory_path, 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        current_group = 'ungrouped'
        
        for line in lines:
            line = line.strip()
            if line.startswith('[') and line.endswith(']'):
                current_group = line[1:-1]
                if current_group.endswith(':vars'):
                    current_group = 'vars'
            elif line and not line.startswith('#') and current_group != 'vars':
                if line.startswith(host_ip):
                    # 找到目标主机
                    host_info = {
                        'ip': host_ip,
                        'group': current_group,
                        'username': 'root',
                        'description': f'主机 {host_ip}',
                        'has_password': False
                    }
                    
                    if ' ' in line:
                        parts = line.split(' ')
                        for part in parts[1:]:
                            if '=' in part:
                                key, value = part.split('=', 1)
                                if key == 'ansible_user':
                                    host_info['username'] = value
                                elif key == 'ansible_ssh_pass':
                                    host_info['has_password'] = True
                    
                    return jsonify({
                        "success": True,
                        "host": host_info
                    })
        
        return jsonify({
            "success": False,
            "error": f"主机 {host_ip} 不存在"
        }), 404
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/hosts/<host_ip>', methods=['PUT'])
@require_auth
def update_host(host_ip):
    """修改主机信息"""
    try:
        data = request.get_json()
        new_username = data.get('username', 'root')
        new_password = data.get('password')
        new_group = data.get('group', 'managed_hosts')
        new_description = data.get('description', f'主机 {host_ip}')
        
        with open(ansible_runner.inventory_path, 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        new_lines = []
        host_found = False
        current_group = 'ungrouped'
        original_password = None
        
        # 首先查找原有密码（如果没有提供新密码）
        if not new_password:
            for line in lines:
                line_stripped = line.strip()
                if line_stripped.startswith(host_ip) and 'ansible_ssh_pass=' in line_stripped:
                    parts = line_stripped.split(' ')
                    for part in parts:
                        if part.startswith('ansible_ssh_pass='):
                            original_password = part.split('=', 1)[1]
                            break
                    break
        
        # 删除旧的主机记录
        for line in lines:
            line_stripped = line.strip()
            if line_stripped.startswith('[') and line_stripped.endswith(']'):
                current_group = line_stripped[1:-1]
                if current_group.endswith(':vars'):
                    current_group = 'vars'
            
            if not line_stripped.startswith(host_ip):
                new_lines.append(line)
            else:
                host_found = True
        
        if not host_found:
            return jsonify({"error": f"主机 {host_ip} 不存在"}), 404
        
        # 构建新的主机条目
        if new_password:
            new_host_line = f"{host_ip} ansible_user={new_username} ansible_ssh_pass={new_password}"
        elif original_password:
            new_host_line = f"{host_ip} ansible_user={new_username} ansible_ssh_pass={original_password}"
        else:
            new_host_line = f"{host_ip} ansible_user={new_username}"
        
        # 添加到指定组
        content = '\n'.join(new_lines)
        group_pattern = f"\\[{new_group}\\]"
        
        if re.search(group_pattern, content):
            # 组存在，在组下添加主机
            lines = content.split('\n')
            final_lines = []
            
            for line in lines:
                final_lines.append(line)
                if line.strip() == f"[{new_group}]":
                    final_lines.append(new_host_line)
            
            content = '\n'.join(final_lines)
        else:
            # 组不存在，创建新组
            if not content.endswith('\n'):
                content += '\n'
            content += f"\n[{new_group}]\n{new_host_line}\n"
        
        # 写回文件
        with open(ansible_runner.inventory_path, 'w') as f:
            f.write(content)
        
        app.logger.info(f"Successfully updated host {host_ip}")
        
        return jsonify({
            "message": "主机更新成功",
            "host": {
                "ip": host_ip,
                "username": new_username,
                "group": new_group,
                "description": new_description
            }
        })
        
    except Exception as e:
        app.logger.error(f"Failed to update host {host_ip}: {str(e)}")
        return jsonify({"error": f"更新主机失败: {str(e)}"}), 500

@app.route('/api/hosts/<host_ip>', methods=['DELETE'])
@require_auth
def delete_host(host_ip):
    """删除主机"""
    try:
        with open(ansible_runner.inventory_path, 'r') as f:
            lines = f.readlines()
        
        # 过滤掉包含指定IP的行
        filtered_lines = [line for line in lines if not line.strip().startswith(host_ip)]
        
        if len(filtered_lines) == len(lines):
            return jsonify({"error": f"主机 {host_ip} 不存在"}), 404
        
        with open(ansible_runner.inventory_path, 'w') as f:
            f.writelines(filtered_lines)
        
        app.logger.info(f"Successfully deleted host {host_ip}")
        
        return jsonify({"message": "主机删除成功"})
    
    except Exception as e:
        app.logger.error(f"Failed to delete host {host_ip}: {str(e)}")
        return jsonify({"error": f"删除主机失败: {str(e)}"}), 500

@app.route('/api/resources', methods=['GET'])
def get_resources():
    """获取资源监控数据"""
    try:
        result = ansible_runner.run_playbook("resource_monitor.yml")
        
        # 即使部分主机失败，只要有输出就尝试解析可用的结果
        if result["stdout"].strip():
            try:
                # 解析资源信息
                resources = parse_resource_output(result["stdout"])
                return jsonify({
                    "success": True,
                    "resources": resources,
                    "raw_output": result["stdout"],
                    "return_code": result["return_code"],
                    "partial_failure": not result["success"]  # 标记是否有部分失败
                })
            except Exception as e:
                app.logger.error(f"解析资源数据失败: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": f"解析资源数据失败: {str(e)}",
                    "raw_output": result["stdout"],
                    "resources": []
                }), 500
        else:
            return jsonify({
                "success": False,
                "error": result["stderr"] or "没有资源监控输出结果",
                "raw_output": result["stdout"],
                "resources": []
            }), 500
            
    except Exception as e:
        app.logger.error(f"获取资源信息失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "resources": []
        }), 500

@app.route('/api/network', methods=['GET'])
def get_network_info():
    """获取网络信息"""
    result = ansible_runner.run_playbook("network_scan.yml")
    
    if result["success"]:
        # 解析网络信息
        network_info = parse_network_output(result["stdout"])
        return jsonify({
            "success": True,
            "network": network_info,
            "raw_output": result["stdout"]
        })
    else:
        return jsonify({
            "success": False,
            "error": result["stderr"],
            "raw_output": result["stdout"]
        }), 500

@app.route('/api/command', methods=['POST'])
@require_auth
def run_command():
    """执行自定义ansible命令"""
    data = request.get_json()
    module = data.get('module', 'shell')
    args = data.get('args', '')
    hosts = data.get('hosts', 'all')
    
    result = ansible_runner.run_adhoc_command(module, args, hosts)
    
    return jsonify({
        "success": result["success"],
        "output": result["stdout"],
        "error": result["stderr"]
    })

@app.route('/api/upload', methods=['POST'])
@require_auth
def upload_file():
    """上传文件到指定主机"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "没有选择文件"}), 400
        
        file = request.files['file']
        target_hosts = request.form.get('hosts', 'all')
        remote_path = request.form.get('remote_path', '/tmp/')
        
        if file.filename == '':
            return jsonify({"error": "没有选择文件"}), 400
        
        if file and allowed_file(file.filename):
            # 生成安全的文件名
            timestamp = str(int(time.time()))
            file_hash = hashlib.md5(file.filename.encode()).hexdigest()[:8]
            filename = f"{timestamp}_{file_hash}_{secure_filename(file.filename)}"
            
            # 保存文件到本地
            local_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(local_path)
            
            # 使用Ansible copy模块将文件传输到远程主机
            remote_file_path = os.path.join(remote_path, secure_filename(file.filename))
            
            result = ansible_runner.run_adhoc_command(
                "copy",
                f"src={local_path} dest={remote_file_path} mode=0644",
                target_hosts
            )
            
            # 清理本地临时文件
            try:
                os.remove(local_path)
            except:
                pass
            
            if result["success"]:
                return jsonify({
                    "success": True,
                    "message": f"文件 {file.filename} 上传成功",
                    "remote_path": remote_file_path,
                    "hosts": target_hosts
                })
            else:
                return jsonify({
                    "success": False,
                    "error": f"文件传输失败: {result['stderr']}"
                }), 500
        else:
            return jsonify({"error": "不支持的文件类型"}), 400
            
    except Exception as e:
        app.logger.error(f"文件上传失败: {str(e)}")
        return jsonify({"error": f"上传失败: {str(e)}"}), 500

@app.route('/api/shutdown', methods=['POST'])
@require_auth
def shutdown_hosts():
    """远程关机"""
    try:
        data = request.get_json()
        target_hosts = data.get('hosts', 'all')
        force = data.get('force', False)
        delay = data.get('delay', 1)  # 默认1分钟后关机
        
        # 构建关机命令
        if force:
            shutdown_cmd = f"shutdown -h +{delay}"
        else:
            shutdown_cmd = f"shutdown -h +{delay} 'System shutdown initiated from Ansible Dashboard'"
        
        result = ansible_runner.run_adhoc_command(
            "shell",
            shutdown_cmd,
            target_hosts
        )
        
        # 关机操作的特殊处理逻辑
        # 检查是否有成功的关机指示，即使整体状态显示失败
        success_indicators = [
            "Shutdown scheduled",
            "shutdown -h",
            "CHANGED",
            "rc=0"
        ]
        
        # 检查stderr中的连接断开信息（通常意味着关机成功）
        connection_lost_indicators = [
            "Connection to .* closed by remote host",
            "Shared connection to .* closed",
            "SSH connection was closed",
            "Connection closed by"
        ]
        
        stdout_has_success = any(indicator in result["stdout"] for indicator in success_indicators)
        stderr_has_connection_lost = any(re.search(pattern, result["stderr"], re.IGNORECASE) 
                                       for pattern in connection_lost_indicators)
        
        # 判断关机是否成功：
        # 1. 正常成功返回
        # 2. 输出包含成功指示
        # 3. 连接断开（通常意味着主机已关机）
        if result["success"] or stdout_has_success or stderr_has_connection_lost:
            # 构建详细的成功消息
            if result["success"] and stdout_has_success:
                status_msg = "关机命令已成功发送并确认"
            elif stdout_has_success:
                status_msg = "关机命令已发送并执行"
            elif stderr_has_connection_lost:
                status_msg = "关机命令已发送，主机连接已断开（可能已关机）"
            else:
                status_msg = "关机命令已发送"
            
            return jsonify({
                "success": True,
                "message": f"{status_msg}，目标主机: {target_hosts}",
                "delay": delay,
                "force": force,
                "raw_output": result["stdout"],
                "connection_status": "disconnected" if stderr_has_connection_lost else "connected",
                "return_code": result["return_code"]
            })
        else:
            # 真正的失败情况
            return jsonify({
                "success": False,
                "error": f"关机命令失败: {result['stderr'] or '未知错误'}",
                "raw_output": result["stdout"],
                "return_code": result["return_code"]
            }), 500
            
    except Exception as e:
        app.logger.error(f"远程关机失败: {str(e)}")
        return jsonify({"error": f"关机失败: {str(e)}"}), 500

@app.route('/api/cancel-shutdown', methods=['POST'])
@require_auth
def cancel_shutdown():
    """取消远程关机"""
    try:
        data = request.get_json()
        target_hosts = data.get('hosts', 'all')
        
        result = ansible_runner.run_adhoc_command(
            "shell",
            "shutdown -c",
            target_hosts
        )
        
        # 取消关机的特殊处理
        # 检查成功指示，包括空输出（表示成功取消）
        success_indicators = [
            "CHANGED",
            "rc=0"
        ]
        
        stdout_has_success = any(indicator in result["stdout"] for indicator in success_indicators)
        # 对于取消关机，空的stderr通常表示成功
        stderr_is_empty = not result["stderr"].strip()
        
        if result["success"] or stdout_has_success or (stderr_is_empty and result["return_code"] == 0):
            return jsonify({
                "success": True,
                "message": f"已取消主机关机: {target_hosts}",
                "raw_output": result["stdout"],
                "return_code": result["return_code"]
            })
        else:
            # 检查是否是"没有关机计划"的错误（这也算是成功的一种）
            no_shutdown_indicators = [
                "No scheduled shutdown to cancel",
                "shutdown: no shutdown scheduled",
                "没有计划的关机"
            ]
            
            has_no_shutdown = any(indicator.lower() in result["stderr"].lower() 
                                for indicator in no_shutdown_indicators)
            
            if has_no_shutdown:
                return jsonify({
                    "success": True,
                    "message": f"主机 {target_hosts} 没有计划的关机操作",
                    "raw_output": result["stdout"],
                    "return_code": result["return_code"]
                })
            else:
                return jsonify({
                    "success": False,
                    "error": f"取消关机失败: {result['stderr'] or '未知错误'}",
                    "raw_output": result["stdout"],
                    "return_code": result["return_code"]
                }), 500
            
    except Exception as e:
        app.logger.error(f"取消关机失败: {str(e)}")
        return jsonify({"error": f"取消关机失败: {str(e)}"}), 500

@app.route('/api/system-info', methods=['GET'])
def get_system_info():
    """获取系统信息"""
    try:
        result = ansible_runner.run_adhoc_command("setup", "filter=ansible_distribution*,ansible_kernel,ansible_uptime_seconds,ansible_processor*")
        
        if result["success"]:
            return jsonify({
                "success": True,
                "raw_output": result["stdout"]
            })
        else:
            return jsonify({
                "success": False,
                "error": result["stderr"]
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def parse_resource_output(output):
    """解析资源监控输出"""
    resources = []
    
    # 使用正则表达式匹配整个JSON块
    json_blocks = re.findall(r'ok: \[[^\]]+\] => \{[^}]*"msg": "([^"]+)"[^}]*\}', output, re.DOTALL)
    
    for msg_content in json_blocks:
        current_resource = {}
        
        # 使用\\n分割消息内容
        msg_lines = msg_content.split('\\n')
        
        for msg_line in msg_lines:
            msg_line = msg_line.strip()
            
            if '主机:' in msg_line:
                host_match = re.search(r'主机: (.+)', msg_line)
                if host_match:
                    current_resource['host'] = host_match.group(1).strip()
            elif 'CPU使用率:' in msg_line:
                cpu_match = re.search(r'CPU使用率: ([^%]+)%', msg_line)
                if cpu_match:
                    current_resource['cpu'] = cpu_match.group(1).strip()
            elif '内存使用率:' in msg_line:
                mem_match = re.search(r'内存使用率: ([^%]+)%', msg_line)
                if mem_match:
                    current_resource['memory'] = mem_match.group(1).strip()
            elif '磁盘使用率:' in msg_line:
                disk_match = re.search(r'磁盘使用率: ([^%]+)%', msg_line)
                if disk_match:
                    current_resource['disk'] = disk_match.group(1).strip()
            elif '系统负载:' in msg_line:
                load_match = re.search(r'系统负载: (.+)', msg_line)
                if load_match:
                    current_resource['load'] = load_match.group(1).strip()
        
        # 如果收集到了完整的资源信息，添加到结果中
        if 'host' in current_resource and len(current_resource) > 1:
            resources.append(current_resource)
    
    return resources

def parse_network_output(output):
    """解析网络信息输出"""
    network_info = []
    lines = output.split('\n')
    current_host = None
    current_info = {}
    
    for line in lines:
        if line.strip().startswith('ok: [') and '] => {' in line:
            host_match = re.search(r'ok: \[([^\]]+)\]', line)
            if host_match:
                current_host = host_match.group(1)
                current_info = {"host": current_host}
        elif current_host and '主机:' in line:
            if '连通性:' in line:
                status_match = re.search(r'连通性: (\w+)', line)
                if status_match:
                    current_info['status'] = status_match.group(1)
            elif 'IP地址:' in line:
                ip_match = re.search(r'IP地址: (.+)', line)
                if ip_match:
                    current_info['ip'] = ip_match.group(1).strip()
            elif '网关:' in line:
                gateway_match = re.search(r'网关: (.+)', line)
                if gateway_match:
                    current_info['gateway'] = gateway_match.group(1).strip()
            elif 'DNS:' in line:
                dns_match = re.search(r'DNS: (.+)', line)
                if dns_match:
                    current_info['dns'] = dns_match.group(1).strip()
                    # 收集完一个主机的信息后添加到结果
                    if len(current_info) > 1:
                        network_info.append(current_info.copy())
                        current_info = {}
                        current_host = None
    
    return network_info

if __name__ == '__main__':
    app.run(
        host='0.0.0.0', 
        port=5000, 
        debug=False,
        threaded=True
    ) 