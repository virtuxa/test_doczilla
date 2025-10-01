import { LiquidSortingSolver } from './solver.js';

/**
 * Форматирует и выводит результат
 */
function printSolution(result) {
  if (!result.success) {
    console.log(`❌ ${result.message}`);
    console.log(`Выполнено итераций: ${result.iterations}`);
    return;
  }
  
  console.log('✅ Решение найдено!');
  console.log(`Количество ходов: ${result.moves.length}`);
  console.log(`Выполнено итераций: ${result.iterations}`);
  console.log('\nПоследовательность ходов:');
  
  // Форматируем вывод ходов
  const movesPerLine = 8;
  for (let i = 0; i < result.moves.length; i += movesPerLine) {
    const line = result.moves
      .slice(i, i + movesPerLine)
      .map(([from, to]) => `(${String(from).padStart(2)}, ${String(to).padStart(2)})`)
      .join(' ');
    console.log(line);
  }
}

/**
 * Визуализирует состояние пробирок
 */
function visualizeState(state, title = 'Состояние') {
  console.log(`\n${title}:`);
  const maxHeight = Math.max(...state.map(tube => tube.length));
  
  // Выводим пробирки сверху вниз
  for (let level = maxHeight - 1; level >= 0; level--) {
    const row = state.map(tube => {
      if (level < tube.length) {
        return ` ${tube[level]} `;
      }
      return '   ';
    }).join(' ');
    console.log(row);
  }
  
  // Выводим номера пробирок
  const numbers = state.map((_, i) => String(i).padStart(2)).join('  ');
  console.log(numbers);
  console.log('');
}

// Пример из задания
const puzzle = [
  ['D', 'D', 'J', 'B'],  // 0
  ['H', 'L', 'H', 'A'],  // 1
  ['I', 'E', 'G', 'J'],  // 2
  ['E', 'B', 'C', 'E'],  // 3
  ['G', 'H', 'K', 'F'],  // 4
  ['B', 'A', 'L', 'L'],  // 5
  ['K', 'H', 'G', 'D'],  // 6
  ['A', 'C', 'K', 'J'],  // 7
  ['I', 'I', 'G', 'J'],  // 8
  ['K', 'F', 'B', 'F'],  // 9
  ['C', 'I', 'F', 'D'],  // 10
  ['A', 'L', 'C', 'E'],  // 11
  [],                    // 12
  []                     // 13
];

console.log('=== РЕШАТЕЛЬ ГОЛОВОЛОМКИ "СОРТИРОВКА ЖИДКОСТЕЙ" ===\n');
console.log(`Решаем головоломку с ${puzzle.length} пробирками...`);
visualizeState(puzzle, 'Начальное состояние');

const solver = new LiquidSortingSolver(puzzle);
const result = solver.solve();

printSolution(result);

// Показываем финальное состояние если решение найдено
if (result.success) {
  // Применяем все ходы для получения финального состояния
  let finalState = puzzle;
  for (const [from, to] of result.moves) {
    finalState = solver.pour(finalState, from, to);
  }
  visualizeState(finalState, 'Финальное состояние');
}



