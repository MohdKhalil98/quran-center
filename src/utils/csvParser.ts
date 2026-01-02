/**
 * قراءة ومعالجة ملفات CSV
 */

export interface UserImportData {
  name: string;
  email: string;
  phone: string;
  personalId?: string; // الرقم الشخصي (للطلاب)
  role: 'supervisor' | 'teacher' | 'student' | 'parent';
  centerId: string;
  groupId?: string;
  status?: string;
}

export const parseCSV = (csvText: string): { valid: UserImportData[]; errors: Array<{ row: number; error: string }> } => {
  const lines = csvText.split('\n').filter(line => line.trim());
  const errors: Array<{ row: number; error: string }> = [];
  const valid: UserImportData[] = [];

  if (lines.length === 0) {
    errors.push({ row: 0, error: 'الملف فارغ' });
    return { valid, errors };
  }

  // قراءة رؤوس الأعمدة
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const requiredColumns = ['name', 'email', 'phone', 'role', 'centerid'];
  
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    errors.push({ row: 1, error: `أعمدة مفقودة: ${missingColumns.join(', ')}` });
    return { valid, errors };
  }

  // قراءة الصفوف
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',').map(v => v.trim());
      
      const data: any = {};
      headers.forEach((header, index) => {
        data[header] = values[index] || '';
      });

      // التحقق من القيم المطلوبة
      if (!data.name || !data.name.trim()) {
        errors.push({ row: i + 1, error: 'الاسم مفقود' });
        continue;
      }

      if (!data.email || !data.email.trim()) {
        errors.push({ row: i + 1, error: 'البريد الإلكتروني مفقود' });
        continue;
      }

      if (!data.phone || !data.phone.trim()) {
        errors.push({ row: i + 1, error: 'رقم الهاتف مفقود' });
        continue;
      }

      if (!data.role || !['supervisor', 'teacher', 'student', 'parent'].includes(data.role)) {
        errors.push({ row: i + 1, error: `الدور غير صحيح: ${data.role}. يجب أن يكون: supervisor, teacher, student, parent` });
        continue;
      }

      if (!data.centerid || !data.centerid.trim()) {
        errors.push({ row: i + 1, error: 'معرف المركز مفقود' });
        continue;
      }

      // التحقق من صحة البريد الإلكتروني
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push({ row: i + 1, error: `البريد الإلكتروني غير صحيح: ${data.email}` });
        continue;
      }

      valid.push({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        personalId: data.personalid ? data.personalid.trim() : undefined,
        role: data.role,
        centerId: data.centerid.trim(),
        groupId: data.groupid ? data.groupid.trim() : undefined
      });
    } catch (error: any) {
      errors.push({ row: i + 1, error: `خطأ في معالجة الصف: ${error.message}` });
    }
  }

  return { valid, errors };
};

export const downloadJSON = (data: any, filename: string) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  // إنشاء رؤوس الأعمدة
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // تجنب مشاكل الفواصل والأسطر الجديدة
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const createSampleCSV = (): string => {
  return `name,email,phone,personalId,role,centerId,groupId
محمد أحمد,mohammad@quran.com,33123456,1234567890,teacher,center1,group1
فاطمة علي,fatima@quran.com,33234567,1234567891,teacher,center1,group2
علي حسن,ali@quran.com,33345678,1234567892,student,center1,group1
نور محمود,noor@quran.com,33456789,1234567893,student,center1,group2
خديجة عبدالله,khadija@quran.com,33567890,,supervisor,center1,`;
};
