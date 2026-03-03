/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Slider from '@radix-ui/react-slider';
import { 
  Trophy, Volume2, ChevronLeft, CheckCircle2, 
  XCircle, Rocket, RotateCcw, Award, Lightbulb, Users, Clock, AlertCircle,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WORD_DATABASE, Word } from './data/wordDatabase';

// ==========================================
// 2. Service: clsStorage (本地存檔模組)
// ==========================================
type ScoreRecord = {
  id: string;
  date: string;
  name: string;
  score: number;
  timeTaken: number;
  isMultiplayer: boolean;
  seatNumber?: string;
};

class StorageService {
  private static KEY = 'WORD_KING_RECORDS_V4';

  public static saveRecord(record: Omit<ScoreRecord, 'id' | 'date'>) {
    const records = this.getRecords();
    const newRecord: ScoreRecord = {
      ...record,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toLocaleString('zh-TW', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false 
      }),
    };
    records.push(newRecord);
    const limitedRecords = records.slice(-100);
    localStorage.setItem(this.KEY, JSON.stringify(limitedRecords));
  }

  public static getRecords(): ScoreRecord[] {
    const data = localStorage.getItem(this.KEY);
    return data ? JSON.parse(data) : [];
  }

  public static clearRecords() {
    localStorage.removeItem(this.KEY);
  }
}

// ==========================================
// 3. Controller: clsGameEngine (遊戲核心類別)
// ==========================================
enum GameMode { DRAG_DROP, FLASHCARDS }

type LetterFilter = 'less_than_4' | 'exactly_4' | 'more_than_4' | null;

class GameEngine {
  public words: Word[] = [];
  public currentIndex: number = 0;
  public correctCount: number = 0;
  public isAllMode: boolean = false;
  public range: [number, number] | null = null;
  public letterFilter: LetterFilter = null;

  constructor(grade: number, isAll: boolean = false, range?: [number, number], randomize: boolean = false, letterFilter: LetterFilter = null) {
    this.isAllMode = isAll;
    this.range = range || null;
    this.letterFilter = letterFilter;
    this.initSession(grade, isAll, range, randomize, letterFilter);
  }

  private initSession(grade: number, isAll: boolean, range?: [number, number], randomize: boolean = false, letterFilter: LetterFilter = null) {
    let limit = 100;
    if (grade === 4) limit = 150;
    if (grade === 5) limit = 200;
    if (grade === 6) limit = 311;

    let pool = WORD_DATABASE.filter(w => w.id <= limit);
    
    // Apply range filter
    if (range) {
      pool = pool.filter(w => w.id >= range[0] && w.id <= range[1]);
    }

    // Apply letter filter
    if (letterFilter) {
      if (letterFilter === 'less_than_4') pool = pool.filter(w => w.en.length < 4);
      else if (letterFilter === 'exactly_4') pool = pool.filter(w => w.en.length === 4);
      else if (letterFilter === 'more_than_4') pool = pool.filter(w => w.en.length > 4);
    }

    // Randomize if requested
    if (randomize) {
      pool = pool.sort(() => Math.random() - 0.5);
    }

    // Set words based on mode
    if (isAll) {
      this.words = pool;
    } else {
      this.words = pool.slice(0, 10);
    }
  }

  public get currentWord(): Word {
    return this.words[this.currentIndex];
  }

  public checkAnswer(input: string): boolean {
    const isCorrect = input.toLowerCase().trim() === this.currentWord.en.toLowerCase();
    if (isCorrect) {
      this.correctCount++;
    }
    return isCorrect;
  }

  public get score(): number {
    if (this.words.length === 0) return 0;
    return Math.round((this.correctCount / this.words.length) * 100);
  }

  public next() {
    this.currentIndex++;
  }

  public get isFinished(): boolean {
    return this.currentIndex >= this.words.length;
  }

  public getProgress(): number {
    return (this.currentIndex / this.words.length) * 100;
  }
}

// ==========================================
// 4. View: frmMain (React UI 介面)
// ==========================================
type PlayerState = {
  engine: GameEngine;
  feedback: 'OK' | 'NG' | null;
  showHint: boolean;
  dragLetters: { id: string; char: string }[];
  slots: (string | null)[];
  isFinished: boolean;
  wrongWords: Word[];
  seatSlots: (string | null)[];
  isReady: boolean;
  startTime: number | null;
  endTime: number | null;
  keyboardInput?: string;
  lastInput?: string;
};

const PLAYER_COLORS = [
  'bg-indigo-600',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500'
];

const PLAYER_LIGHT_COLORS = [
  'bg-indigo-50',
  'bg-rose-50',
  'bg-emerald-50',
  'bg-amber-50',
  'bg-violet-50'
];

// ==========================================
// 4. View Components (Defined outside to prevent re-creation)
// ==========================================

const MenuComp = ({ 
  records, 
  sortKey, 
  sortOrder, 
  toggleSort, 
  setView, 
  StorageService, 
  setRecords,
  exportToCSV
}: any) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const sortedRecords = [...records].sort((a, b) => {
    let valA: any = a[sortKey];
    let valB: any = b[sortKey];
    
    if (sortKey === 'score') {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    return sortOrder === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
  });

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex flex-col items-center justify-center p-4 text-center overflow-x-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", type: "spring", bounce: 0.5 }}
        className="w-full flex flex-col items-center"
      >
        <div className="mb-8 w-full max-w-full flex justify-center px-2">
          <motion.img 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src="https://www.mtp.kh.edu.tw/upload/197/103_18630/%E9%AB%98%E9%9B%84%E5%B8%82%E5%BD%8C%E9%99%80%E5%9C%8B%E5%B0%8F%E6%A0%A1%E5%BE%BD.jpg"
            alt="彌陀國小校徽"
            referrerPolicy="no-referrer"
            className="max-w-full h-auto object-contain"
          />
        </div>
        
        <div className="mb-12 w-full flex flex-col items-center px-2">
          <p className="text-black font-black tracking-[0.1em] text-2xl sm:text-3xl md:text-4xl whitespace-nowrap">
            英文單字測驗
          </p>
        </div>        
      </motion.div>

      <div className="w-full max-w-sm space-y-6">
        <button 
          onClick={() => setView('GRADE')} 
          className="w-full bg-amber-400 border-b-[6px] border-amber-500 active:border-b-0 active:translate-y-[6px] p-6 sm:p-8 rounded-3xl shadow-xl text-amber-900 transition-all flex items-center justify-center group"
        >
          <b className="text-2xl sm:text-3xl font-black">開始練習</b>
          <Rocket className="ml-3 w-8 h-8 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
        </button>

        <div className="bg-white/95 backdrop-blur-sm p-6 rounded-3xl shadow-xl border-4 border-white w-full">
          <div className="flex items-center mb-4 text-indigo-600 font-black justify-between">
            <div className="flex items-center text-lg">
              <Award className="mr-2 w-6 h-6" /> 
              <span>成績紀錄</span>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={exportToCSV}
                className="text-base font-bold text-indigo-500 hover:text-indigo-700 transition-colors px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-full flex items-center"
                title="下載 Excel 檔"
              >
                <Download className="w-4 h-4 mr-1" />
                儲存
              </button>
              {!showClearConfirm ? (
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="text-base font-bold text-slate-400 hover:text-rose-500 transition-colors px-3 py-1.5 bg-slate-100 hover:bg-rose-50 rounded-full"
                >
                  清除
                </button>
              ) : (
                <div className="flex items-center space-x-2 bg-rose-50 p-1 rounded-lg border border-rose-100">
                  <button 
                    onClick={() => { 
                      StorageService.clearRecords(); 
                      setRecords([]); 
                      setShowClearConfirm(false);
                    }}
                    className="text-[10px] sm:text-xs bg-rose-500 text-white px-3 py-1.5 rounded-md font-bold hover:bg-rose-600 transition-colors shadow-sm"
                  >
                    確定
                  </button>
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    className="text-[10px] sm:text-xs bg-white text-slate-600 px-3 py-1.5 rounded-md font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th onClick={() => toggleSort('name')} className="pb-3 text-left text-slate-400 font-black cursor-pointer hover:text-indigo-600 transition-colors">
                    座號 {sortKey === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => toggleSort('score')} className="pb-3 text-right text-slate-400 font-black cursor-pointer hover:text-indigo-600 transition-colors">
                    成績 {sortKey === 'score' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => toggleSort('timeTaken')} className="pb-3 text-right text-slate-400 font-black cursor-pointer hover:text-indigo-600 transition-colors">
                    用時 {sortKey === 'timeTaken' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => toggleSort('date')} className="pb-3 text-right text-slate-400 font-black cursor-pointer hover:text-indigo-600 transition-colors">
                    日期 {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedRecords.slice(0, 10).map((r: any) => (
                  <tr key={r.id} className="hover:bg-indigo-50/50 transition-colors">
                    <td className="py-3 text-left font-bold text-slate-700">{r.name}</td>
                    <td className="py-3 text-right font-black text-indigo-600">{r.score}</td>
                    <td className="py-3 text-right text-slate-500 text-xs font-medium">{r.timeTaken}s</td>
                    <td className="py-3 text-right text-slate-400 text-[10px] font-medium">{r.date.split(' ')[0]}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">尚無紀錄，趕快開始練習吧！</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const GradeSelectComp = ({ setGrade, setView }: any) => (
  <div className="min-h-[100dvh] bg-indigo-500 flex flex-col items-center p-6 text-center overflow-x-hidden">
    <div className="flex-1 flex flex-col items-center justify-center w-full max-sm mx-auto pt-8">
      <h2 className="text-3xl sm:text-4xl font-black text-white mb-6 px-2 leading-tight drop-shadow-md">
        你是幾年級的<br />小朋友？
      </h2>
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs px-2">
        {[3,4,5,6].map(g => (
          <button 
            key={g} 
            onClick={() => { setGrade(g); setView('RANGE_SELECT'); }} 
            className="bg-white border-b-[6px] border-slate-300 active:border-b-0 active:translate-y-[6px] p-4 sm:p-6 rounded-[2rem] text-indigo-600 hover:bg-slate-50 transition-all shadow-xl flex flex-col items-center justify-center"
          >
            <div className="text-4xl sm:text-5xl font-black mb-1">{g}</div>
            <div className="text-slate-400 text-sm sm:text-base font-black">年級</div>
          </button>
        ))}
      </div>
      <button onClick={() => setView('MENU')} className="mt-8 bg-indigo-700/50 border-b-4 border-indigo-800/50 active:border-b-0 active:translate-y-[4px] text-white font-bold flex items-center justify-center hover:bg-indigo-700/70 text-base sm:text-lg py-4 px-10 rounded-2xl transition-all">
        <ChevronLeft className="mr-2 w-6 h-6" /> 返回主選單
      </button>
    </div>
  </div>
);

const ModeSelectComp = ({ setGameMode, setView, GameMode, startNewGame, grade, isAllMode, practiceRange, letterFilter }: any) => (
  <div className="min-h-[100dvh] bg-emerald-500 flex flex-col items-center p-6 text-center overflow-x-hidden">
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto pt-12">
      <h2 className="text-3xl sm:text-4xl font-black text-white mb-10 px-2 drop-shadow-md">想用什麼方式練習？</h2>
      <div className="grid grid-cols-1 gap-5 w-full px-2">
        <button onClick={() => { setGameMode(GameMode.DRAG_DROP); setView('PLAYERS'); }} className="bg-white border-b-[6px] border-slate-300 active:border-b-0 active:translate-y-[6px] p-5 sm:p-6 rounded-[2rem] flex items-center transition-all shadow-xl group">
          <div className="bg-rose-400 p-4 sm:p-5 rounded-2xl mr-4 sm:mr-6 text-white shadow-md group-hover:scale-110 transition-transform"><Rocket className="w-8 h-8 sm:w-10 sm:h-10" /></div>
          <div className="text-left"><b className="block text-xl sm:text-2xl text-slate-800 font-black mb-1">字母大搬家</b><small className="text-slate-500 text-sm sm:text-base font-bold">拖曳字母拼單字</small></div>
        </button>
        <button onClick={() => { setGameMode(GameMode.FLASHCARDS); startNewGame(grade, 1, GameMode.FLASHCARDS, isAllMode, practiceRange, letterFilter); }} className="bg-white border-b-[6px] border-slate-300 active:border-b-0 active:translate-y-[6px] p-5 sm:p-6 rounded-[2rem] flex items-center transition-all shadow-xl group">
          <div className="bg-amber-400 p-4 sm:p-5 rounded-2xl mr-4 sm:mr-6 text-white shadow-md group-hover:scale-110 transition-transform"><Lightbulb className="w-8 h-8 sm:w-10 sm:h-10" /></div>
          <div className="text-left"><b className="block text-xl sm:text-2xl text-slate-800 font-black mb-1">單字卡練習</b><small className="text-slate-500 text-sm sm:text-base font-bold">翻轉卡片背單字</small></div>
        </button>
      </div>
      <button onClick={() => setView('RANGE_SELECT')} className="mt-12 bg-emerald-700/50 border-b-4 border-emerald-800/50 active:border-b-0 active:translate-y-[4px] text-white font-bold flex items-center justify-center hover:bg-emerald-700/70 text-base sm:text-lg py-4 px-10 rounded-2xl transition-all">
        <ChevronLeft className="mr-2 w-6 h-6" /> 返回上一步
      </button>
    </div>
  </div>
);

const PlayerCountSelectComp = ({ setPlayerCount, startNewGame, grade, gameMode, setView, isAllMode, practiceRange, letterFilter }: any) => (
  <div className="min-h-[100dvh] bg-rose-500 flex flex-col items-center p-6 text-center overflow-x-hidden">
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto pt-12">
      <h2 className="text-3xl sm:text-4xl font-black text-white mb-10 flex items-center justify-center px-2 drop-shadow-md">
        <Users className="mr-3 w-8 h-8 sm:w-10 sm:h-10" /> 幾個人要一起玩？
      </h2>
      <div className="grid grid-cols-3 gap-4 w-full px-2">
        {[1,2,3,4,5].map(n => (
          <button 
            key={n} 
            onClick={() => { setPlayerCount(n); startNewGame(grade, n, gameMode, isAllMode, practiceRange, letterFilter); }} 
            className="bg-white border-b-[6px] border-slate-300 active:border-b-0 active:translate-y-[6px] p-5 sm:p-6 rounded-[2rem] text-rose-500 hover:bg-slate-50 transition-all shadow-xl flex flex-col items-center justify-center"
          >
            <div className="text-4xl sm:text-5xl font-black mb-1">{n}</div>
            <div className="text-slate-400 text-sm sm:text-base font-black">人</div>
          </button>
        ))}
      </div>
      <button onClick={() => setView('MODE')} className="mt-12 bg-rose-700/50 border-b-4 border-rose-800/50 active:border-b-0 active:translate-y-[4px] text-white font-bold flex items-center justify-center hover:bg-rose-700/70 text-base sm:text-lg py-4 px-10 rounded-2xl transition-all">
        <ChevronLeft className="mr-2 w-6 h-6" /> 返回上一步
      </button>
    </div>
  </div>
);

const PlayingComp = ({
  playerCount,
  players,
  gameMode,
  GameMode,
  PLAYER_COLORS,
  PLAYER_LIGHT_COLORS,
  handleSeatSlotClick,
  handleSeatInput,
  clearSeatInput,
  handleConfirmSeat,
  speak,
  speakWord,
  speakSentenceTwice,
  speakSentenceAndWord,
  onAnswer,
  handleSlotClick,
  handleDragLetterClick,
  setView,
  setPlayers,
  isFlipped,
  setIsFlipped
}: any) => {
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const highlightZh = (sentence: string, target: string) => {
    if (!target) return sentence;
    
    // 1. 嘗試完整匹配 (最理想情況)
    if (sentence.includes(target)) {
      const parts = sentence.split(target);
      return (
        <span>
          {parts.map((part, i) => (
            <React.Fragment key={i}>
              {part}
              {i < parts.length - 1 && <span className="text-rose-600 font-black">{target}</span>}
            </React.Fragment>
          ))}
        </span>
      );
    }

    // 2. 如果沒有完整匹配，嘗試匹配目標詞中的個別字 (處理如 target="夜晚" sentence="晚安" 的情況)
    // 排除掉標點符號與空白
    const chars = target.split('').filter(c => c.trim().length > 0 && !/[，。！？；：、「」『』（）]/.test(c));
    if (chars.length === 0) return sentence;

    // 建立正則表達式，匹配目標詞中的任何一個字
    const escapedChars = chars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    const regex = new RegExp(`([${escapedChars}])`, 'g');
    const parts = sentence.split(regex);
    
    return (
      <span>
        {parts.map((part, i) => {
          if (chars.includes(part)) {
            return <span key={i} className="text-rose-600 font-black">{part}</span>;
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden relative">
      {/* 手機橫向提示 (僅多人時顯示) */}
      {playerCount > 1 && (
        <div className="fixed top-2 right-2 z-50 md:hidden">
          <div className="bg-black/50 backdrop-blur text-white text-[10px] px-2 py-1 rounded-full flex items-center">
            <RotateCcw className="w-3 h-3 mr-1 rotate-90" /> 建議橫向遊玩
          </div>
        </div>
      )}

      {/* 全域回首頁按鈕 */}
      <button 
        onClick={() => {
          if (players.every((p: any) => p.isFinished) || !players.some((p: any) => p.isReady)) {
            setView('MENU');
          } else {
            setShowQuitConfirm(true);
          }
        }} 
        className="absolute top-4 left-4 z-50 p-2 sm:p-3 bg-white/90 backdrop-blur shadow-md rounded-xl sm:rounded-2xl transition-all flex items-center border-2 border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 active:scale-95"
      >
        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
        <span className="font-bold text-xs sm:text-sm hidden sm:inline">結束</span>
      </button>

      {/* 退出確認彈窗 */}
      <AnimatePresence>
        {showQuitConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-xs w-full shadow-2xl text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">確定要退出嗎？</h3>
              {gameMode === GameMode.FLASHCARDS ? (
                <p className="text-slate-500 mb-8 font-medium">練習尚未結束，確定要返回主選單嗎？</p>
              ) : (
                <p className="text-slate-500 mb-8 font-medium">遊戲尚未結束，退出後將不會儲存本次成績。</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowQuitConfirm(false)} className="py-4 px-6 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all">取消</button>
                <button onClick={() => setView('MENU')} className="py-4 px-6 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all">確定退出</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {players.map((p: any, idx: number) => {
        const word = p.isFinished ? null : p.engine.currentWord;
        if (!p.isFinished && !word) return null; // Safety guard

        const maskedSentence = word ? word.sentence.replace(new RegExp(word.en, 'gi'), '___') : '';
        const isNarrow = playerCount > 2;

        return (
          <div 
            key={idx} 
            className={`relative flex-1 flex flex-col border-r last:border-r-0 transition-all duration-500 ${p.isFinished ? 'opacity-40 grayscale' : 'bg-white'}`}
            style={{ minWidth: `${100 / playerCount}%` }}
          >
            {gameMode !== GameMode.FLASHCARDS && (
              <>
                <div className={`${PLAYER_COLORS[idx]} p-2 sm:p-3 text-white text-center font-black flex items-center justify-center text-xs sm:text-base border-b-4 border-black/10`}>
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> 
                  <span className={isNarrow ? 'hidden sm:inline' : ''}>玩家</span> {idx + 1}
                  {p.isReady && p.seatSlots.some((s: any) => s !== null) && (
                    <span className="ml-1"> [ {p.seatSlots.filter((s: any) => s !== null).join('')} 號 ]</span>
                  )}
                </div>

                <div className="p-2 sm:p-4 flex items-center justify-between border-b-2 border-slate-100 bg-slate-50/50">
                  <div className="flex-1 h-3 sm:h-4 bg-slate-200 rounded-full overflow-hidden mr-2 sm:mr-4 shadow-inner border border-slate-300">
                    <motion.div animate={{ width: `${p.engine.getProgress()}%` }} className={`h-full ${PLAYER_COLORS[idx]} border-r-4 border-black/10`} />
                  </div>
                  <div className="flex items-center font-black text-slate-700 text-xs sm:text-base bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                    <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-amber-500" /> {p.engine.score}
                  </div>
                </div>
              </>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="min-h-full flex flex-col items-center justify-start p-2 sm:p-4">
                <div className="w-full flex flex-col items-center">
                  <AnimatePresence mode="wait">
                {!p.isReady ? (
                  <motion.div key="seat-input" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-xs space-y-6">
                    <div className="text-center w-full">
                      <p className="text-slate-400 font-bold text-[10px] sm:text-sm mb-2 uppercase tracking-widest">請輸入座號</p>
                      <div className="flex justify-center gap-1 sm:gap-2 mb-4">
                        {p.seatSlots.map((s: any, sIdx: number) => (
                          <div 
                            key={sIdx} 
                            onClick={() => handleSeatSlotClick(idx, sIdx)}
                            className={`rounded-xl border-2 flex items-center justify-center font-black transition-all cursor-pointer border-b-4 active:border-b-0 active:translate-y-[4px] ${
                              isNarrow ? 'w-10 h-14 text-xl' : 'w-16 h-20 text-4xl'
                            } ${
                              s ? 'bg-indigo-500 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-transparent'
                            }`}
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className={`grid gap-1 sm:gap-2 px-1 sm:px-2 w-full ${isNarrow ? 'grid-cols-4' : 'grid-cols-5'}`}>
                      {[1,2,3,4,5,6,7,8,9,0].map(n => (
                        <motion.button 
                          key={n} 
                          type="button"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSeatInput(idx, n.toString());
                          }}
                          whileTap={{ scale: 0.95, translateY: 2, borderBottomWidth: 0 }}
                          className={`bg-white border-2 border-slate-200 border-b-4 rounded-lg sm:rounded-xl shadow-sm flex items-center justify-center font-black text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors ${
                            isNarrow ? 'p-2 text-sm' : 'aspect-square text-xl'
                          }`}
                        >
                          {n}
                        </motion.button>
                      ))}
                    </div>
                    
                    <div className="flex gap-1 sm:gap-2 w-full">
                      <button 
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearSeatInput(idx);
                        }}
                        className="flex-1 p-2 sm:p-4 rounded-lg sm:rounded-xl font-black text-slate-500 bg-slate-100 border-b-4 border-slate-200 active:border-b-0 active:translate-y-[4px] hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all text-xs sm:text-base"
                      >
                        清除
                      </button>
                      <button 
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleConfirmSeat(idx);
                        }}
                        disabled={!p.seatSlots.some((s: any) => s !== null)}
                        className={`flex-[2] p-2 sm:p-4 rounded-lg sm:rounded-xl font-black text-white shadow-lg border-b-4 transition-all active:border-b-0 active:translate-y-[4px] text-xs sm:text-base ${p.seatSlots.some((s: any) => s !== null) ? 'bg-indigo-500 border-indigo-600 hover:bg-indigo-400' : 'bg-slate-300 border-slate-400 cursor-not-allowed'}`}
                      >
                        確定進入
                      </button>
                    </div>
                  </motion.div>
                ) : !p.isFinished ? (
                  <motion.div key={p.engine.currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-full text-center space-y-3 sm:space-y-6">
                    {gameMode === GameMode.FLASHCARDS ? (
                      <div className="w-full max-w-full mx-auto perspective-1000 px-1">
                        <motion.div 
                          animate={{ rotateY: isFlipped ? 180 : 0 }}
                          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                          className="relative w-full h-[32rem] sm:h-[42rem] preserve-3d cursor-pointer"
                          onClick={() => setIsFlipped(!isFlipped)}
                        >
                          {/* Front */}
                          <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] border-[8px] border-slate-100 shadow-2xl flex flex-col items-center p-6 text-center">
                            <div className="bg-amber-100 text-amber-600 px-6 py-2 rounded-full text-sm font-black mb-4 flex-shrink-0 shadow-sm">正面</div>
                            <h3 className={`${isNarrow ? 'text-4xl sm:text-5xl' : 'text-6xl sm:text-9xl'} font-black text-slate-900 mb-4 sm:mb-8 break-all flex-shrink-0 drop-shadow-sm`}>{word.zh}</h3>
                            <div className="bg-slate-50 p-6 rounded-[2.5rem] w-full flex-1 flex items-center justify-center overflow-y-auto min-h-0 border-2 border-slate-100 shadow-inner">
                              <p className={`${isNarrow ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-5xl'} text-slate-600 italic font-black leading-tight break-words`}>
                                {word.sentence.replace(new RegExp(word.en, 'gi'), '___')}
                              </p>
                            </div>
                          </div>

                          {/* Back */}
                          <div className="absolute inset-0 backface-hidden bg-indigo-500 rounded-[3rem] border-[8px] border-indigo-400 shadow-2xl flex flex-col items-center p-6 text-center text-white rotate-y-180">
                            <div className="bg-white/20 text-white px-4 py-1 rounded-full text-xs font-black mb-4 flex-shrink-0 shadow-inner">背面</div>
                            <div className="flex items-center justify-center space-x-4 mb-4 flex-shrink-0">
                              <h3 className={`${isNarrow ? 'text-4xl sm:text-5xl' : 'text-6xl sm:text-9xl'} font-black break-all drop-shadow-md`}>{word.en}</h3>
                              <button onClick={(e) => { e.stopPropagation(); speakWord(word.en); }} className="p-4 bg-white/20 rounded-full hover:bg-white/30 transition-all flex-shrink-0 shadow-lg active:scale-95"><Volume2 className={isNarrow ? 'w-6 h-6' : 'w-8 h-8 sm:w-12 sm:h-12'} /></button>
                            </div>
                            <p className={`${isNarrow ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-5xl'} opacity-90 mb-6 sm:mb-10 flex-shrink-0 font-black drop-shadow-sm`}>{word.zh}</p>
                            <div className="bg-white/10 p-4 sm:p-8 rounded-[2.5rem] w-full text-center flex-1 flex flex-col min-h-0 border-2 border-white/10 shadow-inner">
                              <div className="flex flex-col items-center justify-center h-full relative">
                                <div className="space-y-2 sm:space-y-4 overflow-y-auto w-full custom-scrollbar py-2">
                                  <div className="flex items-center justify-center gap-3 sm:gap-4">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); speakSentenceTwice(word.sentence); }} 
                                      className="p-2 sm:p-3 bg-white/20 rounded-full hover:bg-white/30 transition-all flex-shrink-0 shadow-md active:scale-95"
                                    >
                                      <Volume2 className={isNarrow ? 'w-5 h-5' : 'w-6 h-6 sm:w-8 h-8'} />
                                    </button>
                                    <p className={`${isNarrow ? 'text-lg sm:text-xl' : 'text-2xl sm:text-4xl'} font-black italic leading-tight break-words drop-shadow-sm text-left`}>
                                      {word.sentence}
                                    </p>
                                  </div>
                                  <p className={`${isNarrow ? 'text-base sm:text-lg' : 'text-xl sm:text-3xl'} opacity-80 break-words font-black`}>
                                    {word.sentenceZh}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-6 sm:mt-8 flex items-center justify-center w-full flex-shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); onAnswer(idx, word.en); }} className="w-full py-5 bg-white text-indigo-600 font-black rounded-2xl hover:bg-indigo-50 transition-all text-xl sm:text-3xl shadow-lg border-b-[6px] border-indigo-200 active:border-b-0 active:translate-y-[6px]">下一個</button>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    ) : gameMode === GameMode.DRAG_DROP ? (
                      <div className="w-full space-y-2 sm:space-y-4">
                        <div className="w-full px-1 sm:px-2">
                          <div className={`${PLAYER_LIGHT_COLORS[idx]} p-3 sm:p-4 rounded-[2rem] border-4 border-slate-200 shadow-inner text-left space-y-1 sm:space-y-2`}>
                            <p className="text-lg sm:text-3xl font-black text-slate-800 leading-tight text-center">
                              {highlightZh(word.sentenceZh, word.zh)}
                            </p>
                            <div className="flex flex-col items-center">
                              <p className="text-xl sm:text-2xl font-bold text-indigo-600 leading-tight text-center">
                                {p.feedback ? word.sentence : maskedSentence}
                                <span className="ml-2 text-slate-400 text-sm sm:text-lg font-bold">[{word.pos}]</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="w-full flex flex-col items-center py-1">
                          {!word.sentenceZh.includes(word.zh) && (
                            <span className="text-rose-600 font-black text-sm sm:text-lg mb-1">
                              {word.zh}
                            </span>
                          )}
                          <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
                            <div className="flex flex-wrap justify-center gap-1">
                              {p.slots.map((char: any, sIdx: number) => (
                                <motion.div 
                                  key={sIdx} 
                                  onClick={() => handleSlotClick(idx, sIdx)} 
                                  className={`rounded-xl border-b-4 flex items-center justify-center font-black cursor-pointer transition-all ${
                                    playerCount > 3 ? 'w-9 h-11 text-lg' : playerCount > 1 ? 'w-11 h-13 text-2xl' : 'w-16 h-22 text-5xl'
                                  } ${char ? `${PLAYER_COLORS[idx]} border-black/20 text-white shadow-lg active:border-b-0 active:translate-y-[4px]` : 'bg-slate-200 border-slate-400 text-transparent shadow-inner border-b-2'}`} 
                                  whileHover={char ? { scale: 1.05 } : {}}
                                >
                                  {char}
                                </motion.div>
                              ))}
                            </div>
                            <button 
                              onClick={() => speakSentenceAndWord(word.sentence, word.en)} 
                              className={`bg-white rounded-full text-indigo-500 shadow-md hover:scale-110 active:scale-95 transition-all border border-slate-100 flex items-center justify-center flex-shrink-0 ${
                                playerCount > 3 ? 'w-9 h-9' : playerCount > 1 ? 'w-11 h-11' : 'w-16 h-16'
                              }`}
                            >
                              <Volume2 className={playerCount > 3 ? 'w-4 h-4' : playerCount > 1 ? 'w-5 h-5' : 'w-8 h-8'} />
                            </button>
                          </div>
                        </div>

                        <div className="w-full flex justify-center">
                          <div className={`grid gap-1 sm:gap-2 px-1 sm:px-2 w-full mx-auto ${
                            isNarrow ? 'grid-cols-4 max-w-[280px]' : 'grid-cols-5 max-w-[450px] sm:max-w-[600px]'
                          }`}>
                            {p.dragLetters.map((l: any) => (
                              <motion.button 
                                key={l.id} 
                                type="button"
                                onClick={() => handleDragLetterClick(idx, l)}
                                whileTap={{ scale: 0.95, translateY: 2, borderBottomWidth: 0 }}
                                className={`bg-white border-2 border-slate-400 border-b-4 rounded-lg sm:rounded-xl shadow-md flex items-center justify-center font-black text-slate-900 hover:border-indigo-500 hover:text-indigo-600 transition-all ${
                                  isNarrow ? 'p-2 text-xl' : 'py-3 sm:py-5 text-2xl sm:text-4xl'
                                }`}
                              >
                                {l.char}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-1 sm:gap-2 w-full px-1 sm:px-2">
                          <button 
                            onClick={() => {
                              const newPlayers = [...players];
                              const player = newPlayers[idx];
                              const returnedLetters = player.slots.filter(s => s !== null).map(char => ({ id: `return-${Date.now()}-${Math.random()}`, char }));
                              player.slots = new Array(player.slots.length).fill(null);
                              player.dragLetters = [...player.dragLetters, ...returnedLetters];
                              setPlayers(newPlayers);
                            }}
                            className="flex-1 p-2 sm:p-4 rounded-lg sm:rounded-xl font-black text-slate-500 bg-slate-100 border-b-4 border-slate-200 active:border-b-0 active:translate-y-[4px] hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all text-xs sm:text-base"
                          >
                            清除
                          </button>
                          <button 
                            onClick={() => onAnswer(idx, p.slots.join(''))}
                            disabled={p.slots.some((s: any) => s === null) || !!p.feedback}
                            className={`flex-[2] p-2 sm:p-4 rounded-lg sm:rounded-xl font-black text-white shadow-lg border-b-4 transition-all active:border-b-0 active:translate-y-[4px] text-xs sm:text-base ${!p.slots.some((s: any) => s === null) && !p.feedback ? 'bg-indigo-500 border-indigo-600 hover:bg-indigo-400' : 'bg-slate-300 border-slate-400 cursor-not-allowed text-slate-500'}`}
                          >
                            確定送出
                          </button>
                        </div>

                      </div>
                    ) : null}

                    {gameMode === GameMode.FLASHCARDS && (
                      <div className="w-full max-w-md mx-auto mt-4 sm:mt-8 px-4">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1 sm:mb-2">
                          <span>學習進度</span>
                          <span>{p.engine.currentIndex + 1} / {p.engine.words.length}</span>
                        </div>
                        <div className="h-2 sm:h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <motion.div animate={{ width: `${p.engine.getProgress()}%` }} className={`h-full ${PLAYER_COLORS[idx]}`} />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-2 sm:space-y-4">
                    <CheckCircle2 className="w-10 h-10 sm:w-16 h-16 text-emerald-500 mx-auto" />
                    <p className="font-black text-slate-400 text-xs sm:text-base">完成！等待其他玩家...</p>
                  </motion.div>
                )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

          <AnimatePresence>
              {p.feedback && gameMode !== GameMode.FLASHCARDS && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 z-10 flex flex-col items-center justify-center text-white p-4 sm:p-6 text-center ${p.feedback === 'OK' ? 'bg-emerald-500/90' : 'bg-rose-500/90'}`}>
                  {p.feedback === 'OK' ? (
                    <>
                      <CheckCircle2 className="w-12 h-12 sm:w-20 h-20 mb-2 sm:mb-4" />
                      <h4 className="text-xl sm:text-2xl font-black">答對了！</h4>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-12 h-12 sm:w-20 h-20 mb-2 sm:mb-4" />
                      <div className="space-y-4 sm:space-y-6">
                        <div className="opacity-70">
                          <p className="text-sm sm:text-base font-bold mb-1">你的回答</p>
                          <p className="text-3xl sm:text-5xl font-black line-through decoration-white/40">{p.lastInput}</p>
                        </div>
                        <div className="bg-white/20 p-4 sm:p-6 rounded-3xl border-2 border-white/20 shadow-xl">
                          <p className="text-sm sm:text-base font-bold mb-1">正確答案</p>
                          <p className="text-4xl sm:text-7xl font-black">{word?.en}</p>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

const ResultComp = ({
  players,
  gameMode,
  startNewGame,
  grade,
  playerCount,
  setView,
  GameMode,
  speakWord
}: any) => {
  const [showWrongWords, setShowWrongWords] = useState<number | null>(null);

  if (players.length === 0) return null;
  
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.engine.score !== a.engine.score) return b.engine.score - a.engine.score;
    const timeA = a.startTime && a.endTime ? a.endTime - a.startTime : Infinity;
    const timeB = b.startTime && b.endTime ? b.endTime - b.startTime : Infinity;
    return timeA - timeB;
  });

  const winner = sortedPlayers[0];

  if (gameMode === GameMode.FLASHCARDS) {
    return (
      <div className="min-h-[100dvh] bg-amber-400 flex flex-col items-center justify-center p-6 text-amber-900 text-center overflow-x-hidden">
        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="mb-8 sm:mb-12">
          <CheckCircle2 className="w-20 h-20 sm:w-32 h-32 text-white mx-auto mb-4 sm:mb-6 drop-shadow-md" />
          <h2 className="text-3xl sm:text-5xl font-black mb-2 drop-shadow-sm text-white">練習完成！</h2>
          <p className="text-amber-800 font-bold text-lg">太棒了，你已經複習完所有的單字囉！</p>
        </motion.div>
        <div className="w-full max-w-xs space-y-4">
          <button onClick={() => startNewGame(grade, playerCount, gameMode, players[0].engine.isAllMode, players[0].engine.range || undefined)} className="w-full p-4 sm:p-6 bg-white text-amber-600 font-black rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-xl border-b-[6px] border-slate-200 active:border-b-0 active:translate-y-[6px] text-base sm:text-xl transition-all"><RotateCcw className="mr-2 w-6 h-6" /> 再練習一次</button>
          <button onClick={() => setView('MENU')} className="w-full p-4 sm:p-6 bg-amber-500 text-white font-black rounded-2xl sm:rounded-3xl border-b-[6px] border-amber-600 active:border-b-0 active:translate-y-[6px] text-base sm:text-xl transition-all">回主選單</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-indigo-600 flex flex-col items-center justify-center p-6 text-white text-center overflow-x-hidden relative">
      <AnimatePresence>
        {showWrongWords !== null && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setShowWrongWords(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white text-slate-800 rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl sm:text-2xl font-black flex items-center">
                  <AlertCircle className="w-6 h-6 mr-2 text-rose-500" />
                  答錯的單字
                </h3>
                <button onClick={() => setShowWrongWords(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {players[showWrongWords].wrongWords.length > 0 ? (
                  players[showWrongWords].wrongWords.map((w: Word, idx: number) => (
                    <div key={idx} className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between group">
                      <div className="text-left">
                        <p className="text-lg font-black text-rose-600 group-hover:scale-105 transition-transform origin-left">{w.en}</p>
                        <p className="text-sm text-slate-500 font-medium">{w.zh}</p>
                      </div>
                      <button 
                        onClick={() => speakWord(w.en)}
                        className="p-3 bg-white text-rose-500 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500 font-bold">太棒了！沒有答錯的單字！</p>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setShowWrongWords(null)}
                className="mt-6 w-full py-4 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition-all shadow-lg"
              >
                關閉
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="mb-8 sm:mb-12">
        <Trophy className="w-24 h-24 sm:w-36 sm:h-36 text-amber-400 mx-auto mb-4 sm:mb-6 drop-shadow-lg" />
        <h2 className="text-3xl sm:text-5xl font-black mb-2 drop-shadow-sm text-white">遊戲結束！</h2>
        <p className="text-indigo-200 font-bold text-lg">
          {playerCount > 1 ? (
            <>
              恭喜玩家 {players.indexOf(winner) + 1}
              {winner.seatSlots.some((s: any) => s !== null) && ` [ ${winner.seatSlots.filter((s: any) => s !== null).join('')} 號 ]`}
              獲得勝利！
            </>
          ) : '挑戰成功！看看你的成績吧！'}
        </p>
      </motion.div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-[2.5rem] p-6 sm:p-8 border-4 border-white/20 shadow-2xl mb-8">
        <div className="space-y-4">
          {sortedPlayers.map((p, i) => {
            const playerIndex = players.indexOf(p);
            const seatNum = p.seatSlots.filter((s: any) => s !== null).join('');
            const timeTaken = p.startTime && p.endTime ? Math.floor((p.endTime - p.startTime) / 1000) : 0;
            return (
              <div key={i} className="p-4 bg-white/20 rounded-2xl border-b-4 border-white/30 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg mr-3 shadow-inner ${i === 0 ? 'bg-amber-400 text-amber-900' : 'bg-white/30 text-white'}`}>
                      {i + 1}
                    </div>
                    <div className="text-left">
                      <p className="font-black text-base sm:text-lg text-white">玩家 {playerIndex + 1} [ {seatNum || '?'} 號 ]</p>
                      <p className="text-xs sm:text-sm text-indigo-200 font-bold flex items-center"><Clock className="w-4 h-4 mr-1" /> {timeTaken}s</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-black text-amber-300 drop-shadow-sm">{p.engine.score}</p>
                    <p className="text-[10px] uppercase tracking-widest text-indigo-200 font-black">Points</p>
                  </div>
                </div>
                
                {p.wrongWords.length > 0 && (
                  <button 
                    onClick={() => setShowWrongWords(playerIndex)}
                    className="w-full py-3 bg-rose-500/80 hover:bg-rose-500 text-white text-sm font-black rounded-xl flex items-center justify-center transition-all border-b-4 border-rose-700 active:border-b-0 active:translate-y-[4px] shadow-sm"
                  >
                    <AlertCircle className="w-5 h-5 mr-2" />
                    查看答錯單字 ({p.wrongWords.length})
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <button onClick={() => startNewGame(grade, playerCount, gameMode, players[0].engine.isAllMode, players[0].engine.range || undefined, players[0].engine.letterFilter || undefined)} className="w-full p-4 sm:p-6 bg-white text-indigo-600 font-black rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-xl border-b-[6px] border-slate-200 active:border-b-0 active:translate-y-[6px] text-base sm:text-xl transition-all"><RotateCcw className="mr-2 w-6 h-6" /> 再戰一局</button>
        <button onClick={() => setView('MENU')} className="w-full p-4 sm:p-6 bg-indigo-500 text-white font-black rounded-2xl sm:rounded-3xl border-b-[6px] border-indigo-700 active:border-b-0 active:translate-y-[6px] text-base sm:text-xl transition-all">回主選單</button>
      </div>
    </div>
  );
};
const RangeSelectComp = ({ 
  grade,
  practiceRange, 
  setPracticeRange, 
  setIsAllMode,
  letterFilter,
  setLetterFilter,
  setView, 
  maxVal 
}: {
  grade: number;
  practiceRange: [number, number];
  setPracticeRange: (val: [number, number]) => void;
  setIsAllMode: (val: boolean) => void;
  letterFilter: LetterFilter;
  setLetterFilter: (val: LetterFilter) => void;
  setView: (v: any) => void;
  maxVal: number;
}) => {
  const pool = WORD_DATABASE.filter(w => w.id <= maxVal);
  
  // Calculate selected count based on both filters
  let filteredPool = pool.filter(w => w.id >= practiceRange[0] && w.id <= practiceRange[1]);
  if (letterFilter) {
    if (letterFilter === 'less_than_4') filteredPool = filteredPool.filter(w => w.en.length < 4);
    else if (letterFilter === 'exactly_4') filteredPool = filteredPool.filter(w => w.en.length === 4);
    else if (letterFilter === 'more_than_4') filteredPool = filteredPool.filter(w => w.en.length > 4);
  }
  const selectedCount = filteredPool.length;

  const handleConfirm = (isAll: boolean) => {
    setIsAllMode(isAll);
    setView('MODE');
  };

  return (
    <div className="min-h-[100dvh] bg-sky-500 flex flex-col items-center p-6 text-center overflow-x-hidden">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto pt-12">
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-10 px-2 drop-shadow-md">要練習哪些字？</h2>
        
        <div className="w-full px-2 space-y-6">
          {/* Combined Filter Card */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl space-y-8 mb-6">
            
            {/* Range Slider */}
            <div className="space-y-4">
              <div className="flex items-center text-emerald-600 font-black justify-center">
                <Award className="w-6 h-6 mr-2" />
                <span className="text-xl">第幾號到第幾號？</span>
              </div>

              <Slider.Root
                className="relative flex items-center select-none touch-none w-full h-5"
                value={practiceRange}
                onValueChange={(val) => setPracticeRange(val as [number, number])}
                max={maxVal}
                min={1}
                step={1}
                minStepsBetweenThumbs={1}
              >
                <Slider.Track className="bg-slate-200 relative grow rounded-full h-[6px]">
                  <Slider.Range className="absolute bg-emerald-500 rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb
                  className="block w-6 h-6 bg-white border-4 border-emerald-500 shadow-lg rounded-full hover:scale-110 focus:outline-none transition-transform cursor-grab active:cursor-grabbing"
                  aria-label="Start range"
                />
                <Slider.Thumb
                  className="block w-6 h-6 bg-white border-4 border-emerald-500 shadow-lg rounded-full hover:scale-110 focus:outline-none transition-transform cursor-grab active:cursor-grabbing"
                  aria-label="End range"
                />
              </Slider.Root>

              <div className="flex justify-between items-center text-sm font-black text-slate-400 px-1">
                <span className="bg-slate-100 px-3 py-1 rounded-lg text-slate-600">{practiceRange[0]}</span>
                <span className="bg-slate-100 px-3 py-1 rounded-lg text-slate-600">{practiceRange[1]}</span>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            {/* Letter Count Segmented Control */}
            <div className="space-y-4">
              <div className="flex items-center text-indigo-600 font-black justify-center">
                <Award className="w-6 h-6 mr-2" />
                <span className="text-xl">想挑戰幾個字母？</span>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-2xl w-full shadow-inner">
                {[
                  { label: '1~3', value: 'less_than_4' },
                  { label: '4', value: 'exactly_4' },
                  { label: '5~n', value: 'more_than_4' },
                  { label: '全部', value: null }
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setLetterFilter(opt.value as LetterFilter)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-base transition-all ${
                      letterFilter === opt.value 
                        ? 'bg-white text-indigo-600 shadow-md' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <button 
              onClick={() => handleConfirm(true)} 
              disabled={selectedCount === 0}
              className={`py-4 font-black rounded-2xl border-b-4 transition-all ${
                selectedCount === 0
                  ? 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 text-white border-emerald-600 active:border-b-0 active:translate-y-[4px] hover:bg-emerald-400'
              }`}
            >
              開始 {selectedCount} 題
            </button>
            <button 
              onClick={() => handleConfirm(false)} 
              disabled={selectedCount < 11}
              className={`py-4 font-black rounded-2xl border-b-4 transition-all ${
                selectedCount < 11 
                  ? 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-500 text-white border-indigo-600 hover:bg-indigo-400 active:border-b-0 active:translate-y-[4px]'
              }`}
            >
              隨機 10 題
            </button>
          </div>
        </div>
        <button onClick={() => setView('GRADE')} className="mt-12 bg-sky-700/50 border-b-4 border-sky-800/50 active:border-b-0 active:translate-y-[4px] text-white font-bold flex items-center justify-center hover:bg-sky-700/70 text-base sm:text-lg py-4 px-10 rounded-2xl transition-all">
          <ChevronLeft className="mr-2 w-6 h-6" /> 返回上一步
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'MENU' | 'GRADE' | 'RANGE_SELECT' | 'PLAYERS' | 'MODE' | 'PLAY' | 'RESULT'>('MENU');
  const [grade, setGrade] = useState(3);
  const [playerCount, setPlayerCount] = useState(1);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.DRAG_DROP);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [sortKey, setSortKey] = useState<'name' | 'score' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isFlipped, setIsFlipped] = useState(false); // For Flashcards
  const [practiceRange, setPracticeRange] = useState<[number, number]>([1, 100]);
  const [isAllMode, setIsAllMode] = useState(false);
  const [letterFilter, setLetterFilter] = useState<LetterFilter>('less_than_4');
  const hasSavedRecord = React.useRef(false);

  let maxVal = 100;
  if (grade === 4) maxVal = 150;
  if (grade === 5) maxVal = 200;
  if (grade === 6) maxVal = 311;

  // Ensure range is within bounds
  useEffect(() => {
    if (practiceRange[1] > maxVal) {
      setPracticeRange([1, maxVal]);
    }
  }, [grade, maxVal]);

  useEffect(() => {
    setRecords(StorageService.getRecords());
  }, []);

  useEffect(() => {
    if (view === 'PLAY' && players.length > 0 && players.every(p => p.isFinished)) {
      if (!hasSavedRecord.current) {
        hasSavedRecord.current = true;
        if (gameMode !== GameMode.FLASHCARDS) {
          players.forEach((p) => {
            const seatNum = p.seatSlots.filter(s => s !== null).join('');
            const timeTaken = p.startTime && p.endTime ? Math.floor((p.endTime - p.startTime) / 1000) : 0;
            StorageService.saveRecord({
              name: seatNum || '玩家',
              score: p.engine.score,
              timeTaken: timeTaken,
              isMultiplayer: playerCount > 1,
              seatNumber: seatNum
            });
          });
          setRecords(StorageService.getRecords());
        }
        setTimeout(() => {
          setView('RESULT');
        }, 500);
      }
    }
  }, [players, view, gameMode, playerCount]);

  const exportToCSV = () => {
    if (records.length === 0) {
      alert('尚無紀錄可供下載');
      return;
    }

    // CSV Header
    const headers = ['座號', '成績', '用時(秒)', '日期'];
    
    // CSV Rows
    const rows = records.map(r => [
      r.name,
      r.score,
      r.timeTaken,
      r.date
    ]);

    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Add UTF-8 BOM for Excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `英文單字測驗紀錄_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (key: 'name' | 'score' | 'date' | 'timeTaken') => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const speak = useCallback((text: string, rate: number = 0.5) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = rate;
    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => 
      (v.lang === 'en-US' || v.lang === 'en_US') && 
      (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Samantha'))
    );
    if (preferredVoice) utter.voice = preferredVoice;
    synth.speak(utter);
  }, []);

  const speakWord = useCallback((word: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    
    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => 
      (v.lang === 'en-US' || v.lang === 'en_US') && 
      (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Samantha'))
    );

    const utter1 = new SpeechSynthesisUtterance(word);
    utter1.lang = 'en-US';
    utter1.rate = 0.5;
    
    const spelling = word.split('').join(' ');
    const utter2 = new SpeechSynthesisUtterance(spelling);
    utter2.lang = 'en-US';
    utter2.rate = 0.25;
    
    const utter3 = new SpeechSynthesisUtterance(word);
    utter3.lang = 'en-US';
    utter3.rate = 0.5;

    if (preferredVoice) {
      utter1.voice = preferredVoice;
      utter2.voice = preferredVoice;
      utter3.voice = preferredVoice;
    }
    
    synth.speak(utter1);
    synth.speak(utter2);
    synth.speak(utter3);
  }, []);

  const speakSentenceTwice = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    
    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => 
      (v.lang === 'en-US' || v.lang === 'en_US') && 
      (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Samantha'))
    );

    const utter1 = new SpeechSynthesisUtterance(text);
    utter1.lang = 'en-US';
    utter1.rate = 0.5;
    
    const utter2 = new SpeechSynthesisUtterance(text);
    utter2.lang = 'en-US';
    utter2.rate = 0.25;

    if (preferredVoice) {
      utter1.voice = preferredVoice;
      utter2.voice = preferredVoice;
    }
    
    synth.speak(utter1);
    synth.speak(utter2);
  }, []);

  const speakSentenceAndWord = useCallback((sentence: string, word: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    
    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => 
      (v.lang === 'en-US' || v.lang === 'en_US') && 
      (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Samantha'))
    );

    const utter1 = new SpeechSynthesisUtterance(sentence);
    utter1.lang = 'en-US';
    utter1.rate = 0.5;
    
    const utter2 = new SpeechSynthesisUtterance(word);
    utter2.lang = 'en-US';
    utter2.rate = 0.5;

    if (preferredVoice) {
      utter1.voice = preferredVoice;
      utter2.voice = preferredVoice;
    }
    
    synth.speak(utter1);
    synth.speak(utter2);
  }, []);

  const initDragDrop = (word: string) => {
    const chars = word.split('').map((c, i) => ({ id: `${c}-${i}-${Math.random()}`, char: c }));
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const distractors = Array.from({ length: 5 }, () => {
      const char = alphabet[Math.floor(Math.random() * alphabet.length)];
      return { id: `dist-${char}-${Math.random()}`, char };
    });
    return {
      dragLetters: [...chars, ...distractors].sort(() => Math.random() - 0.5),
      slots: new Array(word.length).fill(null)
    };
  };

  const startNewGame = (g: number, pCount: number, m: GameMode, isAll: boolean = false, range?: [number, number], lFilter?: LetterFilter) => {
    try {
      hasSavedRecord.current = false;
      const newPlayers: PlayerState[] = Array.from({ length: pCount }, () => {
        const engine = new GameEngine(g, isAll, range, pCount > 1, lFilter);
        if (engine.words.length === 0) {
          throw new Error('此範圍內沒有單字，請重新選擇範圍。');
        }
        const { dragLetters, slots } = initDragDrop(engine.currentWord.en);
        return {
          engine,
          feedback: null,
          showHint: false,
          dragLetters,
          slots,
          isFinished: false,
          wrongWords: [],
          seatSlots: [null, null],
          isReady: m === GameMode.FLASHCARDS,
          startTime: m === GameMode.FLASHCARDS ? Date.now() : null,
          endTime: null,
          keyboardInput: ''
        };
      });
      setPlayers(newPlayers);
      setGrade(g);
      setPlayerCount(pCount);
      setGameMode(m);
      setIsFlipped(false);
      setView('PLAY');
    } catch (err: any) {
      alert(err.message || '遊戲啟動失敗');
    }
  };

  const lastInputTime = React.useRef<number>(0);
  const handleSeatInput = useCallback((playerIdx: number, num: string) => {
    const now = Date.now();
    if (now - lastInputTime.current < 200) return;
    lastInputTime.current = now;

    setPlayers(prev => {
      const next = [...prev];
      const emptyIdx = next[playerIdx].seatSlots.indexOf(null);
      if (emptyIdx !== -1) {
        const newSeatSlots = [...next[playerIdx].seatSlots];
        newSeatSlots[emptyIdx] = num;
        next[playerIdx] = { ...next[playerIdx], seatSlots: newSeatSlots };
      }
      return next;
    });
  }, []);

  const handleSeatSlotClick = (playerIdx: number, slotIdx: number) => {
    setPlayers(prev => {
      const next = [...prev];
      const newSeatSlots = [...next[playerIdx].seatSlots];
      newSeatSlots[slotIdx] = null;
      next[playerIdx] = { ...next[playerIdx], seatSlots: newSeatSlots };
      return next;
    });
  };

  const clearSeatInput = useCallback((playerIdx: number) => {
    setPlayers(prev => {
      const next = [...prev];
      next[playerIdx] = { ...next[playerIdx], seatSlots: [null, null] };
      return next;
    });
  }, []);

  const handleConfirmSeat = useCallback((playerIdx: number) => {
    setPlayers(prev => {
      const next = [...prev];
      const seatNumber = next[playerIdx].seatSlots.filter(s => s !== null).join('');
      if (seatNumber) {
        next[playerIdx] = { ...next[playerIdx], isReady: true, startTime: Date.now() };
      }
      return next;
    });
  }, []);

  const onAnswer = (playerIdx: number, val: string) => {
    const p = players[playerIdx];
    if (p.feedback || p.isFinished) return;

    const ok = p.engine.checkAnswer(val);
    const newPlayers = [...players];
    const updatedWrongWords = ok 
      ? p.wrongWords 
      : (p.wrongWords.some((w: Word) => w.id === p.engine.currentWord.id) 
          ? p.wrongWords 
          : [...p.wrongWords, p.engine.currentWord]);
    newPlayers[playerIdx] = { ...p, feedback: ok ? 'OK' : 'NG', wrongWords: updatedWrongWords, lastInput: val };
    setPlayers(newPlayers);

    if (ok && gameMode !== GameMode.FLASHCARDS) {
      confetti({ 
        particleCount: 40, 
        spread: 40, 
        origin: { x: (playerIdx + 0.5) / playerCount, y: 0.7 } 
      });
    }

    const baseDelay = gameMode === GameMode.FLASHCARDS ? 300 : 1200;
    const delay = ok ? baseDelay : baseDelay + 1000;

    setTimeout(() => {
      const pRef = players[playerIdx];
      if (pRef) {
        pRef.engine.next();
      }
      setIsFlipped(false);

      setPlayers(prevPlayers => {
        const updatedPlayers = [...prevPlayers];
        if (!updatedPlayers[playerIdx]) return prevPlayers;

        const currentPlayer = { ...updatedPlayers[playerIdx] };
        
        if (currentPlayer.engine.isFinished) {
          currentPlayer.isFinished = true;
          currentPlayer.feedback = null;
          currentPlayer.endTime = Date.now();
          updatedPlayers[playerIdx] = currentPlayer;
        } else {
          const { dragLetters, slots } = initDragDrop(currentPlayer.engine.currentWord.en);
          updatedPlayers[playerIdx] = {
            ...currentPlayer,
            feedback: null,
            showHint: false,
            dragLetters,
            slots,
            keyboardInput: ''
          };
          if (playerCount === 1 && gameMode !== GameMode.FLASHCARDS) {
            // No automatic pronunciation as requested
          }
        }
        return updatedPlayers;
      });
    }, delay);
  };

  const handleDragLetterClick = (playerIdx: number, letterObj: { id: string; char: string }) => {
    const p = players[playerIdx];
    if (p.feedback || p.isFinished) return;
    const nextEmptySlot = p.slots.indexOf(null);
    if (nextEmptySlot !== -1) {
      const newSlots = [...p.slots];
      newSlots[nextEmptySlot] = letterObj.char;
      const newPlayers = [...players];
      newPlayers[playerIdx] = {
        ...p,
        slots: newSlots,
        dragLetters: p.dragLetters.filter(l => l.id !== letterObj.id)
      };
      setPlayers(newPlayers);
    }
  };

  const handleSlotClick = (playerIdx: number, slotIdx: number) => {
    const p = players[playerIdx];
    if (p.feedback || p.isFinished || p.slots[slotIdx] === null) return;
    const char = p.slots[slotIdx]!;
    const newSlots = [...p.slots];
    newSlots[slotIdx] = null;
    const newPlayers = [...players];
    newPlayers[playerIdx] = {
      ...p,
      slots: newSlots,
      dragLetters: [...p.dragLetters, { id: `return-${Date.now()}`, char }]
    };
    setPlayers(newPlayers);
  };

  const renderView = () => {
    switch(view) {
      case 'GRADE': 
        return <GradeSelectComp setGrade={setGrade} setView={setView} />;
      case 'PLAYERS': 
        return (
          <PlayerCountSelectComp 
            setPlayerCount={setPlayerCount} 
            startNewGame={startNewGame} 
            grade={grade} 
            gameMode={gameMode} 
            setView={setView} 
            isAllMode={isAllMode}
            practiceRange={practiceRange}
            letterFilter={letterFilter}
          />
        );
      case 'MODE': 
        return <ModeSelectComp setGameMode={setGameMode} setView={setView} GameMode={GameMode} startNewGame={startNewGame} grade={grade} isAllMode={isAllMode} practiceRange={practiceRange} letterFilter={letterFilter} />;
      case 'RANGE_SELECT': 
        return (
          <RangeSelectComp 
            grade={grade}
            practiceRange={practiceRange}
            setPracticeRange={setPracticeRange}
            setIsAllMode={setIsAllMode}
            letterFilter={letterFilter}
            setLetterFilter={setLetterFilter}
            setView={setView}
            maxVal={maxVal}
          />
        );
      case 'PLAY': 
        return (
          <PlayingComp 
            playerCount={playerCount}
            players={players}
            gameMode={gameMode}
            GameMode={GameMode}
            PLAYER_COLORS={PLAYER_COLORS}
            PLAYER_LIGHT_COLORS={PLAYER_LIGHT_COLORS}
            handleSeatSlotClick={handleSeatSlotClick}
            handleSeatInput={handleSeatInput}
            clearSeatInput={clearSeatInput}
            handleConfirmSeat={handleConfirmSeat}
            speak={speak}
            speakWord={speakWord}
            speakSentenceTwice={speakSentenceTwice}
            speakSentenceAndWord={speakSentenceAndWord}
            onAnswer={onAnswer}
            handleSlotClick={handleSlotClick}
            handleDragLetterClick={handleDragLetterClick}
            setView={setView}
            setPlayers={setPlayers}
            isFlipped={isFlipped}
            setIsFlipped={setIsFlipped}
          />
        );
      case 'RESULT': 
        return (
          <ResultComp 
            players={players}
            gameMode={gameMode}
            startNewGame={startNewGame}
            grade={grade}
            playerCount={playerCount}
            setView={setView}
            GameMode={GameMode}
            speakWord={speakWord}
          />
        );
      default: 
        return (
          <MenuComp 
            records={records}
            sortKey={sortKey}
            sortOrder={sortOrder}
            toggleSort={toggleSort}
            setView={setView}
            StorageService={StorageService}
            setRecords={setRecords}
            exportToCSV={exportToCSV}
          />
        );
    }
  };

  return renderView();
}
