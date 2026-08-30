/*
 * 자동배치 옵션 — 톱니 하나에 다섯 갈래.
 *
 * 규칙과 기본값은 core/arrange-policy.ts 가 쥐고, 여기는 그것을 눌러 보이게만
 * 한다. 저장은 설정 서랍(localStorage)이다 — 런 저장본에 담으면 옛 판을
 * 이어할 때 그때의 정책이 되살아나 지금 고른 것과 어긋난다.
 */
import {
  ARRANGE_POLICY_OPTIONS,
  DEFAULT_ARRANGE_POLICY,
  changedArrangeOptions,
  parseArrangePolicy,
  type ArrangePolicy
} from "../../core/arrange-policy";
import { ctx, must, shell } from "../app-context";
import { loadArrangePolicyRaw, saveArrangePolicyRaw } from "../summon-placement";

let policy: ArrangePolicy = DEFAULT_ARRANGE_POLICY;
let bound = false;

function panel(): HTMLElement {
  return must<HTMLElement>("#arrange-policy-panel");
}

function apply(next: ArrangePolicy): void {
  policy = next;
  saveArrangePolicyRaw(JSON.stringify(next));
  ctx.engine.setArrangePolicy(next);
  render();
}

function render(): void {
  const list = must<HTMLElement>("#arrange-policy-list");
  list.replaceChildren(
    ...ARRANGE_POLICY_OPTIONS.map((option) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = policy[option.key] ? "arrange-policy-row is-on" : "arrange-policy-row";
      row.dataset.arrangeKey = option.key;
      row.setAttribute("role", "switch");
      row.setAttribute("aria-checked", policy[option.key] ? "true" : "false");
      row.innerHTML = `<i aria-hidden="true"></i><span><b>${option.label}</b><small>${option.hint}</small></span>`;
      return row;
    })
  );

  // 기본값과 다른 갈래 수를 톱니에 적는다 — 손댔다는 사실이 판 밖으로 드러나야
  // "왜 이렇게 놓였지"를 여기서 되짚을 수 있다.
  const badge = must<HTMLElement>("#arrange-policy-badge");
  const changed = changedArrangeOptions(policy);
  badge.textContent = String(changed);
  badge.hidden = changed === 0;
}

/**
 * 판을 단추 위에 띄운다.
 *
 * 판이 원래 있던 자리(상점 작업대)는 `overflow: hidden` 두 겹에 싸여 있어
 * 위로 뜬 판의 머리가 잘렸다. 그래서 무대 뿌리로 옮겨 두고, 열 때마다 단추의
 * 자리를 재서 그 위에 놓는다 — 무대는 배율 변환이 걸려 있으므로 화면 좌표를
 * 배율로 되돌려 설계 좌표로 적는다.
 */
function place(): void {
  const box = panel();
  const button = must<HTMLButtonElement>("#arrange-policy-button");
  const scale = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--stage-scale")
  ) || 1;
  const buttonRect = button.getBoundingClientRect();
  const shellRect = shell.getBoundingClientRect();
  const height = box.getBoundingClientRect().height / scale;
  const right = (shellRect.right - buttonRect.right) / scale;
  const bottom = (shellRect.bottom - buttonRect.top) / scale + 6;
  box.style.right = `${Math.max(8, Math.round(right))}px`;
  box.style.bottom = `${Math.max(8, Math.round(bottom))}px`;
  // 판이 무대 위로 넘치면 아래로 내려 붙인다.
  const top = shellRect.height / scale - bottom - height;
  if (top < 8) box.style.bottom = `${Math.max(8, Math.round(shellRect.height / scale - height - 8))}px`;
}

function setOpen(open: boolean): void {
  panel().hidden = !open;
  if (open) place();
  must<HTMLButtonElement>("#arrange-policy-button").setAttribute("aria-expanded", open ? "true" : "false");
}

/** 엔진이 새로 꽂힐 때마다(새 판·이어하기) 정책을 다시 물린다. */
export function syncArrangePolicy(): void {
  ctx.engine.setArrangePolicy(policy);
}

export function bindArrangePolicy(): void {
  policy = parseArrangePolicy(loadArrangePolicyRaw());
  syncArrangePolicy();
  if (bound) {
    render();
    return;
  }
  bound = true;
  // 상점 작업대는 overflow: hidden 두 겹이라 위로 뜬 판이 잘린다. 무대 뿌리로 옮긴다.
  shell.append(panel());

  must<HTMLButtonElement>("#arrange-policy-button").addEventListener("click", () => {
    // HTMLElement.hidden 은 boolean | "until-found" | "" 이라 그대로 뒤집을 수 없다.
    setOpen(panel().hidden !== false);
  });
  must<HTMLButtonElement>("#arrange-policy-close").addEventListener("click", () => setOpen(false));
  must<HTMLButtonElement>("#arrange-policy-reset").addEventListener("click", () => apply(DEFAULT_ARRANGE_POLICY));
  must<HTMLElement>("#arrange-policy-list").addEventListener("click", (event) => {
    const raw = (event.target as HTMLElement).closest<HTMLElement>("[data-arrange-key]")?.dataset.arrangeKey;
    if (!raw) return;
    const key = raw as keyof ArrangePolicy;
    apply({ ...policy, [key]: !policy[key] });
  });
  // 판 밖을 누르면 닫는다 — 옵션은 잠깐 열어 보는 것이지 머무는 화면이 아니다.
  document.addEventListener("pointerdown", (event) => {
    if (panel().hidden) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("#arrange-policy-panel, #arrange-policy-button")) return;
    setOpen(false);
  });

  render();
}
