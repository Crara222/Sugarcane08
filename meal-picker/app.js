const CATEGORIES = [
  { name: "한식", emoji: "🍚" },
  { name: "중식", emoji: "🥡" },
  { name: "일식", emoji: "🍣" },
  { name: "분식", emoji: "🍢" },
  { name: "미식", emoji: "🍽️" },
  { name: "아시안", emoji: "🍜" },
  { name: "양식", emoji: "🍝", recommended: true },
  { name: "패스트푸드", emoji: "🍟", recommended: true },
  { name: "채식", emoji: "🥗", recommended: true },
  { name: "디저트/카페", emoji: "🍰", recommended: true },
];

const SPIN_TICKS = 18;
const SPIN_START_DELAY = 70;
const SPIN_DELAY_STEP = 14;

const categoryListEl = document.getElementById("categoryList");
const rouletteBox = document.getElementById("rouletteBox");
const rouletteEmoji = document.getElementById("rouletteEmoji");
const rouletteText = document.getElementById("rouletteText");
const spinBtn = document.getElementById("spinBtn");
const resetBtn = document.getElementById("resetBtn");

let spinning = false;

function renderCategories() {
  categoryListEl.innerHTML = CATEGORIES.map((cat, index) => `
    <label>
      <input type="checkbox" value="${index}" checked>
      ${cat.emoji} ${cat.name}
      ${cat.recommended ? '<span class="category-tag-new">추천</span>' : ""}
    </label>
  `).join("");
}

function getCheckedCategories() {
  const checked = [...categoryListEl.querySelectorAll("input:checked")];
  return checked.map((input) => CATEGORIES[Number(input.value)]);
}

function showResult(cat) {
  rouletteEmoji.textContent = cat.emoji;
  rouletteText.textContent = cat.name;
}

function spin() {
  if (spinning) return;

  const pool = getCheckedCategories();
  if (pool.length === 0) {
    alert("항목을 하나 이상 선택해주세요.");
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  rouletteBox.classList.remove("landed");
  rouletteBox.classList.add("spinning");

  const finalCat = pool[Math.floor(Math.random() * pool.length)];
  let tick = 0;
  let delay = SPIN_START_DELAY;

  function step() {
    const isLast = tick === SPIN_TICKS - 1;
    const cat = isLast ? finalCat : pool[Math.floor(Math.random() * pool.length)];
    showResult(cat);
    tick += 1;

    if (!isLast) {
      delay += SPIN_DELAY_STEP;
      setTimeout(step, delay);
    } else {
      rouletteBox.classList.remove("spinning");
      rouletteBox.classList.add("landed");
      spinBtn.disabled = false;
      spinning = false;
    }
  }

  step();
}

function reset() {
  if (spinning) return;
  rouletteBox.classList.remove("landed", "spinning");
  rouletteEmoji.textContent = "🍽️";
  rouletteText.textContent = "두근두근";
  categoryListEl.querySelectorAll("input").forEach((input) => {
    input.checked = true;
  });
}

spinBtn.addEventListener("click", spin);
resetBtn.addEventListener("click", reset);

renderCategories();
