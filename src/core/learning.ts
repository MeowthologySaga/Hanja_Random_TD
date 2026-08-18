import learningData from "../data/learning-readings.json";
import type { RegionCode } from "./types";

interface LearningEntry {
  h?: string;
  kh?: string;
  jo?: string;
  jk?: string;
  m?: string;
  d?: string;
}

interface LearningData {
  version: string;
  source: string;
  catalogCharacters: number;
  coveredCharacters: number;
  koreanHuneumCharacters: number;
  chars: Record<string, LearningEntry>;
}

export interface LearningInfo {
  short: string;
  readingLabel: string;
  reading: string;
  meaning: string;
  meaningSource: "ko" | "en" | "none";
}

const data = learningData as LearningData;

const KOREAN_GLOSSES: Record<string, string> = {
  一: "한 일", 也: "어조사 야", 中: "가운데 중", 以: "써 이", 人: "사람 인", 信: "믿을 신", 傳: "전할 전", 伝: "전할 전", 传: "전할 전",
  刀: "칼 도", 力: "힘 력", 十: "열 십", 口: "입 구", 女: "계집 녀", 子: "아들 자", 專: "오로지 전", 专: "오로지 전", 山: "메 산",
  川: "내 천", 心: "마음 심", 慎: "삼갈 신", 慼: "근심할 척", 故: "옛 고", 文: "글월 문", 新: "새 신", 日: "날 일", 既: "이미 기", 昃: "기울 측", 晚: "늦을 만", 景: "볕 경", 有: "있을 유", 木: "나무 목",
  林: "수풀 림", 森: "빽빽할 삼", 水: "물 수", 溫: "따뜻할 온", 温: "따뜻할 온", 無: "없을 무", 无: "없을 무", 王: "임금 왕",
  田: "밭 전", 發: "필 발", 発: "필 발", 发: "필 발", 百: "일백 백", 相: "서로 상", 目: "눈 목", 矢: "화살 시", 知: "알 지",
  亯: "누릴 향", 夌: "능가할 릉", 咊: "화할 화", 啟: "열 계", 嵇: "산 이름 혜", 并: "아우를 병", 妍: "고울 연", 气: "기운 기", 稾: "볏짚 고", 立: "설 립", 羣: "무리 군",
  者: "놈 자", 舉: "들 거", 虢: "나라 괵", 輶: "가벼울 유", 辧: "분별할 변", 讃: "기릴 찬", 颻: "나부낄 요", 顛: "엎드러질 전", 青: "푸를 청",
  喰: "먹을 식", 劭: "아름다울 소", 毀: "헐 훼",
  親: "친할 친", 亲: "친할 친", 言: "말씀 언", 金: "쇠 금", 門: "문 문", 门: "문 문", 雨: "비 우",
  霜: "서리 상", 鳥: "새 조", 羽: "깃 우", 白: "흰 백", 京: "서울 경", 土: "흙 토", 斤: "도끼 근", 劉: "성씨 류", 刘: "성씨 류",
  瀏: "맑을 류", 浏: "맑을 류"
};

function compact(values: string | undefined, limit = 3): string {
  if (!values) return "";
  return values.split(/\s+/u).filter(Boolean).slice(0, limit).join("·");
}

function firstKoreanReading(char: string, entry: LearningEntry | undefined): string {
  const curated = KOREAN_GLOSSES[char] ?? entry?.kh;
  if (curated) return curated;
  const reading = compact(entry?.h, 2);
  return reading ? `음 ${reading}` : "읽기 미수록";
}

export function learningInfo(region: RegionCode, char: string): LearningInfo {
  const entry = data.chars[char];
  const curated = KOREAN_GLOSSES[char] ?? entry?.kh;
  const koreanMeaning = curated?.split(" ").slice(0, -1).join(" ") ?? "";
  if (region === "KR") {
    const reading = firstKoreanReading(char, entry);
    return {
      short: reading,
      readingLabel: "훈음",
      reading,
      meaning: koreanMeaning || entry?.d || "뜻 정보 미수록",
      meaningSource: koreanMeaning ? "ko" : entry?.d ? "en" : "none"
    };
  }
  if (region === "JP") {
    const on = compact(entry?.jo, 3);
    const kun = compact(entry?.jk, 3);
    const reading = [on ? `음독 ${on}` : "", kun ? `훈독 ${kun}` : ""].filter(Boolean).join(" · ") || "읽기 미수록";
    return {
      short: on || kun || "읽기 미수록",
      readingLabel: "음독·훈독",
      reading,
      meaning: koreanMeaning || entry?.d || "뜻 정보 미수록",
      meaningSource: koreanMeaning ? "ko" : entry?.d ? "en" : "none"
    };
  }
  const mandarin = compact(entry?.m, 2);
  return {
    short: mandarin || "병음 미수록",
    readingLabel: "병음",
    reading: mandarin || "병음 미수록",
    meaning: koreanMeaning || entry?.d || "뜻 정보 미수록",
    meaningSource: koreanMeaning ? "ko" : entry?.d ? "en" : "none"
  };
}

export const LEARNING_DATA_META = {
  version: data.version,
  source: data.source,
  catalogCharacters: data.catalogCharacters,
  coveredCharacters: data.coveredCharacters,
  koreanHuneumCharacters: data.koreanHuneumCharacters
} as const;
