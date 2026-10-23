import React, { useState, useEffect } from 'react';

export interface EditableQuestion {
  id: string;
  type: 'choice' | 'input';
  questionImg: string;
  questionText: string;
  correctAnswer: string;
  wrongAnswer1: string;
  wrongAnswer2: string;
  wrongAnswer3: string;
}

interface AIQuestionGeneratorProps {
  onBack: () => void;
  onPlayTest: (questions: any[]) => void;
  defaultSpreadsheetId?: string;
  availableSheets?: string[];
}

const SAMPLE_LESSON = `Chủ đề: Tin học lớp 3 - Bài: Chuột máy tính
Nội dung bài học:
1. Cấu tạo chuột máy tính: Thường có nút chuột trái, nút chuột phải và nút cuộn (bánh lăn) ở giữa.
2. Cách cầm chuột đúng cách: Đặt lòng bàn tay lên lưng chuột, ngón trỏ đặt lên nút chuột trái, ngón giữa đặt lên nút chuột phải, ngón cái và các ngón còn lại giữ hai bên thân chuột.
3. Các thao tác cơ bản với chuột:
- Di chuyển chuột: Thay đổi vị trí của con trỏ chuột trên màn hình.
- Nháy chuột (chuột trái): Nhấn nút chuột trái 1 lần rồi thả ra, dùng để chọn đối tượng.
- Nháy nút chuột phải: Nhấn nút chuột phải 1 lần rồi thả ra để mở bảng chọn (menu tác vụ).
- Nháy đúp chuột: Nhấn nút chuột trái 2 lần liên tiếp thật nhanh, dùng để mở tệp hoặc phần mềm.
- Kéo thả chuột: Nhấn giữ nút chuột trái, di chuyển con trỏ chuột đến vị trí mới rồi thả ngón tay ra.`;

export default function AIQuestionGenerator({
  onBack,
  onPlayTest,
  defaultSpreadsheetId = '1R4caBv-wVn5JvVcXLoP3W3uLAK7roDg5bXn8NSRnRN4',
  availableSheets = []
}: AIQuestionGeneratorProps) {
  // Tab: 'input' | 'review' | 'export'
  const [activeTab, setActiveTab] = useState<'input' | 'review' | 'export'>('input');

  // Input states
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [lessonContent, setLessonContent] = useState('');
  const [targetGrade, setTargetGrade] = useState('Lớp 3');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questionTypePreference, setQuestionTypePreference] = useState<'choice' | 'input' | 'mixed'>('choice');
  const [difficultyLevel, setDifficultyLevel] = useState('Phù hợp tiểu học');

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateStatus, setGenerateStatus] = useState('');

  // Review states
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [copyNotification, setCopyNotification] = useState('');

  // Export states
  const [selectedSheetName, setSelectedSheetName] = useState('Bộ câu hỏi mới');
  const [showScriptModal, setShowScriptModal] = useState(false);

  // Load API Key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setShowKeyInput(true);
    }
  }, []);

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey.trim());
  };

  // --- Call Gemini API ---
  const handleGenerateQuestions = async () => {
    const keyToUse = apiKey.trim();
    if (!keyToUse) {
      setGenerateError('Vui lòng nhập API Key Google Gemini để tạo câu hỏi.');
      setShowKeyInput(true);
      return;
    }
    if (!lessonContent.trim()) {
      setGenerateError('Vui lòng nhập hoặc dán nội dung bài học.');
      return;
    }

    setIsGenerating(true);
    setGenerateError('');
    setGenerateStatus('Đang gửi yêu cầu tới AI Google Gemini...');

    try {
      const systemPrompt = `Bạn là một chuyên gia sư phạm tiểu học và giáo viên Tin học giỏi.
Nhiệm vụ của bạn là đọc kỹ nội dung bài học và tạo ra ${numQuestions} câu hỏi dành cho học sinh ${targetGrade}, mức độ "${difficultyLevel}".
Quy định định dạng câu hỏi theo đúng cấu trúc Google Sheets của trò chơi Luyện Chuột:
- Cột A (questionImg): Để chuỗi rỗng "" (nếu không có link ảnh cụ thể).
- Cột B (questionText): Câu hỏi rõ ràng, ngắn gọn, phù hợp với tâm lý học sinh tiểu học.
- Cột C (correctAnswer): Đáp án ĐÚNG. Nếu là câu hỏi trắc nghiệm thì chứa 1 đáp án đúng duy nhất. Nếu là câu hỏi điền từ thì các đáp án đúng chấp nhận cách nhau bởi dấu gạch đứng "|", ví dụ "chuột|con chuột".
- Cột D (wrongAnswer1): Đáp án SAI 1 (Nếu là câu hỏi điền từ thì để trống "").
- Cột E (wrongAnswer2): Đáp án SAI 2 (Nếu là câu hỏi điền từ thì để trống "").
- Cột F (wrongAnswer3): Đáp án SAI 3 (Nếu là câu hỏi điền từ thì để trống "").

Yêu cầu loại câu hỏi: ${
        questionTypePreference === 'choice'
          ? 'Tất cả đều là câu hỏi trắc nghiệm 4 đáp án (type = "choice").'
          : questionTypePreference === 'input'
          ? 'Tất cả là câu hỏi điền từ ngắn gọn (type = "input").'
          : 'Kết hợp cả trắc nghiệm 4 đáp án và điền từ.'
      }

BẮT BUỘC TRẢ VỀ DẠNG MẢNG JSON HỢP LỆ THEO SCHEMA:
[
  {
    "type": "choice",
    "questionImg": "",
    "questionText": "...",
    "correctAnswer": "...",
    "wrongAnswer1": "...",
    "wrongAnswer2": "...",
    "wrongAnswer3": "..."
  }
]`;

      const userPrompt = `Nội dung bài học:\n${lessonContent}\n\nHãy tạo ${numQuestions} câu hỏi ngay bây giờ.`;

      // Supported Gemini models
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
      let rawText = '';
      let fetchError = '';

      for (const model of models) {
        try {
          setGenerateStatus(`Đang yêu cầu mô hình ${model}...`);
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToUse}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                  temperature: 0.7,
                  responseMimeType: 'application/json'
                }
              })
            }
          );

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Lỗi HTTP ${response.status}`);
          }

          const data = await response.json();
          rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) break;
        } catch (err: any) {
          fetchError = err.message || String(err);
          // If model not found or key issue, continue to next fallback
          if (fetchError.includes('API key not valid')) {
            throw new Error('API Key Google Gemini không hợp lệ. Vui lòng kiểm tra lại key.');
          }
        }
      }

      if (!rawText) {
        throw new Error(`Không nhận được phản hồi từ AI: ${fetchError}`);
      }

      setGenerateStatus('Đang xử lý và chuẩn hóa dữ liệu câu hỏi...');

      // Parse JSON from response
      let cleanText = rawText.trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
      else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
      if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
      cleanText = cleanText.trim();

      const startIdx = cleanText.indexOf('[');
      const endIdx = cleanText.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1) {
        cleanText = cleanText.substring(startIdx, endIdx + 1);
      }

      const parsedArray = JSON.parse(cleanText);
      if (!Array.isArray(parsedArray)) {
        throw new Error('Định dạng AI trả về không phải là mảng danh sách câu hỏi.');
      }

      const formattedQuestions: EditableQuestion[] = parsedArray.map((q: any, idx: number) => ({
        id: `q_${Date.now()}_${idx}`,
        type: q.type === 'input' ? 'input' : 'choice',
        questionImg: q.questionImg || q.image || '',
        questionText: q.questionText || q.question || '',
        correctAnswer: q.correctAnswer || q.correct || '',
        wrongAnswer1: q.wrongAnswer1 || q.wrong1 || '',
        wrongAnswer2: q.wrongAnswer2 || q.wrong2 || '',
        wrongAnswer3: q.wrongAnswer3 || q.wrong3 || ''
      }));

      setQuestions(formattedQuestions);
      setActiveTab('review'); // Tự động chuyển sang tab duyệt câu hỏi
    } catch (err: any) {
      console.error(err);
      setGenerateError(err.message || 'Đã xảy ra lỗi trong quá trình tạo câu hỏi. Hãy thử lại.');
    } finally {
      setIsGenerating(false);
      setGenerateStatus('');
    }
  };

  // --- Question Manipulation ---
  const handleUpdateQuestion = (id: string, field: keyof EditableQuestion, value: string) => {
    setQuestions(prev =>
      prev.map(q => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleAddEmptyQuestion = () => {
    const newQ: EditableQuestion = {
      id: `q_${Date.now()}_${Math.random()}`,
      type: 'choice',
      questionImg: '',
      questionText: 'Nhập câu hỏi mới...',
      correctAnswer: 'Đáp án đúng',
      wrongAnswer1: 'Đáp án sai 1',
      wrongAnswer2: 'Đáp án sai 2',
      wrongAnswer3: 'Đáp án sai 3'
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    setQuestions(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // --- Export Actions ---
  // 1. Copy Tab-Separated Values (TSV) to clipboard
  const handleCopyForGoogleSheets = () => {
    if (questions.length === 0) return;
    const rows = questions.map(q => {
      const colA = q.questionImg ? (q.questionImg.startsWith('http') ? q.questionImg : `img:${q.questionImg}`) : '';
      const colB = q.questionText.replace(/\t/g, ' ').replace(/\n/g, ' ');
      const colC = q.correctAnswer.replace(/\t/g, ' ').replace(/\n/g, ' ');
      const colD = q.type === 'input' ? '' : q.wrongAnswer1.replace(/\t/g, ' ').replace(/\n/g, ' ');
      const colE = q.type === 'input' ? '' : q.wrongAnswer2.replace(/\t/g, ' ').replace(/\n/g, ' ');
      const colF = q.type === 'input' ? '' : q.wrongAnswer3.replace(/\t/g, ' ').replace(/\n/g, ' ');
      return [colA, colB, colC, colD, colE, colF].join('\t');
    });

    const clipboardText = rows.join('\r\n');
    navigator.clipboard.writeText(clipboardText).then(() => {
      setCopyNotification('Đã sao chép! Bạn hãy mở Google Sheets, bấm vào ô A1 (hoặc dòng trống) và ấn Ctrl + V để dán.');
      setTimeout(() => setCopyNotification(''), 6000);
    });
  };

  // 2. Download CSV File with UTF-8 BOM
  const handleDownloadCSV = () => {
    if (questions.length === 0) return;
    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
    const header = ['Cột A (Ảnh)', 'Cột B (Câu hỏi)', 'Cột C (Đáp án đúng)', 'Cột D (Sai 1)', 'Cột E (Sai 2)', 'Cột F (Sai 3)'];
    const rows = questions.map(q => [
      escapeCsv(q.questionImg),
      escapeCsv(q.questionText),
      escapeCsv(q.correctAnswer),
      escapeCsv(q.type === 'input' ? '' : q.wrongAnswer1),
      escapeCsv(q.type === 'input' ? '' : q.wrongAnswer2),
      escapeCsv(q.type === 'input' ? '' : q.wrongAnswer3)
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSheetName.replace(/\s+/g, '_')}_cau_hoi.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 3. Playtest directly in game
  const handlePlayTestCurrent = () => {
    if (questions.length === 0) return;
    const playableQuestions = questions.map(q => {
      if (q.type === 'input') {
        return {
          questionText: q.questionText,
          questionImg: q.questionImg,
          type: 'input',
          correctAnswers: q.correctAnswer.split('|').map(s => s.trim())
        };
      } else {
        const answers = [
          { text: q.correctAnswer, isCorrect: true, isImg: q.correctAnswer.startsWith('img:'), url: q.correctAnswer.startsWith('img:') ? q.correctAnswer.substring(4) : null },
          { text: q.wrongAnswer1, isCorrect: false, isImg: q.wrongAnswer1.startsWith('img:'), url: q.wrongAnswer1.startsWith('img:') ? q.wrongAnswer1.substring(4) : null },
          { text: q.wrongAnswer2, isCorrect: false, isImg: q.wrongAnswer2.startsWith('img:'), url: q.wrongAnswer2.startsWith('img:') ? q.wrongAnswer2.substring(4) : null },
          { text: q.wrongAnswer3, isCorrect: false, isImg: q.wrongAnswer3.startsWith('img:'), url: q.wrongAnswer3.startsWith('img:') ? q.wrongAnswer3.substring(4) : null }
        ].sort(() => Math.random() - 0.5);

        return {
          questionText: q.questionText,
          questionImg: q.questionImg,
          type: 'choice',
          answers
        };
      }
    });

    onPlayTest(playableQuestions);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">✨</span>
              <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                TRỢ LÝ AI TẠO BỘ CÂU HỎI
              </h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Nhập nội dung bài học ➜ AI sinh câu hỏi ➜ Giáo viên duyệt ➜ Xuất chuẩn cấu trúc Google Sheets
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-xs px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 flex items-center gap-1.5 transition-colors border border-slate-600"
            >
              <span>🔑</span>
              <span>{apiKey ? 'Đã có API Key' : 'Cấu hình API Key'}</span>
            </button>

            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-700/80 hover:bg-slate-600 text-white font-bold rounded-xl shadow-md transition-colors border border-slate-600 flex items-center gap-2"
            >
              <span>Quay lại</span>
            </button>
          </div>
        </div>

        {/* API Key Drawer/Modal if triggered */}
        {showKeyInput && (
          <div className="bg-indigo-950/60 p-6 rounded-3xl border border-indigo-500/30 shadow-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-indigo-200 flex items-center gap-2">
                <span>🔑</span> Cấu hình Google Gemini API Key
              </h3>
              <button
                onClick={() => setShowKeyInput(false)}
                className="text-xs text-indigo-400 hover:text-indigo-200"
              >
                Đóng
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Gemini API Key dùng để gọi trực tiếp trí tuệ nhân tạo của Google. Khóa được lưu an toàn tại trình duyệt của bạn (localStorage).
              Bạn có thể tạo khóa miễn phí trong 30 giây tại{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-yellow-400 underline font-semibold"
              >
                Google AI Studio (aistudio.google.com)
              </a>.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={e => handleSaveApiKey(e.target.value)}
                placeholder="Dán mã AIzaSy... vào đây"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-indigo-400/50 text-white font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={() => setShowKeyInput(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-transform active:scale-95"
              >
                Lưu
              </button>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700 gap-1">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm md:text-base transition-all flex items-center justify-center gap-2 ${
              activeTab === 'input'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span>1. Nhập bài học & Tạo</span>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm md:text-base transition-all flex items-center justify-center gap-2 ${
              activeTab === 'review'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span>2. Duyệt & Chỉnh sửa</span>
            {questions.length > 0 && (
              <span className="bg-yellow-400 text-slate-900 text-xs px-2 py-0.5 rounded-full font-black">
                {questions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm md:text-base transition-all flex items-center justify-center gap-2 ${
              activeTab === 'export'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span>3. Xuất Google Sheets</span>
          </button>
        </div>

        {/* TAB 1: INPUT LESSON CONTENT */}
        {activeTab === 'input' && (
          <div className="bg-slate-800/60 p-6 md:p-8 rounded-3xl border border-slate-700/80 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <label className="text-lg font-bold text-amber-300 flex items-center gap-2">
                <span>📝</span> Nội dung bài học hoặc chủ đề:
              </label>
              <button
                type="button"
                onClick={() => setLessonContent(SAMPLE_LESSON)}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-300 border border-indigo-600/40 transition-colors"
              >
                + Dán bài mẫu (Tin học 3: Chuột máy tính)
              </button>
            </div>

            <textarea
              rows={8}
              value={lessonContent}
              onChange={e => setLessonContent(e.target.value)}
              placeholder="Dán nội dung bài học, sách giáo khoa, ghi chú hoặc tóm tắt kiến thức vào đây..."
              className="w-full p-4 rounded-2xl bg-slate-900/90 border border-slate-700 text-slate-100 placeholder-slate-500 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />

            {/* Config Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đối tượng học sinh:</label>
                <select
                  value={targetGrade}
                  onChange={e => setTargetGrade(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-medium outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Lớp 3">Học sinh Lớp 3</option>
                  <option value="Lớp 4">Học sinh Lớp 4</option>
                  <option value="Lớp 5">Học sinh Lớp 5</option>
                  <option value="Tiểu học chung">Tiểu học (Chung)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Số lượng câu hỏi:</label>
                <select
                  value={numQuestions}
                  onChange={e => setNumQuestions(Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-medium outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={3}>3 câu</option>
                  <option value={5}>5 câu</option>
                  <option value={10}>10 câu</option>
                  <option value={15}>15 câu</option>
                  <option value={20}>20 câu</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dạng câu hỏi:</label>
                <select
                  value={questionTypePreference}
                  onChange={e => setQuestionTypePreference(e.target.value as any)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-medium outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="choice">Trắc nghiệm 4 đáp án (Khuyên dùng)</option>
                  <option value="input">Điền từ ngắn gọn</option>
                  <option value="mixed">Kết hợp cả hai loại</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Độ khó:</label>
                <select
                  value={difficultyLevel}
                  onChange={e => setDifficultyLevel(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-medium outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Dễ - Nhận biết trực tiếp">Dễ (Nhận biết)</option>
                  <option value="Phù hợp tiểu học">Vừa phải (Tiểu học)</option>
                  <option value="Vận dụng và suy luận">Thử thách (Vận dụng)</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {generateError && (
              <div className="bg-red-900/40 border border-red-500/50 p-4 rounded-2xl text-red-300 text-sm flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <span>{generateError}</span>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-4 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateQuestions}
                disabled={isGenerating}
                className={`w-full max-w-md py-4 rounded-2xl font-black text-lg md:text-xl uppercase tracking-wider shadow-xl transition-all duration-300 flex items-center justify-center gap-3 ${
                  isGenerating
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed animate-pulse'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:scale-[1.02] text-white shadow-orange-500/25 active:scale-95'
                }`}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{generateStatus || 'Đang tạo câu hỏi...'}</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Tạo câu hỏi bằng AI</span>
                  </>
                )}
              </button>
              {isGenerating && (
                <p className="text-xs text-slate-400 italic">Quá trình thường mất khoảng 5 - 10 giây...</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: REVIEW & EDIT */}
        {activeTab === 'review' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/60 p-4 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <span className="font-bold text-slate-200">
                  Danh sách câu hỏi ({questions.length} câu)
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  (Bạn có thể chỉnh sửa trực tiếp nội dung từng câu bên dưới)
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleAddEmptyQuestion}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-1"
                >
                  <span>+ Thêm câu hỏi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('export')}
                  disabled={questions.length === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition-transform hover:scale-105 shadow-md flex items-center gap-1.5"
                >
                  <span>Tiếp tục xuất Google Sheets ➔</span>
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="bg-slate-800/40 p-12 rounded-3xl border border-dashed border-slate-700 text-center space-y-4">
                <span className="text-5xl">📄</span>
                <p className="text-slate-400 text-lg">Chưa có câu hỏi nào. Hãy chuyển về tab 1 để AI tạo câu hỏi nhé!</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('input')}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white text-sm"
                >
                  Quay lại Tab 1
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 shadow-lg space-y-4 transition-all hover:border-slate-600"
                  >
                    {/* Question Header */}
                    <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-black text-sm text-white">
                          {idx + 1}
                        </span>
                        <select
                          value={q.type}
                          onChange={e => handleUpdateQuestion(q.id, 'type', e.target.value as any)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-300 outline-none cursor-pointer"
                        >
                          <option value="choice">Trắc nghiệm (4 đáp án)</option>
                          <option value="input">Điền từ (Ô nhập)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(idx, 'up')}
                          disabled={idx === 0}
                          title="Di chuyển lên"
                          className="p-1.5 hover:bg-slate-700 rounded-lg disabled:opacity-30"
                        >
                          ⬆️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(idx, 'down')}
                          disabled={idx === questions.length - 1}
                          title="Di chuyển xuống"
                          className="p-1.5 hover:bg-slate-700 rounded-lg disabled:opacity-30"
                        >
                          ⬇️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          title="Xóa câu hỏi này"
                          className="p-1.5 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors ml-2"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Nội dung câu hỏi (Cột B):
                      </label>
                      <textarea
                        rows={2}
                        value={q.questionText}
                        onChange={e => handleUpdateQuestion(q.id, 'questionText', e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-base focus:border-indigo-500 outline-none"
                      />
                    </div>

                    {/* Question Image (Column A) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-400">
                          Link ảnh minh họa (Cột A - Không bắt buộc):
                        </label>
                        {q.questionImg && (
                          <span className="text-[11px] text-emerald-400">Có ảnh</span>
                        )}
                      </div>
                      <div className="flex gap-3 items-center">
                        <input
                          type="text"
                          value={q.questionImg}
                          onChange={e => handleUpdateQuestion(q.id, 'questionImg', e.target.value)}
                          placeholder="https://... hoặc img:https://..."
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 text-sm outline-none focus:border-indigo-500"
                        />
                        {q.questionImg && (
                          <img
                            src={q.questionImg.startsWith('img:') ? q.questionImg.substring(4) : q.questionImg}
                            alt="preview"
                            className="w-10 h-10 object-contain rounded-lg bg-white/10 p-0.5 border border-slate-600"
                            onError={e => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Answers Section */}
                    {q.type === 'choice' ? (
                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Các phương án trả lời:
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Correct Answer (Column C) */}
                          <div className="flex items-center gap-2 bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/50">
                            <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-900 font-bold text-xs flex items-center justify-center shrink-0">
                              ✓
                            </span>
                            <div className="flex-1">
                              <span className="text-[11px] font-bold text-emerald-400 block mb-1">
                                ĐÁP ÁN ĐÚNG (Cột C)
                              </span>
                              <input
                                type="text"
                                value={q.correctAnswer}
                                onChange={e => handleUpdateQuestion(q.id, 'correctAnswer', e.target.value)}
                                className="w-full bg-slate-900/90 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-white font-medium text-sm outline-none"
                              />
                            </div>
                          </div>

                          {/* Wrong Answer 1 (Column D) */}
                          <div className="flex items-center gap-2 bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                            <span className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                              ✕
                            </span>
                            <div className="flex-1">
                              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                                Đáp án sai 1 (Cột D)
                              </span>
                              <input
                                type="text"
                                value={q.wrongAnswer1}
                                onChange={e => handleUpdateQuestion(q.id, 'wrongAnswer1', e.target.value)}
                                className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-medium text-sm outline-none focus:border-slate-500"
                              />
                            </div>
                          </div>

                          {/* Wrong Answer 2 (Column E) */}
                          <div className="flex items-center gap-2 bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                            <span className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                              ✕
                            </span>
                            <div className="flex-1">
                              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                                Đáp án sai 2 (Cột E)
                              </span>
                              <input
                                type="text"
                                value={q.wrongAnswer2}
                                onChange={e => handleUpdateQuestion(q.id, 'wrongAnswer2', e.target.value)}
                                className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-medium text-sm outline-none focus:border-slate-500"
                              />
                            </div>
                          </div>

                          {/* Wrong Answer 3 (Column F) */}
                          <div className="flex items-center gap-2 bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                            <span className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                              ✕
                            </span>
                            <div className="flex-1">
                              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                                Đáp án sai 3 (Cột F)
                              </span>
                              <input
                                type="text"
                                value={q.wrongAnswer3}
                                onChange={e => handleUpdateQuestion(q.id, 'wrongAnswer3', e.target.value)}
                                className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-medium text-sm outline-none focus:border-slate-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/50 space-y-1">
                          <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                            Các đáp án đúng được chấp nhận (Cột C - Ngăn cách bởi dấu |):
                          </label>
                          <input
                            type="text"
                            value={q.correctAnswer}
                            onChange={e => handleUpdateQuestion(q.id, 'correctAnswer', e.target.value)}
                            placeholder="Ví dụ: con chuột | chuột máy tính"
                            className="w-full bg-slate-900/90 border border-emerald-500/40 rounded-lg px-3 py-2 text-white font-medium text-sm outline-none"
                          />
                          <p className="text-[11px] text-slate-400">
                            💡 Câu hỏi dạng điền từ: Cột D, E, F sẽ tự động để trống.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EXPORT TO GOOGLE SHEETS */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="bg-slate-800/80 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-2xl space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📤</span>
                <div>
                  <h2 className="text-2xl font-black text-amber-300">
                    Xuất câu hỏi vào Google Sheets ({questions.length} câu)
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Dữ liệu được định dạng hoàn toàn chuẩn xác theo cấu trúc 6 cột (A: Ảnh | B: Câu hỏi | C: Đáp án đúng | D, E, F: Đáp án sai)
                  </p>
                </div>
              </div>

              {/* Notification Banner */}
              {copyNotification && (
                <div className="bg-emerald-900/50 border border-emerald-400 p-4 rounded-2xl text-emerald-200 font-bold text-sm flex items-center gap-3 animate-bounce">
                  <span className="text-2xl">🎉</span>
                  <span>{copyNotification}</span>
                </div>
              )}

              {/* Method 1: 1-Click Copy */}
              <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900/60 p-6 rounded-2xl border border-indigo-500/40 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                      Cách 1: Khuyên Dùng (Nhanh Nhất)
                    </span>
                    <h3 className="text-xl font-bold text-white mt-2">
                      📋 Sao chép dữ liệu để Dán thẳng vào Google Sheets
                    </h3>
                    <p className="text-slate-300 text-xs mt-1">
                      Chỉ cần bấm 1 nút ➔ mở Google Sheets ➔ bấm <strong>Ctrl + V</strong> tại ô A1 là tự động phân bổ vào 6 cột!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyForGoogleSheets}
                    className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black rounded-xl text-base shadow-lg shadow-emerald-600/30 transition-transform hover:scale-105 active:scale-95 shrink-0"
                  >
                    Sao chép ngay (Ctrl+C)
                  </button>
                </div>

                <div className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span>🔗 Google Spreadsheet của Game:</span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${defaultSpreadsheetId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 font-semibold underline hover:text-amber-300"
                    >
                      Mở Google Sheets câu hỏi ↗
                    </a>
                  </div>
                  <span className="text-slate-400">
                    💡 Mẹo: Bạn có thể tạo thêm Sheet mới trong file đó với tên khối lớp (ví dụ: &quot;Lop 3 - Bai 1&quot;).
                  </span>
                </div>
              </div>

              {/* Method 2 & 3: CSV Download and Playtest */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 2: CSV */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cách 2: File bảng tính</span>
                    <h4 className="font-bold text-lg text-slate-200 mt-1">💾 Tải file CSV chuẩn UTF-8</h4>
                    <p className="text-slate-400 text-xs mt-1">
                      Tải về máy tính dưới dạng file CSV để import vào Google Sheets hoặc lưu trữ dự phòng.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={selectedSheetName}
                      onChange={e => setSelectedSheetName(e.target.value)}
                      placeholder="Tên file..."
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleDownloadCSV}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition-colors shrink-0"
                    >
                      Tải CSV
                    </button>
                  </div>
                </div>

                {/* Method 3: Playtest */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Kiểm tra trải nghiệm</span>
                    <h4 className="font-bold text-lg text-slate-200 mt-1">🎮 Chơi thử ngay bộ câu hỏi này</h4>
                    <p className="text-slate-400 text-xs mt-1">
                      Nạp trực tiếp bộ câu hỏi bạn vừa tạo vào game để thử nghiệm thao tác và trả lời như học sinh.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePlayTestCurrent}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm transition-transform hover:scale-[1.02] shadow-md shadow-indigo-500/20"
                  >
                    Bắt đầu chơi thử ngay ➔
                  </button>
                </div>
              </div>
            </div>

            {/* Live Table Preview */}
            <div className="bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2">
                  <span>📊</span> Bảng xem trước cấu trúc Google Sheets (Preview)
                </h3>
                <span className="text-xs text-slate-400">{questions.length} dòng dữ liệu</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-700">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-300 font-bold border-b border-slate-700 uppercase tracking-wider">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 w-32">Cột A: Ảnh</th>
                      <th className="p-3 min-w-[200px]">Cột B: Câu hỏi</th>
                      <th className="p-3 min-w-[150px] text-emerald-400 bg-emerald-950/20">Cột C: Đáp án ĐÚNG</th>
                      <th className="p-3 min-w-[120px]">Cột D: Sai 1</th>
                      <th className="p-3 min-w-[120px]">Cột E: Sai 2</th>
                      <th className="p-3 min-w-[120px]">Cột F: Sai 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-medium">
                    {questions.map((q, i) => (
                      <tr key={q.id} className="hover:bg-slate-750 transition-colors">
                        <td className="p-3 text-center text-slate-500 font-mono">{i + 1}</td>
                        <td className="p-3 text-slate-400 truncate max-w-[120px]" title={q.questionImg}>
                          {q.questionImg || <span className="text-slate-600 italic">Trống</span>}
                        </td>
                        <td className="p-3 text-white font-semibold">{q.questionText}</td>
                        <td className="p-3 text-emerald-300 bg-emerald-950/20 font-bold">{q.correctAnswer}</td>
                        <td className="p-3 text-slate-400">{q.type === 'input' ? <span className="text-slate-600">-</span> : q.wrongAnswer1}</td>
                        <td className="p-3 text-slate-400">{q.type === 'input' ? <span className="text-slate-600">-</span> : q.wrongAnswer2}</td>
                        <td className="p-3 text-slate-400">{q.type === 'input' ? <span className="text-slate-600">-</span> : q.wrongAnswer3}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
