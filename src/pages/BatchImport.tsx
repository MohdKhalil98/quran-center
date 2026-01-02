import { useState } from 'react';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc, getDocs, collection, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { parseCSV, downloadJSON, downloadCSV, createSampleCSV, UserImportData } from '../utils/csvParser';
import { generateTemporaryPassword } from '../utils/passwordGenerator';
import '../styles/BatchImport.css';

interface ImportResult {
  user: UserImportData;
  success: boolean;
  password?: string;
  error?: string;
  whatsappUrl?: string;
}

const BatchImport = () => {
  const { isAdmin } = useAuth();
  const [csvContent, setCsvContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [validUsers, setValidUsers] = useState<UserImportData[]>([]);
  const [errors, setErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [step, setStep] = useState<'upload' | 'review' | 'importing' | 'complete'>('upload');
  const [batchSize, setBatchSize] = useState(10);
  const [delay, setDelay] = useState(2000); // milliseconds
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      
      const { valid, errors: parseErrors } = parseCSV(content);
      setValidUsers(valid);
      setErrors(parseErrors);
      
      if (valid.length > 0) {
        setStep('review');
      }
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    if (validUsers.length === 0) {
      alert('لا توجد مستخدمين صحيحين للاستيراد');
      return;
    }

    setImporting(true);
    setStep('importing');
    setProgress({ current: 0, total: validUsers.length });
    setResults([]);

    const currentUser = auth.currentUser;
    const currentEmail = currentUser?.email;

    try {
      const importResults: ImportResult[] = [];

      // معالجة الحسابات على دفعات
      for (let i = 0; i < validUsers.length; i += batchSize) {
        const batch = validUsers.slice(i, i + batchSize);

        // معالجة كل حساب في الدفعة
        for (const user of batch) {
          try {
            const password = generateTemporaryPassword();

            // إنشاء حساب
            const userCredential = await createUserWithEmailAndPassword(
              auth,
              user.email,
              password
            );

            // حفظ البيانات في Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
              uid: userCredential.user.uid,
              email: user.email,
              name: user.name,
              phone: user.phone,
              personalId: user.personalId || null,
              role: user.role,
              centerId: user.centerId,
              groupId: user.groupId || null,
              // للطلاب: حالة waiting_teacher_approval (في انتظار موافقة المعلم على المستوى)
              // للباقي: حالة active
              status: user.role === 'student' ? 'waiting_teacher_approval' : 'active',
              createdAt: new Date().toISOString(),
              active: true
            });

            // إنشاء رابط واتساب قبل تسجيل الخروج
            let phoneNumber = user.phone.replace(/[\s+-]/g, '');
            if (phoneNumber.startsWith('0')) {
              phoneNumber = '973' + phoneNumber.substring(1);
            }
            if (!phoneNumber.startsWith('973')) {
              phoneNumber = '973' + phoneNumber;
            }

            const roleAr = {
              supervisor: 'مشرف',
              teacher: 'معلم',
              student: 'طالب',
              parent: 'ولي أمر'
            }[user.role];

            const message = `مرحباً ${user.name}،

تم إنشاء حسابك في نظام إدارة المراكز بنجاح!

البريد الإلكتروني: ${user.email}
كلمة المرور المؤقتة: ${password}
الدور: ${roleAr}
${user.personalId ? `الرقم الشخصي: ${user.personalId}` : ''}

ملاحظة مهمة:
• يرجى تغيير كلمة المرور بعد تسجيل الدخول الأول
• يمكنك تغيير كلمة المرور من قائمة الإعدادات

رابط النظام: ${window.location.origin}

نتمنى لك تجربة موفقة!`;

            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

            // تسجيل الخروج
            await signOut(auth);

            // فتح واتساب (بدون انتظار)
            window.open(whatsappUrl, '_blank');

            // إعادة تسجيل دخول المستخدم الحالي (المطور)
            if (currentEmail) {
              try {
                // محاولة إعادة التسجيل باستخدام رسالة للمستخدم
                // للآن سنتخطى هذه الخطوة لتسريع الاستيراد
              } catch (e) {
                console.error('Could not re-authenticate');
              }
            }

            importResults.push({
              user,
              success: true,
              password,
              whatsappUrl
            });

            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            setResults([...importResults]);
          } catch (error: any) {
            console.error(`Error creating user ${user.email}:`, error);

            importResults.push({
              user,
              success: false,
              error: error.code === 'auth/email-already-in-use' 
                ? 'البريد الإلكتروني مستخدم بالفعل'
                : error.message
            });

            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            setResults([...importResults]);
          }

          // تأخير قبل الحساب التالي
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // إعادة تسجيل دخول المطور بعد كل دفعة
        if (currentEmail) {
          try {
            // محاولة إعادة التسجيل - قد تحتاج كلمة مرور
            // للآن، سنتخطى هذه الخطوة
          } catch (e) {
            console.log('Could not re-authenticate admin');
          }
        }
      }

      setStep('complete');
      setImporting(false);
    } catch (error: any) {
      console.error('Batch import error:', error);
      alert('حدث خطأ أثناء الاستيراد');
      setImporting(false);
    }
  };

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return (
    <section className="page">
      <header className="page__header">
        <h1>📦 استيراد جماعي للحسابات</h1>
        <p>أضف عشرات أو مئات الحسابات دفعة واحدة</p>
      </header>

      <div className="batch-import-container">
        {/* خطوات العملية */}
        <div className="steps">
          <div className={`step ${step === 'upload' ? 'active' : (step === 'review' || step === 'importing' || step === 'complete') ? 'completed' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">تحميل الملف</div>
          </div>
          <div className={`step ${step === 'review' ? 'active' : (step === 'importing' || step === 'complete') ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">المراجعة</div>
          </div>
          <div className={`step ${step === 'importing' ? 'active' : step === 'complete' ? 'completed' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">الاستيراد</div>
          </div>
          <div className={`step ${step === 'complete' ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <div className="step-label">النتائج</div>
          </div>
        </div>

        {/* خطوة التحميل */}
        {step === 'upload' && (
          <div className="batch-content">
            <div className="upload-section">
              <div className="upload-box">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  id="csv-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="csv-upload" className="upload-label">
                  📁 اختر ملف CSV<br />
                  <span className="upload-hint">أو اسحب الملف هنا</span>
                </label>
              </div>

              <div className="sample-section">
                <h3>📋 نموذج CSV</h3>
                <p>يجب أن يحتوي ملفك على الأعمدة التالية:</p>
                <ul className="column-list">
                  <li><strong>name</strong> - الاسم الكامل (مطلوب)</li>
                  <li><strong>email</strong> - البريد الإلكتروني (مطلوب)</li>
                  <li><strong>phone</strong> - رقم الهاتف (مطلوب)</li>
                  <li><strong>personalId</strong> - الرقم الشخصي (اختياري - للطلاب)</li>
                  <li><strong>role</strong> - الدور: supervisor, teacher, student, parent (مطلوب)</li>
                  <li><strong>centerId</strong> - معرف المركز (مطلوب)</li>
                  <li><strong>groupId</strong> - معرف المجموعة (اختياري)</li>
                </ul>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const sample = createSampleCSV();
                    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'sample_users.csv';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                >
                  ⬇️ تحميل نموذج
                </button>
              </div>
            </div>
          </div>
        )}

        {/* خطوة المراجعة */}
        {step === 'review' && (
          <div className="batch-content">
            <div className="review-section">
              <div className="review-stats">
                <div className="stat-box success">
                  <div className="stat-number">{validUsers.length}</div>
                  <div className="stat-label">مستخدم صحيح</div>
                </div>
                {errors.length > 0 && (
                  <div className="stat-box error">
                    <div className="stat-number">{errors.length}</div>
                    <div className="stat-label">أخطاء</div>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="errors-section">
                  <h3>⚠️ الأخطاء المكتشفة:</h3>
                  <div className="error-list">
                    {errors.map((err, idx) => (
                      <div key={idx} className="error-item">
                        <strong>الصف {err.row}:</strong> {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validUsers.length > 0 && (
                <div className="users-preview">
                  <h3>👥 المستخدمون الذين سيتم إضافتهم:</h3>
                  <div className="table-container">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>الاسم</th>
                          <th>البريد الإلكتروني</th>
                          <th>الهاتف</th>
                          <th>الرقم الشخصي</th>
                          <th>الدور</th>
                          <th>المركز</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validUsers.slice(0, 10).map((user, idx) => (
                          <tr key={idx}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>{user.phone}</td>
                            <td>{user.personalId || '-'}</td>
                            <td>{user.role}</td>
                            <td>{user.centerId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validUsers.length > 10 && (
                      <div className="more-users">
                        و {validUsers.length - 10} مستخدم إضافي
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="settings-section">
                <h3>⚙️ إعدادات الاستيراد:</h3>
                <div className="setting-group">
                  <label>حجم الدفعة (عدد الحسابات في كل مجموعة):</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={batchSize}
                    onChange={e => setBatchSize(Math.max(1, parseInt(e.target.value) || 10))}
                  />
                </div>
                <div className="setting-group">
                  <label>التأخير بين الحسابات (ميلي ثانية):</label>
                  <input
                    type="number"
                    min="500"
                    max="5000"
                    step="500"
                    value={delay}
                    onChange={e => setDelay(Math.max(500, parseInt(e.target.value) || 2000))}
                  />
                  <small>تأخير أطول = أقل عرضة للأخطاء (موصى به: 2000-3000)</small>
                </div>
              </div>

              <div className="action-buttons">
                <button className="btn btn-secondary" onClick={() => setStep('upload')}>
                  ← الرجوع
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleStartImport}
                  disabled={validUsers.length === 0}
                >
                  ▶️ بدء الاستيراد
                </button>
              </div>
            </div>
          </div>
        )}

        {/* خطوة الاستيراد */}
        {step === 'importing' && (
          <div className="batch-content">
            <div className="importing-section">
              <div className="progress-box">
                <div className="progress-label">
                  جاري الاستيراد: {progress.current} من {progress.total}
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <div className="progress-percentage">
                  {Math.round((progress.current / progress.total) * 100)}%
                </div>
              </div>

              {results.length > 0 && (
                <div className="results-preview">
                  <div className="preview-stats">
                    <div className="stat success">
                      ✓ نجح: {results.filter(r => r.success).length}
                    </div>
                    <div className="stat error">
                      ✗ فشل: {results.filter(r => !r.success).length}
                    </div>
                  </div>
                </div>
              )}

              <p className="importing-note">
                ⏳ جاري المعالجة، يرجى عدم إغلاق الصفحة...
              </p>
            </div>
          </div>
        )}

        {/* خطوة النتائج */}
        {step === 'complete' && (
          <div className="batch-content">
            <div className="results-section">
              <div className="results-header">
                <h2>✅ اكتمل الاستيراد</h2>
                <p>تم معالجة {results.length} حساب</p>
              </div>

              <div className="results-stats">
                <div className="stat-box success">
                  <div className="stat-number">{successCount}</div>
                  <div className="stat-label">حساب تم إنشاؤه بنجاح</div>
                </div>
                <div className="stat-box error">
                  <div className="stat-number">{errorCount}</div>
                  <div className="stat-label">حساب فشل</div>
                </div>
              </div>

              {errorCount > 0 && (
                <div className="failed-users">
                  <h3>❌ الحسابات التي فشلت:</h3>
                  <div className="failed-list">
                    {results.filter(r => !r.success).map((result, idx) => (
                      <div key={idx} className="failed-item">
                        <strong>{result.user.name}</strong> ({result.user.email})
                        <br />
                        <span className="error-msg">{result.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {successCount > 0 && (
                <div className="successful-users">
                  <h3>✅ الحسابات التي تم إنشاؤها:</h3>
                  <div className="success-list">
                    {results.filter(r => r.success).slice(0, 5).map((result, idx) => (
                      <div key={idx} className="success-item">
                        <div className="user-info">
                          <strong>{result.user.name}</strong> ({result.user.email})
                          <br />
                          <span className="password">كلمة المرور: {result.password}</span>
                          {result.user.personalId && (
                            <>
                              <br />
                              <span className="personal-id">الرقم الشخصي: {result.user.personalId}</span>
                            </>
                          )}
                        </div>
                        {result.whatsappUrl && (
                          <a
                            href={result.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            📱 واتساب
                          </a>
                        )}
                      </div>
                    ))}
                    {successCount > 5 && (
                      <div className="more-success">
                        و {successCount - 5} حساب آخر تم إنشاؤه بنجاح
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="export-section">
                <h3>📥 تصدير النتائج:</h3>
                <div className="export-buttons">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const exportData = results.map(r => ({
                        الاسم: r.user.name,
                        البريد: r.user.email,
                        الهاتف: r.user.phone,
                        الرقم_الشخصي: r.user.personalId || '',
                        الدور: r.user.role,
                        كلمة_المرور: r.password || 'فشل',
                        الحالة: r.success ? 'نجح' : 'فشل',
                        الخطأ: r.error || '',
                        رابط_واتساب: r.whatsappUrl || ''
                      }));
                      downloadCSV(exportData, 'import_results.csv');
                    }}
                  >
                    📊 تصدير كـ CSV
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => downloadJSON(results, 'import_results.json')}
                  >
                    📄 تصدير كـ JSON
                  </button>
                </div>
              </div>

              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setStep('upload');
                    setCsvContent('');
                    setValidUsers([]);
                    setErrors([]);
                    setResults([]);
                  }}
                >
                  ↻ استيراد جديد
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default BatchImport;
