/**
 * Клиентское приложение для сервиса прогноза погоды
 */

class WeatherApp {
  constructor() {
    this.chart = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadCacheStats();
    
    // Обновляем статистику кэша каждые 30 секунд
    setInterval(() => this.loadCacheStats(), 30000);
  }

  setupEventListeners() {
    // Форма поиска
    document.getElementById('searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const city = document.getElementById('cityInput').value.trim();
      if (city) {
        this.searchWeather(city);
      }
    });

    // Кнопки популярных городов
    document.querySelectorAll('.city-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const city = e.target.dataset.city;
        document.getElementById('cityInput').value = city;
        this.searchWeather(city);
      });
    });
  }

  async searchWeather(city) {
    this.showLoading();
    this.hideError();
    this.hideWeatherResult();

    try {
      const response = await fetch(`/weather?city=${encodeURIComponent(city)}`);
      const data = await response.json();

      if (data.error) {
        this.showError(data.error);
        return;
      }

      this.displayWeather(data);
      this.loadCacheStats();
    } catch (error) {
      this.showError('Ошибка соединения с сервером');
      console.error('Error:', error);
    } finally {
      this.hideLoading();
    }
  }

  displayWeather(data) {
    // Информация о городе
    document.getElementById('cityName').textContent = 
      `${data.city}${data.country ? ', ' + data.country : ''}`;
    
    document.getElementById('coordinates').textContent = 
      `${data.coordinates.latitude.toFixed(2)}°N, ${data.coordinates.longitude.toFixed(2)}°E`;

    // Статус кэша
    const cacheStatus = document.getElementById('cacheStatus');
    if (data.cached) {
      cacheStatus.textContent = '✅ Данные из кэша';
      cacheStatus.className = 'cache-badge cached';
    } else {
      cacheStatus.textContent = '🆕 Свежие данные';
      cacheStatus.className = 'cache-badge fresh';
    }

    // Статистика температуры
    const temperatures = data.hourly.temperature;
    const current = temperatures[0];
    const max = Math.max(...temperatures);
    const min = Math.min(...temperatures);
    const avg = (temperatures.reduce((a, b) => a + b, 0) / temperatures.length).toFixed(1);

    document.getElementById('currentTemp').textContent = `${current}°C`;
    document.getElementById('maxTemp').textContent = `${max}°C`;
    document.getElementById('minTemp').textContent = `${min}°C`;
    document.getElementById('avgTemp').textContent = `${avg}°C`;

    // График
    this.renderChart(data.hourly.time, data.hourly.temperature);

    // Почасовой прогноз
    this.renderHourlyForecast(data.hourly.time, data.hourly.temperature);

    // Показываем результат
    this.showWeatherResult();
  }

  renderChart(times, temperatures) {
    const ctx = document.getElementById('temperatureChart').getContext('2d');

    // Уничтожаем предыдущий график, если он существует
    if (this.chart) {
      this.chart.destroy();
    }

    // Форматируем метки времени
    const labels = times.map(time => {
      const date = new Date(time);
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    });

    // Создаем градиент
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(52, 152, 219, 0.5)');
    gradient.addColorStop(1, 'rgba(52, 152, 219, 0.05)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Температура (°C)',
          data: temperatures,
          borderColor: '#3498db',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3498db',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 14,
                weight: 'bold'
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              label: function(context) {
                return `Температура: ${context.parsed.y}°C`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              font: {
                size: 11
              }
            }
          },
          y: {
            beginAtZero: false,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              callback: function(value) {
                return value + '°C';
              },
              font: {
                size: 12
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  renderHourlyForecast(times, temperatures) {
    const container = document.getElementById('hourlyList');
    
    const html = times.slice(0, 12).map((time, index) => {
      const date = new Date(time);
      const timeStr = date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const temp = temperatures[index];

      return `
        <div class="hourly-item">
          <div class="hourly-time">${timeStr}</div>
          <div class="hourly-temp">${temp}°C</div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  async loadCacheStats() {
    try {
      const response = await fetch('/api/cache-stats');
      const stats = await response.json();
      this.displayCacheStats(stats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  }

  displayCacheStats(stats) {
    const container = document.getElementById('cacheStats');
    
    container.innerHTML = `
      <div class="cache-stat">
        <div class="cache-stat-value">${stats.size}</div>
        <div class="cache-stat-label">Записей в кэше</div>
      </div>
      <div class="cache-stat">
        <div class="cache-stat-value">${stats.hits}</div>
        <div class="cache-stat-label">Попаданий (Hits)</div>
      </div>
      <div class="cache-stat">
        <div class="cache-stat-value">${stats.misses}</div>
        <div class="cache-stat-label">Промахов (Misses)</div>
      </div>
      <div class="cache-stat">
        <div class="cache-stat-value">${stats.hitRate}</div>
        <div class="cache-stat-label">Hit Rate</div>
      </div>
      <div class="cache-stat">
        <div class="cache-stat-value">${stats.ttl} мин</div>
        <div class="cache-stat-label">Время жизни (TTL)</div>
      </div>
    `;
  }

  showLoading() {
    document.getElementById('loadingIndicator').style.display = 'block';
  }

  hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
  }

  showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  hideError() {
    document.getElementById('errorMessage').style.display = 'none';
  }

  showWeatherResult() {
    document.getElementById('weatherResult').style.display = 'block';
  }

  hideWeatherResult() {
    document.getElementById('weatherResult').style.display = 'none';
  }
}

// Инициализация приложения
const app = new WeatherApp();


