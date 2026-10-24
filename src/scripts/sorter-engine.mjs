export function shuffled(count, random = Math.random) {
  const values = Array.from({ length: count }, (_, i) => i + 1);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
export function verified(values, count) {
  return values.length === count && values.every((v, i) => v === i + 1);
}
export function* sortSteps(a, method = 'quick') {
  if (method === 'insertion') {
    for (let i = 1; i < a.length; i++) {
      let j = i;
      while (j > 0) {
        yield [j - 1, j];
        if (a[j - 1] <= a[j]) break;
        [a[j - 1], a[j]] = [a[j], a[j - 1]];
        yield [j - 1, j]; j--;
      }
    }
  } else if (method === 'merge') {
    for (let width = 1; width < a.length; width *= 2) {
      for (let left = 0; left < a.length; left += width * 2) {
        const mid = Math.min(left + width, a.length), end = Math.min(left + width * 2, a.length);
        const copy = a.slice(left, end);
        let i = 0, j = mid - left;
        for (let k = left; k < end; k++) {
          if (i < mid - left && (j >= copy.length || copy[i] <= copy[j])) a[k] = copy[i++];
          else a[k] = copy[j++];
          yield [k];
        }
      }
    }
  } else {
    const stack = [[0, a.length - 1]];
    while (stack.length) {
      const [left, right] = stack.pop();
      if (left >= right) continue;
      const pivot = a[right]; let p = left;
      for (let i = left; i < right; i++) {
        yield [i, p, right];
        if (a[i] < pivot) {
          [a[i], a[p]] = [a[p], a[i]];
          yield [i, p]; p++;
        }
      }
      [a[p], a[right]] = [a[right], a[p]]; yield [p, right];
      stack.push([p + 1, right], [left, p - 1]);
    }
  }
}
