/**
 * Клиентское приложение для сервиса обмена файлами
 */

class FileShareApp {
  constructor() {
    this.token = localStorage.getItem('token');
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkAuth();
  }

  setupEventListeners() {
    // Табы авторизации
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Формы авторизации
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    // Выход
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Загрузка файла
    document.getElementById('fileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('fileName').textContent = file.name;
      }
    });

    document.getElementById('uploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload();
    });
  }

  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
  }

  checkAuth() {
    if (this.token) {
      this.showAuthenticatedView();
      this.loadUserFiles();
    } else {
      this.showUnauthenticatedView();
    }
  }

  showAuthenticatedView() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
    document.getElementById('statsSection').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'block';
  }

  showUnauthenticatedView() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('statsSection').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
  }

  async handleRegister() {
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const messageEl = document.getElementById('authMessage');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        this.showMessage(messageEl, 'Регистрация успешна! Теперь войдите.', 'success');
        setTimeout(() => {
          this.switchTab('login');
          document.getElementById('registerForm').reset();
        }, 1500);
      } else {
        this.showMessage(messageEl, data.error || 'Ошибка регистрации', 'error');
      }
    } catch (error) {
      this.showMessage(messageEl, 'Ошибка соединения', 'error');
    }
  }

  async handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const messageEl = document.getElementById('authMessage');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        this.token = data.token;
        localStorage.setItem('token', this.token);
        document.getElementById('username').textContent = username;
        this.showMessage(messageEl, 'Вход выполнен!', 'success');
        setTimeout(() => {
          this.showAuthenticatedView();
          this.loadUserFiles();
          document.getElementById('loginForm').reset();
        }, 1000);
      } else {
        this.showMessage(messageEl, data.error || 'Ошибка входа', 'error');
      }
    } catch (error) {
      this.showMessage(messageEl, 'Ошибка соединения', 'error');
    }
  }

  handleLogout() {
    this.token = null;
    localStorage.removeItem('token');
    document.getElementById('username').textContent = '';
    this.showUnauthenticatedView();
  }

  async handleUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
      alert('Выберите файл');
      return;
    }

    const progressBar = document.getElementById('uploadProgress');
    const resultEl = document.getElementById('uploadResult');

    progressBar.style.display = 'block';
    resultEl.innerHTML = '';

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: formData,
      });

      const data = await response.json();

      progressBar.style.display = 'none';

      if (data.success) {
        this.showUploadResult(resultEl, data);
        fileInput.value = '';
        document.getElementById('fileName').textContent = 'Выберите файл';
        this.loadUserFiles();
      } else {
        this.showMessage(resultEl, data.error || 'Ошибка загрузки', 'error');
      }
    } catch (error) {
      progressBar.style.display = 'none';
      this.showMessage(resultEl, 'Ошибка соединения', 'error');
    }
  }

  showUploadResult(element, data) {
    element.innerHTML = `
      <div class="download-link">
        <h3>✅ Файл успешно загружен!</h3>
        <p><strong>Имя файла:</strong> ${data.filename}</p>
        <p><strong>Размер:</strong> ${this.formatBytes(data.size)}</p>
        <div class="link-box">
          <input type="text" value="${data.downloadUrl}" readonly id="downloadUrl">
          <button onclick="app.copyLink()">Копировать</button>
        </div>
      </div>
    `;
  }

  copyLink() {
    const input = document.getElementById('downloadUrl');
    input.select();
    document.execCommand('copy');
    alert('Ссылка скопирована!');
  }

  async loadUserFiles() {
    try {
      const [filesResponse, statsResponse] = await Promise.all([
        fetch('/api/files', {
          headers: { 'Authorization': `Bearer ${this.token}` },
        }),
        fetch('/api/stats', {
          headers: { 'Authorization': `Bearer ${this.token}` },
        }),
      ]);

      const filesData = await filesResponse.json();
      const statsData = await statsResponse.json();

      this.displayUserFiles(filesData.files);
      this.displayStats(statsData);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }

  displayUserFiles(files) {
    const filesListEl = document.getElementById('filesList');

    if (!files || files.length === 0) {
      filesListEl.innerHTML = '<p style="color: #999;">Вы еще не загрузили ни одного файла</p>';
      return;
    }

    filesListEl.innerHTML = files.map(file => `
      <div class="file-item">
        <h4>📄 ${file.filename}</h4>
        <div class="file-meta">
          <span>📦 ${this.formatBytes(file.size)}</span>
          <span>📅 ${new Date(file.uploadDate).toLocaleDateString('ru-RU')}</span>
          <span>⬇️ ${file.downloadCount} скачиваний</span>
        </div>
      </div>
    `).join('');
  }

  displayStats(stats) {
    const statsEl = document.getElementById('overallStats');
    
    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.totalFiles}</div>
        <div class="stat-label">Всего файлов</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${this.formatBytes(stats.totalSize)}</div>
        <div class="stat-label">Общий размер</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalDownloads}</div>
        <div class="stat-label">Всего скачиваний</div>
      </div>
    `;
  }

  showMessage(element, text, type) {
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = 'block';

    setTimeout(() => {
      element.style.display = 'none';
    }, 5000);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Инициализация приложения
const app = new FileShareApp();


