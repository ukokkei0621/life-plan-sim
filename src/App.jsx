import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, PieChart as RePieChart, Pie, Cell } from 'recharts';
import { Plus, Trash2, TrendingUp, DollarSign, User, Briefcase, AlertCircle, CheckCircle2, Users, Calculator, Activity, Baby, Table as TableIcon, ChevronDown, ChevronUp, GraduationCap, Coins, PiggyBank, Home, Save, TrendingDown, PieChart, Repeat, ArrowRight, Landmark, ArrowDownCircle, ArrowUpCircle, Sparkles, Bot, BarChart2, ShieldAlert, Settings2, Info, X, BookOpen, Maximize2, Minimize2, ExternalLink, SlidersHorizontal } from 'lucide-react';

// --- Gemini API Key ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// --- Constants for Portfolio ---
const ASSET_CLASSES = {
  domestic_stock: { id: 'domestic_stock', name: '国内株式', return: 4.0, risk: 20.0, color: '#f87171' },
  us_stock: { id: 'us_stock', name: '米国株式', return: 11.0, risk: 19.0, color: '#ef4444' },
  ex_us_stock: { id: 'ex_us_stock', name: '先進国株(除米)', return: 7.5, risk: 21.0, color: '#fb923c' },
  emerging_stock: { id: 'emerging_stock', name: '新興国株式', return: 5.6, risk: 25.0, color: '#fbbf24' },
  domestic_bond: { id: 'domestic_bond', name: '国内債券', return: 1.0, risk: 3.0, color: '#60a5fa' },
  us_agg_bond: { id: 'us_agg_bond', name: '米国総合債券', return: 3.5, risk: 11.0, color: '#818cf8' },
  reit: { id: 'reit', name: 'REIT', return: 6.0, risk: 18.0, color: '#a78bfa' },
  gold: { id: 'gold', name: '金(Gold)', return: 5.0, risk: 15.0, color: '#fcd34d' },
  cash: { id: 'cash', name: '現金', return: 0.01, risk: 0.0, color: '#9ca3af' },
};

const CORRELATION_MATRIX = {
  domestic_stock: { domestic_stock: 1.0, us_stock: 0.6, ex_us_stock: 0.7, emerging_stock: 0.6, domestic_bond: -0.1, us_agg_bond: 0.2, reit: 0.5, gold: 0.1, cash: 0.0 },
  us_stock:       { domestic_stock: 0.6, us_stock: 1.0, ex_us_stock: 0.9, emerging_stock: 0.7, domestic_bond: -0.2, us_agg_bond: 0.3, reit: 0.6, gold: 0.1, cash: 0.0 },
  ex_us_stock:    { domestic_stock: 0.7, us_stock: 0.9, ex_us_stock: 1.0, emerging_stock: 0.8, domestic_bond: -0.1, us_agg_bond: 0.5, reit: 0.6, gold: 0.2, cash: 0.0 },
  emerging_stock: { domestic_stock: 0.6, us_stock: 0.7, ex_us_stock: 0.8, emerging_stock: 1.0, domestic_bond: -0.1, us_agg_bond: 0.4, reit: 0.5, gold: 0.3, cash: 0.0 },
  domestic_bond:  { domestic_stock: -0.1, us_stock: -0.2, ex_us_stock: -0.1, emerging_stock: -0.1, domestic_bond: 1.0, us_agg_bond: 0.3, reit: 0.1, gold: 0.2, cash: 0.0 },
  us_agg_bond:    { domestic_stock: 0.2, us_stock: 0.3, ex_us_stock: 0.5, emerging_stock: 0.4, domestic_bond: 0.3, us_agg_bond: 1.0, reit: 0.3, gold: 0.3, cash: 0.0 },
  reit:           { domestic_stock: 0.5, us_stock: 0.6, ex_us_stock: 0.6, emerging_stock: 0.5, domestic_bond: 0.1, us_agg_bond: 0.3, reit: 1.0, gold: 0.2, cash: 0.0 },
  gold:           { domestic_stock: 0.1, us_stock: 0.1, ex_us_stock: 0.2, emerging_stock: 0.3, domestic_bond: 0.2, us_agg_bond: 0.3, reit: 0.2, gold: 1.0, cash: 0.0 },
  cash:           { domestic_stock: 0.0, us_stock: 0.0, ex_us_stock: 0.0, emerging_stock: 0.0, domestic_bond: 0.0, foreign_bond: 0.0, reit: 0.0, gold: 0.0, cash: 1.0 },
};

// --- Utility: Helper Functions ---
const formatPercent = (val, digits = 2) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return val.toFixed(digits) + '%';
};

const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return Math.round(val).toLocaleString();
};

// --- Utility: LocalStorage Hook ---
const usePersistState = (key, defaultValue) => {
  const [state, setState] = useState(() => {
    try {
      // Version key (lps_v21_) to match previous stable version
      const saved = localStorage.getItem('lps_v21_' + key); 
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('LocalStorage load error', e);
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem('lps_v21_' + key, JSON.stringify(state));
    } catch (e) {
      console.error('LocalStorage save error', e);
    }
  }, [key, state]);

  return [state, setState];
};

// 正規分布乱数生成
const randn_bm = () => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
};

const calculateAge = (birthDateString) => {
    if (!birthDateString) return 0;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

// 投資指標計算用ユーティリティ
const calculateMetrics = (returns, finalBalance) => {
  const n = returns.length;
  if (n === 0) return { twr: 0, amr: 0, vol: 0, sharpe: 0, mdd: 0, final: finalBalance };

  const product = returns.reduce((acc, r) => acc * (1 + r), 1.0);
  const twr = Math.pow(product, 1 / n) - 1;

  const sum = returns.reduce((acc, r) => acc + r, 0);
  const amr = sum / n;

  const variance = returns.reduce((acc, r) => acc + Math.pow(r - amr, 2), 0) / (n - 1 || 1);
  const vol = Math.sqrt(variance);

  const sharpe = vol === 0 ? 0 : amr / vol;

  let peak = 1.0;
  let maxDrawdown = 0;
  let currentWealth = 1.0;

  for (const r of returns) {
    currentWealth *= (1 + r);
    if (currentWealth > peak) {
      peak = currentWealth;
    }
    const drawdown = (peak - currentWealth) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return {
    twr: twr * 100,
    amr: amr * 100,
    vol: vol * 100,
    sharpe: sharpe,
    mdd: maxDrawdown * 100,
    final: finalBalance 
  };
};

// ポートフォリオ計算用ユーティリティ
const calculatePortfolioStats = (allocation) => {
  let totalReturn = 0;
  let totalVariance = 0;
  const assets = Object.keys(allocation);

  assets.forEach(id => {
    const weight = allocation[id] / 100;
    const asset = ASSET_CLASSES[id];
    if (asset) {
        totalReturn += weight * asset.return;
    }
  });

  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      const id_i = assets[i];
      const id_j = assets[j];
      const asset_i = ASSET_CLASSES[id_i];
      const asset_j = ASSET_CLASSES[id_j];
      
      if (asset_i && asset_j) {
        const w_i = allocation[id_i] / 100;
        const w_j = allocation[id_j] / 100;
        const sigma_i = asset_i.risk;
        const sigma_j = asset_j.risk;
        const rho = CORRELATION_MATRIX[id_i] && CORRELATION_MATRIX[id_i][id_j] !== undefined ? CORRELATION_MATRIX[id_i][id_j] : 0;
        
        totalVariance += w_i * w_j * sigma_i * sigma_j * rho;
      }
    }
  }

  return {
    return: totalReturn,
    risk: Math.sqrt(totalVariance)
  };
};

// 住宅ローン計算
const calculateMonthlyMortgage = (balanceMan, years, ratePercent) => {
  if (balanceMan <= 0 || years <= 0) return 0;
  const principal = balanceMan * 10000;
  if (ratePercent <= 0) return Math.round(principal / (years * 12));
  const r = ratePercent / 100 / 12;
  const n = years * 12;
  const numerator = principal * r * Math.pow(1 + r, n);
  const denominator = Math.pow(1 + r, n) - 1;
  return Math.round(numerator / denominator);
};

// 教育費統計データ
const EDUCATION_COSTS = {
  nursery: { public: 25, private: 50 },
  elementary: { public: 35, private: 160 },
  middle: { public: 54, private: 144 },
  high: { public: 51, private: 105 },
  university: { national: 82, private_hum: 120, private_sci: 160, none: 0 }
};

// 塾・習い事費用
const CRAM_SCHOOL_COSTS = {
  elementary_low: 20,
  elementary_high: 40,
  middle: 40,
  middle_exam: 60,
  high: 50,
  high_exam: 70
};

const getCramCost = (age) => {
  if (age >= 6 && age <= 8) return CRAM_SCHOOL_COSTS.elementary_low;
  if (age >= 9 && age <= 11) return CRAM_SCHOOL_COSTS.elementary_high;
  if (age >= 12 && age <= 13) return CRAM_SCHOOL_COSTS.middle;
  if (age === 14) return CRAM_SCHOOL_COSTS.middle_exam;
  if (age >= 15 && age <= 16) return CRAM_SCHOOL_COSTS.high;
  if (age === 17) return CRAM_SCHOOL_COSTS.high_exam;
  return 0;
};

// Asset Info Modal Component
const AssetInfoModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">📊 アセット詳細・相関表</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20}/></button>
        </div>
        
        <div className="mb-6">
            <h4 className="font-bold text-sm text-slate-600 mb-2">設定リターン・リスク (年率)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.values(ASSET_CLASSES).map(asset => (
                    <div key={asset.id} className="p-3 rounded border border-slate-200 bg-slate-50 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: asset.color}}></div>
                            <span className="font-bold">{asset.name}</span>
                        </div>
                        <div className="flex justify-between"><span>リターン:</span> <span>{asset.return}%</span></div>
                        <div className="flex justify-between"><span>リスク:</span> <span>{asset.risk}%</span></div>
                    </div>
                ))}
            </div>
        </div>

        <div>
            <h4 className="font-bold text-sm text-slate-600 mb-2">相関係数行列</h4>
            <div className="overflow-x-auto">
                <table className="w-full text-[10px] md:text-xs text-center border-collapse">
                    <thead>
                        <tr>
                            <th className="p-1 bg-slate-100 border"></th>
                            {Object.values(ASSET_CLASSES).map(a => <th key={a.id} className="p-1 bg-slate-100 border font-normal">{a.name}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(CORRELATION_MATRIX).map(rowId => (
                            <tr key={rowId}>
                                <td className="p-1 bg-slate-100 border font-normal text-left whitespace-nowrap">{ASSET_CLASSES[rowId].name}</td>
                                {Object.keys(CORRELATION_MATRIX[rowId]).map(colId => {
                                    const val = CORRELATION_MATRIX[rowId][colId];
                                    let bg = 'bg-white';
                                    if (val > 0.7) bg = 'bg-red-100';
                                    else if (val > 0.4) bg = 'bg-red-50';
                                    else if (val < 0) bg = 'bg-blue-50';
                                    return <td key={colId} className={`p-1 border ${bg}`}>{val.toFixed(2)}</td>
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

// Education Cost Info Modal
const EducationCostModal = ({ onClose }) => {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl p-6 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">🎓 教育費・習い事費用の内訳</h3>
              <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20}/></button>
          </div>
          
          <div className="space-y-6">
            <div>
                <h4 className="font-bold text-sm text-indigo-700 mb-2 border-b pb-1 flex items-center gap-2"><BookOpen size={16}/> 学校種別ごとの年間学費 (概算)</h4>
                <p className="text-xs text-slate-500 mb-2">※文部科学省「子供の学習費調査」などを参考にした、授業料・給食費・学校納付金・通学費等の目安（年額・万円）。</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse border border-slate-200">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="p-2 border border-slate-200">区分</th>
                                <th className="p-2 border border-slate-200">公立 / 国立</th>
                                <th className="p-2 border border-slate-200">私立</th>
                                <th className="p-2 border border-slate-200">備考</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-2 border border-slate-200 font-bold">幼稚園・保育園</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.nursery.public} 万円</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.nursery.private} 万円</td>
                                <td className="p-2 border border-slate-200 text-slate-500">幼保無償化後の雑費等想定</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-200 font-bold">小学校</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.elementary.public} 万円</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.elementary.private} 万円</td>
                                <td className="p-2 border border-slate-200 text-slate-500"></td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-200 font-bold">中学校</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.middle.public} 万円</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.middle.private} 万円</td>
                                <td className="p-2 border border-slate-200 text-slate-500"></td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-200 font-bold">高校</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.high.public} 万円</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.high.private} 万円</td>
                                <td className="p-2 border border-slate-200 text-slate-500"></td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-200 font-bold">大学</td>
                                <td className="p-2 border border-slate-200">{EDUCATION_COSTS.university.national} 万円</td>
                                <td className="p-2 border border-slate-200">
                                    文系: {EDUCATION_COSTS.university.private_hum} 万円<br/>
                                    理系: {EDUCATION_COSTS.university.private_sci} 万円
                                </td>
                                <td className="p-2 border border-slate-200 text-slate-500">学費＋生活費補助の一部を含む概算</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
  
            <div>
                <h4 className="font-bold text-sm text-indigo-700 mb-2 border-b pb-1 flex items-center gap-2"><GraduationCap size={16}/> 塾・習い事費用 (概算)</h4>
                <p className="text-xs text-slate-500 mb-2">※設定した「開始年齢〜終了年齢」の間、毎年加算される費用（年額・万円）。</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-bold block mb-1">小学校 低学年 (習い事等)</span>
                        <span className="text-lg">{CRAM_SCHOOL_COSTS.elementary_low}</span> 万円/年
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-bold block mb-1">小学校 高学年 (塾等)</span>
                        <span className="text-lg">{CRAM_SCHOOL_COSTS.elementary_high}</span> 万円/年
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-bold block mb-1">中学校 (1〜2年)</span>
                        <span className="text-lg">{CRAM_SCHOOL_COSTS.middle}</span> 万円/年
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-bold block mb-1">中学校 (3年/受験)</span>
                        <span className="text-lg text-red-600">{CRAM_SCHOOL_COSTS.middle_exam}</span> 万円/年
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-bold block mb-1">高校 (1〜2年)</span>
                        <span className="text-lg">{CRAM_SCHOOL_COSTS.high}</span> 万円/年
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-bold block mb-1">高校 (3年/予備校等)</span>
                        <span className="text-lg text-red-600">{CRAM_SCHOOL_COSTS.high_exam}</span> 万円/年
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

export default function App() {
  // --- State Definitions ---

  // 本人情報
  const [userBirthDate, setUserBirthDate] = usePersistState('userBirthDate', '1981-06-21');
  const currentAge = useMemo(() => calculateAge(userBirthDate), [userBirthDate]);

  const [retirementAge, setRetirementAge] = usePersistState('retirementAge', 48);
  const [retirementIncome, setRetirementIncome] = usePersistState('retirementIncome', 500);
  const [pensionStartAge, setPensionStartAge] = usePersistState('pensionStartAge', 60);
  const [lifeExpectancy, setLifeExpectancy] = usePersistState('lifeExpectancy', 95);
  const [yearlyIncome, setYearlyIncome] = usePersistState('yearlyIncome', 1000);
  const [pension, setPension] = usePersistState('pension', 150);
  
  // 配偶者情報
  const [hasSpouse, setHasSpouse] = usePersistState('hasSpouse', true);
  const [spouseBirthDate, setSpouseBirthDate] = usePersistState('spouseBirthDate', '1981-09-16');
  const spouseAge = useMemo(() => calculateAge(spouseBirthDate), [spouseBirthDate]);

  const [spouseRetirementAge, setSpouseRetirementAge] = usePersistState('spouseRetirementAge', 60);
  const [spouseRetirementIncome, setSpouseRetirementIncome] = usePersistState('spouseRetirementIncome', 2000);
  const [spousePensionStartAge, setSpousePensionStartAge] = usePersistState('spousePensionStartAge', 60);
  const [spouseIncome, setSpouseIncome] = usePersistState('spouseIncome', 580);
  const [spousePension, setSpousePension] = usePersistState('spousePension', 150);

  // 子供情報
  const [children, setChildren] = usePersistState('children_v2', [
    { id: 1, birthDate: '2012-07-14', edu: { elementary: 'public', middle: 'public', high: 'public', university: 'private_hum' }, cram: { start: 13, end: 18 } },
    { id: 2, birthDate: '2014-10-12', edu: { elementary: 'public', middle: 'public', high: 'public', university: 'private_hum' }, cram: { start: 11, end: 18 } }
  ]);
  
  // 資産・運用・ポートフォリオ
  const [initialCash, setInitialCash] = usePersistState('initialCash', 600);
  const [initialInvest, setInitialInvest] = usePersistState('initialInvest', 12600);
  
  const [currentPortfolio, setCurrentPortfolio] = usePersistState('currentPortfolio', {
    domestic_stock: 0, us_stock: 72, ex_us_stock: 10, emerging_stock: 5, domestic_bond: 0, us_agg_bond: 5, reit: 0, gold: 8
  });
  const [targetPortfolio, setTargetPortfolio] = usePersistState('targetPortfolio', {
    domestic_stock: 0, us_stock: 50, ex_us_stock: 10, emerging_stock: 0, domestic_bond: 0, us_agg_bond: 20, reit: 0, gold: 20
  });
  const [glidePathYears, setGlidePathYears] = usePersistState('glidePathYears', 1);

  const [incomeGrowth, setIncomeGrowth] = usePersistState('incomeGrowth', 2.0);
  const [inflationRate, setInflationRate] = usePersistState('inflationRate', 2.0);
  const [macroSlide, setMacroSlide] = usePersistState('macroSlide', 0.9);
  
  const [expectedReturn, setExpectedReturn] = usePersistState('expectedReturn', 10.0);
  const [risk, setRisk] = usePersistState('risk', 15.0);
  
  const [simulationCount, setSimulationCount] = useState(500);

  // 積立・取り崩し
  const [annualInvestment, setAnnualInvestment] = usePersistState('annualInvestment', 300);
  const [investAfterRetirement, setInvestAfterRetirement] = usePersistState('investAfterRetirement', false);
  const [targetCashAtRetirement, setTargetCashAtRetirement] = usePersistState('targetCashAtRetirement', 3000); 
  
  const [withdrawalType, setWithdrawalType] = usePersistState('withdrawalType', 'fixed_rate');
  const [withdrawalValue, setWithdrawalValue] = usePersistState('withdrawalValue', 4.0);
  const [withdrawalStrategy, setWithdrawalStrategy] = usePersistState('withdrawalStrategy', 'skip_negative');
  const [skipNegativeYearsLimit, setSkipNegativeYearsLimit] = usePersistState('skipNegativeYearsLimit', 5);
  // 現金上限 (定率取り崩し用)
  const [maxCashReserve, setMaxCashReserve] = usePersistState('maxCashReserve', 5000);

  // 住居・ローン
  const [housingType, setHousingType] = usePersistState('housingType', 'owned');
  const [mortgageBalance, setMortgageBalance] = usePersistState('mortgageBalance', 2300);
  const [mortgageYears, setMortgageYears] = usePersistState('mortgageYears', 20);
  const [mortgageRate, setMortgageRate] = usePersistState('mortgageRate', 0.78);
  
  // 支出・イベント
  const [monthlyExpense, setMonthlyExpense] = usePersistState('monthlyExpense', 65);
  const [housingExpense, setHousingExpense] = usePersistState('housingExpense', 0);
  const [postRetirementExpenseRatio, setPostRetirementExpenseRatio] = usePersistState('postRetirementExpenseRatio', 100); 
  const [spendingPattern, setSpendingPattern] = usePersistState('spendingPattern', 'ushape');
  const [expenseDecayRate, setExpenseDecayRate] = usePersistState('expenseDecayRate', 0.5);
  // U字型フェーズ比率
  const [ushapePhase1Ratio, setUshapePhase1Ratio] = usePersistState('ushapePhase1Ratio', 85); // 75-84歳
  const [ushapePhase2Ratio, setUshapePhase2Ratio] = usePersistState('ushapePhase2Ratio', 95); // 85歳-
  
  // イベント更新: v5 (assetThreshold追加)
  const [events, setEvents] = usePersistState('events_v5', [
    { id: 1, name: '車買い替え', amount: 800, type: 'expense', isRecurring: false, startAge: 49, endAge: 49, useInflation: true, assetThreshold: 0 },
    { id: 2, name: '車買い替え', amount: 250, type: 'expense', isRecurring: false, startAge: 50, endAge: 50, useInflation: true, assetThreshold: 0 },
    { id: 3, name: '車買い替え', amount: 1000, type: 'expense', isRecurring: false, startAge: 59, endAge: 59, useInflation: true, assetThreshold: 0 },
    { id: 4, name: '車買い替え', amount: 300, type: 'expense', isRecurring: false, startAge: 60, endAge: 60, useInflation: true, assetThreshold: 0 },
    { id: 5, name: '分割贈与', amount: 210, type: 'income', isRecurring: true, startAge: 45, endAge: 60, useInflation: false, assetThreshold: 0 },
    { id: 6, name: '贈与', amount: 220, type: 'expense', isRecurring: true, startAge: 60, endAge: 95, useInflation: false, assetThreshold: 10000 },
  ]);
  const [newEvent, setNewEvent] = useState({ name: '', amount: 100, type: 'expense', isRecurring: false, startAge: 50, endAge: 55, useInflation: true, assetThreshold: 0 });

  // UI State
  const [simulationData, setSimulationData] = useState([]);
  const [stats, setStats] = useState({ minP10: 0, finalP50: 0, negativeAge: null, successRate: 0, assetAtRetirement: 0, depletionRates: {} });
  const [summaryMetrics, setSummaryMetrics] = useState({ pessimistic: {}, central: {}, optimistic: {} });
  const [isCalculating, setIsCalculating] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [activeScenarioTab, setActiveScenarioTab] = useState('central'); 
  const [breakdownScenario, setBreakdownScenario] = useState('p50');
  const [chartMode, setChartMode] = useState('final_year'); // 'final_year' or 'yearly'
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showAssetInfo, setShowAssetInfo] = useState(false);
  const [showEducationInfo, setShowEducationInfo] = useState(false);
  const [isTableMaximized, setIsTableMaximized] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false); // New state for CSS-based fullscreen

  // AI State
  const [aiAdvice, setAiAdvice] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Helper Functions for Logic ---
  const resetSettings = () => { if(window.confirm('すべての設定を初期値に戻しますか？')) { localStorage.clear(); window.location.reload(); }};
  const getEducationExpense = useCallback((age, eduPath, cram) => {
    let eduCost = 0;
    if (age >= 3 && age <= 5) eduCost = EDUCATION_COSTS.nursery.public;
    else if (age >= 6 && age <= 11) eduCost = eduPath.elementary === 'private' ? EDUCATION_COSTS.elementary.private : EDUCATION_COSTS.elementary.public;
    else if (age >= 12 && age <= 14) eduCost = eduPath.middle === 'private' ? EDUCATION_COSTS.middle.private : EDUCATION_COSTS.middle.public;
    else if (age >= 15 && age <= 17) eduCost = eduPath.high === 'private' ? EDUCATION_COSTS.high.private : EDUCATION_COSTS.high.public;
    else if (age >= 18 && age <= 21) {
      switch (eduPath.university) {
        case 'national': eduCost = EDUCATION_COSTS.university.national; break;
        case 'private_hum': eduCost = EDUCATION_COSTS.university.private_hum; break;
        case 'private_sci': eduCost = EDUCATION_COSTS.university.private_sci; break;
        case 'none': eduCost = 0; break;
        default: eduCost = EDUCATION_COSTS.university.private_hum;
      }
    }
    let cramCost = 0;
    if (age >= cram.start && age <= cram.end) cramCost = getCramCost(age);
    return eduCost + cramCost;
  }, []);

  const addChild = () => setChildren([...children, { id: Date.now(), birthDate: '2020-01-01', edu: { elementary: 'public', middle: 'public', high: 'public', university: 'private_hum' }, cram: { start: 10, end: 18 } }]);
  const removeChild = (id) => setChildren(children.filter(c => c.id !== id));
  // const updateChildAge = (index, val) => { const n = [...children]; n[index].age = Number(val); setChildren(n); }; // 廃止
  const updateChildBirthDate = (index, val) => { const n = [...children]; n[index].birthDate = val; setChildren(n); };
  const updateChildEdu = (index, stage, val) => { const n = [...children]; n[index].edu[stage] = val; setChildren(n); };
  const updateChildCram = (index, field, val) => { const n = [...children]; n[index].cram[field] = Number(val); setChildren(n); };
  const addEvent = () => { if (!newEvent.name) return; setEvents([...events, { ...newEvent, id: Date.now() }].sort((a, b) => a.startAge - b.startAge)); setNewEvent({ ...newEvent, name: '', amount: 100, useInflation: true, assetThreshold: 0 }); };
  const removeEvent = (id) => setEvents(events.filter(e => e.id !== id));

  const updatePortfolio = (type, id, value) => {
    const val = Math.max(0, Math.min(100, Number(value)));
    if (type === 'current') setCurrentPortfolio(prev => ({ ...prev, [id]: val }));
    else setTargetPortfolio(prev => ({ ...prev, [id]: val }));
  };

  const applyPortfolioStats = () => {
    const stats = calculatePortfolioStats(currentPortfolio);
    setExpectedReturn(Number(stats.return.toFixed(2)));
    setRisk(Number(stats.risk.toFixed(2)));
    setShowPortfolioModal(false);
  };

  const portfolioTotal = Object.keys(ASSET_CLASSES).reduce((sum, key) => sum + (currentPortfolio[key] || 0), 0);
  const currentStats = useMemo(() => calculatePortfolioStats(currentPortfolio), [currentPortfolio]);
  const targetStats = useMemo(() => calculatePortfolioStats(targetPortfolio), [targetPortfolio]);

  // CSS-based Full Screen Toggle
  const toggleFullScreen = () => {
    setIsFullScreenMode(!isFullScreenMode);
  };

  // AI
  const generateAiAdvice = async () => {
    setIsAiLoading(true);
    setAiAdvice('');
    const householdIncome = yearlyIncome + (hasSpouse ? spouseIncome : 0);
    const totalAssets = initialCash + initialInvest;
    // 子供情報もプロンプトに含める
    const childrenInfo = children.map((c, i) => `第${i+1}子(${calculateAge(c.birthDate)}歳)`).join(', ');
    
    const prompt = `
      あなたは経験豊富なファイナンシャルプランナーです。
      以下のユーザーのライフプランシミュレーション結果に基づき、以下の3点について親しみやすく、かつ具体的なアドバイスを日本語で生成してください。
      特に、「あなたが設定した${retirementAge}歳での引退」という目標に対して、シミュレーション結果（成功率${stats.successRate.toFixed(1)}%）がどうなのか、という観点で評価してください。
      「いつ引退するか決めましょう」といった前提を問うようなアドバイスは避け、入力されたプランの実現可能性と改善点にフォーカスしてください。
      
      1. **現状の診断**: 設定されたプランの安全性評価。
      2. **リスクへの備え**: 悲観シナリオ（市場暴落やインフレ）に対して、どのような心構えや対策が必要か。
      3. **具体的なアクション**: 資産寿命を延ばす、あるいはより豊かに暮らすための具体的な提案（積立額の調整、支出の見直し、働き方など）。

      【ユーザー情報】
      - 現在年齢: ${currentAge}歳
      - 世帯年収: ${householdIncome}万円
      - 現在資産: ${totalAssets}万円 (うち運用資産 ${initialInvest}万円)
      - 引退予定: ${retirementAge}歳
      - 家族構成: ${hasSpouse ? `配偶者(${spouseAge}歳)` : '配偶者なし'}, 子供: ${childrenInfo || 'なし'}

      【シミュレーション設定】
      - 運用リターン(年率): ${expectedReturn}%
      - インフレ率(年率): ${inflationRate}%
      - 取り崩し設定: ${withdrawalType === 'none' ? 'なし' : withdrawalType}

      【シミュレーション結果】
      - ${lifeExpectancy}歳までの資産維持成功率: ${stats.successRate.toFixed(1)}%
      - 悲観シナリオ(下位10%)での枯渇年齢: ${stats.minP10 < 0 ? stats.negativeAge + '歳' : '枯渇なし'}
      - 引退時の資産(中央値): ${Math.round(stats.assetAtRetirement / 10000)}億円
      - ${lifeExpectancy}歳時点の資産(中央値): ${Math.round(stats.finalP50 / 10000)}億円
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json();
      setAiAdvice(data.candidates?.[0]?.content?.parts?.[0]?.text || "生成失敗");
    } catch (e) { setAiAdvice("エラー"); } finally { setIsAiLoading(false); }
  };

  const estimatedMonthlyMortgage = useMemo(() => calculateMonthlyMortgage(mortgageBalance, mortgageYears, mortgageRate), [mortgageBalance, mortgageYears, mortgageRate]);

  // --- Main Simulation Logic ---
  const runMonteCarloSimulation = useCallback(() => {
    const duration = lifeExpectancy - currentAge + 1;
    if (duration <= 0) return;
    
    // --- 日割り計算用係数 (初年度のみ) ---
    const today = new Date();
    const currentYear = today.getFullYear();
    const isLeap = (currentYear % 4 === 0 && (currentYear % 100 !== 0 || currentYear % 400 === 0));
    const daysInYear = isLeap ? 366 : 365;
    // 今日の正午と年末(12/31)の正午で差分を取る（サマータイム等の影響排除）
    const todayNoon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
    const endYearNoon = new Date(currentYear, 11, 31, 12, 0, 0);
    const daysRemaining = Math.max(0, Math.round((endYearNoon - todayNoon) / (1000 * 60 * 60 * 24))) + 1; // +1で当日含む
    const firstYearFraction = Math.max(0, Math.min(1, daysRemaining / daysInYear));
    // -----------------------------------

    const yearlyStats = [];
    for (let i = 0; i < duration; i++) {
        const progress = glidePathYears > 0 ? Math.min(1, i / glidePathYears) : 0;
        const allocation = {};
        Object.keys(ASSET_CLASSES).forEach(key => {
            const start = currentPortfolio[key] || 0;
            const end = targetPortfolio[key] || 0;
            allocation[key] = start + (end - start) * progress;
        });
        yearlyStats.push(calculatePortfolioStats(allocation));
    }

    const monthlyMortgageMan = housingType === 'owned' ? calculateMonthlyMortgage(mortgageBalance, mortgageYears, mortgageRate) / 10000 : 0;
    const yearlyCashFlows = [];
    let currentUserIncome = yearlyIncome;
    let currentSpouseIncome = spouseIncome;

    for (let i = 0; i < duration; i++) {
        const age = currentAge + i;
        const inflationFactor = Math.pow(1 + inflationRate / 100, i);
        // 初年度のみ日割り係数を適用、以降は1.0
        const fraction = (i === 0) ? firstYearFraction : 1.0; 
        
        // 収入 (継続的なものは日割り)
        let uIncRaw = (age < retirementAge) ? currentUserIncome * Math.pow(1 + incomeGrowth/100, i) : (age >= pensionStartAge ? pension * Math.pow(1+(inflationRate-macroSlide)/100, i) : 0);
        let uInc = uIncRaw * fraction;

        let sIncRaw = hasSpouse ? ((age < spouseRetirementAge) ? currentSpouseIncome * Math.pow(1 + incomeGrowth/100, i) : (age >= spousePensionStartAge ? spousePension * Math.pow(1+(inflationRate-macroSlide)/100, i) : 0)) : 0;
        let sInc = sIncRaw * fraction;

        // 退職金 (一時金なので日割りしない)
        let retInc = 0;
        if (age === retirementAge) retInc += retirementIncome;
        if (hasSpouse && age + (spouseAge - currentAge) === spouseRetirementAge) retInc += spouseRetirementIncome;

        // 基本生活費 (日割り)
        let baseExp = monthlyExpense * 12 * inflationFactor; 
        if (age >= retirementAge) {
             let decayFactor = 1.0;
             if (spendingPattern === 'linear') {
                 decayFactor = Math.pow(1 - expenseDecayRate/100, age - retirementAge);
             } else if (spendingPattern === 'ushape') {
                 if (age >= 85) decayFactor = ushapePhase2Ratio / 100;
                 else if (age >= 75) decayFactor = ushapePhase1Ratio / 100;
                 else decayFactor = 1.0;
             }
             baseExp = baseExp * decayFactor * (postRetirementExpenseRatio / 100);
        }
        baseExp *= fraction;
        
        // 住居費 (日割り)
        let houseCost = housingType === 'rent' ? housingExpense * 12 * inflationFactor : (i < mortgageYears ? monthlyMortgageMan * 12 : 0) + housingExpense * 12 * inflationFactor;
        houseCost *= fraction;
        
        // イベント (継続イベントは日割り、単発イベントはそのまま)
        let eventFlow = 0;
        let eventIncome = 0;
        let eventExpense = 0;
        const conditionalEvents = []; // 閾値判定が必要なイベント

        events.forEach(e => {
            if (e.isRecurring ? (e.startAge <= age && age <= e.endAge) : e.startAge === age) {
                const shouldUseInflation = e.useInflation !== false;
                let val = shouldUseInflation ? e.amount * inflationFactor : e.amount;
                
                // 継続イベントかつ初年度なら日割り適用
                if (e.isRecurring && i === 0) val *= fraction;

                if (e.type === 'expense' && e.assetThreshold > 0) {
                    // 閾値判定ありの支出はここでは計上せず、シミュレーションループ内で判定
                    conditionalEvents.push({ ...e, amount: val, threshold: e.assetThreshold });
                } else {
                    if (e.type === 'income') eventIncome += val;
                    else eventExpense += val;
                }
            }
        });
        eventFlow = eventIncome - eventExpense;

        // 教育費 (年額データなので日割り)
        const eduCostTotal = children.reduce((sum, child) => sum + getEducationExpense(calculateAge(child.birthDate) + i, child.edu, child.cram) * inflationFactor, 0);
        const totalExpense = baseExp + houseCost + eventExpense + (eduCostTotal * fraction);

        const annualBalance = uInc + sInc + retInc - totalExpense + eventIncome;
        const totalIncome = uInc + sInc + retInc + eventIncome;

        // Education cost separately for chart (日割り反映)
        let totalEducationCost = 0;
        children.forEach(child => {
            totalEducationCost += (getEducationExpense(calculateAge(child.birthDate) + i, child.edu, child.cram) * inflationFactor);
        });
        totalEducationCost *= fraction;

        let eventNames = age === retirementAge ? "退職" : "";

        yearlyCashFlows.push({
            age,
            annualBalance: totalIncome - totalExpense, // 再計算したtotalExpenseを使用 (条件付きは含まない)
            eventNames,
            income: totalIncome,
            expense: totalExpense, // (条件付きは含まない)
            baseLivingCost: baseExp,
            housingCost: houseCost,
            eventExpense: eventExpense, // (条件付きは含まない)
            educationCost: totalEducationCost,
            conditionalEvents // ループ内で使用
        });
    }

    const simCount = simulationCount;
    const simDataAtYear = Array.from({ length: duration }, () => []);
    let successCount = 0;

    for (let sim = 0; sim < simCount; sim++) {
        let cash = initialCash;
        let invest = initialInvest;
        let neverDepleted = true;
        
        // For 'fixed_rate_retirement_start' strategy
        let fixedRetirementWithdrawalBase = 0;
        let retirementYearInflationFactor = 1.0;

        for (let i = 0; i < duration; i++) {
            const age = currentAge + i;
            
            // --- 条件付きイベントの実行判定 ---
            let executedConditionalExpense = 0;
            if (yearlyCashFlows[i].conditionalEvents) {
                yearlyCashFlows[i].conditionalEvents.forEach(evt => {
                    const totalAsset = cash + invest;
                    if (totalAsset >= evt.threshold) {
                        executedConditionalExpense += evt.amount;
                    }
                });
            }
            // -------------------------------

            let mu = expectedReturn;
            let sigma = risk;

            if (yearlyStats[i]) {
                mu = yearlyStats[i].return;
                sigma = yearlyStats[i].risk;
            }

            const monthlyMu = mu / 100 / 12;
            const monthlySigma = sigma / 100 / Math.sqrt(12);

            let growthRate = 1.0;
            if (i === 0) {
                // 初年度: 日割り期間のリターン
                // 期待リターン = 年率 * 期間比率
                // リスク(標準偏差) = 年率 * sqrt(期間比率)
                const periodMu = mu / 100 * firstYearFraction;
                const periodSigma = sigma / 100 * Math.sqrt(firstYearFraction);
                growthRate = 1 + periodMu + randn_bm() * periodSigma;
            } else {
                // 2年目以降: 12ヶ月分の積み上げ
                for(let m=0; m<12; m++) {
                   growthRate *= (1 + monthlyMu + randn_bm() * monthlySigma);
                }
            }
            const investStart = invest;
            invest *= growthRate;
            const returnRate = investStart > 0 ? (invest - investStart) / investStart : 0;

            // キャッシュフロー適用 (固定 + 条件付き支出分を減算)
            cash += yearlyCashFlows[i].annualBalance - executedConditionalExpense;

            if (age === retirementAge) {
                // Target Cash adjustment
                if (cash < targetCashAtRetirement) {
                    const diff = targetCashAtRetirement - cash;
                    const move = Math.min(invest, diff);
                    invest -= move;
                    cash += move;
                }
                
                // Store base for fixed_rate_retirement_start
                if (withdrawalType === 'fixed_rate_retirement_start') {
                    fixedRetirementWithdrawalBase = invest * (withdrawalValue / 100);
                    // Use inflationFactor from pre-calculated array (simpler than reconstructing inside)
                    retirementYearInflationFactor = Math.pow(1 + inflationRate / 100, i);
                }
            }

            if (age < retirementAge || investAfterRetirement) {
                // 投資額も初年度は日割り
                let invAmount = annualInvestment;
                if (i === 0) invAmount *= firstYearFraction;

                cash -= invAmount;
                invest += invAmount;
            }

            let withdrawal = 0;
            if (age >= retirementAge) {
                let skip = false;
                if (returnRate < 0) {
                    if (withdrawalStrategy === 'skip_negative') skip = true;
                    else if (withdrawalStrategy === 'skip_negative_limited' && (age - retirementAge) < skipNegativeYearsLimit) skip = true;
                }

                if (!skip) {
                    let target = 0;
                    const currentInflationFactor = Math.pow(1 + inflationRate / 100, i);

                    if (withdrawalType === 'fixed_amount') target = withdrawalValue;
                    else if (withdrawalType === 'fixed_rate') {
                        target = invest * (withdrawalValue / 100);
                        // Cash Cap Logic for Fixed Rate
                        if (maxCashReserve > 0 && (cash + target) > maxCashReserve) {
                            target = Math.max(0, maxCashReserve - cash);
                        }
                    }
                    else if (withdrawalType === 'fixed_rate_retirement_start') {
                        // Inflate the base amount
                        target = fixedRetirementWithdrawalBase * (currentInflationFactor / retirementYearInflationFactor);
                    }
                    else if (withdrawalType === 'shortage' && (yearlyCashFlows[i].annualBalance - executedConditionalExpense) < 0) {
                         target = -(yearlyCashFlows[i].annualBalance - executedConditionalExpense);
                    }
                    else if (withdrawalType === 'keep_cash' && cash < targetCashAtRetirement) target = targetCashAtRetirement - cash;

                    withdrawal = Math.min(invest, target);
                    invest -= withdrawal;
                    cash += withdrawal;
                }
            }

            if (cash < 0) {
                const shortage = -cash;
                if (invest >= shortage) {
                    invest -= shortage;
                    withdrawal += shortage;
                    cash = 0;
                } else {
                    withdrawal += invest;
                    cash += invest;
                    invest = 0;
                }
            }
            
            if (cash + invest < 0) neverDepleted = false;

            simDataAtYear[i].push({ total: cash + invest, cash, invest, returnRate, withdrawal, executedConditionalExpense });
        }
        if (neverDepleted) successCount++;
    }

    // --- Final Year Based Percentiles (Existing Logic) ---
    const finalYearData = simDataAtYear[duration - 1].map((d, idx) => ({ ...d, index: idx })).sort((a, b) => a.total - b.total);
    const idx10 = finalYearData[Math.floor(simCount * 0.1)]?.index || 0;
    const idx50 = finalYearData[Math.floor(simCount * 0.5)]?.index || 0;
    const idx90 = finalYearData[Math.floor(simCount * 0.9)]?.index || 0;

    const extractReturns = (simIdx) => simDataAtYear.map(yd => yd[simIdx].returnRate);
    const extractFinal = (simIdx) => simDataAtYear[duration - 1][simIdx].total;

    // --- Max Withdrawal Rate Calculation ---
    const calculateMaxWithdrawalRate = (simIdx) => {
        let low = 0;
        let high = 0.50; // 50% max search
        
        // Binary search
        for(let k = 0; k < 15; k++) {
            const mid = (low + high) / 2;
            let currentCash = initialCash;
            let currentInvest = initialInvest;
            let depleted = false;
            
            for(let i = 0; i < duration; i++) {
                const retRate = simDataAtYear[i][simIdx].returnRate;
                const age = currentAge + i;
                
                // 1. Calculate Conditional Expenses based on CURRENT loop asset
                let condExpense = 0;
                if (yearlyCashFlows[i].conditionalEvents) {
                    yearlyCashFlows[i].conditionalEvents.forEach(evt => {
                        if ((currentCash + currentInvest) >= evt.threshold) {
                            condExpense += evt.amount;
                        }
                    });
                }

                // 2. Apply Return to Invest
                currentInvest *= (1 + retRate);

                // 3. Apply Income/Expense
                const yearBalance = yearlyCashFlows[i].annualBalance - condExpense;
                currentCash += yearBalance;

                // 4. Standard Investment Flow & Rebalancing
                // Accumulation phase or Reinvestment of excess cash
                let invAmount = 0;
                if (age < retirementAge || investAfterRetirement) {
                     invAmount = annualInvestment;
                     if (i === 0) {
                         const today = new Date();
                         const currentYear = today.getFullYear();
                         const isLeap = (currentYear % 4 === 0 && (currentYear % 100 !== 0 || currentYear % 400 === 0));
                         const daysInYear = isLeap ? 366 : 365;
                         const todayNoon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
                         const endYearNoon = new Date(currentYear, 11, 31, 12, 0, 0);
                         const daysRemaining = Math.max(0, Math.round((endYearNoon - todayNoon) / (1000 * 60 * 60 * 24))) + 1;
                         const firstYearFraction = Math.max(0, Math.min(1, daysRemaining / daysInYear));
                         invAmount *= firstYearFraction;
                     }
                }

                // Move planned investment from cash to invest
                if (currentCash >= invAmount) {
                    currentCash -= invAmount;
                    currentInvest += invAmount;
                }

                // *** Cash Cap Reinvestment Logic ***
                // If cash exceeds limit, move excess to invest to maximize return efficiency
                // Default maxCashReserve if user set it to 0 or undefined for this calculation context is debatable, 
                // but let's use the user's setting. If 0 (no cap), then no reinvestment -> inefficient.
                // Assuming user wants "Optimal" withdrawal rate, we should perhaps assume optimal cash management (reinvest excess).
                // Let's use the current maxCashReserve setting.
                if (maxCashReserve > 0 && currentCash > maxCashReserve) {
                    const excess = currentCash - maxCashReserve;
                    currentCash -= excess;
                    currentInvest += excess;
                }

                // 5. Apply "Mechanical Fixed Rate Withdrawal" (Consumption)
                if (age >= retirementAge) {
                    const totalAsset = currentCash + currentInvest;
                    // Calculate withdrawal amount based on Total Asset
                    const withdrawalAmount = Math.max(0, totalAsset * mid);
                    
                    // Deduct from Invest first, then Cash
                    if (currentInvest >= withdrawalAmount) {
                        currentInvest -= withdrawalAmount;
                    } else {
                        const remain = withdrawalAmount - currentInvest;
                        currentInvest = 0;
                        currentCash -= remain;
                    }
                }
                
                // 6. Check Depletion
                if ((currentCash + currentInvest) < 0) {
                    depleted = true;
                    break;
                }
            }
            
            if (depleted) high = mid; // Rate too high
            else low = mid; // Asset survived
        }
        return low * 100;
    };

    setSummaryMetrics({
        pessimistic: { ...calculateMetrics(extractReturns(idx10), extractFinal(idx10)), maxWithdrawalRate: calculateMaxWithdrawalRate(idx10) },
        central: { ...calculateMetrics(extractReturns(idx50), extractFinal(idx50)), maxWithdrawalRate: calculateMaxWithdrawalRate(idx50) },
        optimistic: { ...calculateMetrics(extractReturns(idx90), extractFinal(idx90)), maxWithdrawalRate: calculateMaxWithdrawalRate(idx90) }
    });

    const res = yearlyCashFlows.map((cf, i) => {
        // Final Year Based Data
        const final_p10 = simDataAtYear[i][idx10];
        const final_p50 = simDataAtYear[i][idx50];
        const final_p90 = simDataAtYear[i][idx90];

        // Yearly Based Data (Sort at each year independently)
        const sortedThisYear = [...simDataAtYear[i]].sort((a, b) => a.total - b.total);
        const yearly_p10 = sortedThisYear[Math.floor(simCount * 0.1)] || sortedThisYear[0];
        const yearly_p50 = sortedThisYear[Math.floor(simCount * 0.5)] || sortedThisYear[0];
        const yearly_p90 = sortedThisYear[Math.floor(simCount * 0.9)] || sortedThisYear[0];

        // 中央値シナリオでの条件付き支出額を加算して、表示上の「支出」とする
        const displayExpense = cf.expense + (final_p50.executedConditionalExpense || 0);
        const displayBalance = cf.income - displayExpense;
        const displayEventExpense = cf.eventExpense + (final_p50.executedConditionalExpense || 0);

        return {
            age: cf.age,
            income: Math.round(cf.income),
            expense: Math.round(displayExpense),
            annualBalance: Math.round(displayBalance),
            
            baseLivingCost: Math.round(cf.baseLivingCost),
            housingCost: Math.round(cf.housingCost),
            educationCost: Math.round(cf.educationCost),
            eventExpense: Math.round(displayEventExpense),

            // Final Year Based Keys (Legacy + Explicit)
            pessimistic_total: Math.round(final_p10.total), // legacy for compatibility if needed
            central_total: Math.round(final_p50.total),     // legacy
            optimistic_total: Math.round(final_p90.total),  // legacy

            final_pessimistic_total: Math.round(final_p10.total),
            final_pessimistic_cash: Math.round(final_p10.cash),
            final_pessimistic_invest: Math.round(final_p10.invest),
            final_pessimistic_return: (final_p10.returnRate * 100).toFixed(1),
            final_pessimistic_withdrawal: Math.round(final_p10.withdrawal),

            final_central_total: Math.round(final_p50.total),
            final_central_cash: Math.round(final_p50.cash),
            final_central_invest: Math.round(final_p50.invest),
            final_central_return: (final_p50.returnRate * 100).toFixed(1),
            final_central_withdrawal: Math.round(final_p50.withdrawal),

            final_optimistic_total: Math.round(final_p90.total),
            final_optimistic_cash: Math.round(final_p90.cash),
            final_optimistic_invest: Math.round(final_p90.invest),
            final_optimistic_return: (final_p90.returnRate * 100).toFixed(1),
            final_optimistic_withdrawal: Math.round(final_p90.withdrawal),

            // Yearly Based Keys
            yearly_pessimistic_total: Math.round(yearly_p10.total),
            yearly_pessimistic_cash: Math.round(yearly_p10.cash),
            yearly_pessimistic_invest: Math.round(yearly_p10.invest),
            yearly_pessimistic_return: (yearly_p10.returnRate * 100).toFixed(1),
            yearly_pessimistic_withdrawal: Math.round(yearly_p10.withdrawal),

            yearly_central_total: Math.round(yearly_p50.total),
            yearly_central_cash: Math.round(yearly_p50.cash),
            yearly_central_invest: Math.round(yearly_p50.invest),
            yearly_central_return: (yearly_p50.returnRate * 100).toFixed(1),
            yearly_central_withdrawal: Math.round(yearly_p50.withdrawal),

            yearly_optimistic_total: Math.round(yearly_p90.total),
            yearly_optimistic_cash: Math.round(yearly_p90.cash),
            yearly_optimistic_invest: Math.round(yearly_p90.invest),
            yearly_optimistic_return: (yearly_p90.returnRate * 100).toFixed(1),
            yearly_optimistic_withdrawal: Math.round(yearly_p90.withdrawal),

            event: cf.eventNames
        };
    });

    setSimulationData(res);
    
    // Calculate Survival Rates (Depletion Avoidance Rates)
    const calculateSurvivalRateAtAge = (targetAge) => {
        const idx = targetAge - currentAge;
        if (idx < 0 || idx >= duration) return null;
        // 資産が0以上のシミュレーション数をカウント
        const count = simDataAtYear[idx].filter(d => d.total >= 0).length;
        return (count / simCount) * 100;
    };

    const survivalRates = {
        age85: calculateSurvivalRateAtAge(85),
        age90: calculateSurvivalRateAtAge(90),
        age95: calculateSurvivalRateAtAge(95),
    };

    const assetAtRetirementIdx = retirementAge - currentAge;
    setStats({
        minP10: Math.min(...res.map(d => d.final_pessimistic_total)),
        finalP50: res[res.length-1].final_central_total,
        negativeAge: res.find(d => d.final_pessimistic_total < 0)?.age,
        successRate: (successCount / simCount) * 100,
        assetAtRetirement: assetAtRetirementIdx >= 0 ? res[assetAtRetirementIdx].final_central_total : 0,
        survivalRates // survivalRatesをセット
    });

  }, [currentAge, retirementAge, pensionStartAge, lifeExpectancy, yearlyIncome, spouseIncome, initialCash, initialInvest, incomeGrowth, inflationRate, macroSlide, expectedReturn, risk, monthlyExpense, housingExpense, housingType, mortgageBalance, mortgageYears, mortgageRate, currentPortfolio, targetPortfolio, glidePathYears, annualInvestment, investAfterRetirement, withdrawalType, withdrawalValue, targetCashAtRetirement, withdrawalStrategy, skipNegativeYearsLimit, simulationCount, getEducationExpense, postRetirementExpenseRatio, ushapePhase1Ratio, ushapePhase2Ratio, maxCashReserve]);

  useEffect(() => {
    setIsCalculating(true);
    const t = setTimeout(() => { runMonteCarloSimulation(); setIsCalculating(false); }, 600);
    return () => clearTimeout(t);
  }, [runMonteCarloSimulation]);

  const yAxisTickFormatter = (val) => (Math.abs(val) >= 10000 ? (val / 10000).toFixed(0) + '億' : val + '万');
  const portfolioData = useMemo(() => Object.keys(currentPortfolio).map(key => ({ name: ASSET_CLASSES[key].name, value: currentPortfolio[key], color: ASSET_CLASSES[key].color })).filter(item => item.value > 0), [currentPortfolio]);

  const getKey = (base) => chartMode === 'final_year' ? `final_${base}` : `yearly_${base}`;

  // --- Render ---
  return (
    <div className={`min-h-screen bg-slate-50 p-2 md:p-6 font-sans text-slate-800 ${isFullScreenMode ? 'fixed inset-0 z-[200] overflow-auto' : ''}`}>
      {showAssetInfo && <AssetInfoModal onClose={() => setShowAssetInfo(false)} />}
      {showEducationInfo && <EducationCostModal onClose={() => setShowEducationInfo(false)} />}
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp/> ライフプランシミュレータ Expert</h1>
            <div className="flex gap-3 items-center">
                <button onClick={toggleFullScreen} className={`text-xs bg-white border px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1 ${isFullScreenMode ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : ''}`} title={isFullScreenMode ? "全画面解除" : "全画面表示"}>
                    {isFullScreenMode ? <Minimize2 size={12}/> : <Maximize2 size={12}/>} {isFullScreenMode ? "戻る" : "全画面"}
                </button>
                <button onClick={resetSettings} className="text-xs underline hover:text-red-500">リセット</button>
                <span className="text-xs bg-white px-2 py-1 rounded border flex gap-1"><Save size={12}/> 保存ON</span>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel */}
          <div className="lg:col-span-4 space-y-4 h-fit lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto custom-scrollbar">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-sm mb-2 text-slate-700 flex items-center gap-2"><User size={16}/> 本人</h3>
                <div className="grid grid-cols-2 gap-2">
                    {/* 生年月日入力 */}
                    <div className="col-span-2 flex items-center justify-between mb-2">
                        <label className="text-[10px] text-slate-500 flex items-center gap-1">生年月日</label>
                        <div className="flex items-center gap-2">
                             <input type="date" value={userBirthDate} onChange={(e) => setUserBirthDate(e.target.value)} className="p-1 text-xs border rounded text-right bg-white" />
                             <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{currentAge}歳</span>
                        </div>
                    </div>
                    
                    <InputGroup label="引退年齢" value={retirementAge} onChange={setRetirementAge} unit="歳"/>
                    <InputGroup label="退職金" value={retirementIncome} onChange={setRetirementIncome} unit="万円"/>
                    <InputGroup label="手取り年収" value={yearlyIncome} onChange={setYearlyIncome} unit="万円"/>
                    <InputGroup label="年金開始" value={pensionStartAge} onChange={setPensionStartAge} unit="歳"/>
                    <InputGroup label="年金(年額)" value={pension} onChange={setPension} unit="万円"/>
                    <InputGroup label="シミュ終了" value={lifeExpectancy} onChange={setLifeExpectancy} unit="歳"/>
                </div>
            </div>
            
            <div className={`bg-white p-4 rounded-xl shadow-sm border transition-colors duration-300 ${hasSpouse ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200'}`}>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-sm flex items-center gap-2 text-slate-700 uppercase tracking-wider"><Users size={16}/> 配偶者</h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={hasSpouse} onChange={e => setHasSpouse(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                {hasSpouse && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="col-span-2 flex items-center justify-between">
                        <label className="text-[10px] text-slate-500 flex items-center gap-1">生年月日</label>
                        <div className="flex items-center gap-2">
                             <input type="date" value={spouseBirthDate} onChange={(e) => setSpouseBirthDate(e.target.value)} className="p-1 text-xs border rounded text-right bg-white" />
                             <span className="text-xs font-bold text-indigo-600 bg-white px-2 py-1 rounded border border-indigo-100">{spouseAge}歳</span>
                        </div>
                    </div>
                    <InputGroup label="手取り年収" value={spouseIncome} onChange={setSpouseIncome} unit="万円" />
                    <InputGroup label="引退年齢" value={spouseRetirementAge} onChange={setSpouseRetirementAge} unit="歳" />
                    <InputGroup label="退職金(手取)" value={spouseRetirementIncome} onChange={setSpouseRetirementIncome} unit="万円" />
                    <InputGroup label="年金開始" value={spousePensionStartAge} onChange={setSpousePensionStartAge} unit="歳" />
                    <InputGroup label="年金(年額)" value={spousePension} onChange={setSpousePension} unit="万円" />
                  </div>
                )}
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-sm mb-2">💰 資産・ポートフォリオ</h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <InputGroup label="貯蓄(現金)" value={initialCash} onChange={setInitialCash} unit="万円" icon={<PiggyBank size={12}/>}/>
                    <InputGroup label="運用資産" value={initialInvest} onChange={setInitialInvest} unit="万円" icon={<Coins size={12}/>}/>
                </div>
                <div className="col-span-2 bg-indigo-50 p-2 rounded border border-indigo-100">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold text-indigo-700 flex items-center gap-1"><Settings2 size={12}/> ポートフォリオ設定 (運用資産のみ)</label>
                        <button onClick={() => setShowPortfolioModal(!showPortfolioModal)} className="text-[10px] bg-white border px-2 py-0.5 rounded hover:bg-indigo-100">{showPortfolioModal ? '閉じる' : '編集'}</button>
                    </div>
                    {showPortfolioModal ? (
                        <div className="space-y-3 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-center mb-1">現在 (Start)</p>
                                    {Object.keys(ASSET_CLASSES).map(key => (
                                        <div key={key} className="flex items-center gap-1 mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:ASSET_CLASSES[key].color}}></div>
                                            <span className="text-[10px] flex-1 truncate">{ASSET_CLASSES[key].name}</span>
                                            <input 
                                                type="number" 
                                                min="0" max="100" 
                                                value={currentPortfolio[key]} 
                                                onChange={(e) => updatePortfolio('current', key, e.target.value)}
                                                className="w-8 p-0.5 text-[10px] border rounded text-right flex-shrink-0"
                                            />
                                            <span className="text-[9px]">%</span>
                                        </div>
                                    ))}
                                    <div className="text-[10px] font-bold mt-1 text-center">{Object.values(currentPortfolio).reduce((a,b)=>a+b,0)}%</div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-center mb-1">目標 (End)</p>
                                    {Object.keys(ASSET_CLASSES).map(key => (
                                        <div key={key} className="flex items-center gap-1 mb-1">
                                            <span className="text-[10px] flex-1 truncate">{ASSET_CLASSES[key].name}</span>
                                            <input 
                                                type="number" 
                                                value={targetPortfolio[key]} 
                                                onChange={(e) => updatePortfolio('target', key, e.target.value)} 
                                                className="w-8 p-0.5 text-[10px] border rounded text-right flex-shrink-0"
                                            />
                                            <span className="text-[9px]">%</span>
                                        </div>
                                    ))}
                                    <div className="text-[10px] font-bold mt-1 text-center">{Object.values(targetPortfolio).reduce((a,b)=>a+b,0)}%</div>
                                </div>
                            </div>
                            <div><InputGroup label="移行期間 (グライドパス)" value={glidePathYears} onChange={setGlidePathYears} unit="年"/></div>
                            <button onClick={() => setShowAssetInfo(true)} className="w-full mt-2 text-[10px] bg-slate-200 hover:bg-slate-300 py-1 rounded flex items-center justify-center gap-1"><BarChart2 size={10}/> 📊 アセット詳細・相関表を確認</button>
                        </div>
                    ) : (
                        <div className="flex gap-2 text-[10px]">
                            <div className="flex-1"><span className="block font-bold">現在</span><span>期待利回り: {currentStats.return.toFixed(1)}%</span><br/><span>リスク: {currentStats.risk.toFixed(1)}%</span></div>
                            <ArrowRight size={14} className="text-slate-400 mt-2"/>
                            <div className="flex-1"><span className="block font-bold">目標</span><span>期待利回り: {targetStats.return.toFixed(1)}%</span><br/><span>リスク: {targetStats.risk.toFixed(1)}%</span></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                 <h2 className="font-bold text-sm flex items-center gap-2 text-slate-700 uppercase tracking-wider"><Baby size={16}/> 子供・教育費</h2>
                 <button onClick={() => setShowEducationInfo(true)} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1 hover:bg-indigo-100">
                    <Info size={10}/> 費用の内訳・詳細を確認
                 </button>
              </div>
              <div className="space-y-4 mb-4">
                {children.map((child, index) => (
                  <div key={child.id} className="bg-slate-50 p-3 rounded border border-slate-100 text-sm space-y-3 relative group">
                    <div className="flex justify-between items-center border-b pb-2">
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-indigo-700 flex items-center gap-1"><User size={14}/> 第{index + 1}子</span>
                           <input type="date" value={child.birthDate} onChange={(e) => updateChildBirthDate(index, e.target.value)} className="w-24 p-1 text-xs border rounded bg-white outline-none" />
                           <span className="text-xs text-slate-500 font-bold bg-white px-1 rounded border border-slate-200">{calculateAge(child.birthDate)}歳</span>
                        </div>
                      <button onClick={() => removeChild(child.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-1"><label className="block text-[10px] text-slate-500">小学校</label><select value={child.edu.elementary} onChange={(e) => updateChildEdu(index, 'elementary', e.target.value)} className="w-full p-1 text-xs border rounded bg-white"><option value="public">公立</option><option value="private">私立</option></select></div>
                         <div className="col-span-1"><label className="block text-[10px] text-slate-500">中学校</label><select value={child.edu.middle} onChange={(e) => updateChildEdu(index, 'middle', e.target.value)} className="w-full p-1 text-xs border rounded bg-white"><option value="public">公立</option><option value="private">私立</option></select></div>
                         <div className="col-span-1"><label className="block text-[10px] text-slate-500">高校</label><select value={child.edu.high} onChange={(e) => updateChildEdu(index, 'high', e.target.value)} className="w-full p-1 text-xs border rounded bg-white"><option value="public">公立</option><option value="private">私立</option></select></div>
                        <div className="col-span-1"><label className="block text-[10px] text-slate-500">大学</label><select value={child.edu.university} onChange={(e) => updateChildEdu(index, 'university', e.target.value)} className="w-full p-1 text-xs border rounded bg-white"><option value="national">国公立</option><option value="private_hum">私立(文)</option><option value="private_sci">私立(理)</option><option value="none">行かない</option></select></div>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-100 mt-2">
                        <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><GraduationCap size={12}/> 塾・習い事</div>
                        <div className="flex items-center gap-2">
                             <div className="flex-1"><label className="text-[10px] text-slate-400">開始</label><input type="number" min="0" max="22" value={child.cram.start} onChange={(e) => updateChildCram(index, 'start', e.target.value)} className="w-full p-1 text-xs border rounded" /></div>
                             <span className="text-slate-400">~</span>
                             <div className="flex-1"><label className="text-[10px] text-slate-400">終了</label><input type="number" min="0" max="22" value={child.cram.end} onChange={(e) => updateChildCram(index, 'end', e.target.value)} className="w-full p-1 text-xs border rounded" /></div>
                             <span className="text-xs text-slate-500 pt-3">歳</span>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-center p-2 bg-indigo-50 rounded border border-indigo-100"><button onClick={addChild} className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 text-xs flex items-center justify-center gap-1 font-bold"><Plus size={14}/> 子供を追加</button></div>
            </div>

             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-700 uppercase tracking-wider"><Home size={16}/> 住居・ローン</h2>
              <div>
                    <div className="flex items-center gap-4 mb-3">
                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Home size={12}/> 住居タイプ</label>
                        <div className="flex bg-slate-100 p-1 rounded">
                            <button onClick={() => setHousingType('rent')} className={`px-3 py-1 text-xs rounded transition-colors ${housingType === 'rent' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-500'}`}>賃貸</button>
                            <button onClick={() => setHousingType('owned')} className={`px-3 py-1 text-xs rounded transition-colors ${housingType === 'owned' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-500'}`}>持ち家</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label={housingType === 'rent' ? "家賃(月)" : "管理修繕費(月)"} value={housingExpense} onChange={setHousingExpense} unit="万円" />
                        {housingType === 'owned' && (
                            <>
                                <InputGroup label="ローン残債" value={mortgageBalance} onChange={setMortgageBalance} unit="万円" />
                                <InputGroup label="残り年数" value={mortgageYears} onChange={setMortgageYears} unit="年" />
                                <InputGroup label="金利" value={mortgageRate} onChange={setMortgageRate} unit="%" step={0.01}/>
                            </>
                        )}
                    </div>
                 </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                 <h3 className="font-bold text-sm mb-2">💳 収支・イベント</h3>
                 <div className="space-y-3">
                     <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="月生活費" value={monthlyExpense} onChange={setMonthlyExpense} unit="万円"/>
                        <InputGroup label="昇給率(年)" value={incomeGrowth} onChange={setIncomeGrowth} unit="%" step={0.1} />
                        <InputGroup label="インフレ率(年)" value={inflationRate} onChange={setInflationRate} unit="%" step={0.1} />
                        <InputGroup label="年金調整(スライド)" value={macroSlide} onChange={setMacroSlide} unit="%" step={0.1} />
                     </div>

                     <div className="bg-indigo-50/50 p-2 rounded border border-indigo-100 space-y-3">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-indigo-700 flex items-center gap-1"><ArrowUpCircle size={12}/> 積立投資</label>
                            <div className="flex items-center gap-2">
                                <InputGroup label="年間入金額" value={annualInvestment} onChange={setAnnualInvestment} unit="万円" />
                                <label className="flex items-center gap-1 text-[10px] mt-4 whitespace-nowrap cursor-pointer">
                                    <input type="checkbox" checked={investAfterRetirement} onChange={e => setInvestAfterRetirement(e.target.checked)} className="accent-indigo-600"/> 引退後も継続
                                </label>
                            </div>
                        </div>
                        <div className="border-t border-indigo-100"></div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-orange-700 flex items-center gap-1"><ArrowDownCircle size={12}/> 取り崩し・現金管理</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="col-span-2 flex items-center gap-2">
                                    <InputGroup label="引退時目標現金" value={targetCashAtRetirement} onChange={setTargetCashAtRetirement} unit="万円" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] text-slate-500 mb-1">取り崩し方式</label>
                                    <select value={withdrawalType} onChange={e=>setWithdrawalType(e.target.value)} className="w-full p-1.5 text-xs border rounded bg-white">
                                        <option value="none">なし</option>
                                        <option value="fixed_amount">定額 (万円)</option>
                                        <option value="fixed_rate">定率 (毎年再計算)</option>
                                        <option value="fixed_rate_retirement_start">定率 (引退時決定・固定)</option>
                                        <option value="shortage">不足額 (収支補填)</option>
                                        <option value="keep_cash">現金一定 (目標維持)</option>
                                    </select>
                                </div>
                                {(withdrawalType === 'fixed_rate' || withdrawalType === 'fixed_amount' || withdrawalType === 'fixed_rate_retirement_start') && (
                                    <div className="col-span-2 flex items-center gap-2 mt-1">
                                        <input type="number" value={withdrawalValue} onChange={e=>setWithdrawalValue(Number(e.target.value))} className="w-20 p-1.5 text-xs border rounded"/>
                                        <span className="text-xs text-slate-500">{withdrawalType === 'fixed_amount' ? '万円/年' : '%/年'}</span>
                                    </div>
                                )}
                                {withdrawalType === 'fixed_rate' && (
                                    <div className="col-span-2 flex items-center gap-2 mt-1 bg-white p-1 rounded border border-orange-200">
                                        <label className="text-[10px] text-orange-700 whitespace-nowrap">現金上限</label>
                                        <input type="number" value={maxCashReserve} onChange={e=>setMaxCashReserve(Number(e.target.value))} className="w-16 p-1 text-xs border rounded text-right"/>
                                        <span className="text-[10px] text-slate-400">万</span>
                                    </div>
                                )}
                                <div className="col-span-2 mt-2">
                                    <label className="block text-[10px] text-slate-500 mb-1 flex items-center gap-1"><ShieldAlert size={10}/> マイナスリターン時の対応</label>
                                    <select value={withdrawalStrategy} onChange={e=>setWithdrawalStrategy(e.target.value)} className="w-full p-1.5 text-xs border rounded bg-white">
                                        <option value="always">常に実行</option>
                                        <option value="skip_negative">マイナス時は停止(永続)</option>
                                        <option value="skip_negative_limited">マイナス時は停止(期間制限)</option>
                                    </select>
                                </div>
                                {withdrawalStrategy === 'skip_negative_limited' && (
                                    <div className="col-span-2 flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-slate-500">引退後</span>
                                        <input type="number" value={skipNegativeYearsLimit} onChange={e => setSkipNegativeYearsLimit(Number(e.target.value))} className="w-12 p-1.5 text-xs border rounded"/>
                                        <span className="text-[10px] text-slate-500">年間は停止</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1">※現金が枯渇する場合は設定に関わらず補填します</p>
                        </div>
                    </div>
                     
                     <div className="border-t pt-2">
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1"><TrendingDown size={12}/> 老後の支出変化</label>
                                <select value={spendingPattern} onChange={(e) => setSpendingPattern(e.target.value)} className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
                                    <option value="flat">一定 (インフレのみ)</option><option value="linear">徐々に減少 (定率)</option><option value="ushape">段階的変化 (U字型)</option>
                                </select>
                            </div>
                        </div>
                        {/* 常に表示: 退職後の生活費比率 */}
                        <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-2">
                             <InputGroup label="退職後の生活費率" value={postRetirementExpenseRatio} onChange={setPostRetirementExpenseRatio} unit="%" step={5} />
                             {spendingPattern === 'linear' && <div className="pt-2 border-t border-slate-200"><InputGroup label="毎年の減少率" value={expenseDecayRate} onChange={setExpenseDecayRate} unit="%" step={0.1} /></div>}
                             {spendingPattern === 'ushape' && (
                                 <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                                     <div className="col-span-2 text-[10px] font-bold text-slate-500">各フェーズの支出率</div>
                                     <InputGroup label="75歳~" value={ushapePhase1Ratio} onChange={setUshapePhase1Ratio} unit="%" step={5} />
                                     <InputGroup label="85歳~" value={ushapePhase2Ratio} onChange={setUshapePhase2Ratio} unit="%" step={5} />
                                 </div>
                             )}
                        </div>
                     </div>
                     </div>

                     <div className="border-t pt-2">
                      <p className="text-xs font-bold mb-2 text-slate-600 flex items-center gap-1"><Activity size={14}/> イベント・その他収支</p>
                      <div className="space-y-2 mb-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {events.map((event) => (
                          <div key={event.id} className={`text-xs p-2 rounded border flex flex-col gap-1 ${event.type === 'income' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <div className="flex justify-between items-center"><span className="font-bold text-slate-700">{event.name}</span><button onClick={() => removeEvent(event.id)}><Trash2 size={12} className="text-slate-400 hover:text-red-500"/></button></div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                                <div>
                                    {event.isRecurring ? <span className="flex items-center gap-1"><Repeat size={10}/> {event.startAge}歳 ~ {event.endAge}歳</span> : <span>{event.startAge}歳 (単発)</span>}
                                    <span className="ml-2 text-[9px] px-1 rounded bg-slate-100 border text-slate-500">{event.useInflation !== false ? 'インフレ連動' : '固定額'}</span>
                                </div>
                                <div className={`font-bold ${event.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{event.type === 'income' ? '+' : '-'}{event.amount}万{event.isRecurring && '/年'}</div>
                            </div>
                            {event.type === 'expense' && event.assetThreshold > 0 && (
                                <div className="text-[9px] text-orange-600 font-bold mt-1">
                                    ※ 資産 {event.assetThreshold}万未満で停止
                                </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200 space-y-2">
                          <div className="flex gap-2">
                              <input type="text" placeholder="名称" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} className="flex-1 p-1 text-xs border rounded"/>
                              <div className="flex bg-white rounded border overflow-hidden">
                                  <button onClick={() => setNewEvent({...newEvent, type: 'expense'})} className={`px-2 py-1 text-[10px] ${newEvent.type === 'expense' ? 'bg-red-100 text-red-700 font-bold' : 'text-slate-400'}`}>支出</button>
                                  <button onClick={() => setNewEvent({...newEvent, type: 'income'})} className={`px-2 py-1 text-[10px] ${newEvent.type === 'income' ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400'}`}>収入</button>
                              </div>
                          </div>
                          <div className="flex gap-2 items-center">
                              <div className="flex-1 flex items-center gap-1 bg-white border rounded px-1"><span className="text-[10px] text-slate-400">金額</span><input type="number" value={newEvent.amount} onChange={e => setNewEvent({...newEvent, amount: Number(e.target.value)})} className="w-full p-1 text-xs outline-none"/><span className="text-[10px] text-slate-400">万</span></div>
                              <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="チェックするとインフレ率に合わせて金額が増加します"><input type="checkbox" checked={newEvent.useInflation !== false} onChange={e => setNewEvent({...newEvent, useInflation: e.target.checked})} className="accent-indigo-600"/><span>インフレ連動</span></label>
                              <label className="flex items-center gap-1 text-[10px] cursor-pointer"><input type="checkbox" checked={newEvent.isRecurring} onChange={e => setNewEvent({...newEvent, isRecurring: e.target.checked})} className="accent-indigo-600"/><span>毎年</span></label>
                          </div>
                          <div className="flex gap-2 items-center">
                              <div className="flex items-center gap-1"><input type="number" value={newEvent.startAge} onChange={e => setNewEvent({...newEvent, startAge: Number(e.target.value)})} className="w-10 p-1 text-xs border rounded text-center"/><span className="text-[10px] text-slate-500">歳</span></div>
                              {newEvent.isRecurring && (<><span className="text-slate-400 text-[10px]">~</span><div className="flex items-center gap-1"><input type="number" value={newEvent.endAge} onChange={e => setNewEvent({...newEvent, endAge: Number(e.target.value)})} className="w-10 p-1 text-xs border rounded text-center"/><span className="text-[10px] text-slate-500">歳</span></div></>)}
                              <button onClick={addEvent} className="ml-auto bg-slate-700 text-white p-1.5 rounded hover:bg-slate-600 flex items-center gap-1 text-xs"><Plus size={12}/> 追加</button>
                          </div>
                          {newEvent.type === 'expense' && (
                              <div className="flex items-center gap-2 mt-1">
                                  <label className="text-[10px] text-slate-500 flex items-center gap-1" title="資産残高がこの値を下回る場合は支出を実行しません">実行資産閾値(万)</label>
                                  <input type="number" value={newEvent.assetThreshold} onChange={e => setNewEvent({...newEvent, assetThreshold: Number(e.target.value)})} className="w-20 p-1 text-xs border rounded text-right"/>
                              </div>
                          )}
                      </div>
                     </div>
                 </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-8 flex flex-col gap-4 h-full">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-3 rounded-lg border-l-4 shadow-sm bg-white ${stats.successRate < 80 ? 'border-red-500' : 'border-green-500'}`}>
                    <div className="text-xs text-slate-500 font-bold">全期間 枯渇回避率</div>
                    <div className="text-xl font-bold">{formatPercent(stats.successRate, 1)}</div>
                </div>
                <div className="p-3 rounded-lg border-l-4 border-indigo-500 shadow-sm bg-white">
                    <div className="text-xs text-slate-500 font-bold">{lifeExpectancy}歳資産(中央)</div>
                    <div className="text-xl font-bold">{formatCurrency(stats.finalP50/10000)}億円</div>
                </div>
                 <div className="p-3 rounded-lg border-l-4 border-slate-400 shadow-sm bg-white">
                    <div className="text-xs text-slate-500 font-bold">引退時資産(中央)</div>
                    <div className="text-xl font-bold">{formatCurrency(stats.assetAtRetirement/10000)}億円</div>
                </div>
                 <div className="p-3 rounded-lg border-l-4 border-blue-400 shadow-sm bg-white">
                    <div className="text-xs text-slate-500 font-bold mb-1">年齢別 枯渇回避率</div>
                    <div className="flex flex-col gap-0.5 text-xs">
                        <div className="flex justify-between"><span>85歳:</span> <span className="font-bold">{formatPercent(stats.survivalRates?.age85, 1)}</span></div>
                        <div className="flex justify-between"><span>90歳:</span> <span className="font-bold">{formatPercent(stats.survivalRates?.age90, 1)}</span></div>
                        <div className="flex justify-between"><span>95歳:</span> <span className="font-bold">{formatPercent(stats.survivalRates?.age95, 1)}</span></div>
                    </div>
                </div>
            </div>
            
            {/* Chart */}
            <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200 h-[400px]">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">資産推移</h3>
                    <div className="flex bg-slate-100 p-1 rounded">
                        <button onClick={() => setChartMode('final_year')} className={`px-3 py-1 text-xs rounded transition-colors ${chartMode === 'final_year' ? 'bg-white shadow font-bold text-indigo-600' : 'text-slate-500'}`}>最終年基準</button>
                        <button onClick={() => setChartMode('yearly')} className={`px-3 py-1 text-xs rounded transition-colors ${chartMode === 'yearly' ? 'bg-white shadow font-bold text-indigo-600' : 'text-slate-500'}`}>各年基準</button>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={simulationData} margin={{top:10, right:10, left:0, bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="age" unit="歳" tick={{fontSize:10}}/>
                    <YAxis tickFormatter={yAxisTickFormatter} tick={{fontSize:10}} width={40}/>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(val) => Math.round(val).toLocaleString() + '万円'} labelFormatter={(label) => `${label}歳`} />
                    <Legend />
                    <Area type="monotone" dataKey={getKey('optimistic_total')} stackId="1" stroke="none" fill="#e0e7ff" name="範囲"/>
                    <Line type="monotone" dataKey={getKey('central_total')} stroke="#4f46e5" strokeWidth={2} dot={false} name="中央値"/>
                    <Line type="monotone" dataKey={getKey('pessimistic_total')} stroke="#9ca3af" strokeWidth={1} dot={false} name="悲観"/>
                  </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Breakdown Chart (Bar) */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-md border border-slate-200 h-[400px] flex flex-col">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-700">資産内訳詳細 (現金 vs 運用)</h3>
                  <div className="flex bg-slate-100 p-1 rounded text-xs">
                      <button onClick={() => setBreakdownScenario('p10')} className={`px-3 py-1 rounded ${breakdownScenario === 'p10' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-500'}`}>悲観</button>
                      <button onClick={() => setBreakdownScenario('p50')} className={`px-3 py-1 rounded ${breakdownScenario === 'p50' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-500'}`}>中央</button>
                      <button onClick={() => setBreakdownScenario('p90')} className={`px-3 py-1 rounded ${breakdownScenario === 'p90' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-500'}`}>楽観</button>
                  </div>
               </div>
               <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simulationData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="age" unit="歳" tick={{fontSize: 12}} minTickGap={30} />
                    <YAxis tickFormatter={yAxisTickFormatter} width={60} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(val, name) => [Math.round(val).toLocaleString() + '万円', name]} labelFormatter={(label) => `${label}歳時点 (${breakdownScenario === 'p10' ? '悲観' : breakdownScenario === 'p50' ? '中央' : '楽観'}シナリオ)`} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#64748b" />
                    <Bar dataKey={`${getKey(`${breakdownScenario === 'p10' ? 'pessimistic' : breakdownScenario === 'p50' ? 'central' : 'optimistic'}_cash`)}`} name="貯蓄(現金)" stackId="a" fill="#3b82f6" />
                    <Bar dataKey={`${getKey(`${breakdownScenario === 'p10' ? 'pessimistic' : breakdownScenario === 'p50' ? 'central' : 'optimistic'}_invest`)}`} name="運用資産" stackId="a" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Summary Table */}
            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart2 size={20}/> 運用成績サマリー</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm text-left text-slate-600 border-collapse">
                        <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-4 py-3 border border-slate-200">指標</th>
                                <th className="px-4 py-3 border border-slate-200 text-blue-700">悲観シナリオ (下位10%)</th>
                                <th className="px-4 py-3 border border-slate-200 text-indigo-700">中央シナリオ (中央値)</th>
                                <th className="px-4 py-3 border border-slate-200 text-green-700">楽観シナリオ (上位10%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="hover:bg-slate-50">
                                <td className="px-4 py-2 border border-slate-200 font-medium bg-slate-50/50">時間加重収益率 (年率)</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.pessimistic.twr)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right font-bold">{formatPercent(summaryMetrics.central.twr)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.optimistic.twr)}</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                                <td className="px-4 py-2 border border-slate-200 font-medium bg-slate-50/50">資産最終残高 ({lifeExpectancy}歳)</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatCurrency(summaryMetrics.pessimistic.final / 10000)}億円</td>
                                <td className="px-4 py-2 border border-slate-200 text-right font-bold">{formatCurrency(summaryMetrics.central.final / 10000)}億円</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatCurrency(summaryMetrics.optimistic.final / 10000)}億円</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                                <td className="px-4 py-2 border border-slate-200 font-medium bg-slate-50/50">年間平均収益率</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.pessimistic.amr)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right font-bold">{formatPercent(summaryMetrics.central.amr)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.optimistic.amr)}</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                                <td className="px-4 py-2 border border-slate-200 font-medium bg-slate-50/50">年率ボラティリティ</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.pessimistic.vol)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right font-bold">{formatPercent(summaryMetrics.central.vol)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.optimistic.vol)}</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                                <td className="px-4 py-2 border border-slate-200 font-medium bg-slate-50/50">シャープレシオ</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{summaryMetrics.pessimistic.sharpe?.toFixed(2) || '-'}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right font-bold">{summaryMetrics.central.sharpe?.toFixed(2) || '-'}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{summaryMetrics.optimistic.sharpe?.toFixed(2) || '-'}</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                                <td className="px-4 py-2 border border-slate-200 font-medium bg-slate-50/50">最大ドローダウン</td>
                                <td className="px-4 py-2 border border-slate-200 text-right text-red-500 font-bold">{formatPercent(summaryMetrics.pessimistic.mdd)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.central.mdd)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.optimistic.mdd)}</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                                <td className="px-4 py-2 border border-slate-200 font-medium bg-slate-50/50" title="シミュレーション終了時に資産が0となる定率取り崩し率（各シナリオのリターン推移から逆算）">最大許容取り崩し率 (資産枯渇)</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.pessimistic.maxWithdrawalRate)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right font-bold">{formatPercent(summaryMetrics.central.maxWithdrawalRate)}</td>
                                <td className="px-4 py-2 border border-slate-200 text-right">{formatPercent(summaryMetrics.optimistic.maxWithdrawalRate)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* AI & Table */}
             <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-xl border border-indigo-100 flex justify-between items-center">
                <div className="text-xs font-bold text-indigo-800 flex items-center gap-1"><Bot size={16}/> AIコーチ</div>
                <button onClick={generateAiAdvice} disabled={isAiLoading} className="bg-white border px-3 py-1 rounded text-xs hover:bg-indigo-50">
                    {isAiLoading ? '分析中...' : '診断する'}
                </button>
             </div>
             {aiAdvice && <div className="bg-white p-3 rounded border text-xs leading-relaxed whitespace-pre-wrap">{aiAdvice}</div>}

             <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-50 border-b flex justify-between items-center cursor-pointer" onClick={() => setShowTable(!showTable)}>
                    <span className="font-bold text-sm flex items-center gap-2"><TableIcon size={14}/> 詳細データ</span>
                    <div className="flex gap-2 items-center">
                        <button onClick={(e) => { e.stopPropagation(); setIsTableMaximized(true); }} className="p-1 hover:bg-slate-200 rounded text-slate-500" title="拡大表示">
                            <Maximize2 size={16}/>
                        </button>
                        {showTable ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </div>
                </div>
                {showTable && (
                    <div className="overflow-x-auto max-h-64">
                         <div className="flex gap-2 p-2 bg-slate-50">
                            {['pessimistic','central','optimistic'].map(s => (
                                <button key={s} onClick={()=>setActiveScenarioTab(s)} className={`px-3 py-1 rounded text-xs ${activeScenarioTab===s ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>
                                    {s==='pessimistic'?'悲観':s==='central'?'中央':'楽観'}
                                </button>
                            ))}
                        </div>
                        <table className="w-full text-xs text-right border-collapse">
                            <thead className="bg-slate-100 sticky top-0 z-10">
                                <tr>
                                    <th className="p-2 text-left">年齢</th>
                                    <th className="p-2">イベント</th>
                                    <th className="p-2 text-green-600">世帯収入<br/><span className="text-[9px] text-slate-400">退職金込</span></th>
                                    <th className="p-2 text-red-500" title="基本生活費+住居費+教育費+イベント支出">世帯支出<span className="text-[9px] text-slate-400">ℹ️</span></th>
                                    <th className="p-2 border-r">収支<br/><span className="text-[9px] text-slate-400">運用益除</span></th>
                                    <th className="p-2 bg-blue-50">現金</th>
                                    <th className="p-2 bg-yellow-50">運用</th>
                                    <th className="p-2 font-bold">総額</th>
                                    <th className="p-2 text-slate-400">リターン</th>
                                    <th className="p-2 text-orange-400 border">取崩</th>
                                </tr>
                            </thead>
                            <tbody>
                                {simulationData.map(row => (
                                    <tr key={row.age} className="border-b hover:bg-slate-50 group">
                                        <td className="p-2 text-left font-bold">{row.age}</td>
                                        <td className="p-2 text-left truncate max-w-[100px] text-slate-500" title={row.event}>{row.event}</td>
                                        <td className="p-2 text-green-600">{row.income.toLocaleString()}</td>
                                        <td className="p-2 text-red-500 relative cursor-help" title={`内訳:\n基本生活費: ${row.baseLivingCost.toLocaleString()}\n住居費: ${row.housingCost.toLocaleString()}\n教育費: ${row.educationCost.toLocaleString()}\nイベント: ${row.eventExpense.toLocaleString()}`}>
                                            {row.expense.toLocaleString()}
                                        </td>
                                        <td className={`p-2 border-r ${row.annualBalance<0?'text-red-500':''}`}>{row.annualBalance.toLocaleString()}</td>
                                        <td className="p-2 bg-blue-50/20">{row[getKey(`${activeScenarioTab}_cash`)].toLocaleString()}</td>
                                        <td className="p-2 bg-yellow-50/20">{row[getKey(`${activeScenarioTab}_invest`)].toLocaleString()}</td>
                                        <td className="p-2 font-bold">{row[getKey(`${activeScenarioTab}_total`)].toLocaleString()}</td>
                                        <td className="p-2 text-slate-400">{row[getKey(`${activeScenarioTab}_return`)]}%</td>
                                        <td className="p-2 text-orange-400">{row[getKey(`${activeScenarioTab}_withdrawal`)].toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// UI Components
const InputGroup = ({ label, value, onChange, unit, step=1, icon }) => (
  <div className="flex items-center justify-between">
    <label className="text-[10px] text-slate-500 flex items-center gap-1">{icon}{label}</label>
    <div className="flex items-center w-24">
        <input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full p-1 text-xs border rounded text-right" />
        <span className="text-[10px] text-slate-400 ml-1 w-4">{unit}</span>
    </div>
  </div>
);