import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "src", "data", "cheonjamun-review-dex-v1.json");
const runtimePath = path.join(root, "src", "data", "cheonjamun-runtime-jaryeongs.json");
const outputPath = path.join(root, "src", "data", "cheonjamun-jaryeong-dex-v1.json");
const huneumOverridesPath = path.join(root, "src", "data", "korean-huneum-overrides.json");

const ELEMENT_PROFILES = {
  木: {
    name: "나무",
    resonance: "생장과 순환",
    defaultNiche: { category: "수림 자령", habitat: "오래된 숲과 이끼 낀 바위틈" },
    temperaments: ["온순하고 끈기 있음", "호기심이 많고 신중함", "느긋하지만 고집이 셈", "다정하고 무리를 돌봄", "조용히 영역을 넓힘"],
    behaviors: [
      "주변의 작은 생기를 살피며 천천히 자리를 넓힌다",
      "바람과 햇빛의 변화를 먼저 느끼고 몸의 결을 바꾼다",
      "낯선 기척이 다가오면 뿌리처럼 자세를 낮추고 오래 관찰한다",
      "약한 자령 곁에 머물며 생기가 흩어지지 않도록 돕는다",
      "계절이 바뀔 때마다 몸의 잎과 무늬가 조금씩 달라진다"
    ],
    traits: [
      ["새순 감응", "주변 생명의 움직임을 느끼면 몸의 빛이 잎맥처럼 번진다."],
      ["나이테 기억", "오래 머문 장소의 냄새와 소리를 몸의 결에 차곡차곡 남긴다."],
      ["뿌리걸음", "서두르지 않지만 한번 정한 길에서는 쉽게 밀려나지 않는다."],
      ["숲의 돌봄", "가까운 자령의 기운이 약해지면 곁을 지키며 생기를 나눈다."],
      ["계절 숨결", "햇빛과 습도에 따라 색과 자세가 부드럽게 변한다."]
    ]
  },
  火: {
    name: "불",
    resonance: "열기와 변화",
    defaultNiche: { category: "화광 자령", habitat: "불씨가 남은 제단과 따뜻한 바위지대" },
    temperaments: ["활달하고 감정이 선명함", "용감하고 성급함", "명랑하고 호기심이 많음", "자존심이 강하고 화끈함", "집중하면 말수가 줄어듦"],
    behaviors: [
      "기분이 달아오를수록 몸의 빛과 온기가 선명해진다",
      "어둠 속에서 작은 불씨를 따라 빠르게 움직인다",
      "기쁜 일이 생기면 주위를 빙글 돌며 잔불을 흩뿌린다",
      "자신의 영역을 침범한 기척에는 몸을 크게 밝히며 경고한다",
      "평소에는 온기를 아끼지만 뜻을 정하면 한순간에 타오른다"
    ],
    traits: [
      ["불씨 맥동", "감정의 높낮이에 맞춰 몸속 불빛이 심장처럼 뛰기 시작한다."],
      ["잔광 추적", "어둠 속에 남은 아주 작은 빛도 놓치지 않고 따라간다."],
      ["화롯가 기질", "안심한 장소에서는 은은한 열을 내어 주변을 따뜻하게 만든다."],
      ["홍염 경계", "위험을 느끼면 몸의 가장자리부터 붉은 빛이 빠르게 번진다."],
      ["집중 연소", "움직임을 멈춘 채 한곳에 열기를 모으는 습성이 있다."]
    ]
  },
  土: {
    name: "흙",
    resonance: "안정과 축적",
    defaultNiche: { category: "지맥 자령", habitat: "산기슭과 지맥이 모이는 깊은 굴" },
    temperaments: ["묵직하고 참을성이 많음", "신중하고 영역 의식이 강함", "온화하지만 쉽게 움직이지 않음", "성실하고 반복을 좋아함", "말수가 적고 믿음직함"],
    behaviors: [
      "발밑의 울림을 읽으며 가장 안정된 자리를 찾아 머문다",
      "낯선 진동이 생기면 몸을 낮추고 땅의 변화를 살핀다",
      "작은 돌과 흙을 모아 자신만의 쉼터를 단단히 다진다",
      "매일 같은 길을 오가며 지형의 변화를 꼼꼼하게 기억한다",
      "급한 움직임보다 한 번의 확실한 행동을 고르는 편이다"
    ],
    traits: [
      ["지맥 청취", "발끝으로 전해지는 미세한 떨림을 통해 먼 움직임을 알아챈다."],
      ["층리 기억", "지나온 장소의 모양을 몸의 층과 무늬로 기록한다."],
      ["돌집 습성", "편안한 곳을 찾으면 주변 재료를 모아 작은 거처를 만든다."],
      ["완만한 걸음", "느리게 움직이는 대신 방향을 정하면 좀처럼 흔들리지 않는다."],
      ["묵토 호흡", "쉬는 동안 주변의 먼지와 흙이 차분하게 가라앉는다."]
    ]
  },
  金: {
    name: "쇠",
    resonance: "결단과 정밀함",
    defaultNiche: { category: "금석 자령", habitat: "오래된 병기고와 빛나는 광맥 주변" },
    temperaments: ["정확하고 경계심이 강함", "냉정하고 질서를 중시함", "예민하지만 약속을 지킴", "단호하고 군더더기가 없음", "관찰이 빠르고 깔끔함"],
    behaviors: [
      "빛과 소리의 작은 차이를 재어 가장 정확한 움직임을 고른다",
      "주변 물건이 흐트러지면 일정한 간격으로 다시 맞춰 놓는다",
      "낯선 기척을 만나면 표면을 세워 거리를 유지한 채 살핀다",
      "한 번 정한 순서를 끝까지 지키며 불필요한 움직임을 줄인다",
      "반짝이는 물체보다 균형이 잘 맞는 형태에 더 오래 시선을 둔다"
    ],
    traits: [
      ["공명 측정", "주변의 소리와 진동을 되비추어 거리와 모양을 가늠한다."],
      ["정렬 본능", "흐트러진 사물을 발견하면 반듯한 간격으로 맞추려 한다."],
      ["날빛 경계", "위험을 감지하면 표면에 가느다란 빛줄기가 빠르게 선다."],
      ["무결 동작", "필요한 만큼만 움직이며 같은 행동을 거의 오차 없이 반복한다."],
      ["금속 기억", "한 번 들은 울림을 오래 기억해 같은 재질을 구분한다."]
    ]
  },
  水: {
    name: "물",
    resonance: "흐름과 적응",
    defaultNiche: { category: "수계 자령", habitat: "물안개가 머무는 강과 깊은 못" },
    temperaments: ["차분하고 관찰력이 깊음", "유연하고 낯가림이 있음", "장난스럽지만 금세 조용해짐", "신비롭고 혼자 있기를 좋아함", "부드럽지만 속을 알기 어려움"],
    behaviors: [
      "주변의 흐름이 바뀌면 몸의 자세와 무늬를 천천히 맞춘다",
      "낯선 소리가 들리면 물결이 잦아들 듯 움직임을 멈춘다",
      "안개와 그늘 사이를 오가며 흔적을 거의 남기지 않는다",
      "고요한 곳을 좋아하지만 호기심이 생기면 먼 길도 따라간다",
      "막힌 길을 만나면 서두르지 않고 가장 부드러운 틈을 찾는다"
    ],
    traits: [
      ["잔물결 감응", "주변 흐름이 달라지면 몸의 무늬도 물결처럼 천천히 움직인다."],
      ["안개 숨기", "기척을 낮추면 윤곽이 흐려져 물안개와 쉽게 어우러진다."],
      ["유수 기억", "지나간 길의 방향과 냄새를 물길처럼 이어서 기억한다."],
      ["심연 응시", "오랫동안 움직이지 않고 한곳을 바라보며 변화를 기다린다."],
      ["틈새 흐름", "좁고 복잡한 장소에서도 몸을 유연하게 굽혀 빠져나간다."]
    ]
  }
};

const NICHE_RULES = [
  { pattern: /심해|바다|강물|물결|물방울|호수|연못|온천|해파리|수달|파도|얼음|지느러미/u, category: "심수 자령", habitat: "물안개가 내려앉은 강가와 빛이 적은 깊은 물" },
  { pattern: /나무|숲|잎|뿌리|꽃|열매|씨앗|가지|풀|채소|대나무|덩굴/u, category: "수림 자령", habitat: "햇빛이 잘게 부서지는 숲과 오래된 나무 곁" },
  { pattern: /구름|날개|바람|태양|별빛|달빛|새벽|하늘/u, category: "천공 자령", habitat: "바람이 크게 도는 능선과 높은 옛 지붕" },
  { pattern: /불꽃|화염|화로|촛불|용암|열기|달군|불씨/u, category: "화광 자령", habitat: "불씨가 오래 남는 제단과 따뜻한 암반지대" },
  { pattern: /도끼|칼날|갑옷|방패|거울|톱니|금속|쇠|기계|바늘|종소리/u, category: "금석 자령", habitat: "오래된 병기고와 금속성 울림이 퍼지는 광맥" },
  { pattern: /돌|바위|흙|산등성이|점토|벽돌|석판|기둥|토기|모래|무덤|봉분/u, category: "지맥 자령", habitat: "산기슭의 굴과 지맥이 드러난 돌무더기" }
];

const OBSERVATION_ENDINGS = [
  "낯선 존재에게는 거리를 두지만 익숙해지면 먼저 곁을 내준다.",
  "주변을 오래 살핀 뒤 안전하다고 판단해야 천천히 다가온다.",
  "같은 기운을 지닌 자령과 마주치면 몸의 무늬로 짧게 신호를 보낸다.",
  "글자의 뜻을 떠올리게 하는 사물 근처에서 가장 편안한 모습을 보인다.",
  "해가 바뀌는 시간에 움직임이 활발해지고 주변 기운을 세심하게 살핀다."
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const huneumOverrides = readJson(huneumOverridesPath);

function canonicalHuneum(char, fallback) {
  return huneumOverrides[char] ?? fallback;
}

function meaningFromHuneum(huneum) {
  return huneum.trim().split(/\s+/u).slice(0, -1).join(" ");
}

function appearanceSentence(raw) {
  const parts = String(raw).trim().replace(/[.。!?]+$/u, "").split(/\s*[·,，]\s*/u).filter(Boolean);
  if (parts.length === 1) return `${parts[0]}이다.`;
  return `${parts[0]}이다. 두드러진 특징은 ${parts.slice(1).join("과 ")}이다.`;
}

function nicheFor(entry, profile) {
  return NICHE_RULES.find((rule) => rule.pattern.test(entry.semanticDesign)) ?? profile.defaultNiche;
}

const source = readJson(inputPath);
const runtime = readJson(runtimePath);
if (source.schema !== "cheonjamun-review-dex-v1" || source.entries?.length !== 360) {
  throw new Error("Expected the 360-entry Cheonjamun art source.");
}
if (runtime.schema !== "cheonjamun-runtime-jaryeongs-v1" || runtime.entries?.length !== 1000) {
  throw new Error("Expected the complete 1,000-entry Cheonjamun runtime source.");
}

const runtimeById = new Map(runtime.entries.map((entry) => [entry.id, entry]));
const reviewedEntries = new Map(source.entries.map((entry) => {
  const profile = ELEMENT_PROFILES[entry.wuxing];
  if (!profile) throw new Error(`Unsupported element for ${entry.id}: ${entry.wuxing}`);
  const runtimeEntry = runtimeById.get(entry.id);
  if (!runtimeEntry) throw new Error(`Missing runtime image mapping for ${entry.id}.`);
  const index = (entry.sequence - 1) % profile.behaviors.length;
  const niche = nicheFor(entry, profile);
  const appearance = appearanceSentence(entry.semanticDesign);
  const [traitName, traitDescription] = profile.traits[index];
  const huneum = canonicalHuneum(entry.hanja, entry.huneum);
  const meaning = huneumOverrides[entry.hanja] ? meaningFromHuneum(huneum) : entry.meaningKo;

  return [entry.id, {
    id: entry.id,
    number: entry.sequence,
    hanja: entry.hanja,
    huneum,
    meaning,
    wuxing: entry.wuxing,
    elementName: profile.name,
    category: niche.category,
    imagePath: runtimeEntry.assetPath,
    dexText: `${appearance} ${profile.behaviors[index]}. 글자 ${entry.hanja}에 깃든 뜻은 ${profile.resonance}의 기운으로 나타난다.`,
    habitat: niche.habitat,
    temperament: profile.temperaments[index],
    observation: OBSERVATION_ENDINGS[index],
    traitName,
    traitDescription,
    appearance
  }];
}));

const entries = runtime.entries
  .map((entry) => {
    const reviewed = reviewedEntries.get(entry.id);
    if (reviewed) return reviewed;
    const profile = ELEMENT_PROFILES[entry.wuxing];
    if (!profile) throw new Error(`Unsupported element for ${entry.id}: ${entry.wuxing}`);
    const index = (entry.sequence - 1) % profile.behaviors.length;
    const huneum = canonicalHuneum(entry.hanja, entry.huneum);
    const meaning = huneumOverrides[entry.hanja]
      ? meaningFromHuneum(huneum)
      : String(entry.meaning || huneum || entry.hanja).trim();
    const niche = nicheFor({ semanticDesign: `${meaning} ${huneum}` }, profile);
    const appearance = `글자 ${entry.hanja}의 뜻인 ${meaning}의 기운이 ${profile.resonance}의 형상으로 응결된 자령이다.`;
    const [traitName, traitDescription] = profile.traits[index];
    return {
      id: entry.id,
      number: entry.sequence,
      hanja: entry.hanja,
      huneum,
      meaning,
      wuxing: entry.wuxing,
      elementName: profile.name,
      category: niche.category,
      imagePath: entry.assetPath,
      dexText: `${appearance} ${profile.behaviors[index]}. 가까이에서 관찰하면 글자의 본뜻이 몸짓과 빛의 결로 드러난다.`,
      habitat: niche.habitat,
      temperament: profile.temperaments[index],
      observation: OBSERVATION_ENDINGS[index],
      traitName,
      traitDescription,
      appearance
    };
  })
  .sort((left, right) => left.number - right.number);

if (
  entries.length !== 1000
  || new Set(entries.map((entry) => entry.id)).size !== 1000
  || new Set(entries.map((entry) => entry.hanja)).size !== 1000
) {
  throw new Error("Player-facing Cheonjamun Jaryeong dex must contain 1,000 unique entries.");
}

const data = {
  schema: "cheonjamun-jaryeong-dex-v1",
  edition: "천자문 자령 도감",
  total: entries.length,
  elementCounts: Object.fromEntries(Object.keys(ELEMENT_PROFILES).map((wuxing) => [wuxing, entries.filter((entry) => entry.wuxing === wuxing).length])),
  entries
};

const serialized = JSON.stringify(data);
for (const forbidden of ["pending", "QC", "검토", "승인", "재생성", "원본 유지", "production", "integrated"]) {
  if (serialized.includes(forbidden)) throw new Error(`Player-facing dex contains a production term: ${forbidden}`);
}

fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ schema: data.schema, entries: data.total, elementCounts: data.elementCounts, output: path.relative(root, outputPath).replaceAll("\\", "/"), imagePolicy: "shared-runtime-quality-v2" }, null, 2)}\n`);
