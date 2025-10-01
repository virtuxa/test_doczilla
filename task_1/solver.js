export class LiquidSortingSolver {
  constructor(initialState) {
    this.initialState = initialState;
    this.tubeCapacity = initialState[0].length;
    this.numTubes = initialState.length;
  }

  /**
   * Создает копию состояния
   */
  cloneState(state) {
    return state.map(tube => [...tube]);
  }

  /**
   * Генерирует уникальный ключ для состояния
   */
  getStateKey(state) {
    return JSON.stringify(state);
  }

  /**
   * Проверяет, является ли состояние решением
   */
  isSolved(state) {
    for (const tube of state) {
      // Пропускаем пустые пробирки
      if (tube.length === 0) continue;
      
      // Пробирка должна быть либо пустой, либо полной и однородной
      if (tube.length !== this.tubeCapacity) return false;
      
      const firstColor = tube[0];
      if (!tube.every(color => color === firstColor)) return false;
    }
    return true;
  }

  /**
   * Получает верхний цвет и количество капель этого цвета в пробирке
   */
  getTopColor(tube) {
    if (tube.length === 0) return { color: null, count: 0 };
    
    const topColor = tube[tube.length - 1];
    let count = 0;
    
    for (let i = tube.length - 1; i >= 0; i--) {
      if (tube[i] === topColor) {
        count++;
      } else {
        break;
      }
    }
    
    return { color: topColor, count };
  }

  /**
   * Проверяет, является ли пробирка однородной (все капли одного цвета)
   */
  isUniform(tube) {
    if (tube.length === 0) return true;
    const firstColor = tube[0];
    return tube.every(color => color === firstColor);
  }

  /**
   * Проверяет, можно ли перелить жидкость из пробирки A в пробирку B
   */
  canPour(state, from, to) {
    if (from === to) return false;
    
    const fromTube = state[from];
    const toTube = state[to];
    
    // В исходной пробирке должна быть жидкость
    if (fromTube.length === 0) return false;
    
    // В целевой пробирке должно быть место
    if (toTube.length >= this.tubeCapacity) return false;
    
    // Получаем верхний цвет исходной пробирки
    const { color: fromColor } = this.getTopColor(fromTube);
    
    // Эвристика 1: Не переливаем из уже отсортированной полной пробирки
    if (fromTube.length === this.tubeCapacity && this.isUniform(fromTube)) {
      return false;
    }
    
    // Эвристика 2: Не переливаем в пустую пробирку, если исходная однородная (но не полная)
    if (toTube.length === 0 && this.isUniform(fromTube)) {
      return false;
    }
    
    // Если целевая пробирка пуста, можно переливать
    if (toTube.length === 0) return true;
    
    // Если в целевой пробирке верхняя жидкость того же цвета, можно переливать
    const { color: toColor } = this.getTopColor(toTube);
    return fromColor === toColor;
  }

  /**
   * Выполняет переливание и возвращает новое состояние
   */
  pour(state, from, to) {
    const newState = this.cloneState(state);
    const fromTube = newState[from];
    const toTube = newState[to];
    
    const { color, count } = this.getTopColor(fromTube);
    
    // Определяем сколько капель можно перелить
    const availableSpace = this.tubeCapacity - toTube.length;
    const amountToPour = Math.min(count, availableSpace);
    
    // Переливаем
    for (let i = 0; i < amountToPour; i++) {
      toTube.push(fromTube.pop());
    }
    
    return newState;
  }

  heuristic(state) {
    let cost = 0;
    
    for (const tube of state) {
      if (tube.length === 0) continue;
      
      // Проверяем, отсортирована ли пробирка
      const isComplete = tube.length === this.tubeCapacity && this.isUniform(tube);
      
      if (isComplete) {
        // Отсортированная пробирка - отлично!
        continue;
      }
      
      // Считаем количество разных цветов в пробирке
      const uniqueColors = new Set(tube).size;
      
      if (uniqueColors === 1) {
        // Пробирка однородная, но не полная - нужно просто долить
        cost += (this.tubeCapacity - tube.length) * 0.5;
      } else {
        // Пробирка содержит смесь цветов
        // Считаем "переходы" между цветами (чем больше переходов, тем хуже)
        let transitions = 0;
        for (let i = 1; i < tube.length; i++) {
          if (tube[i] !== tube[i - 1]) {
            transitions++;
          }
        }
        cost += transitions * 3 + uniqueColors * 2;
      }
    }
    
    return cost;
  }

  /**
   * Решает головоломку используя A* алгоритм
   */
  solve() {
    // Приоритетная очередь (имитация через массив с сортировкой)
    const openSet = [];
    const visited = new Map(); // state key -> best cost
    
    const initialKey = this.getStateKey(this.initialState);
    const initialH = this.heuristic(this.initialState);
    
    openSet.push({
      state: this.initialState,
      moves: [],
      g: 0, // реальная стоимость пути
      h: initialH, // эвристическая оценка
      f: initialH // g + h
    });
    
    visited.set(initialKey, 0);
    
    let iterations = 0;
    const maxIterations = 200000;
    
    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;
      
      // Сортируем по f (g + h) и берем лучшее состояние
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      
      // Проверяем, решена ли головоломка
      if (this.isSolved(current.state)) {
        return {
          success: true,
          moves: current.moves,
          iterations
        };
      }
      
      // Генерируем все возможные ходы
      for (let from = 0; from < this.numTubes; from++) {
        for (let to = 0; to < this.numTubes; to++) {
          if (this.canPour(current.state, from, to)) {
            const newState = this.pour(current.state, from, to);
            const newKey = this.getStateKey(newState);
            const newG = current.g + 1; // каждый ход стоит 1
            
            // Проверяем, не посещали ли мы это состояние с меньшей стоимостью
            if (!visited.has(newKey) || visited.get(newKey) > newG) {
              visited.set(newKey, newG);
              
              const newH = this.heuristic(newState);
              const newF = newG + newH;
              const newMoves = [...current.moves, [from, to]];
              
              openSet.push({
                state: newState,
                moves: newMoves,
                g: newG,
                h: newH,
                f: newF
              });
            }
          }
        }
      }
      
      // Ограничиваем размер очереди для экономии памяти
      if (openSet.length > 10000) {
        openSet.sort((a, b) => a.f - b.f);
        openSet.splice(5000); // 5000 лучших состояний
      }
      
      // Вывод прогресса
      if (iterations % 10000 === 0) {
        const bestF = openSet.length > 0 ? openSet[0].f : 'N/A';
        console.log(`Прогресс: ${iterations} итераций, очередь: ${openSet.length}, посещено: ${visited.size}, лучший f: ${bestF}`);
      }
    }
    
    return {
      success: false,
      message: iterations >= maxIterations 
        ? 'Превышен лимит итераций. Попробуйте увеличить maxIterations или упростить задачу.' 
        : 'Решение не найдено',
      iterations
    };
  }
}

