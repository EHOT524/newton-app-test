// Маскоты приложения: енот, который идёт по пути, и его подруга ворона. Нарисованы здесь же в SVG, свои, не с чужих маскотов.

const FUR = "#8d939c";
const FUR_LIGHT = "#e7e9ec";
const INK = "#2b2f36";
const APPLE = "#d9412b";

let uid = 0; // у каждой картинки свои id, иначе обрезка хвоста у двух енотов на странице смешается

function eyes(state) {
  if (state === "happy") {
    return `<path d="M38 47 Q44 38 50 47 M66 47 Q72 38 78 47" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
  if (state === "sleep") {
    return `<path d="M38 45 Q44 50 50 45 M66 45 Q72 50 78 45" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }
  const look = state === "sad" ? 2 : 0; // грустный смотрит вниз
  return [44, 72].map((x) => `
    <circle cx="${x}" cy="44" r="7" fill="#fff"/>
    <circle cx="${x + 1}" cy="${45 + look}" r="3.6" fill="${INK}"/>
    <circle cx="${x + 2.4}" cy="${43.4 + look}" r="1.3" fill="#fff"/>`).join("");
}

function mouth(state) {
  if (state === "happy") return `<path d="M49 62 Q58 76 67 62 Z" fill="#7a2e2e" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  if (state === "sad") return `<path d="M50 68 Q58 61 66 68" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  if (state === "sleep") return `<path d="M53 65 Q58 67 63 65" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  return `<path d="M50 63 Q58 70 66 63" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
}

function apple(cx, cy, r) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${APPLE}" stroke="#8a2a1c" stroke-width="2.5"/>
    <circle cx="${cx - r * 0.4}" cy="${cy - r * 0.35}" r="${r * 0.25}" fill="#f07864"/>
    <path d="M${cx} ${cy - r} L${cx + 1.5} ${cy - r - 5}" stroke="#6e4628" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="${cx + 5}" cy="${cy - r - 4}" rx="4.5" ry="2.5" fill="#50a046" transform="rotate(-25 ${cx + 5} ${cy - r - 4})"/>`;
}

// state: idle, happy, sad, sleep
export function raccoonSVG(state = "idle") {
  const id = `rt${uid++}`;
  const arms = state === "happy"
    // Радуется: лапы вверх, яблоко поднято над головой
    ? `<ellipse cx="30" cy="78" rx="7" ry="14" transform="rotate(-35 30 78)" fill="${FUR}" stroke="${INK}" stroke-width="3"/>
       <ellipse cx="86" cy="76" rx="7" ry="14" transform="rotate(35 86 76)" fill="${FUR}" stroke="${INK}" stroke-width="3"/>
       ${apple(94, 60, 9)}`
    // Обычно держит яблоко у живота
    : `${apple(58, 97, 11)}
       <ellipse cx="45" cy="96" rx="6.5" ry="9" fill="${FUR}" stroke="${INK}" stroke-width="3"/>
       <ellipse cx="71" cy="96" rx="6.5" ry="9" fill="${FUR}" stroke="${INK}" stroke-width="3"/>`;
  const tear = state === "sad" ? `<path d="M80 52 Q83 58 80 61 Q77 58 80 52 Z" fill="#74c0fc"/>` : "";
  const zzz = state === "sleep"
    ? `<text x="88" y="24" font-size="15" font-weight="800" fill="#748ffc" font-family="sans-serif">z</text>
       <text x="98" y="12" font-size="20" font-weight="800" fill="#748ffc" font-family="sans-serif">Z</text>` : "";
  return `<svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="${id}"><ellipse cx="100" cy="94" rx="12" ry="30" transform="rotate(25 100 94)"/></clipPath></defs>
    <ellipse cx="100" cy="94" rx="12" ry="30" transform="rotate(25 100 94)" fill="${FUR}"/>
    <g clip-path="url(#${id})" fill="${INK}">
      <rect x="80" y="68" width="40" height="7" transform="rotate(25 100 94)"/>
      <rect x="80" y="84" width="40" height="7" transform="rotate(25 100 94)"/>
      <rect x="80" y="100" width="40" height="7" transform="rotate(25 100 94)"/>
      <rect x="80" y="116" width="40" height="9" transform="rotate(25 100 94)"/>
    </g>
    <ellipse cx="100" cy="94" rx="12" ry="30" transform="rotate(25 100 94)" fill="none" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="44" cy="123" rx="10" ry="5" fill="${INK}"/>
    <ellipse cx="72" cy="123" rx="10" ry="5" fill="${INK}"/>
    <ellipse cx="58" cy="97" rx="29" ry="26" fill="${FUR}" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="58" cy="103" rx="17" ry="16" fill="${FUR_LIGHT}"/>
    <path d="M28 34 L35 8 L54 26 Z" fill="${FUR}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M35 28 L37.5 15 L47 25 Z" fill="#f4b6b6"/>
    <path d="M88 34 L81 8 L62 26 Z" fill="${FUR}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M81 28 L78.5 15 L69 25 Z" fill="#f4b6b6"/>
    <ellipse cx="58" cy="45" rx="35" ry="28" fill="${FUR}" stroke="${INK}" stroke-width="3"/>
    <path d="M30 50 Q58 34 86 50 Q80 72 58 73 Q36 72 30 50 Z" fill="${FUR_LIGHT}"/>
    <path d="M25 43 Q38 31 53 40 Q58 44 63 40 Q78 31 91 43 Q85 56 71 53 Q62 51 58 55 Q54 51 45 53 Q31 56 25 43 Z" fill="${INK}"/>
    ${eyes(state)}
    <ellipse cx="58" cy="58" rx="5.5" ry="3.8" fill="${INK}"/>
    ${mouth(state)}
    ${tear}
    ${arms}
    ${zzz}
  </svg>`;
}

export function crowSVG() {
  return `<svg viewBox="0 0 104 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M18 66 L2 84 L26 78 Z" fill="#262a3a" stroke="#1d2030" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 84 L37 96 M37 96 L31 98 M37 96 L41 99" stroke="#c47f00" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M54 84 L56 96 M56 96 L51 99 M56 96 L61 98" stroke="#c47f00" stroke-width="3" stroke-linecap="round" fill="none"/>
    <ellipse cx="46" cy="62" rx="30" ry="24" fill="#3a3f55" stroke="#1d2030" stroke-width="3"/>
    <path d="M28 56 Q46 44 64 60 Q48 78 28 70 Z" fill="#262a3a"/>
    <circle cx="72" cy="36" r="20" fill="#3a3f55" stroke="#1d2030" stroke-width="3"/>
    <path d="M65 18 Q67 6 73 14 Q76 4 80 17" stroke="#1d2030" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M54 49 Q68 58 84 50 L86 57 Q68 66 52 56 Z" fill="#f2a516" stroke="#c47f00" stroke-width="1.5"/>
    <path d="M84 52 L92 66 L82 62 Z" fill="#f2a516" stroke="#c47f00" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M88 32 L103 39 L88 45 Z" fill="#f2a516" stroke="#c47f00" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="76" cy="31" r="6.5" fill="#fff"/>
    <circle cx="78" cy="31.5" r="3.4" fill="#1d2030"/>
    <circle cx="79.3" cy="30" r="1.2" fill="#fff"/>
  </svg>`;
}

// Что говорит ворона. Тон дружеский, с лёгким укором, без стыда: это школьники
export const CROW_LINES = {
  welcome: [
    "Кар! Я ворона, а это мой друг енот. Он пройдёт весь путь вместе с тобой. Жми на первый островок!",
    "Привет! Енот уже стоит на первом островке и ждёт тебя. Начнём?",
  ],
  today: [
    "Сегодня ты уже занимался — енот доволен!",
    "Кар! Отличная работа сегодня. Енот гордится тобой.",
    "Енот довольно жуёт яблоко: сегодняшний урок засчитан.",
  ],
  streak: [
    "Енот держит твой стрик {n} дн., но лапки устают! Один урок — и он спасён.",
    "Кар! Стрик {n} дн. висит на волоске. Заглянешь на урок?",
    "Енот уже разложил задачи. Один урок — и стрик продолжается!",
  ],
  days: [
    "Ты где пропадал? Енот без тебя скучает.",
    "Кар-кар! Енот третий раз спрашивает, когда ты вернёшься.",
    "Енот сидит на островке и ждёт тебя. Пойдём дальше?",
  ],
  week: [
    "Енот уже неделю смотрит на твой островок. Начнём с короткого урока?",
    "Я облетела весь путь — тебя нигде нет! Енот грустит.",
    "Енот выучил все формулы сам. Но ему скучно без тебя!",
  ],
  long: [
    "Давно не виделись! Енот приберёг для тебя лёгкий урок.",
    "Кар! Енот не сдаётся и ждёт тебя. Вернёмся потихоньку?",
  ],
};
