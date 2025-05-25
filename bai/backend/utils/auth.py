import hashlib
import secrets
from functools import wraps
from flask import request, jsonify, session

class AuthManager:
    def __init__(self):
        # 默认管理员账户 (admin/admin123)
        self.users = {
            "admin": {
                "password_hash": self._hash_password("admin123"),
                "role": "admin"
            }
        }
        self.sessions = {}
    
    def _hash_password(self, password: str) -> str:
        """密码哈希"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def authenticate(self, username: str, password: str) -> dict:
        """用户认证"""
        if username in self.users:
            user = self.users[username]
            if user["password_hash"] == self._hash_password(password):
                # 生成会话token
                token = secrets.token_hex(32)
                self.sessions[token] = {
                    "username": username,
                    "role": user["role"]
                }
                return {
                    "success": True,
                    "token": token,
                    "username": username,
                    "role": user["role"]
                }
        
        return {
            "success": False,
            "message": "用户名或密码错误"
        }
    
    def verify_token(self, token: str) -> dict:
        """验证token"""
        if token in self.sessions:
            return {
                "valid": True,
                "user": self.sessions[token]
            }
        return {
            "valid": False,
            "message": "无效的token"
        }
    
    def logout(self, token: str) -> bool:
        """登出"""
        if token in self.sessions:
            del self.sessions[token]
            return True
        return False

# 全局认证管理器实例
auth_manager = AuthManager()

def require_auth(f):
    """认证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if token and token.startswith('Bearer '):
            token = token[7:]  # 移除 'Bearer ' 前缀
            
            auth_result = auth_manager.verify_token(token)
            if auth_result["valid"]:
                request.current_user = auth_result["user"]
                return f(*args, **kwargs)
        
        return jsonify({"error": "需要认证"}), 401
    
    return decorated_function 