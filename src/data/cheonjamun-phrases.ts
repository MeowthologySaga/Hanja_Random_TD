export interface CheonjamunPhrase {
  chars: string;
  reading: string;
  meaning: string;
}

// 천자문 원문의 첫 100개 사언 성구. 원문 순서를 그대로 보존한다.
const CHEONJAMUN_PHRASE_MEANINGS: ReadonlyArray<Omit<CheonjamunPhrase, "reading">> = [
  { chars: "天地玄黃", meaning: "하늘은 검고 땅은 누르다" },
  { chars: "宇宙洪荒", meaning: "우주는 넓고 아득하다" },
  { chars: "日月盈昃", meaning: "해와 달은 차고 기운다" },
  { chars: "辰宿列張", meaning: "별자리가 하늘에 펼쳐져 있다" },
  { chars: "寒來暑往", meaning: "추위가 오면 더위가 물러간다" },
  { chars: "秋收冬藏", meaning: "가을에 거두고 겨울에 저장한다" },
  { chars: "閏餘成歲", meaning: "남는 날을 윤달로 삼아 한 해를 이룬다" },
  { chars: "律呂調陽", meaning: "음률로 음양의 기운을 고르게 한다" },
  { chars: "雲騰致雨", meaning: "구름이 오르면 비가 내린다" },
  { chars: "露結爲霜", meaning: "이슬이 맺혀 서리가 된다" },
  { chars: "金生麗水", meaning: "금은 여수에서 난다" },
  { chars: "玉出崑岡", meaning: "옥은 곤륜산에서 난다" },
  { chars: "劍號巨闕", meaning: "이름난 칼을 거궐이라 한다" },
  { chars: "珠稱夜光", meaning: "귀한 구슬을 야광주라 부른다" },
  { chars: "果珍李柰", meaning: "과일 중에는 오얏과 능금이 귀하다" },
  { chars: "菜重芥薑", meaning: "채소 중에는 겨자와 생강을 중히 여긴다" },
  { chars: "海鹹河淡", meaning: "바닷물은 짜고 강물은 맑고 싱겁다" },
  { chars: "鱗潛羽翔", meaning: "물고기는 잠기고 새는 날아오른다" },
  { chars: "龍師火帝", meaning: "복희는 용으로, 신농은 불로 벼슬을 정했다" },
  { chars: "鳥官人皇", meaning: "소호는 새로 벼슬을 정한 옛 임금이다" },
  { chars: "始制文字", meaning: "처음으로 문자를 만들었다" },
  { chars: "乃服衣裳", meaning: "이에 윗옷과 아랫옷을 갖추어 입었다" },
  { chars: "推位讓國", meaning: "임금 자리를 미루어 나라를 양보했다" },
  { chars: "有虞陶唐", meaning: "순임금 유우와 요임금 도당을 이른다" },
  { chars: "弔民伐罪", meaning: "백성을 위로하고 죄 있는 자를 벌했다" },
  { chars: "周發殷湯", meaning: "주 무왕과 은 탕왕을 이른다" },
  { chars: "坐朝問道", meaning: "조정에 앉아 다스릴 도리를 물었다" },
  { chars: "垂拱平章", meaning: "옷깃을 드리우고 팔짱 낀 채도 잘 다스렸다" },
  { chars: "愛育黎首", meaning: "백성을 사랑하고 길렀다" },
  { chars: "臣伏戎羌", meaning: "오랑캐들도 신하로 복종했다" },
  { chars: "遐邇壹體", meaning: "먼 곳과 가까운 곳이 한몸이 되었다" },
  { chars: "率賓歸王", meaning: "온 천하가 왕에게 귀의했다" },
  { chars: "鳴鳳在樹", meaning: "봉황이 나무 위에서 울었다" },
  { chars: "白駒食場", meaning: "흰 망아지가 들판에서 풀을 먹는다" },
  { chars: "化被草木", meaning: "교화가 풀과 나무에까지 미쳤다" },
  { chars: "賴及萬方", meaning: "그 은혜가 온 세상에 이르렀다" },
  { chars: "蓋此身髮", meaning: "이 몸과 머리카락을 소중히 여긴다" },
  { chars: "四大五常", meaning: "사대와 오상의 도리를 말한다" },
  { chars: "恭惟鞠養", meaning: "부모가 길러 준 은혜를 공손히 생각한다" },
  { chars: "豈敢毀傷", meaning: "어찌 감히 몸을 훼손하겠는가" },
  { chars: "女慕貞絜", meaning: "여자는 곧고 깨끗한 행실을 본받는다" },
  { chars: "男效才良", meaning: "남자는 재주와 어진 행실을 본받는다" },
  { chars: "知過必改", meaning: "허물을 알면 반드시 고친다" },
  { chars: "得能莫忘", meaning: "배운 능력을 얻으면 잊지 않는다" },
  { chars: "罔談彼短", meaning: "남의 단점을 함부로 말하지 않는다" },
  { chars: "靡恃己長", meaning: "자기 장점을 믿고 뽐내지 않는다" },
  { chars: "信使可覆", meaning: "믿음은 되풀이해도 어긋남이 없어야 한다" },
  { chars: "器欲難量", meaning: "사람의 그릇은 헤아리기 어려울 만큼 커야 한다" },
  { chars: "墨悲絲染", meaning: "묵자는 흰 실이 물드는 것을 슬퍼했다" },
  { chars: "詩讃羔羊", meaning: "시경은 고결한 관리의 덕을 기렸다" },
  { chars: "景行維賢", meaning: "크고 바른 행실을 지닌 현인을 우러른다" },
  { chars: "克念作聖", meaning: "바른 생각을 지키면 성인이 될 수 있다" },
  { chars: "德建名立", meaning: "덕을 세우면 이름도 바로 선다" },
  { chars: "形端表正", meaning: "몸가짐이 단정하면 겉모습도 바르다" },
  { chars: "空谷傳聲", meaning: "빈 골짜기에는 소리가 멀리 전해진다" },
  { chars: "虛堂習聽", meaning: "빈집에서는 작은 소리도 거듭 들린다" },
  { chars: "禍因惡積", meaning: "재앙은 악행이 쌓여 생긴다" },
  { chars: "福緣善慶", meaning: "복은 선행이 쌓인 경사에서 온다" },
  { chars: "尺璧非寶", meaning: "한 자 되는 옥도 참된 보배는 아니다" },
  { chars: "寸陰是競", meaning: "짧은 시간이라도 아껴 힘써야 한다" },
  { chars: "資父事君", meaning: "부모를 섬기던 마음으로 임금을 섬긴다" },
  { chars: "曰嚴與敬", meaning: "엄숙함과 공경함으로 섬긴다" },
  { chars: "孝當竭力", meaning: "효도에는 마땅히 힘을 다한다" },
  { chars: "忠則盡命", meaning: "충성에는 목숨을 다한다" },
  { chars: "臨深履薄", meaning: "깊은 못가와 얇은 얼음을 걷듯 조심한다" },
  { chars: "夙興溫凊", meaning: "일찍 일어나 부모의 춥고 더움을 살핀다" },
  { chars: "似蘭斯馨", meaning: "효행의 향기는 난초와 같다" },
  { chars: "如松之盛", meaning: "절개는 무성한 소나무와 같다" },
  { chars: "川流不息", meaning: "냇물이 쉬지 않고 흐른다" },
  { chars: "淵澄取映", meaning: "못이 맑으면 사물을 비춘다" },
  { chars: "容止若思", meaning: "몸가짐은 깊이 생각하는 듯해야 한다" },
  { chars: "言辭安定", meaning: "말은 편안하고 침착해야 한다" },
  { chars: "篤初誠美", meaning: "처음에 정성을 다하면 아름답다" },
  { chars: "慎終宜令", meaning: "끝까지 삼가면 좋은 평판을 얻는다" },
  { chars: "榮業所基", meaning: "영예로운 일은 성실함에서 비롯된다" },
  { chars: "籍甚無竟", meaning: "좋은 명성이 오래도록 끝이 없다" },
  { chars: "學優登仕", meaning: "학문이 뛰어나면 벼슬에 오른다" },
  { chars: "攝職從政", meaning: "직책을 맡아 정사를 돌본다" },
  { chars: "存以甘棠", meaning: "선정을 베푼 이를 감당나무처럼 기억한다" },
  { chars: "去而益詠", meaning: "떠난 뒤에도 그 덕을 더욱 노래한다" },
  { chars: "樂殊貴賤", meaning: "음악은 신분에 따라 쓰임이 달랐다" },
  { chars: "禮別尊卑", meaning: "예절은 높고 낮음을 구별한다" },
  { chars: "上咊下睦", meaning: "윗사람은 온화하고 아랫사람은 화목하다" },
  { chars: "夫唱婦隨", meaning: "남편이 이끌고 아내가 따른다" },
  { chars: "外受傅訓", meaning: "밖에서는 스승의 가르침을 받는다" },
  { chars: "入奉母儀", meaning: "집에서는 어머니의 법도를 받든다" },
  { chars: "諸姑伯叔", meaning: "고모와 큰아버지와 작은아버지를 공경한다" },
  { chars: "猶子比兒", meaning: "조카도 자기 자식처럼 사랑한다" },
  { chars: "孔懷兄弟", meaning: "형제 사이를 매우 깊이 생각한다" },
  { chars: "同气連枝", meaning: "형제는 같은 기운에서 난 이어진 가지다" },
  { chars: "交友投分", meaning: "벗을 사귈 때 뜻과 정을 나눈다" },
  { chars: "切磨箴規", meaning: "서로 갈고닦으며 잘못을 타이른다" },
  { chars: "仁慈隱惻", meaning: "어질고 자애롭게 남을 가엾게 여긴다" },
  { chars: "造次弗離", meaning: "다급한 순간에도 어짊을 떠나지 않는다" },
  { chars: "節義廉退", meaning: "절개와 의리를 지키고 청렴하게 물러난다" },
  { chars: "顛沛匪虧", meaning: "어려운 형편에도 바른 도리를 잃지 않는다" },
  { chars: "性靜情逸", meaning: "성품이 고요하면 마음도 편안하다" },
  { chars: "心動神疲", meaning: "마음이 흔들리면 정신도 피로해진다" },
  { chars: "守眞志滿", meaning: "참됨을 지키면 뜻이 충만해진다" },
  { chars: "逐物意移", meaning: "외물을 좇으면 뜻이 흔들린다" }
];

// 한국 한문 입문에서 통용되는 천자문 구 독음. 두음법칙과 문맥 독음을 반영한다.
const CHEONJAMUN_READINGS = `
천지현황 우주홍황 일월영측 진수열장 한래서왕 추수동장 윤여성세 율려조양 운등치우 노결위상
금생여수 옥출곤강 검호거궐 주칭야광 과진이내 채중개강 해함하담 인잠우상 용사화제 조관인황
시제문자 내복의상 추위양국 유우도당 조민벌죄 주발은탕 좌조문도 수공평장 애육여수 신복융강
하이일체 솔빈귀왕 명봉재수 백구식장 화피초목 뇌급만방 개차신발 사대오상 공유국양 기감훼상
여모정결 남효재량 지과필개 득능막망 망담피단 미시기장 신사가복 기욕난량 묵비사염 시찬고양
경행유현 극념작성 덕건명립 형단표정 공곡전성 허당습청 화인악적 복연선경 척벽비보 촌음시경
자부사군 왈엄여경 효당갈력 충즉진명 임심리박 숙흥온정 사란사형 여송지성 천류불식 연징취영
용지약사 언사안정 독초성미 신종의령 영업소기 적심무경 학우등사 섭직종정 존이감당 거이익영
악수귀천 예별존비 상화하목 부창부수 외수부훈 입봉모의 제고백숙 유자비아 공회형제 동기연지
교우투분 절마잠규 인자은측 조차불리 절의염퇴 전패비휴 성정정일 심동신피 수진지만 축물의이
`.trim().split(/\s+/u);

export const CHEONJAMUN_PHRASES: readonly CheonjamunPhrase[] = CHEONJAMUN_PHRASE_MEANINGS.map((phrase, index) => ({
  ...phrase,
  reading: CHEONJAMUN_READINGS[index] as string
}));
