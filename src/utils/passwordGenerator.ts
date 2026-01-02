/**
 * توليد كلمة مرور مؤقتة عشوائية
 * @param length طول كلمة المرور (افتراضي 8)
 * @returns كلمة مرور عشوائية
 */
export const generateTemporaryPassword = (length: number = 8): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // التأكد من وجود على الأقل حرف واحد من كل نوع
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // إكمال باقي الطول بأحرف عشوائية
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // خلط الأحرف
  return password.split('').sort(() => Math.random() - 0.5).join('');
};
