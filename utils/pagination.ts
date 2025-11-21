/**
 * Buduje listę numerów stron z elipsami dla paginacji
 * 
 * @param total - Całkowita liczba stron
 * @param current - Aktualna strona
 * @returns Tablica numerów stron i elips (np. [1, "…", 5, 6, 7, "…", 20])
 * 
 * @example
 * buildPageList(20, 6) // [1, "…", 4, 5, 6, 7, 8, "…", 20]
 * buildPageList(5, 3) // [1, 2, 3, 4, 5]
 */
export function buildPageList(total: number, current: number): Array<number | string> {
  const pages: Array<number | string> = [];
  
  if (!Number.isFinite(total) || total <= 0) {
    return [1];
  }
  
  // Jeśli jest mało stron, pokaż wszystkie
  if (total <= 9) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  const add = (p: number | string) => pages.push(p);
  
  // Zawsze pokaż pierwszą stronę
  add(1);
  
  // Dodaj elipsy jeśli potrzeba
  if (current > 4) {
    add("…");
  }
  
  // Oblicz zakres stron do pokazania wokół aktualnej
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  
  // Dodaj strony w zakresie
  for (let i = start; i <= end; i++) {
    add(i);
  }
  
  // Dodaj elipsy jeśli potrzeba
  if (current < total - 3) {
    add("…");
  }
  
  // Zawsze pokaż ostatnią stronę
  add(total);
  
  return pages;
}

