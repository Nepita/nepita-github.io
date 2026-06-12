const data = window.TENDER_DATA;
const state = {
  category: "Alle",
  query: "",
  type: "Alle",
  status: "Alle",
  sort: "deadline",
  favorites: JSON.parse(localStorage.getItem("tenderFavorites") || "[]")
};

const categories = ["Alle", "Hochbau", "Tiefbau", "Bruecken", "Privat"];

const formatDate = (iso) => {
  if (!iso) return "laufend";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
};

const daysLeft = (iso) => {
  if (!iso) return null;
  const today = new Date(data.updatedAt || Date.now());
  const end = new Date(iso);
  return Math.ceil((end - today) / 86400000);
};

const byDeadline = (a, b) => {
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  return new Date(a.deadline) - new Date(b.deadline);
};

const priorityWeight = { hoch: 0, mittel: 1, niedrig: 2 };

function renderProfile() {
  document.querySelector("#profileList").innerHTML = data.profile.scope
    .map((item) => `<li><span class="dot"></span>${item}</li>`)
    .join("");

  document.querySelector("#sourceList").innerHTML = data.profile.sources
    .map((source) => `<li><a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a></li>`)
    .join("");
}

function renderTabs() {
  document.querySelector("#tabs").innerHTML = categories
    .map((category) => {
      const count = category === "Alle"
        ? data.tenders.length
        : data.tenders.filter((item) => item.category === category).length;
      return `<button class="tab ${state.category === category ? "active" : ""}" data-category="${category}">${category} (${count})</button>`;
    })
    .join("");
}

function filteredTenders() {
  const q = state.query.trim().toLowerCase();
  return data.tenders
    .filter((item) => state.category === "Alle" || item.category === state.category)
    .filter((item) => state.type === "Alle" || item.type === state.type)
    .filter((item) => state.status === "Alle" || item.status === state.status)
    .filter((item) => {
      if (!q) return true;
      return [
        item.title,
        item.client,
        item.location,
        item.state,
        item.category,
        item.summary,
        item.status
      ].join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (state.sort === "priority") return priorityWeight[a.priority] - priorityWeight[b.priority] || byDeadline(a, b);
      if (state.sort === "category") return a.category.localeCompare(b.category) || byDeadline(a, b);
      return byDeadline(a, b);
    });
}

function pillClass(value) {
  if (["hoch", "Pruefen", "Bruecken"].includes(value)) return "amber";
  if (["Dringend"].includes(value)) return "red";
  if (["mittel", "Neu", "Tiefbau", "Hochbau"].includes(value)) return "green";
  return "";
}

function renderStats(items) {
  const urgent = data.tenders.filter((item) => {
    const left = daysLeft(item.deadline);
    return left !== null && left <= 7;
  }).length;
  const bridges = data.tenders.filter((item) => item.category === "Bruecken").length;
  const privateItems = data.tenders.filter((item) => item.type.includes("Privat")).length;

  document.querySelector("#statTotal").textContent = data.tenders.length;
  document.querySelector("#statVisible").textContent = items.length;
  document.querySelector("#statUrgent").textContent = urgent;
  document.querySelector("#statBridge").textContent = bridges;
  document.querySelector("#privateCount").textContent = privateItems;
}

function renderTable() {
  const items = filteredTenders();
  renderStats(items);
  document.querySelector("#resultCount").textContent = `${items.length} Treffer`;
  document.querySelector("#empty").classList.toggle("show", items.length === 0);

  document.querySelector("#tenderRows").innerHTML = items.map((item) => {
    const left = daysLeft(item.deadline);
    const leftLabel = left === null ? "laufend" : left <= 0 ? "heute/faellig" : `${left} Tage`;
    const isFavorite = state.favorites.includes(item.id);
    return `
      <tr>
        <td class="title-cell">
          <strong>${item.title}</strong>
          <span>${item.summary}</span>
        </td>
        <td>${item.client}</td>
        <td>${item.location}<br><span class="muted">${item.state}</span></td>
        <td><span class="pill ${pillClass(item.category)}">${item.category}</span></td>
        <td><span class="pill">${item.type}</span></td>
        <td>
          <div class="deadline">${formatDate(item.deadline)}</div>
          <span class="muted">${leftLabel}</span>
        </td>
        <td><span class="pill ${pillClass(item.status)}">${item.status}</span></td>
        <td>
          <div class="row-actions">
            <button title="Favorit markieren" class="${isFavorite ? "active" : ""}" data-favorite="${item.id}" aria-label="Favorit">*</button>
            <a class="icon-button" href="${item.url}" target="_blank" rel="noreferrer" title="Quelle oeffnen">Link</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  renderTimeline();
}

function renderTimeline() {
  const items = data.tenders
    .filter((item) => item.deadline)
    .sort(byDeadline)
    .slice(0, 7);

  document.querySelector("#timeline").innerHTML = items.map((item) => `
    <div class="timeline-item">
      <div class="timeline-date">${formatDate(item.deadline).slice(0, 10)}</div>
      <div class="timeline-title">${item.title}<br><span class="muted">${item.category} / ${item.location}</span></div>
    </div>
  `).join("");
}

function bindEvents() {
  document.querySelector("#tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    renderTabs();
    renderTable();
  });

  document.querySelector("#search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderTable();
  });

  document.querySelector("#typeFilter").addEventListener("change", (event) => {
    state.type = event.target.value;
    renderTable();
  });

  document.querySelector("#statusFilter").addEventListener("change", (event) => {
    state.status = event.target.value;
    renderTable();
  });

  document.querySelector("#sortFilter").addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderTable();
  });

  document.querySelector("#tenderRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-favorite]");
    if (!button) return;
    const id = button.dataset.favorite;
    if (state.favorites.includes(id)) {
      state.favorites = state.favorites.filter((item) => item !== id);
    } else {
      state.favorites.push(id);
    }
    localStorage.setItem("tenderFavorites", JSON.stringify(state.favorites));
    renderTable();
  });

  document.querySelector("#printButton").addEventListener("click", () => window.print());
}

function init() {
  document.querySelector("#updatedAt").textContent = formatDate(data.updatedAt);
  renderProfile();
  renderTabs();
  bindEvents();
  renderTable();
}

init();
