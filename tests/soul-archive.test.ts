import { describe, expect, it } from "vitest";

import { CUSTOM_IDIOM_EQUIP_LIMIT } from "../src/core/custom-idioms";
import {
  EMPTY_SOUL_ARCHIVE,
  createCustomIdiom,
  discardCustomIdiom,
  equipCustomIdiom,
  equippedCustomIdioms,
  gainSoul,
  missingSouls,
  parseSoulArchive,
  rerollCustomIdiom,
  serializeSoulArchive,
  soulCost,
  soulsHeld,
  unequipCustomIdiom,
  writeCustomIdiomMeaning
} from "../src/core/soul-archive";

function archiveWith(chars: string, each = 1) {
  let archive = EMPTY_SOUL_ARCHIVE;
  for (const char of new Set([...chars])) archive = gainSoul(archive, char, each);
  return archive;
}

describe("자혼 보관소", () => {
  it("자혼을 얻고 센다", () => {
    let archive = gainSoul(EMPTY_SOUL_ARCHIVE, "天");
    archive = gainSoul(archive, "天", 2);
    expect(soulsHeld(archive, "天")).toBe(3);
    expect(soulsHeld(archive, "地")).toBe(0);
  });

  it("같은 글자를 두 번 쓰면 자혼도 두 개 든다", () => {
    const cost = soulCost("天天地玄");
    expect(cost.get("天")).toBe(2);
    expect(cost.get("地")).toBe(1);

    const archive = archiveWith("天地玄", 1);
    expect(missingSouls(archive, "天天地玄")).toEqual(["天"]);
    expect(missingSouls(archive, "天地玄天")).toEqual(["天"]);
  });

  it("새기면 자혼이 줄고 성어가 남는다", () => {
    const archive = archiveWith("天地玄黃");
    const result = createCustomIdiom(archive, { chars: "天地玄黃", meaning: "하늘과 땅", axisRoll: 0.1, valueRoll: 0.5 });

    expect(result.ok).toBe(true);
    expect(result.idiom?.meaning).toBe("하늘과 땅");
    expect(result.archive.idioms).toHaveLength(1);
    // 넷 다 하나씩 있었으니 새긴 뒤에는 남지 않는다.
    expect(Object.keys(result.archive.souls)).toHaveLength(0);
  });

  it("음은 한자 음 그대로다 — 사람이 쓴 뜻은 음을 건드리지 못한다", () => {
    const result = createCustomIdiom(archiveWith("天地玄黃"), {
      chars: "天地玄黃",
      meaning: "내 마음대로 지은 음",
      axisRoll: 0.3,
      valueRoll: 0.3
    });
    expect(result.idiom?.reading).toBe("천지현황");
  });

  it("자혼이 모자라면 새기지 못하고 보관소도 그대로다", () => {
    const archive = archiveWith("天地玄");
    const result = createCustomIdiom(archive, { chars: "天地玄黃", meaning: "", axisRoll: 0.2, valueRoll: 0.2 });

    expect(result.ok).toBe(false);
    expect(result.archive).toBe(archive);
    expect(result.message).toContain("黃");
  });

  it("네 글자가 아니면 거절한다", () => {
    const result = createCustomIdiom(archiveWith("天地玄"), { chars: "天地玄", meaning: "", axisRoll: 0, valueRoll: 0 });
    expect(result.ok).toBe(false);
  });

  it("재굴림은 음과 뜻을 남기고 능력만 바꾼다", () => {
    const made = createCustomIdiom(archiveWith("天地玄黃"), {
      chars: "天地玄黃",
      meaning: "하늘과 땅",
      axisRoll: 0.05,
      valueRoll: 0.1,
      id: "fixed"
    });
    const before = made.archive.idioms[0];
    const after = rerollCustomIdiom(made.archive, "fixed", 0.95, 0.95).idioms[0];

    expect(after.reading).toBe(before.reading);
    expect(after.meaning).toBe(before.meaning);
    expect(after.bonus).not.toEqual(before.bonus);
  });

  it("뜻만 고쳐 쓴다", () => {
    const made = createCustomIdiom(archiveWith("天地玄黃"), {
      chars: "天地玄黃",
      meaning: "처음 뜻",
      axisRoll: 0.4,
      valueRoll: 0.4,
      id: "fixed"
    });
    const after = writeCustomIdiomMeaning(made.archive, "fixed", "  고쳐 쓴 뜻  ");
    expect(after.idioms[0].meaning).toBe("고쳐 쓴 뜻");
    expect(after.idioms[0].bonus).toEqual(made.idiom?.bonus);
  });

  it("장착은 15구까지다", () => {
    let archive = EMPTY_SOUL_ARCHIVE;
    for (let index = 0; index < CUSTOM_IDIOM_EQUIP_LIMIT + 3; index += 1) {
      for (const char of "天地玄黃") archive = gainSoul(archive, char);
      const made = createCustomIdiom(archive, {
        chars: "天地玄黃",
        meaning: "",
        axisRoll: 0.5,
        valueRoll: 0.5,
        id: `idiom-${index}`
      });
      archive = made.archive;
      archive = equipCustomIdiom(archive, `idiom-${index}`);
    }

    expect(archive.idioms).toHaveLength(CUSTOM_IDIOM_EQUIP_LIMIT + 3);
    expect(archive.equipped).toHaveLength(CUSTOM_IDIOM_EQUIP_LIMIT);
    expect(equippedCustomIdioms(archive)).toHaveLength(CUSTOM_IDIOM_EQUIP_LIMIT);

    // 하나 빼면 그제서야 다음 구가 들어간다.
    archive = unequipCustomIdiom(archive, "idiom-0");
    archive = equipCustomIdiom(archive, `idiom-${CUSTOM_IDIOM_EQUIP_LIMIT + 2}`);
    expect(archive.equipped).toContain(`idiom-${CUSTOM_IDIOM_EQUIP_LIMIT + 2}`);
    expect(archive.equipped).toHaveLength(CUSTOM_IDIOM_EQUIP_LIMIT);
  });

  it("버리면 장착 목록에서도 함께 빠진다", () => {
    const made = createCustomIdiom(archiveWith("天地玄黃"), {
      chars: "天地玄黃",
      meaning: "",
      axisRoll: 0.5,
      valueRoll: 0.5,
      id: "fixed"
    });
    const equipped = equipCustomIdiom(made.archive, "fixed");
    const discarded = discardCustomIdiom(equipped, "fixed");

    expect(discarded.idioms).toHaveLength(0);
    expect(discarded.equipped).toHaveLength(0);
  });

  it("저장한 글을 그대로 되읽는다", () => {
    const made = createCustomIdiom(archiveWith("天地玄黃"), {
      chars: "天地玄黃",
      meaning: "하늘과 땅",
      axisRoll: 0.6,
      valueRoll: 0.6,
      id: "fixed",
      now: 1234
    });
    const equipped = gainSoul(equipCustomIdiom(made.archive, "fixed"), "宇", 5);
    const round = parseSoulArchive(serializeSoulArchive(equipped));

    expect(round).toEqual(equipped);
  });

  it("상한 글은 버리되 성한 조각은 살린다", () => {
    const round = parseSoulArchive(
      JSON.stringify({
        version: 1,
        souls: { 天: 3, 地: -2, 玄: "셋", 잘못된키글자: 1 },
        idioms: [{ id: "broken" }, null],
        equipped: ["없는성어"]
      })
    );

    expect(round.souls).toEqual({ 天: 3 });
    expect(round.idioms).toHaveLength(0);
    expect(round.equipped).toHaveLength(0);
  });

  it("빈 글·깨진 글은 빈 보관소가 된다", () => {
    expect(parseSoulArchive(null)).toEqual(EMPTY_SOUL_ARCHIVE);
    expect(parseSoulArchive("{어긋난 글")).toEqual(EMPTY_SOUL_ARCHIVE);
  });
});
