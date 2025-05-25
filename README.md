🚀 Ansible Dashboard - 企业级运维监控平台
Build Status Version License

一个功能强大、界面美观的Ansible自动化运维监控平台，支持主机管理、资源监控、文件上传、远程关机等企业级功能。

✨ 核心功能特性
🖥️ 主机管理
✅ 批量主机管理: 支持添加、编辑、删除主机
✅ 分组管理: 按用途分组管理主机(webservers、databases等)
✅ 连通性检测: 实时检测主机在线状态
✅ 详细信息展示: 美观的卡片式主机详情页面
📊 实时监控
✅ 资源监控: CPU、内存、磁盘使用率实时监控
✅ 系统负载: 系统负载平均值监控
✅ 图表可视化: Chart.js动态图表展示
✅ 自动刷新: 30秒自动刷新监控数据
📁 文件管理
✅ 文件上传: 支持多种格式文件上传到远程主机
✅ 拖拽上传: 现代化拖拽文件上传体验
✅ 批量目标: 可选择单个或多个主机作为上传目标
✅ 进度显示: 实时显示上传进度和状态
✅ 格式支持: txt, pdf, png, jpg, gif, zip, tar, gz, sh, py, conf, log
🔴 远程控制
✅ 远程关机: 支持延迟关机和立即关机
✅ 批量操作: 可同时关闭多台主机
✅ 安全确认: 多重确认机制防止误操作
✅ 取消功能: 支持取消已发送的关机命令
🆕 状态自动更新: 关机后自动监控和更新主机状态
🆕 智能监控: 根据延迟时间智能计算监控开始时间
🆕 视觉反馈: 丰富的动画效果显示关机进度
🎨 界面美化
✅ 现代化设计: 渐变色彩搭配和圆角设计
✅ 动画效果: 流畅的过渡动画和交互反馈
✅ 响应式布局: 完美适配桌面和移动设备
✅ 图标美化: FontAwesome图标库增强视觉体验
🔧 技术架构
后端技术栈
Python Flask: Web应用框架
Ansible: 自动化运维工具
JWT: 身份认证和授权
多线程: 提升并发性能
前端技术栈
原生JavaScript: 现代ES6+语法
Chart.js: 数据可视化图表
FontAwesome: 图标库
CSS3: 动画和响应式设计
部署架构
Docker容器化: 一键部署
网络隔离: 独立网络环境
数据持久化: 主机配置持久化存储
🚀 快速开始
环境要求
Docker >= 20.10
Docker Compose >= 1.29
2GB+ 内存
1GB+ 磁盘空间
一键部署
# 克隆项目
git clone https://github.com/your-repo/ansible-dashboard.git
cd ansible-dashboard

# 启动服务
docker-compose up -d --build

# 检查服务状态
docker-compose ps
访问地址
Web界面: http://192.168.20.9:5000
默认账号: admin
默认密码: admin123
📖 使用指南
1️⃣ 登录系统
使用默认账号 admin/admin123 登录系统，首次登录后建议修改密码。

2️⃣ 添加主机
点击 "添加主机" 按钮
填写主机IP、用户名、密码等信息
选择合适的主机组
点击添加完成主机注册
3️⃣ 主机监控
连通性检测: 点击 "连通性检测" 查看主机在线状态
资源监控: 点击 "资源监控" 查看CPU、内存、磁盘使用情况
实时刷新: 系统每30秒自动刷新监控数据
4️⃣ 文件上传
点击 "文件上传" 按钮
选择文件或拖拽文件到上传区域
选择目标主机(支持多选)
设置远程存储路径
点击开始上传
支持的文件格式
文档: txt, pdf, conf, log
图片: png, jpg, jpeg, gif
压缩包: zip, tar, gz
脚本: sh, py
5️⃣ 远程关机
点击 "远程关机" 按钮
选择目标主机
设置延迟时间(0-60分钟)
选择是否强制关机
确认执行关机命令
⚠️ 安全提示: 远程关机为危险操作，请谨慎使用

6️⃣ 主机详情
在主机列表中点击 "详情" 按钮查看主机详细信息，包括:

📍 基本信息: IP、用户名、分组
🔍 连接状态: 实时连通性检测
⚡ 快速操作: 编辑、上传、关机、删除
🎨 界面展示
主机详情页面美化
新版本主机详情页面采用卡片式布局:

🎯 布局特点:

信息网格: 3列2行网格显示基本信息
图标美化: 每个信息项配有专属彩色图标
分行按钮: 操作按钮分为两行，主要操作和危险操作分离
悬停效果: 丰富的悬停动画和阴影效果
🎨 视觉优化:

渐变背景: 各个卡片使用不同颜色渐变
响应式设计: 完美适配手机、平板、桌面
动画过渡: 流畅的CSS3动画效果
🔐 安全特性
身份认证
JWT Token认证机制
会话超时自动登出
请求防护和授权验证
文件安全
文件类型白名单验证
文件大小限制(100MB)
安全文件名处理
临时文件自动清理
操作安全
危险操作多重确认
操作日志记录
权限分级控制
📊 API文档
认证相关
POST /api/login          # 用户登录
POST /api/logout         # 用户登出
主机管理
GET  /api/hosts          # 获取主机列表
POST /api/hosts          # 添加新主机
GET  /api/hosts/{ip}     # 获取主机详情
PUT  /api/hosts/{ip}     # 更新主机信息
DELETE /api/hosts/{ip}   # 删除主机
监控功能
GET  /api/ping           # 批量主机连通性检测
GET  /api/ping/host/{ip} # 单主机连通性检测
GET  /api/resources      # 获取资源监控数据
GET  /api/network        # 获取网络信息
文件操作
POST /api/upload         # 文件上传到远程主机
远程控制
POST /api/shutdown       # 远程关机
POST /api/cancel-shutdown # 取消关机
🛠️ 开发指南
目录结构
ansible-dashboard/
├── backend/                 # 后端Python代码
│   ├── app.py              # Flask应用主文件
│   ├── utils/              # 工具模块
│   └── requirements.txt    # Python依赖
├── frontend/               # 前端代码
│   ├── static/             # 静态资源
│   │   ├── css/           # 样式文件
│   │   └── js/            # JavaScript文件
│   └── templates/          # HTML模板
├── ansible/                # Ansible配置
│   ├── inventory/          # 主机清单
│   └── playbooks/          # 剧本文件
├── docker-compose.yml      # Docker编排文件
└── Dockerfile             # Docker构建文件
本地开发
# 安装Python依赖
pip install -r backend/requirements.txt

# 启动开发服务器
cd backend && python app.py

# 访问开发环境
http://localhost:5000
自定义配置
修改主机组: 编辑 frontend/templates/index.html 中的选项
调整监控间隔: 修改 frontend/static/js/dashboard.js 中的定时器
更改认证信息: 修改 backend/utils/auth.py 中的用户配置
🔄 版本更新
v4.0 (当前版本)
✨ 全新的主机详情界面设计
🎨 信息横向排列，按钮分行显示
🚀 上传和关机功能优化
💫 动画效果和响应式设计增强
v3.0
📁 新增文件上传功能
🔴 新增远程关机功能
🎨 界面美化和动画效果
📱 响应式设计优化
v2.0
🔍 主机连接状态动态检测
📊 资源监控图表优化
🛡️ 安全性增强
v1.0
🏠 基础主机管理功能
📈 资源监控功能
🔐 用户认证系统
🤝 贡献指南
欢迎贡献代码！请遵循以下步骤:

Fork 项目
创建特性分支 (git checkout -b feature/AmazingFeature)
提交更改 (git commit -m 'Add some AmazingFeature')
推送到分支 (git push origin feature/AmazingFeature)
打开 Pull Request
📝 许可证
本项目采用 MIT 许可证 - 查看 LICENSE 文件了解详情

📞 支持与反馈
🐛 Bug报告: Issues
💡 功能建议: Discussions
📧 联系我们:2240668137@e.gwng.edu.cn
🙏 致谢
感谢以下开源项目:

Flask - Web应用框架
Ansible - 自动化工具
Chart.js - 图表库
FontAwesome - 图标库
⭐ 如果这个项目对您有帮助，请给个Star支持一下！
