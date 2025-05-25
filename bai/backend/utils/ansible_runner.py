import subprocess
import json
import os
import tempfile
from typing import Dict, List, Any

class AnsibleRunner:
    def __init__(self, inventory_path: str = "/app/ansible/hosts"):
        self.inventory_path = inventory_path
        self.playbook_dir = "/app/ansible/playbooks"
    
    def run_adhoc_command(self, module: str, args: str = "", hosts: str = "all") -> Dict[str, Any]:
        """执行ansible ad-hoc命令"""
        try:
            cmd = [
                "ansible", 
                hosts, 
                "-i", self.inventory_path,
                "-m", module
            ]
            
            if args:
                cmd.extend(["-a", args])
            
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=15
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": "命令执行超时",
                "return_code": -1
            }
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "return_code": -1
            }
    
    def run_playbook(self, playbook_name: str, extra_vars: Dict = None) -> Dict[str, Any]:
        """执行ansible playbook"""
        try:
            playbook_path = os.path.join(self.playbook_dir, playbook_name)
            
            cmd = [
                "ansible-playbook",
                "-i", self.inventory_path,
                playbook_path
            ]
            
            if extra_vars:
                cmd.extend(["-e", json.dumps(extra_vars)])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": "Playbook执行超时",
                "return_code": -1
            }
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "return_code": -1
            }
    
    def ping_all_hosts(self) -> Dict[str, Any]:
        """ping所有主机"""
        return self.run_adhoc_command("ping")
    
    def get_host_facts(self, hosts: str = "all") -> Dict[str, Any]:
        """获取主机facts信息"""
        return self.run_adhoc_command("setup", hosts=hosts)
    
    def parse_ping_results(self, ping_output: str) -> List[Dict[str, Any]]:
        """解析ping命令的输出结果"""
        results = []
        lines = ping_output.split('\n')
        
        for line in lines:
            if ' | ' in line and ('SUCCESS' in line or 'UNREACHABLE' in line or 'FAILED' in line):
                parts = line.split(' | ')
                if len(parts) >= 2:
                    host = parts[0].strip()
                    status_part = parts[1].strip()
                    
                    # 判断状态
                    if 'SUCCESS' in status_part:
                        status = "online"
                        raw_status = "SUCCESS"
                    elif 'UNREACHABLE' in status_part:
                        status = "offline"
                        raw_status = "UNREACHABLE"
                    elif 'FAILED' in status_part:
                        status = "offline"
                        raw_status = "FAILED"
                    else:
                        status = "unknown"
                        raw_status = status_part
                    
                    results.append({
                        "host": host,
                        "status": status,
                        "raw_status": raw_status
                    })
        
        return results
    
    def get_inventory_hosts(self) -> List[str]:
        """获取inventory中的所有主机"""
        try:
            result = subprocess.run(
                ["ansible", "all", "-i", self.inventory_path, "--list-hosts"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            hosts = []
            lines = result.stdout.split('\n')
            for line in lines:
                line = line.strip()
                if line and not line.startswith('hosts (') and line != 'hosts:':
                    hosts.append(line)
            
            return hosts
        except Exception as e:
            print(f"获取主机列表失败: {e}")
            return [] 