// 全局变量
let authToken = null;
let cpuChart = null;
let memoryChart = null;
let refreshInterval = null;
let currentHostData = null;

// DOM元素
const loginModal = document.getElementById('loginModal');
const mainContent = document.getElementById('mainContent');
const addHostModal = document.getElementById('addHostModal');
const editHostModal = document.getElementById('editHostModal');
const hostDetailModal = document.getElementById('hostDetailModal');
const uploadModal = document.getElementById('uploadModal');
const shutdownModal = document.getElementById('shutdownModal');
const loadingIndicator = document.getElementById('loadingIndicator');
const notification = document.getElementById('notification');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
});

function initializeApp() {
    // 总是先显示登录界面
    showLoginModal();
    
    // 检查是否有保存的token并验证其有效性
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        validateToken(savedToken);
    }
}

async function validateToken(token) {
    try {
        const response = await fetch('/api/hosts', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            // Token有效，自动登录
            authToken = token;
            hideLoginModal();
            showMainContent();
            loadDashboardData();
        } else {
            // Token无效，清除并显示登录界面
            localStorage.removeItem('authToken');
            showLoginModal();
        }
    } catch (error) {
        console.error('Token验证失败:', error);
        localStorage.removeItem('authToken');
        showLoginModal();
    }
}

function setupEventListeners() {
    // 登录表单
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // 登出按钮
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // 控制按钮
    document.getElementById('pingBtn').addEventListener('click', () => performPing());
    document.getElementById('resourceBtn').addEventListener('click', () => loadResourceData());
    document.getElementById('networkBtn').addEventListener('click', () => loadNetworkData());
    document.getElementById('uploadBtn').addEventListener('click', () => showUploadModal());
    document.getElementById('shutdownBtn').addEventListener('click', () => showShutdownModal());
    document.getElementById('addHostBtn').addEventListener('click', () => showAddHostModal());
    document.getElementById('refreshBtn').addEventListener('click', () => loadDashboardData());
    
    // 主机管理表单
    document.getElementById('addHostForm').addEventListener('submit', handleAddHost);
    document.getElementById('editHostForm').addEventListener('submit', handleEditHost);
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
    document.getElementById('shutdownForm').addEventListener('submit', handleShutdown);
    
    // 详情页面的按钮
    document.getElementById('editFromDetailBtn').addEventListener('click', editFromDetail);
    document.getElementById('uploadToHostBtn').addEventListener('click', uploadToHost);
    document.getElementById('shutdownHostBtn').addEventListener('click', shutdownHost);
    document.getElementById('deleteFromDetailBtn').addEventListener('click', deleteFromDetail);
    
    // 关机功能按钮
    document.getElementById('cancelShutdownBtn').addEventListener('click', cancelShutdown);
    
    // 模态框关闭按钮
    document.querySelector('#addHostModal .close').addEventListener('click', () => hideAddHostModal());
    document.querySelector('#editHostModal .close').addEventListener('click', () => hideEditHostModal());
    document.querySelector('#hostDetailModal .close').addEventListener('click', () => hideHostDetailModal());
    document.querySelector('#uploadModal .close').addEventListener('click', () => hideUploadModal());
    document.querySelector('#shutdownModal .close').addEventListener('click', () => hideShutdownModal());
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (event.target === addHostModal) {
            hideAddHostModal();
        } else if (event.target === editHostModal) {
            hideEditHostModal();
        } else if (event.target === hostDetailModal) {
            hideHostDetailModal();
        } else if (event.target === uploadModal) {
            hideUploadModal();
        } else if (event.target === shutdownModal) {
            hideShutdownModal();
        }
    });
    
    // 文件上传拖拽功能
    setupFileUploadDragDrop();
}

function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('currentTime').textContent = timeString;
}

// 认证相关函数
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        showLoading();
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            hideLoginModal();
            showMainContent();
            loadDashboardData();
            showNotification('登录成功', 'success');
        } else {
            document.getElementById('loginError').textContent = data.message || '登录失败';
        }
    } catch (error) {
        console.error('登录错误:', error);
        document.getElementById('loginError').textContent = '网络错误，请重试';
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        if (authToken) {
            await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
        }
    } catch (error) {
        console.error('登出错误:', error);
    }
    
    authToken = null;
    localStorage.removeItem('authToken');
    showLoginModal();
    hideMainContent();
    showNotification('已登出', 'info');
}

// UI控制函数
function showLoginModal() {
    loginModal.style.display = 'flex';
    // 延迟focus，确保模态框已显示
    setTimeout(() => {
        document.getElementById('username').focus();
    }, 100);
}

function hideLoginModal() {
    loginModal.style.display = 'none';
    document.getElementById('loginError').textContent = '';
}

function showMainContent() {
    mainContent.style.display = 'block';
}

function hideMainContent() {
    mainContent.style.display = 'none';
}

function showAddHostModal() {
    // 检查认证状态
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        showLoginModal();
        return;
    }
    
    addHostModal.style.display = 'flex';
    document.getElementById('hostIp').focus();
}

function hideAddHostModal() {
    addHostModal.style.display = 'none';
    document.getElementById('addHostForm').reset();
}

function showEditHostModal(hostData) {
    document.getElementById('editHostIp').value = hostData.ip;
    document.getElementById('editHostIpDisplay').value = hostData.ip;
    document.getElementById('editHostUsername').value = hostData.username || 'root';
    document.getElementById('editHostGroup').value = hostData.group || 'managed_hosts';
    document.getElementById('editHostDescription').value = hostData.description || '';
    document.getElementById('editHostPassword').value = ''; // 总是清空密码字段
    
    editHostModal.style.display = 'flex';
    document.getElementById('editHostUsername').focus();
}

function hideEditHostModal() {
    editHostModal.style.display = 'none';
    document.getElementById('editHostForm').reset();
}

function showHostDetailModal(hostData) {
    document.getElementById('detailHostIp').textContent = hostData.ip;
    document.getElementById('detailHostUsername').textContent = hostData.username || 'root';
    document.getElementById('detailHostGroup').textContent = hostData.group || '未分组';
    document.getElementById('detailHostDescription').textContent = hostData.description || '无描述';
    document.getElementById('detailHostPassword').textContent = hostData.has_password ? '已配置' : '未配置';
    
    // 初始状态显示
    const statusElement = document.getElementById('detailHostStatus');
    statusElement.innerHTML = '<span class="status-checking">检测中...</span>';
    
    // 保存当前主机数据到模态框，供后续编辑和删除使用
    hostDetailModal.dataset.hostData = JSON.stringify(hostData);
    
    hostDetailModal.style.display = 'flex';
    
    // 开始动态检测连接状态
    startHostStatusCheck(hostData.ip);
}

function hideHostDetailModal() {
    hostDetailModal.style.display = 'none';
    // 停止状态检测
    stopHostStatusCheck();
}

// 主机状态检测相关变量
let statusCheckInterval = null;
let currentCheckingHost = null;

function startHostStatusCheck(hostIp) {
    // 停止之前的检测
    stopHostStatusCheck();
    
    currentCheckingHost = hostIp;
    
    // 立即执行一次检测
    checkHostStatus(hostIp);
    
    // 设置定时检测（每5秒检测一次）
    statusCheckInterval = setInterval(() => {
        if (hostDetailModal.style.display === 'flex' && currentCheckingHost === hostIp) {
            checkHostStatus(hostIp);
        } else {
            stopHostStatusCheck();
        }
    }, 5000);
}

function stopHostStatusCheck() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    currentCheckingHost = null;
}

async function checkHostStatus(hostIp) {
    const statusElement = document.getElementById('detailHostStatus');
    
    try {
        // 使用单主机ping检测API
        const response = await fetch(`/api/ping/host/${hostIp}`);
        const data = await response.json();
        
        if (data.success) {
            updateHostStatusDisplay(data.status, data.raw_status, data.response_time, data.timestamp);
        } else {
            updateHostStatusDisplay('error', 'API_ERROR');
        }
    } catch (error) {
        console.error('检测主机状态失败:', error);
        updateHostStatusDisplay('error', 'NETWORK_ERROR');
    }
}

function updateHostStatusDisplay(status, rawStatus, responseTime, timestamp) {
    const statusElement = document.getElementById('detailHostStatus');
    const displayTime = timestamp ? new Date(timestamp).toLocaleTimeString('zh-CN') : new Date().toLocaleTimeString('zh-CN');
    
    let statusClass = '';
    let statusText = '';
    let statusIcon = '';
    
    switch (status) {
        case 'online':
            statusClass = 'status-online';
            statusText = '在线';
            statusIcon = 'fas fa-check-circle';
            break;
        case 'offline':
            statusClass = 'status-offline';
            statusText = '离线';
            statusIcon = 'fas fa-times-circle';
            break;
        case 'unknown':
            statusClass = 'status-unknown';
            statusText = '未知';
            statusIcon = 'fas fa-question-circle';
            break;
        case 'error':
            statusClass = 'status-error';
            statusText = '检测失败';
            statusIcon = 'fas fa-exclamation-circle';
            break;
        default:
            statusClass = 'status-unknown';
            statusText = '未知';
            statusIcon = 'fas fa-question-circle';
    }
    
    // 构建状态显示内容（适配新的info-card布局）
    let statusContent = `
        <div class="status-badge-new ${statusClass}">
            <i class="${statusIcon}"></i>
            <span>${statusText}</span>
        </div>
    `;
    
    // 添加详细信息作为提示
    if (responseTime !== undefined) {
        statusContent += `<div class="status-detail">响应: ${responseTime}ms</div>`;
    }
    
    statusContent += `<div class="status-detail">检测: ${displayTime}</div>`;
    
    if (rawStatus) {
        statusContent += `<div class="status-detail">状态: ${rawStatus}</div>`;
    }
    
    statusElement.innerHTML = statusContent;
}

// 手动刷新主机状态
function refreshHostStatus() {
    if (currentCheckingHost) {
        const statusElement = document.getElementById('detailHostStatus');
        statusElement.innerHTML = '<span class="status-checking">检测中...</span>';
        checkHostStatus(currentCheckingHost);
    }
}

function showLoading() {
    loadingIndicator.style.display = 'flex';
}

function hideLoading() {
    loadingIndicator.style.display = 'none';
}

function showNotification(message, type = 'info') {
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// 数据加载函数
async function loadDashboardData() {
    try {
        showLoading();
        await loadHostsList();
        await performPing();
    } catch (error) {
        console.error('加载数据错误:', error);
        showNotification('加载数据失败', 'error');
    } finally {
        hideLoading();
    }
}

async function loadHostsList() {
    try {
        const response = await fetch('/api/hosts');
        const data = await response.json();
        
        if (data.success && data.hosts) {
            updateStatsCards(data.hosts.length, 0, 0, 0);
            updateHostsTableWithDetails(data.hosts);
        }
    } catch (error) {
        console.error('获取主机列表错误:', error);
    }
}

async function performPing() {
    try {
        const response = await fetch('/api/ping');
        const data = await response.json();
        
        if (data.success) {
            updateHostsTable(data.hosts);
            updateStatsFromPing(data.hosts);
            showNotification('连通性检测完成', 'success');
        } else {
            showNotification('连通性检测失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Ping错误:', error);
        showNotification('连通性检测失败', 'error');
    }
}

async function loadResourceData(silent = false) {
    try {
        if (!silent) {
            showLoading();
        }
        const response = await fetch('/api/resources');
        const data = await response.json();
        
        if (data.success) {
            updateResourceData(data.resources);
            updateCharts(data.resources);
            
            if (!silent) {
                showNotification('资源数据更新完成', 'success');
            }
        } else {
            if (!silent) {
                showNotification('获取资源数据失败: ' + data.error, 'error');
            }
            // 即使失败也尝试显示已有数据
            if (data.resources && data.resources.length > 0) {
                updateResourceData(data.resources);
            }
        }
    } catch (error) {
        console.error('获取资源数据错误:', error);
        if (!silent) {
            showNotification('获取资源数据失败: 网络错误', 'error');
        }
    } finally {
        if (!silent) {
            hideLoading();
        }
    }
}

async function loadNetworkData() {
    try {
        showLoading();
        const response = await fetch('/api/network');
        const data = await response.json();
        
        if (data.success) {
            console.log('网络信息:', data.network);
            showNotification('网络信息获取完成', 'success');
        } else {
            showNotification('获取网络信息失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('获取网络信息错误:', error);
        showNotification('获取网络信息失败', 'error');
    } finally {
        hideLoading();
    }
}

// 主机管理函数
async function handleAddHost(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const hostData = {
        host_ip: formData.get('hostIp'),
        username: formData.get('hostUsername'),
        password: formData.get('hostPassword'),
        group: formData.get('hostGroup'),
        description: formData.get('hostDescription')
    };
    
    try {
        showLoading();
        const response = await fetch('/api/hosts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(hostData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            hideAddHostModal();
            loadDashboardData();
            showNotification('主机添加成功', 'success');
        } else {
            showNotification('添加主机失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('添加主机错误:', error);
        showNotification('添加主机失败', 'error');
    } finally {
        hideLoading();
    }
}

async function handleEditHost(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const hostIp = formData.get('editHostIp');
    const hostData = {
        username: formData.get('editHostUsername'),
        group: formData.get('editHostGroup'),
        description: formData.get('editHostDescription')
    };
    
    // 只有填写了密码才包含密码字段
    const password = formData.get('editHostPassword');
    if (password && password.trim()) {
        hostData.password = password;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/hosts/${hostIp}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(hostData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            hideEditHostModal();
            loadDashboardData();
            showNotification('主机更新成功', 'success');
        } else {
            showNotification('更新主机失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('更新主机错误:', error);
        showNotification('更新主机失败', 'error');
    } finally {
        hideLoading();
    }
}

async function getHostDetail(hostIp) {
    try {
        const response = await fetch(`/api/hosts/${hostIp}`);
        const data = await response.json();
        
        if (data.success) {
            return data.host;
        } else {
            showNotification('获取主机详情失败: ' + data.error, 'error');
            return null;
        }
    } catch (error) {
        console.error('获取主机详情错误:', error);
        showNotification('获取主机详情失败', 'error');
        return null;
    }
}

function editFromDetail() {
    // 检查认证状态
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        hideHostDetailModal();
        showLoginModal();
        return;
    }
    
    const hostData = JSON.parse(hostDetailModal.dataset.hostData);
    hideHostDetailModal();
    showEditHostModal(hostData);
}

async function deleteFromDetail() {
    const hostData = JSON.parse(hostDetailModal.dataset.hostData);
    hideHostDetailModal();
    await deleteHost(hostData.ip);
}

async function deleteHost(hostIp) {
    // 检查认证状态
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        showLoginModal();
        return;
    }
    
    if (!confirm(`确定要删除主机 ${hostIp} 吗？`)) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/hosts/${hostIp}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            loadDashboardData();
            showNotification('主机删除成功', 'success');
        } else {
            showNotification('删除主机失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('删除主机错误:', error);
        showNotification('删除主机失败', 'error');
    } finally {
        hideLoading();
    }
}

// UI更新函数
function updateStatsCards(total, online, offline, warning) {
    document.getElementById('totalHosts').textContent = total;
    document.getElementById('onlineHosts').textContent = online;
    document.getElementById('offlineHosts').textContent = offline;
    document.getElementById('warningHosts').textContent = warning;
}

function updateStatsFromPing(hosts) {
    const online = hosts.filter(h => h.status === 'online').length;
    const offline = hosts.filter(h => h.status === 'offline').length;
    const total = hosts.length;
    
    updateStatsCards(total, online, offline, 0);
}

function updateHostsTable(hosts) {
    const tbody = document.getElementById('hostsTableBody');
    tbody.innerHTML = '';
    
    hosts.forEach(host => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${host.host}</td>
            <td>
                <span class="status-badge ${host.status === 'online' ? 'status-online' : 'status-offline'}">
                    ${host.status === 'online' ? '在线' : '离线'}
                </span>
            </td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>
                <div class="action-buttons">
                    <button class="detail-btn" onclick="showHostDetailFromTable('${host.host}')">
                        <i class="fas fa-info-circle"></i> 详情
                    </button>
                    <button class="edit-btn" onclick="editHostFromTable('${host.host}')">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="delete-btn" onclick="deleteHost('${host.host}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateHostsTableWithDetails(hosts) {
    const tbody = document.getElementById('hostsTableBody');
    tbody.innerHTML = '';
    
    hosts.forEach(host => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${host.ip}</td>
            <td>
                <span class="status-badge status-offline">离线</span>
            </td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>
                <div class="action-buttons">
                    <button class="detail-btn" onclick="showHostDetailFromTableWithData('${encodeURIComponent(JSON.stringify(host))}')">
                        <i class="fas fa-info-circle"></i> 详情
                    </button>
                    <button class="edit-btn" onclick="editHostFromTableWithData('${encodeURIComponent(JSON.stringify(host))}')">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="delete-btn" onclick="deleteHost('${host.ip}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 从表格操作的辅助函数
async function showHostDetailFromTable(hostIp) {
    const hostDetail = await getHostDetail(hostIp);
    if (hostDetail) {
        showHostDetailModal(hostDetail);
    }
}

function showHostDetailFromTableWithData(encodedHostData) {
    const hostData = JSON.parse(decodeURIComponent(encodedHostData));
    showHostDetailModal(hostData);
}

async function editHostFromTable(hostIp) {
    // 检查认证状态
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        showLoginModal();
        return;
    }
    
    const hostDetail = await getHostDetail(hostIp);
    if (hostDetail) {
        showEditHostModal(hostDetail);
    }
}

function editHostFromTableWithData(encodedHostData) {
    const hostData = JSON.parse(decodeURIComponent(encodedHostData));
    showEditHostModal(hostData);
}

function updateResourceData(resources) {
    const tbody = document.getElementById('hostsTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    resources.forEach(resource => {
        const row = Array.from(rows).find(r => 
            r.cells[0].textContent === resource.host
        );
        
        if (row) {
            // 更新状态列
            const statusCell = row.cells[1];
            statusCell.innerHTML = `
                <span class="status-badge status-online">在线</span>
            `;
            
            // 更新资源信息
            row.cells[2].innerHTML = createUsageBar(resource.cpu || 'N/A');
            row.cells[3].innerHTML = createUsageBar(resource.memory || 'N/A');
            row.cells[4].innerHTML = createUsageBar(resource.disk || 'N/A');
            row.cells[5].textContent = resource.load || 'N/A';
        }
    });
}

function createUsageBar(value) {
    if (value === 'N/A' || isNaN(parseFloat(value))) {
        return 'N/A';
    }
    
    const numValue = parseFloat(value);
    let colorClass = 'usage-low';
    
    if (numValue > 80) {
        colorClass = 'usage-high';
    } else if (numValue > 60) {
        colorClass = 'usage-medium';
    }
    
    return `
        <div class="usage-bar">
            <div class="usage-fill ${colorClass}" style="width: ${numValue}%"></div>
        </div>
        <span style="font-size: 12px; margin-left: 5px;">${numValue}%</span>
    `;
}

// 图表函数
function updateCharts(resources) {
    updateCpuChart(resources);
    updateMemoryChart(resources);
}

function updateCpuChart(resources) {
    const ctx = document.getElementById('cpuChart').getContext('2d');
    
    if (cpuChart) {
        cpuChart.destroy();
    }
    
    const labels = resources.map(r => r.host);
    const data = resources.map(r => parseFloat(r.cpu) || 0);
    
    cpuChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'CPU使用率 (%)',
                data: data,
                backgroundColor: data.map(value => {
                    if (value > 80) return 'rgba(231, 76, 60, 0.8)';
                    if (value > 60) return 'rgba(243, 156, 18, 0.8)';
                    return 'rgba(39, 174, 96, 0.8)';
                }),
                borderColor: data.map(value => {
                    if (value > 80) return 'rgba(231, 76, 60, 1)';
                    if (value > 60) return 'rgba(243, 156, 18, 1)';
                    return 'rgba(39, 174, 96, 1)';
                }),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

function updateMemoryChart(resources) {
    const ctx = document.getElementById('memoryChart').getContext('2d');
    
    if (memoryChart) {
        memoryChart.destroy();
    }
    
    const labels = resources.map(r => r.host);
    const data = resources.map(r => parseFloat(r.memory) || 0);
    
    memoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: '内存使用率',
                data: data,
                backgroundColor: [
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(155, 89, 182, 0.8)',
                    'rgba(39, 174, 96, 0.8)',
                    'rgba(243, 156, 18, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ],
                borderColor: [
                    'rgba(52, 152, 219, 1)',
                    'rgba(155, 89, 182, 1)',
                    'rgba(39, 174, 96, 1)',
                    'rgba(243, 156, 18, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff'
                    }
                }
            }
        }
    });
}

// 自动刷新
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
        if (authToken) {
            loadResourceData(true);
        }
    }, 30000); // 30秒刷新一次
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// 新功能实现

// 显示/隐藏上传模态框
function showUploadModal() {
    // 检查认证状态
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        showLoginModal();
        return;
    }
    
    loadHostsForSelect('uploadHosts');
    uploadModal.style.display = 'flex';
}

function hideUploadModal() {
    uploadModal.style.display = 'none';
    document.getElementById('uploadForm').reset();
    hideUploadProgress();
}

// 显示/隐藏关机模态框
function showShutdownModal() {
    // 检查认证状态
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        showLoginModal();
        return;
    }
    
    loadHostsForSelect('shutdownHosts');
    shutdownModal.style.display = 'flex';
}

function hideShutdownModal() {
    shutdownModal.style.display = 'none';
    document.getElementById('shutdownForm').reset();
}

// 主机详情页面的新功能
function uploadToHost() {
    // 检查认证状态
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        hideHostDetailModal();
        showLoginModal();
        return;
    }
    
    const hostData = JSON.parse(hostDetailModal.dataset.hostData);
    hideHostDetailModal();
    showUploadModal();
    // 预选当前主机
    const select = document.getElementById('uploadHosts');
    for (let option of select.options) {
        option.selected = option.value === hostData.ip;
    }
}

function shutdownHost() {
    // 检查认证状态
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        hideHostDetailModal();
        showLoginModal();
        return;
    }
    
    const hostData = JSON.parse(hostDetailModal.dataset.hostData);
    hideHostDetailModal();
    showShutdownModal();
    // 预选当前主机
    const select = document.getElementById('shutdownHosts');
    for (let option of select.options) {
        option.selected = option.value === hostData.ip;
    }
}

// 加载主机列表到选择框
async function loadHostsForSelect(selectId) {
    try {
        const response = await fetch('/api/hosts');
        const data = await response.json();
        
        const select = document.getElementById(selectId);
        // 清空现有选项但保留"所有主机"
        select.innerHTML = '<option value="all">所有主机</option>';
        
        if (data.success && data.hosts) {
            data.hosts.forEach(host => {
                const option = document.createElement('option');
                option.value = host.ip;
                option.textContent = `${host.ip} (${host.group})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('加载主机列表失败:', error);
    }
}

// 文件上传处理
async function handleUpload(event) {
    event.preventDefault();
    
    // 双重检查认证状态
    if (!authToken) {
        showNotification('认证失效，请重新登录', 'error');
        hideUploadModal();
        showLoginModal();
        return;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    
    // 检查文件是否选择
    const fileInput = document.getElementById('uploadFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        showNotification('请选择要上传的文件', 'error');
        return;
    }
    
    // 获取选中的主机
    const hostSelect = document.getElementById('uploadHosts');
    const selectedHosts = Array.from(hostSelect.selectedOptions).map(option => option.value);
    
    if (selectedHosts.length === 0) {
        showNotification('请选择目标主机', 'error');
        return;
    }
    
    // 如果选择了"所有主机"则使用"all"
    const hostsValue = selectedHosts.includes('all') ? 'all' : selectedHosts.join(',');
    formData.set('hosts', hostsValue);
    
    try {
        showUploadProgress();
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showUploadSuccess();
            setTimeout(() => {
                hideUploadModal();
                showNotification('文件上传成功', 'success');
            }, 2000);
        } else {
            hideUploadProgress();
            // 处理认证错误
            if (response.status === 401 || response.status === 403) {
                showNotification('认证失效，请重新登录', 'error');
                authToken = null;
                localStorage.removeItem('authToken');
                hideUploadModal();
                showLoginModal();
            } else {
                showNotification('文件上传失败: ' + (data.error || '未知错误'), 'error');
            }
        }
    } catch (error) {
        hideUploadProgress();
        console.error('文件上传错误:', error);
        showNotification('文件上传失败: 网络连接错误', 'error');
    }
}

// 远程关机处理
async function handleShutdown(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const hostSelect = document.getElementById('shutdownHosts');
    const selectedHosts = Array.from(hostSelect.selectedOptions).map(option => option.value);
    
    if (selectedHosts.length === 0) {
        showNotification('请选择目标主机', 'error');
        return;
    }
    
    // 确认对话框
    const hostsText = selectedHosts.includes('all') ? '所有主机' : selectedHosts.join(', ');
    if (!confirm(`确定要关闭 ${hostsText} 吗？此操作不可撤销！`)) {
        return;
    }
    
    const hostsValue = selectedHosts.includes('all') ? 'all' : selectedHosts.join(',');
    
    const shutdownData = {
        hosts: hostsValue,
        delay: parseInt(formData.get('delay')),
        force: formData.get('force') === 'on'
    };
    
    try {
        showLoading();
        
        const response = await fetch('/api/shutdown', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(shutdownData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            hideShutdownModal();
            showNotification(data.message, 'success');
            
            // 启动关机后状态监控
            startShutdownStatusMonitoring(hostsValue, shutdownData.delay);
        } else {
            showNotification('关机失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('关机错误:', error);
        showNotification('关机失败: 网络错误', 'error');
    } finally {
        hideLoading();
    }
}

// 取消关机
async function cancelShutdown() {
    const hostSelect = document.getElementById('shutdownHosts');
    const selectedHosts = Array.from(hostSelect.selectedOptions).map(option => option.value);
    
    if (selectedHosts.length === 0) {
        showNotification('请选择目标主机', 'error');
        return;
    }
    
    const hostsValue = selectedHosts.includes('all') ? 'all' : selectedHosts.join(',');
    
    try {
        showLoading();
        
        const response = await fetch('/api/cancel-shutdown', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ hosts: hostsValue })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            // 停止关机监控
            stopShutdownMonitoring();
        } else {
            showNotification('取消关机失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('取消关机错误:', error);
        showNotification('取消关机失败: 网络错误', 'error');
    } finally {
        hideLoading();
    }
}

// 上传进度显示
function showUploadProgress() {
    document.querySelector('.upload-progress').style.display = 'block';
    document.querySelector('.progress-fill').style.width = '0%';
    document.querySelector('.progress-text').textContent = '0%';
    
    // 模拟进度
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 95) progress = 95;
        
        document.querySelector('.progress-fill').style.width = progress + '%';
        document.querySelector('.progress-text').textContent = Math.round(progress) + '%';
        
        if (progress >= 95) {
            clearInterval(interval);
        }
    }, 200);
}

function hideUploadProgress() {
    document.querySelector('.upload-progress').style.display = 'none';
}

function showUploadSuccess() {
    document.querySelector('.progress-fill').style.width = '100%';
    document.querySelector('.progress-text').textContent = '100% - 上传完成!';
}

// 文件拖拽上传功能
function setupFileUploadDragDrop() {
    const uploadLabel = document.querySelector('.file-upload-label');
    const fileInput = document.getElementById('uploadFile');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, () => {
            uploadLabel.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, () => {
            uploadLabel.classList.remove('dragover');
        }, false);
    });
    
    uploadLabel.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            updateFileLabel(files[0]);
        }
    }, false);
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            updateFileLabel(e.target.files[0]);
        }
    });
    
    function updateFileLabel(file) {
        const span = uploadLabel.querySelector('span');
        span.textContent = `已选择: ${file.name} (${formatFileSize(file.size)})`;
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 通用认证检查函数
function checkAuthBeforeAction(action) {
    if (!authToken) {
        showNotification('请先登录系统', 'error');
        showLoginModal();
        return false;
    }
    return true;
}

// Token有效性检查
async function validateCurrentToken() {
    if (!authToken) {
        return false;
    }
    
    try {
        const response = await fetch('/api/hosts', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.status === 401 || response.status === 403) {
            // Token无效，清除并显示登录界面
            authToken = null;
            localStorage.removeItem('authToken');
            showNotification('登录已过期，请重新登录', 'warning');
            showLoginModal();
            hideMainContent();
            return false;
        }
        
        return response.ok;
    } catch (error) {
        console.error('Token验证失败:', error);
        return false;
    }
}

// 关机状态监控相关变量
let shutdownMonitoringInterval = null;
let shutdownMonitoringHosts = [];

// 启动关机后状态监控
function startShutdownStatusMonitoring(hostsValue, delayMinutes) {
    // 清除之前的监控
    if (shutdownMonitoringInterval) {
        clearInterval(shutdownMonitoringInterval);
    }
    
    // 解析主机列表
    if (hostsValue === 'all') {
        // 获取所有主机
        shutdownMonitoringHosts = Array.from(document.querySelectorAll('#hostsTableBody tr'))
            .map(row => row.cells[0].textContent);
    } else {
        shutdownMonitoringHosts = hostsValue.split(',');
    }
    
    // 计算开始监控的时间（延迟时间 + 30秒缓冲）
    const startDelay = (delayMinutes * 60 + 30) * 1000;
    
    showNotification(`将在 ${delayMinutes} 分钟后开始监控主机状态`, 'monitoring');
    
    // 立即标记要关机的主机
    markHostsAsShuttingDown(shutdownMonitoringHosts);
    
    // 延迟后开始监控
    setTimeout(() => {
        startActiveShutdownMonitoring();
    }, startDelay);
}

// 开始活跃的关机监控
function startActiveShutdownMonitoring() {
    let monitoringCount = 0;
    const maxMonitoringAttempts = 20; // 最多监控20次（约10分钟）
    
    showNotification('开始监控主机关机状态...', 'monitoring');
    
    shutdownMonitoringInterval = setInterval(async () => {
        monitoringCount++;
        
        // 检查所有目标主机状态
        await checkShutdownHostsStatus();
        
        // 达到最大监控次数后停止
        if (monitoringCount >= maxMonitoringAttempts) {
            stopShutdownMonitoring();
            showNotification('关机状态监控已完成，请手动检查剩余主机状态', 'monitoring');
        }
    }, 30000); // 每30秒检查一次
}

// 检查关机主机状态
async function checkShutdownHostsStatus() {
    let offlineCount = 0;
    let onlineCount = 0;
    
    for (const hostIp of shutdownMonitoringHosts) {
        try {
            const response = await fetch(`/api/ping/host/${hostIp}`);
            const data = await response.json();
            
            if (data.success) {
                // 更新主机表格状态
                updateHostTableStatus(hostIp, data.status);
                
                // 如果当前在这个主机的详情页面，更新详情状态
                if (hostDetailModal.style.display === 'flex') {
                    const currentHost = JSON.parse(hostDetailModal.dataset.hostData || '{}');
                    if (currentHost.ip === hostIp) {
                        updateHostStatusDisplay(data.status, data.raw_status, data.response_time, data.timestamp);
                    }
                }
                
                if (data.status === 'offline') {
                    offlineCount++;
                } else {
                    onlineCount++;
                }
            }
        } catch (error) {
            console.error(`检查主机 ${hostIp} 状态失败:`, error);
        }
    }
    
    // 更新统计
    if (offlineCount > 0 || onlineCount > 0) {
        showNotification(`状态更新: ${offlineCount} 台主机已关机, ${onlineCount} 台主机仍在线`, 'monitoring');
    }
    
    // 如果所有主机都已离线，停止监控
    if (offlineCount === shutdownMonitoringHosts.length) {
        stopShutdownMonitoring();
        showNotification(`所有 ${offlineCount} 台目标主机已成功关机`, 'shutdown-success');
    }
}

// 更新主机表格中的状态
function updateHostTableStatus(hostIp, status) {
    const tbody = document.getElementById('hostsTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    for (const row of rows) {
        if (row.cells[0].textContent === hostIp) {
            const statusCell = row.cells[1];
            const statusClass = status === 'online' ? 'status-online' : 'status-offline';
            const statusText = status === 'online' ? '在线' : '离线';
            
            statusCell.innerHTML = `
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
            `;
            
            // 添加视觉提示和清除监控标记
            if (status === 'offline') {
                // 移除监控标记，因为主机已成功关机
                row.classList.remove('status-monitoring');
                row.classList.remove('host-shutting-down');
                
                // 添加成功关机的视觉提示
                row.style.backgroundColor = 'rgba(39, 174, 96, 0.2)';
                row.style.borderLeft = '4px solid #27ae60';
                setTimeout(() => {
                    row.style.backgroundColor = '';
                    row.style.borderLeft = '';
                }, 5000);
            } else if (status === 'online') {
                // 如果主机仍在线，保持监控标记
                row.style.backgroundColor = 'rgba(243, 156, 18, 0.1)';
                setTimeout(() => {
                    row.style.backgroundColor = '';
                }, 3000);
            }
            break;
        }
    }
    
    // 更新统计信息
    updateStatsFromTable();
}

// 停止关机监控
function stopShutdownMonitoring() {
    if (shutdownMonitoringInterval) {
        clearInterval(shutdownMonitoringInterval);
        shutdownMonitoringInterval = null;
    }
    // 清除视觉标记
    clearShutdownMarks();
    shutdownMonitoringHosts = [];
}

// 标记主机为关机状态
function markHostsAsShuttingDown(hostIps) {
    const tbody = document.getElementById('hostsTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    for (const row of rows) {
        const hostIp = row.cells[0].textContent;
        if (hostIps.includes(hostIp)) {
            row.classList.add('host-shutting-down');
            row.classList.add('status-monitoring');
        }
    }
}

// 清除关机标记
function clearShutdownMarks() {
    const tbody = document.getElementById('hostsTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    for (const row of rows) {
        row.classList.remove('host-shutting-down');
        row.classList.remove('status-monitoring');
    }
}

// 更新统计信息
function updateStatsFromTable() {
    const tbody = document.getElementById('hostsTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    let totalHosts = rows.length;
    let onlineHosts = 0;
    let offlineHosts = 0;
    
    rows.forEach(row => {
        const statusBadge = row.cells[1].querySelector('.status-badge');
        if (statusBadge) {
            if (statusBadge.classList.contains('status-online')) {
                onlineHosts++;
            } else if (statusBadge.classList.contains('status-offline')) {
                offlineHosts++;
            }
        }
    });
    
    // 添加更新动画到统计卡片
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.classList.add('updating');
        setTimeout(() => {
            card.classList.remove('updating');
        }, 1000);
    });
    
    // 更新统计卡片
    updateStatsCards(totalHosts, onlineHosts, offlineHosts, 0);
}

// 定期检查token有效性
setInterval(validateCurrentToken, 5 * 60 * 1000); // 每5分钟检查一次

// 启动自动刷新
setTimeout(startAutoRefresh, 5000); 