import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// --- Firebase Init ---
let app, auth, db, appId;
if (typeof window !== 'undefined' && typeof __firebase_config !== 'undefined') {
  try {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  } catch (e) { console.error("Firebase init error", e); }
}

// --- SVGs và Icons ---
const ChestIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
    <path d="M4 8C4 6.89543 4.89543 6 6 6H18C19.1046 6 20 6.89543 20 8V9H4V8Z" fill="#8B4513" stroke="#5C2E0B" strokeWidth="2"/>
    <path d="M4 11V16C4 17.1046 4.89543 18 6 18H18C19.1046 18 20 17.1046 20 16V11H4Z" fill="#A0522D" stroke="#5C2E0B" strokeWidth="2"/>
    <rect x="10" y="9" width="4" height="4" rx="1" fill="#FFD700" stroke="#B8860B" strokeWidth="1.5"/>
    <path d="M4 11H20" stroke="#5C2E0B" strokeWidth="2"/>
    <circle cx="12" cy="11" r="1" fill="#5C2E0B"/>
  </svg>
);

const DiamondIcon = ({ colorClass }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={`w-full h-full ${colorClass} drop-shadow-md`}>
    <path d="M12 2L2 10L12 22L22 10L12 2Z" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
    <path d="M2 10H22M12 2V22M6 6L8 16M18 6L16 16" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
  </svg>
);

const BoneIcon = ({ colorClass }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={`w-full h-full ${colorClass} drop-shadow-md`} style={{transform: 'rotate(45deg)'}}>
    <path d="M12 2a4 4 0 0 0-3 6.6V15.4A4 4 0 1 0 12 22a4 4 0 0 0 3-6.6V8.6A4 4 0 1 0 12 2z" />
  </svg>
);

// --- Constants ---
const SPREADSHEET_ID = '1R4caBv-wVn5JvVcXLoP3W3uLAK7roDg5bXn8NSRnRN4';
const RESULTS_SPREADSHEET_ID = '1XK1iDZLR9yhvurMMmjGoeYjMdd4ltVEq_tKsscF_MxQ';
const API_KEY = 'AIzaSyAYTjY_oH7M5v41Zt-h2o8bFQ_p2M2fVsY';
const ITEM_TYPES = {
  GREEN: { id: 'green', color: 'text-green-500', points: 10, action: 'Chuột TRÁI', isDiamond: true },
  BLUE: { id: 'blue', color: 'text-blue-500', points: 10, action: 'Chuột PHẢI', isDiamond: true },
  YELLOW: { id: 'yellow', color: 'text-yellow-400', points: 15, action: 'Nháy ĐÚP', isDiamond: true },
  RED: { id: 'red', color: 'text-red-500', points: 20, action: 'KÉO THẢ', isDiamond: true },
  BONE: { id: 'bone', color: 'text-gray-300', points: -20, action: 'Tránh xa', isDiamond: false }
};

// --- Helpers ---
const parseAnswerString = (str) => {
  const s = String(str).trim();
  if (s.startsWith('img:')) {
    return { isImg: true, url: s.substring(4).trim(), text: '', isCorrect: false };
  }
  return { isImg: false, url: null, text: s, isCorrect: false };
};

export default function App() {
  // Game States
  const [gameState, setGameState] = useState('start'); // start, loading, question, minigame, result
  const [studentCode, setStudentCode] = useState('');
  const [grade, setGrade] = useState('');
  const [difficulty, setDifficulty] = useState('Kho'); // 'De' or 'Kho'
  const [availableSheets, setAvailableSheets] = useState([]);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);
  const [sheetFetchError, setSheetFetchError] = useState('');
  const [gameDuration, setGameDuration] = useState(300); // Default 5 mins (300s)
  const [totalTimeLeft, setTotalTimeLeft] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0); // For triggering minigame
  const [timeLeft, setTimeLeft] = useState(30);
  const [inputText, setInputText] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [isWaitingNext, setIsWaitingNext] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Statistics States
  const [statsData, setStatsData] = useState([]);
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  // Tracking Stats
  const [stats, setStats] = useState({
    quiz_correct: 0,
    quiz_wrong: 0,
    treasure_opened: false,
    green_collected: 0,
    blue_collected: 0,
    gold_collected: 0,
    red_collected: 0
  });
  const [hasSaved, setHasSaved] = useState(false);
  const [user, setUser] = useState(null);

  // --- Firebase Auth ---
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Minigame States
  const [diamonds, setDiamonds] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [minigameTimeLeft, setMinigameTimeLeft] = useState(20);
  const chestRef = useRef(null);
  const gameAreaRef = useRef(null);
  
  // Use a ref for draggingId to prevent interval resets inside useEffect
  const draggingIdRef = useRef(null);
  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);

  // --- Statistics Fetching ---
  const fetchStatistics = async () => {
    setGameState('statistics');
    setIsFetchingStats(true);
    setStatsError('');
    try {
      const url = `https://docs.google.com/spreadsheets/d/${RESULTS_SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Results`;
      const response = await fetch(url);
      const text = await response.text();
      
      const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const data = JSON.parse(jsonStr);
      
      const parsedData = data.table.rows.map((row, index) => {
        return {
          id: index,
          sessionId: row.c[0]?.v || '',
          studentCode: row.c[1]?.v || 'Ẩn danh',
          questionSet: row.c[2]?.v || '',
          mode: row.c[3]?.v || '',
          treasureOpened: row.c[4]?.v === true || row.c[4]?.v === 'TRUE' || row.c[4]?.v === 1 || String(row.c[4]?.v).toLowerCase() === 'true',
          correct: Number(row.c[5]?.v) || 0,
          wrong: Number(row.c[6]?.v) || 0,
          green: Number(row.c[7]?.v) || 0,
          blue: Number(row.c[8]?.v) || 0,
          gold: Number(row.c[9]?.v) || 0,
          red: Number(row.c[10]?.v) || 0,
          completedAt: row.c[11]?.f || row.c[11]?.v || ''
        };
      });
      
      setStatsData(parsedData);
    } catch (err) {
      console.error(err);
      setStatsError('Không thể tải dữ liệu thống kê. Vui lòng kiểm tra lại Google Sheet có tên là "Results".');
    } finally {
      setIsFetchingStats(false);
    }
  };

  const aggregates = useMemo(() => {
    const totalPlays = statsData.length;
    if (totalPlays === 0) return null;

    let totalCorrect = 0;
    let totalWrong = 0;
    let totalOpened = 0;
    let totalGreen = 0;
    let totalBlue = 0;
    let totalGold = 0;
    let totalRed = 0;

    statsData.forEach(d => {
      totalCorrect += d.correct;
      totalWrong += d.wrong;
      if (d.treasureOpened) totalOpened += 1;
      totalGreen += d.green;
      totalBlue += d.blue;
      totalGold += d.gold;
      totalRed += d.red;
    });

    const accuracy = totalCorrect + totalWrong > 0 ? (totalCorrect / (totalCorrect + totalWrong)) * 100 : 0;
    const openRate = (totalOpened / totalPlays) * 100;

    const diamondData = [
      { name: 'Xanh lá', value: totalGreen, color: '#10b981' },
      { name: 'Xanh lam', value: totalBlue, color: '#3b82f6' },
      { name: 'Vàng', value: totalGold, color: '#eab308' },
      { name: 'Đỏ', value: totalRed, color: '#ef4444' }
    ];

    const quizData = [
      { name: 'Đúng', value: totalCorrect, color: '#10b981' },
      { name: 'Sai', value: totalWrong, color: '#ef4444' }
    ];

    return { totalPlays, accuracy, openRate, diamondData, quizData };
  }, [statsData]);

  const uniqueStudents = useMemo(() => {
    const students = new Set(statsData.map(d => d.studentCode));
    return Array.from(students).filter(s => s && s !== 'Ẩn danh');
  }, [statsData]);

  const studentProgressData = useMemo(() => {
    if (!selectedStudent) return [];
    return statsData
      .filter(d => d.studentCode === selectedStudent)
      .map((d, i) => ({
        name: `Lần ${i + 1}`,
        score: d.green * 10 + d.blue * 10 + d.gold * 15 + d.red * 20,
        correct: d.correct,
        date: d.completedAt
      }));
  }, [statsData, selectedStudent]);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchSheetNames = async () => {
      setIsFetchingSheets(true);
      setSheetFetchError('');
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Lỗi tải danh sách bộ câu hỏi. Hãy kiểm tra lại API Key.');
        }
        const data = await response.json();
        const sheetTitles = data.sheets
          .map(sheet => sheet.properties.title)
          .filter(title => title.toLowerCase() !== 'results' && title.toLowerCase() !== 'kết quả');
        setAvailableSheets(sheetTitles);
        if (sheetTitles.length > 0) {
          setGrade(sheetTitles[0]); // Đặt mặc định là sheet đầu tiên tìm thấy
        }
      } catch (error) {
        console.error(error);
        setSheetFetchError(error.message);
      } finally {
        setIsFetchingSheets(false);
      }
    };

    if (gameState === 'start') {
      fetchSheetNames();
    }
  }, [gameState]);

  const fetchQuestions = async (selectedGrade) => {
    setGameState('loading');
    setLoadingError('');
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${selectedGrade}`;
      const response = await fetch(url);
      const text = await response.text();
      
      const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const data = JSON.parse(jsonStr);
      
      const parsedQuestions = data.table.rows.map(row => {
        const imgRaw = row.c[0]?.v ? String(row.c[0].v).trim() : '';
        const qTextRaw = row.c[1]?.v ? String(row.c[1].v).trim() : '';
        const correctRaw = row.c[2]?.v ? String(row.c[2].v).trim() : '';
        const wrongsRaw = [row.c[3]?.v, row.c[4]?.v, row.c[5]?.v].filter(Boolean).map(v => String(v).trim());
        
        // Bỏ qua nếu không có câu hỏi (hoặc không có ảnh) VÀ không có đáp án đúng
        if ((!qTextRaw && !imgRaw) || !correctRaw) return null;

        // Xử lý Cột A (Link ảnh)
        let qImg = imgRaw;
        if (qImg.startsWith('img:')) {
          qImg = qImg.substring(4).trim();
        }

        // Kiểm tra loại câu hỏi
        if (wrongsRaw.length === 0) {
          const correctAnswers = correctRaw.split('|').map(s => s.trim());
          return { questionText: qTextRaw, questionImg: qImg, type: 'input', correctAnswers: correctAnswers };
        } else {
          const correctAns = parseAnswerString(correctRaw);
          correctAns.isCorrect = true;

          const wrongAns = wrongsRaw.map(w => {
            const parsed = parseAnswerString(w);
            parsed.isCorrect = false;
            return parsed;
          });

          const allAnswers = [correctAns, ...wrongAns];
          allAnswers.sort(() => Math.random() - 0.5); // Xáo trộn đáp án
          return { questionText: qTextRaw, questionImg: qImg, type: 'choice', answers: allAnswers };
        }
      }).filter(Boolean);

      if (parsedQuestions.length === 0) throw new Error("Không tìm thấy câu hỏi nào trong Sheet này.");
      
      setQuestions(parsedQuestions);
      setCurrentQIndex(Math.floor(Math.random() * parsedQuestions.length));
      setCorrectCount(0);
      setStats({
        quiz_correct: 0,
        quiz_wrong: 0,
        treasure_opened: false,
        green_collected: 0,
        blue_collected: 0,
        gold_collected: 0,
        red_collected: 0
      });
      setHasSaved(false);
      setTotalTimeLeft(gameDuration);
      setGameState('question');
      setTimeLeft(30);
      setInputText('');
      setIsWaitingNext(false);
      setFeedback(null);
    } catch (err) {
      console.error(err);
      setLoadingError('Lỗi tải dữ liệu. Hãy chắc chắn Google Sheet đã được chia sẻ "Bất kỳ ai có liên kết".');
      setGameState('start');
    }
  };

  // --- Total Game Timer ---
  useEffect(() => {
    let timer;
    if ((gameState === 'question' || gameState === 'minigame') && totalTimeLeft > 0) {
      timer = setInterval(() => setTotalTimeLeft(prev => prev - 1), 1000);
    } else if ((gameState === 'question' || gameState === 'minigame') && totalTimeLeft <= 0) {
      setGameState('result');
    }
    return () => clearInterval(timer);
  }, [gameState, totalTimeLeft]);

  // --- Question Timer ---
  useEffect(() => {
    let timer;
    // Dừng đồng hồ đếm ngược câu hỏi nếu đã đạt đủ 5 câu
    if (gameState === 'question' && timeLeft > 0 && !isWaitingNext && correctCount < 5) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (gameState === 'question' && timeLeft === 0 && !isWaitingNext && correctCount < 5) {
      handleAnswer(false, null);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, isWaitingNext, correctCount]);

  // --- Handle Answer ---
  const handleAnswer = (isCorrect, selectedIdx = null) => {
    if (isWaitingNext || correctCount >= 5) return;
    setIsWaitingNext(true);

    const q = questions[currentQIndex];
    let feedbackMsg = '';
    
    if (q.type === 'input') {
      if (isCorrect) {
        feedbackMsg = 'ĐÚNG!';
      } else {
        feedbackMsg = `SAI! Đáp án đúng là: ${q.correctAnswers.join(' hoặc ')}`;
      }
    }

    setFeedback({
      isCorrect,
      selectedIdx,
      message: feedbackMsg
    });

    // Cập nhật thống kê số câu đúng/sai
    setStats(prev => ({
      ...prev,
      quiz_correct: isCorrect ? prev.quiz_correct + 1 : prev.quiz_correct,
      quiz_wrong: !isCorrect ? prev.quiz_wrong + 1 : prev.quiz_wrong
    }));

    const newCorrectCount = isCorrect ? correctCount + 1 : (difficulty === 'Kho' ? 0 : correctCount);
    setCorrectCount(newCorrectCount);

    setTimeout(() => {
      setIsWaitingNext(false);
      setFeedback(null);
      if (newCorrectCount >= 5 && isCorrect) {
        // Kho báu đã đầy 100%, chờ người chơi click vào kho báu để vào minigame
      } else {
        handleNextQuestion();
      }
    }, 2500); // Đợi 2.5 giây để người chơi xem kết quả
  };

  const handleInputSubmit = () => {
    if (isWaitingNext || !inputText.trim() || correctCount >= 5) return;
    const q = questions[currentQIndex];
    const isCorrect = q.correctAnswers.includes(inputText.trim());
    handleAnswer(isCorrect, null);
  };

  const handleNextQuestion = () => {
    if (questions.length > 0) {
      setCurrentQIndex(Math.floor(Math.random() * questions.length));
      setTimeLeft(30);
      setInputText('');
      setIsWaitingNext(false);
      setFeedback(null);
    }
  };

  // --- Minigame Logic ---
  const startMinigame = () => {
    setGameState('minigame');
    setCorrectCount(0);
    setMinigameTimeLeft(20);
    setDiamonds([]);
    setFloatingTexts([]);
    setStats(prev => ({ ...prev, treasure_opened: true }));
  };

  useEffect(() => {
    if (gameState !== 'minigame') return;

    // Spawner
    const spawnInterval = setInterval(() => {
      const types = Object.values(ITEM_TYPES);
      const randomType = types[Math.floor(Math.random() * types.length)];
      
      let vx = (Math.random() - 0.5) * 8;
      let vy = (Math.random() - 0.5) * 8;
      let size = Math.random() * 20 + 35; // Size between 35-55px

      // Làm chậm và to hơn đối với kim cương vàng
      if (randomType.id === 'yellow') {
        vx *= 0.35; // Giảm 65% tốc độ
        vy *= 0.35;
        size += 15; // Tăng kích thước thêm 15px để dễ click đúp
      }

      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: randomType,
        x: window.innerWidth / 2 - 25, // center X roughly
        y: window.innerHeight / 2 - 25, // center Y roughly
        vx: vx,
        vy: vy,
        size: size
      };
      setDiamonds(prev => [...prev, newItem]);
    }, 1000);

    // Movement Loop
    const moveInterval = setInterval(() => {
      setDiamonds(prev => prev.map(d => {
        if (d.id === draggingIdRef.current) return d; // Don't move if dragging
        
        let newX = d.x + d.vx;
        let newY = d.y + d.vy;
        
        // Bounce off walls
        let newVx = d.vx;
        let newVy = d.vy;
        if (newX <= 0 || newX >= window.innerWidth - d.size) newVx *= -1;
        if (newY <= 150 || newY >= window.innerHeight - d.size) newVy *= -1; // Keep below header

        return { ...d, x: Math.max(0, Math.min(newX, window.innerWidth - d.size)), y: Math.max(150, Math.min(newY, window.innerHeight - d.size)), vx: newVx, vy: newVy };
      }));
    }, 30);

    // 20 seconds countdown timer for minigame
    const countdownInterval = setInterval(() => {
      setMinigameTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(spawnInterval);
          clearInterval(moveInterval);
          clearInterval(countdownInterval);
          setDiamonds([]);
          handleNextQuestion();
          setGameState('question');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(moveInterval);
      clearInterval(countdownInterval);
    };
  }, [gameState]); // Loại bỏ draggingId khỏi dependency để không bị reset thời gian

  // --- Mouse Actions ---
  const handleDiamondAction = (e, item, actionType) => {
    e.preventDefault(); // Prevent default contexts
    e.stopPropagation();

    if (item.type.id === 'bone') {
      setScore(prev => prev - 20); // Trừ điểm nếu chạm vào xương
      setDiamonds(prev => prev.filter(d => d.id !== item.id));
      return;
    }

    if (actionType === 'left' && item.type.id === 'green') {
      collectDiamond(item);
    } else if (actionType === 'right' && item.type.id === 'blue') {
      collectDiamond(item);
    } else if (actionType === 'double' && item.type.id === 'yellow') {
      collectDiamond(item);
    }
  };

  const collectDiamond = (item) => {
    setScore(prev => prev + item.type.points);
    setDiamonds(prev => prev.filter(d => d.id !== item.id));

    // Lưu dữ liệu số lượng thu thập
    setStats(prev => {
      const newStats = { ...prev };
      if (item.type.id === 'green') newStats.green_collected += 1;
      else if (item.type.id === 'blue') newStats.blue_collected += 1;
      else if (item.type.id === 'yellow') newStats.gold_collected += 1;
      else if (item.type.id === 'red') newStats.red_collected += 1;
      return newStats;
    });

    // Thêm số điểm nổi lên màn hình
    const textId = Math.random().toString(36).substring(2, 9);
    setFloatingTexts(prev => [...prev, {
      id: textId,
      x: item.x,
      y: item.y,
      text: item.type.points > 0 ? `+${item.type.points}` : `${item.type.points}`,
      color: item.type.points > 0 ? 'text-green-400' : 'text-red-500'
    }]);

    // Xóa số điểm nổi sau 1 giây
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== textId));
    }, 1000);
  };

  // --- Drag and Drop Logic ---
  const handleMouseDown = (e, item) => {
    if (item.type.id === 'bone') {
      handleDiamondAction(e, item, 'left'); // Bấm giữ cũng bị coi là nhầm
    } else if (item.type.id === 'red') {
      setDraggingId(item.id);
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!draggingIdRef.current) return;
    setDiamonds(prev => prev.map(d => {
      if (d.id === draggingIdRef.current) {
        return { ...d, x: e.clientX - d.size / 2, y: e.clientY - d.size / 2 };
      }
      return d;
    }));
  }, []);

  const handleMouseUp = useCallback((e) => {
    if (!draggingIdRef.current) return;
    
    // Check collision with chest
    if (chestRef.current) {
      const chestRect = chestRef.current.getBoundingClientRect();
      const draggedDiamond = diamonds.find(d => d.id === draggingIdRef.current);
      
      if (draggedDiamond) {
        const dCenterX = draggedDiamond.x + draggedDiamond.size / 2;
        const dCenterY = draggedDiamond.y + draggedDiamond.size / 2;

        if (
          dCenterX >= chestRect.left &&
          dCenterX <= chestRect.right &&
          dCenterY >= chestRect.top &&
          dCenterY <= chestRect.bottom
        ) {
          collectDiamond(draggedDiamond);
        }
      }
    }
    setDraggingId(null);
  }, [diamonds]);

  useEffect(() => {
    if (gameState === 'minigame') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Touch support
      window.addEventListener('touchmove', (e) => handleMouseMove(e.touches[0]), { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [gameState, handleMouseMove, handleMouseUp]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- Database Saving Logic ---
  useEffect(() => {
    if (gameState === 'result' && !hasSaved) {
      setHasSaved(true);
      const saveToDb = async () => {
        const finalData = {
          session_id: crypto.randomUUID(),
          student_code: studentCode || 'Ẩn danh',
          question_set: grade,
          mode: difficulty,
          duration: gameDuration,
          ...stats,
          completed_at: new Date().toISOString()
        };

        // Lưu vào Firebase (Hệ thống nội bộ)
        if (user && db) {
          try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'Results'), finalData);
          } catch (e) {
            console.error("Lỗi lưu kết quả Firestore:", e);
          }
        }
        
        // Gửi dữ liệu tới Google Sheets thông qua Google Apps Script Web App (Webhook)
        const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyjmewgRQBg2utu9qQxYuNfFVMZ0XMtdBPnFoGAfQLNikkc17wbiDVvb0ZTxSwJ5TDQ/exec'; 
        if (GOOGLE_APP_SCRIPT_URL) {
          try {
            await fetch(GOOGLE_APP_SCRIPT_URL, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(finalData)
            });
          } catch (e) { console.error("Lỗi đẩy dữ liệu lên Google Sheets:", e); }
        }
      };
      saveToDb();
    }
  }, [gameState, hasSaved, stats, studentCode, grade, difficulty, gameDuration, score, appId, user, db]);

  // --- Renderers ---
  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-4 text-white font-sans selection:bg-none select-none overflow-y-auto">
        <div className="bg-white/10 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-white/20 max-w-2xl w-full my-8">
          <h2 className="text-4xl font-black mb-6 text-yellow-400 text-center">HƯỚNG DẪN LUẬT CHƠI</h2>
          <div className="space-y-6 text-lg">
            <div className="bg-black/20 p-4 rounded-xl border border-white/10">
              <h3 className="text-2xl font-bold text-blue-300 mb-2">1. Trả lời câu hỏi</h3>
              <p>Trả lời các câu hỏi trắc nghiệm hoặc điền từ. Mỗi câu có 30 giây.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-indigo-100 text-base">
                <li><strong className="text-white">Chế độ Dễ:</strong> Cứ tích luỹ đủ 5 câu đúng là mở được kho báu.</li>
                <li><strong className="text-white">Chế độ Khó:</strong> Phải trả lời đúng <strong>liên tiếp</strong> 5 câu. Trả lời sai sẽ bị tính lại từ đầu!</li>
              </ul>
            </div>
            
            <div className="bg-black/20 p-4 rounded-xl border border-white/10">
              <h3 className="text-2xl font-bold text-emerald-300 mb-2">2. Minigame Thu Thập Kim Cương</h3>
              <p className="mb-4">Khi kho báu mở, kim cương sẽ văng ra. Hãy thu thập chúng bằng các thao tác chuột:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                  <div className="w-8 h-8"><DiamondIcon colorClass="text-green-500" /></div>
                  <div><p className="font-bold text-green-400">Kim cương xanh lá</p><p>Nhấn CHUỘT TRÁI (+10đ)</p></div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                  <div className="w-8 h-8"><DiamondIcon colorClass="text-blue-500" /></div>
                  <div><p className="font-bold text-blue-400">Kim cương xanh lam</p><p>Nhấn CHUỘT PHẢI (+10đ)</p></div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                  <div className="w-8 h-8"><DiamondIcon colorClass="text-yellow-400" /></div>
                  <div><p className="font-bold text-yellow-400">Kim cương vàng</p><p>NHÁY ĐÚP chuột (+15đ)</p></div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                  <div className="w-8 h-8"><DiamondIcon colorClass="text-red-500" /></div>
                  <div><p className="font-bold text-red-400">Kim cương đỏ</p><p>KÉO THẢ vào rương (+20đ)</p></div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 bg-red-500/20 p-2 rounded-lg border border-red-500/30">
                <div className="w-8 h-8"><BoneIcon colorClass="text-gray-300" /></div>
                <div><p className="font-bold text-red-300">Khúc xương (Tránh xa!)</p><p>Click nhầm bị trừ 20 điểm</p></div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowInstructions(false)}
            className="mt-8 w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xl uppercase transition-transform hover:scale-105"
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'start') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-4 text-white font-sans selection:bg-none select-none overflow-y-auto">
        <div className="bg-white/10 backdrop-blur-md p-8 md:p-10 rounded-3xl shadow-2xl border border-white/20 text-center max-w-lg w-full my-8">
          <h1 className="text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 filter drop-shadow-md">
            LUYỆN CHUỘT PRO
          </h1>
          <p className="text-sm font-light mb-8 text-indigo-100 italic">coded by chuhungls</p>

          {loadingError && <p className="text-red-300 bg-red-900/50 p-3 rounded-lg mb-6">{loadingError}</p>}

          <div className="mb-6 text-left">
            <h3 className="text-xl mb-2 font-semibold">Tên / Mã học sinh:</h3>
            <input 
              type="text" 
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="Nhập tên hoặc mã số của bạn..."
              className="w-full px-6 py-3 rounded-xl font-semibold text-slate-800 bg-white/90 focus:bg-white outline-none focus:ring-4 focus:ring-indigo-400/50 transition-all shadow-inner"
            />
          </div>

          <div className="mb-6">
            <h3 className="text-xl mb-4 font-semibold text-left">Chọn bộ câu hỏi:</h3>
            <div className="flex justify-center">
              {isFetchingSheets ? (
                <div className="px-6 py-3 rounded-xl font-bold text-white bg-white/20 animate-pulse w-full">
                  Đang tải danh sách...
                </div>
              ) : sheetFetchError ? (
                <p className="text-red-300 bg-red-900/50 p-3 rounded-lg text-sm w-full">{sheetFetchError}</p>
              ) : (
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="px-6 py-3 rounded-xl font-bold text-indigo-900 bg-yellow-400 hover:bg-yellow-300 transition-all duration-300 shadow-lg shadow-yellow-400/50 outline-none cursor-pointer text-xl w-full text-center appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23312E81%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '1rem auto' }}
                >
                  {availableSheets.map((sheetName) => (
                    <option key={sheetName} value={sheetName}>
                      {sheetName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl mb-4 font-semibold text-left">Chọn thời gian:</h3>
            <div className="flex flex-wrap gap-3">
              {[5, 10, 15, 30].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setGameDuration(mins * 60)}
                  className={`flex-1 py-2 rounded-xl font-bold transition-all duration-300 ${
                    gameDuration === mins * 60
                      ? 'bg-green-400 text-green-900 scale-105 shadow-lg shadow-green-400/50'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                >
                  {mins} phút
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl mb-4 font-semibold text-left">Độ khó:</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setDifficulty('De')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all duration-300 ${
                  difficulty === 'De'
                    ? 'bg-blue-400 text-blue-900 scale-105 shadow-lg shadow-blue-400/50'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                Dễ
              </button>
              <button
                onClick={() => setDifficulty('Kho')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all duration-300 ${
                  difficulty === 'Kho'
                    ? 'bg-red-400 text-red-900 scale-105 shadow-lg shadow-red-400/50'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                Khó
              </button>
            </div>
            <div className="mt-4 text-sm font-medium text-indigo-100 text-left bg-black/20 p-4 rounded-xl border border-white/10">
              <p className="mb-2"><span className="text-blue-300 font-bold">Chế độ Dễ:</span> Trả lời ĐỦ 5 CÂU ĐÚNG sẽ mở kho báu.</p>
              <p><span className="text-red-300 font-bold">Chế độ Khó:</span> Trả lời ĐÚNG LIÊN TIẾP 5 câu sẽ mở kho báu.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowInstructions(true)}
              className="flex-1 py-4 rounded-xl font-bold text-lg md:text-xl uppercase transition-transform shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105"
            >
              Hướng dẫn
            </button>
            <button
              onClick={fetchStatistics}
              className="flex-1 py-4 rounded-xl font-bold text-lg md:text-xl uppercase transition-transform shadow-lg bg-pink-600 hover:bg-pink-500 text-white hover:scale-105"
            >
              Thống kê
            </button>
            <button
              onClick={() => fetchQuestions(grade)}
              disabled={isFetchingSheets || availableSheets.length === 0}
              className={`flex-[2] py-4 rounded-xl font-black text-xl md:text-2xl uppercase tracking-wider transition-transform shadow-xl ${
                isFetchingSheets || availableSheets.length === 0
                  ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                  : 'bg-gradient-to-r from-green-400 to-emerald-600 hover:scale-105 shadow-green-500/30'
              }`}
            >
              Bắt đầu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'statistics') {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800 font-sans overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-black text-indigo-700">BÁO CÁO THỐNG KÊ</h1>
            <button 
              onClick={() => setGameState('start')}
              className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl shadow-md hover:bg-indigo-50 transition-colors border border-indigo-100"
            >
              Quay lại
            </button>
          </div>

          {isFetchingStats ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-xl font-bold text-indigo-500 animate-pulse">Đang tải dữ liệu từ Google Sheets...</div>
            </div>
          ) : statsError ? (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
              <p className="font-bold">Lỗi</p>
              <p>{statsError}</p>
            </div>
          ) : !aggregates ? (
            <div className="bg-yellow-50 border-2 border-yellow-200 text-yellow-700 p-8 rounded-2xl text-center font-medium text-xl shadow-sm">
              Chưa có dữ liệu thống kê nào. Hãy chơi vài lượt để xem báo cáo nhé!
            </div>
          ) : (
            <div className="space-y-8 pb-10">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                  <span className="text-slate-500 font-bold mb-2 uppercase tracking-wider text-sm">Tổng số lượt chơi</span>
                  <span className="text-6xl font-black text-indigo-600">{aggregates.totalPlays}</span>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                  <span className="text-slate-500 font-bold mb-2 uppercase tracking-wider text-sm">Tỷ lệ mở kho báu</span>
                  <span className="text-6xl font-black text-yellow-500">{aggregates.openRate.toFixed(1)}%</span>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                  <span className="text-slate-500 font-bold mb-2 uppercase tracking-wider text-sm">Tỷ lệ trả lời đúng</span>
                  <span className="text-6xl font-black text-green-500">{aggregates.accuracy.toFixed(1)}%</span>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quiz Chart */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-700 mb-6 text-center">Tỷ lệ trả lời câu hỏi</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={aggregates.quizData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {aggregates.quizData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Diamond Chart */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-700 mb-6 text-center">Tổng lượng kim cương đã thu thập</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aggregates.diamondData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontWeight: 'bold', fill: '#64748b'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                        <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {aggregates.diamondData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Student Progress */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                  <h3 className="text-2xl font-black text-slate-700">Tiến trình học sinh</h3>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="px-6 py-3 border-2 border-indigo-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-indigo-900 bg-slate-50 cursor-pointer shadow-inner"
                  >
                    <option value="">-- Chọn mã học sinh --</option>
                    {uniqueStudents.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {selectedStudent ? (
                  studentProgressData.length > 0 ? (
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={studentProgressData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontWeight: 'bold', fill: '#64748b'}} dy={10} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={(value) => `${value}đ`} tick={{fill: '#8b5cf6', fontWeight: 'bold'}} />
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#10b981', fontWeight: 'bold'}} />
                          <RechartsTooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                          />
                          <Legend wrapperStyle={{paddingTop: '20px'}}/>
                          <Line yAxisId="left" type="monotone" name="Điểm luyện chuột" dataKey="score" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 6, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                          <Line yAxisId="right" type="monotone" name="Số câu trả lời đúng" dataKey="correct" stroke="#10b981" strokeWidth={4} dot={{ r: 6, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-10 font-medium">Không đủ dữ liệu cho học sinh này.</p>
                  )
                ) : (
                  <div className="flex items-center justify-center h-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
                    <p className="text-slate-500 font-bold text-lg">Vui lòng chọn một học sinh để xem biểu đồ tiến trình.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-indigo-900 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse font-bold">Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (gameState === 'question') {
    const q = questions[currentQIndex];
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col p-4 select-none relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm">
          <div className="text-2xl font-black text-indigo-600">Điểm: <span className="text-yellow-500">{score}</span></div>
          <div className="flex flex-col items-center">
            <div className="text-xl font-bold text-slate-500">Câu hỏi ngẫu nhiên</div>
            <div className="text-sm font-semibold text-red-500">Tổng thời gian: {formatTime(totalTimeLeft)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xl text-red-500">
              {timeLeft}
            </div>
            <span className="text-slate-500 font-semibold">giây</span>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 flex flex-col items-center max-w-4xl mx-auto w-full">
          <div className="w-full bg-indigo-600 text-white p-6 rounded-3xl shadow-xl mb-8 flex items-stretch min-h-[150px]">
            {/* Cột Trái 1/5 (Ảnh) */}
            <div className="w-1/5 border-r-2 border-indigo-400/50 pr-4 flex flex-col items-center justify-center">
              {q.questionImg ? (
                <img src={q.questionImg} alt="Question" className="max-w-full max-h-32 object-contain rounded-xl shadow-md bg-white/10 p-1" />
              ) : (
                <span className="text-indigo-300 text-xs text-center italic">Không có ảnh</span>
              )}
            </div>
            
            {/* Cột Phải 4/5 (Văn bản) */}
            <div className="w-4/5 pl-6 flex items-center justify-center">
              <h2 className="text-2xl md:text-3xl font-bold leading-relaxed text-center" style={{ fontFamily: 'Verdana, Geneva, Tahoma, sans-serif' }}>
                {q.questionText || q.question}
              </h2>
            </div>
          </div>

          {q.type === 'input' ? (
            <div className="w-full flex flex-col items-center gap-4">
              <input
                type="text"
                value={inputText}
                disabled={isWaitingNext || correctCount >= 5}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInputSubmit();
                }}
                className={`w-full max-w-lg p-4 rounded-xl border-4 ${isWaitingNext && feedback ? (feedback.isCorrect ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-indigo-200 focus:border-indigo-500'} text-xl text-center font-bold focus:outline-none transition-colors`}
                style={{ fontFamily: 'Verdana, Geneva, Tahoma, sans-serif' }}
                placeholder="Nhập câu trả lời (phân biệt hoa thường)..."
                autoFocus
              />
              
              {isWaitingNext && feedback && (
                <div className={`w-full max-w-lg p-4 rounded-xl font-bold text-xl text-center animate-bounce ${feedback.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {feedback.message}
                </div>
              )}

              {!isWaitingNext && correctCount < 5 && (
                <button
                  onClick={handleInputSubmit}
                  className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl text-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-500/30"
                >
                  Gửi trả lời
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {q.answers.map((ans, idx) => {
                let btnClass = "bg-white p-6 rounded-2xl shadow-md text-xl font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border-2 border-transparent transition-all active:scale-95";
                let iconClass = "bg-indigo-100 text-indigo-600";
                
                if (isWaitingNext && feedback) {
                  if (ans.isCorrect) {
                    btnClass = "bg-green-100 p-6 rounded-2xl shadow-md text-xl font-semibold text-green-700 border-2 border-green-500 transition-all scale-[1.02]";
                    iconClass = "bg-green-200 text-green-800";
                  } else if (feedback.selectedIdx === idx) {
                    btnClass = "bg-red-100 p-6 rounded-2xl shadow-md text-xl font-semibold text-red-700 border-2 border-red-500 transition-all scale-[0.98]";
                    iconClass = "bg-red-200 text-red-800";
                  } else {
                    btnClass = "bg-slate-100 p-6 rounded-2xl shadow-sm text-xl font-semibold text-slate-400 border-2 border-transparent transition-all opacity-60";
                    iconClass = "bg-slate-200 text-slate-500";
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isWaitingNext || correctCount >= 5}
                    onClick={() => handleAnswer(ans.isCorrect, idx)}
                    className={`${btnClass} text-left flex items-center gap-4`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${iconClass}`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <div className="flex-1 flex items-center overflow-hidden">
                      {ans.isImg ? (
                        <img src={ans.url} alt="Đáp án" className="max-h-24 max-w-full object-contain rounded-lg shadow-sm bg-white" />
                      ) : (
                        <span className="break-words" style={{ fontFamily: 'Verdana, Geneva, Tahoma, sans-serif' }}>{ans.text}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Treasure Chest Progress (Small - Bottom) */}
          <div className="mt-8 flex flex-col items-center justify-center">
            <div 
              className={`relative w-24 h-24 md:w-32 md:h-32 transition-all duration-300 opacity-90 grayscale-[20%]`}
            >
              <ChestIcon />
            </div>
            <div className="mt-4 font-black text-2xl">
              <span className="text-slate-500">Tiến trình: <span className="text-emerald-500">{Math.min(100, correctCount * 20)}%</span></span>
            </div>
          </div>
        </div>

        {/* Giant Chest Overlay - Bắt buộc nhấn để chơi Minigame */}
        {correctCount >= 5 && !isWaitingNext && (
          <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center transition-all duration-500">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-12 drop-shadow-lg text-center px-4">
              KHO BÁU ĐÃ XUẤT HIỆN!
            </h2>
            <div 
              className="relative w-64 h-64 md:w-96 md:h-96 cursor-pointer hover:scale-110 transition-transform animate-bounce"
              onClick={() => startMinigame()}
            >
              <ChestIcon />
              <div className="absolute -inset-20 bg-yellow-500/40 blur-3xl rounded-full -z-10 animate-pulse"></div>
              <div className="absolute -inset-10 bg-yellow-300/20 blur-2xl rounded-full -z-10 animate-ping"></div>
            </div>
            <div 
              className="mt-12 font-black text-4xl md:text-6xl text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] animate-pulse cursor-pointer text-center" 
              onClick={() => startMinigame()}
            >
              NHẤN ĐỂ MỞ!
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'minigame') {
    return (
      <div 
        ref={gameAreaRef}
        className="min-h-screen bg-slate-900 overflow-hidden relative select-none"
        onContextMenu={(e) => e.preventDefault()} // Prevent global right click
      >
        <style>
          {`
            @keyframes floatUpFade {
              0% { opacity: 1; transform: translateY(0) scale(1); }
              100% { opacity: 0; transform: translateY(-50px) scale(1.5); }
            }
            .floating-score {
              animation: floatUpFade 1s ease-out forwards;
            }
          `}
        </style>

        {/* Header HUD */}
        <div className="absolute top-0 left-0 w-full bg-slate-800/80 backdrop-blur text-white p-4 flex justify-between items-center z-50 border-b border-slate-700 shadow-xl">
          <div className="font-black text-2xl text-yellow-400 drop-shadow-md hidden md:block md:w-32 lg:w-48 text-left">ĐIỂM: {score}</div>
          
          <div className="flex flex-col items-center gap-2 mx-auto">
            {/* Dòng trên */}
            <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
              {[ITEM_TYPES.GREEN, ITEM_TYPES.BLUE].map(type => (
                <div key={type.id} className="flex items-center gap-2 bg-slate-700/50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-slate-600">
                  <div className="w-5 h-5 md:w-6 md:h-6"><DiamondIcon colorClass={type.color} /></div>
                  <span className="text-xs md:text-sm font-semibold whitespace-nowrap">{type.action} (+{type.points})</span>
                </div>
              ))}
            </div>
            {/* Dòng dưới */}
            <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
              {[ITEM_TYPES.YELLOW, ITEM_TYPES.RED, ITEM_TYPES.BONE].map(type => (
                <div key={type.id} className="flex items-center gap-2 bg-slate-700/50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-slate-600">
                  <div className="w-5 h-5 md:w-6 md:h-6">
                    {type.isDiamond ? <DiamondIcon colorClass={type.color} /> : <BoneIcon colorClass={type.color} />}
                  </div>
                  <span className={`text-xs md:text-sm font-semibold whitespace-nowrap ${!type.isDiamond ? 'text-red-400' : ''}`}>
                    {type.action} ({type.points})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute top-2 left-2 md:hidden font-black text-xl text-yellow-400 drop-shadow-md">ĐIỂM: {score}</div>
          
          <div className="absolute top-2 right-2 md:relative md:top-auto md:right-auto flex flex-col items-end md:items-center w-auto md:w-32 lg:w-48">
            <span className="text-emerald-400 font-bold text-xs md:text-base text-right whitespace-nowrap">Tổng: {formatTime(totalTimeLeft)}</span>
            <span className="text-red-400 font-black animate-pulse text-sm md:text-lg whitespace-nowrap">Còn: {minigameTimeLeft}s</span>
          </div>
        </div>

        {/* Chest (Center) */}
        <div 
          ref={chestRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-48 md:h-48 z-10 transition-transform duration-200 hover:scale-105 pointer-events-none"
        >
          <ChestIcon />
          <div className="absolute -inset-10 bg-yellow-500/20 blur-2xl rounded-full -z-10 animate-pulse"></div>
        </div>

        {/* Floating Scores */}
        {floatingTexts.map(ft => (
          <div
            key={ft.id}
            className={`absolute z-50 font-black text-3xl drop-shadow-lg pointer-events-none floating-score ${ft.color}`}
            style={{ left: `${ft.x}px`, top: `${ft.y}px` }}
          >
            {ft.text}
          </div>
        ))}

        {/* Diamonds & Bones */}
        {diamonds.map(d => (
          <div
            key={d.id}
            className="absolute z-20 transition-transform cursor-pointer"
            style={{
              left: `${d.x}px`,
              top: `${d.y}px`,
              width: `${d.size}px`,
              height: `${d.size}px`,
              transform: d.id === draggingId ? 'scale(1.2)' : 'scale(1)',
              transition: d.id === draggingId ? 'none' : 'transform 0.1s' // Disable transition while dragging for smoothness
            }}
            onClick={(e) => handleDiamondAction(e, d, 'left')}
            onContextMenu={(e) => handleDiamondAction(e, d, 'right')}
            onDoubleClick={(e) => handleDiamondAction(e, d, 'double')}
            onMouseDown={(e) => handleMouseDown(e, d)}
            onTouchStart={(e) => handleMouseDown(e.touches[0], d)} // Touch support
          >
            {d.type.isDiamond ? <DiamondIcon colorClass={d.type.color} /> : <BoneIcon colorClass={d.type.color} />}
          </div>
        ))}
      </div>
    );
  }

  if (gameState === 'result') {
    return (
      <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-4 text-white">
        <h1 className="text-5xl font-black mb-6 text-yellow-400">HOÀN THÀNH!</h1>
        <p className="text-2xl mb-8">Tổng điểm của bạn: <span className="font-bold text-4xl text-green-400">{score}</span></p>
        <button
          onClick={() => {
            setGameState('start');
            setScore(0);
          }}
          className="px-8 py-4 bg-white text-indigo-900 font-bold rounded-xl text-xl hover:bg-indigo-100 transition-colors"
        >
          Chơi lại
        </button>
      </div>
    );
  }

  return null;
}