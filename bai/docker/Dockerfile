# Dockerfile with Alibaba Cloud Mirrors

# 基础镜像
FROM ubuntu:20.04

# 设置环境变量避免交互式安装
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai

# -------------------------------------------------------------------
# 更换为阿里巴巴APT镜像源并安装基础工具
# -------------------------------------------------------------------
RUN sed -i 's/archive.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list && \
    apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    openssh-client \
    sshpass \
    iputils-ping \
    net-tools \
    iproute2 \
    curl \
    vim \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# 设置时区
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# -------------------------------------------------------------------
# 使用阿里巴巴PIP镜像源安装Python依赖
# -------------------------------------------------------------------
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r /tmp/requirements.txt

# 安装ansible
RUN pip3 install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ ansible

# 创建工作目录
WORKDIR /app

# 复制项目文件
COPY . /app/

# 创建ansible配置目录
RUN mkdir -p /etc/ansible

# 设置ansible配置
RUN echo "[defaults]" > /etc/ansible/ansible.cfg && \
    echo "host_key_checking = False" >> /etc/ansible/ansible.cfg && \
    echo "timeout = 30" >> /etc/ansible/ansible.cfg

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["python3", "backend/app.py"]