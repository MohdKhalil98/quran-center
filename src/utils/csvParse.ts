// دالة بسيطة لتحويل CSV إلى JSON بدون مكتبات خارجية
// دالة تدعم الحروف العربية وترميز UTF-8 وتتعامل مع القيم التي تحتوي على فاصلة داخل النص
export function parseCSV(text: string): any[] {
  // معالجة السطور
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  // معالجة رؤوس الأعمدة
  const headers = lines[0].split(',').map(h => h.trim());
  const result: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // تقسيم السطر مع مراعاة القيم المحاطة بعلامات اقتباس
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    const obj: any = {};
    headers.forEach((h, idx) => {
      obj[h] = (values[idx] || '').trim();
    });
    result.push(obj);
  }
  return result;
}
