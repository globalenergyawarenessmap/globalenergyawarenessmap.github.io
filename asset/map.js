const DATA_URL = "dataset_response.csv";
const POLICY_BY_COUNTRY = {
  China: "policy_CN.html",
  Japan: "policy_JP.html",
  "South Korea": "policy_KR.html",
  USA: "policy_US.html",
  "United States": "policy_US.html",
  "United States of America": "policy_US.html"
};
const AREA_COLORS = {
  Urban: "#e83f6f",
  Suburban: "#2578d6",
  Rural: "#2f9b62"
};

const fallbackCsv = `City,State/Province,Country,Latitude,Longitude,Knowledge,Area,Fair Investment,Energy Source
Naju,Jeonnam,South Korea,35.0161,126.7108,4,Rural,Yes,Solar
Hayward,California,USA,37.6688,-122.0808,1,Suburban,Yes,Gas
Anaheim,California,USA,33.8366,-117.9143,2,Suburban,Unsure,Unknown
Los Angeles,California,USA,34.0522,-118.2437,2,Urban,No,Solar
Seoul,,South Korea,37.5665,126.9780,3,Urban,Yes,Gas
Saratoga,California,USA,37.2638,-122.0230,3,Suburban,Yes,Solar + Gas
Modesto,California,USA,37.6391,-120.9969,2,Suburban,Unsure,Solar + Gas
Berkeley,California,USA,37.8715,-122.2730,1,Urban,Unsure,PG&E
San Jose,California,USA,37.3382,-121.8863,2,Suburban,Unsure,Solar
Avondale,Arizona,USA,33.4356,-112.3496,3,Suburban,Unsure,Solar
Beijing,China,China,39.9042,116.4074,5,Urban,Yes,Mixed
Sun Valley (Los Angeles),California,USA,34.2279,-118.3813,2,Urban,No,Mixed
Seoul,,South Korea,37.5665,126.9780,3,Urban,Yes,Gas
Brockton,Massachusetts,USA,42.0834,-71.0184,3,Suburban,Unsure,"National Grid, Mixed"
Lucerne Valley,California,USA,34.4439,-116.9678,3,Rural,Yes,Solar
Dublin,California,USA,37.7022,-121.9358,3,Suburban,Yes,PG&E
Berkeley,California,USA,37.8715,-122.2730,1,Suburban,Yes,Solar
Tokyo,Japan,Japan,35.6895,139.6917,4,Urban,Yes,Gas
Berkeley,California,USA,37.8715,-122.2730,2,Rural,Unsure,Gas
Ulsan,,South Korea,35.5384,129.3114,3,Urban,Yes,Gas
Seoul,,South Korea,37.5665,126.978,3,Urban,No,gas`;

const workspace = document.getElementById("workspace");
const responseList = document.getElementById("response-list");
const markersByKey = new Map();
let map;
let activeCityItem = null;
let resizeState = null;

if (!window.L) {
  workspace.classList.add("is-error");
} else {
  init();
}

async function init() {
  const rows = parseCsv(await loadCsv());
  const groups = groupByCity(rows);
  initMap();
  renderMarkers(groups);
  renderCityList(groups);
  bindResize();
  document.getElementById("response-count").textContent = groups.length;
  window.__markerCount = groups.length;
  window.__responseCount = rows.length;
  window.__markersByKey = markersByKey;
}

async function loadCsv() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error("CSV request failed");
    return await response.text();
  } catch (error) {
    return fallbackCsv;
  }
}

function initMap() {
  map = L.map("map", {
    center: [23, -155],
    zoom: 3,
    minZoom: 2,
    maxZoom: 18,
    worldCopyJump: true,
    zoomControl: true
  });

  window.map = map;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    noWrap: false,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  map.setMaxBounds([[-85, -Infinity], [85, Infinity]]);
}

function renderMarkers(groups) {
  const bounds = [];

  groups.forEach((group) => {
    const areas = group.rows.map((row) => row.Area).filter(Boolean);
    const dominantArea = mostCommon(areas) || "Urban";
    const count = group.rows.length;
    const marker = L.circleMarker([group.latitude, group.longitude], {
      radius: 6 + count * 3,
      color: "#ffffff",
      weight: 2,
      fillColor: AREA_COLORS[dominantArea] || "#596575",
      fillOpacity: 0.86
    })
      .addTo(map)
      .bindPopup(createPopup(group))
      .bindTooltip(`${group.city} · ${count} response${count > 1 ? "s" : ""}`);

    markersByKey.set(group.key, marker);
    bounds.push([group.latitude, group.longitude]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, {
      padding: [46, 46],
      maxZoom: 4
    });
  }
}

function renderCityList(groups) {
  const sortedGroups = [...groups].sort(compareCitiesByName);

  responseList.innerHTML = sortedGroups.map((group) => {
    const place = [group.state, group.country].filter(Boolean).join(", ");
    const policyUrl = getPolicyUrl(group.country);
    return `
      <li class="response-item">
        <button class="response-main" type="button" data-key="${escapeHtml(group.key)}">
          <span class="response-city">
            <span>${escapeHtml(group.city)}</span>
          </span>
          <span class="response-meta">${escapeHtml(place)}</span>
        </button>
        <a class="policy-button" href="${escapeHtml(policyUrl)}" aria-label="Open policy for ${escapeHtml(group.city)}">Policy</a>
      </li>
    `;
  }).join("");

  responseList.addEventListener("click", (event) => {
    const button = event.target.closest(".response-main");
    if (!button) return;
    focusResponse(button);
  });
}

function focusResponse(button) {
  const item = button.closest(".response-item");
  if (activeCityItem) activeCityItem.classList.remove("is-active");
  activeCityItem = item;
  if (item) item.classList.add("is-active");

  const marker = markersByKey.get(button.dataset.key);
  if (!marker) return;
  map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 5), { duration: 0.5 });
  marker.openPopup();
}

function bindResize() {
  const handle = document.getElementById("resize-handle");

  handle.addEventListener("pointerdown", (event) => {
    resizeState = {
      startX: event.clientX,
      startWidth: Number.parseFloat(getComputedStyle(workspace).getPropertyValue("--sidebar-width"))
    };
    handle.setPointerCapture(event.pointerId);
    document.body.style.userSelect = "none";
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resizeState) return;
    const nextWidth = clamp(resizeState.startWidth + event.clientX - resizeState.startX, 230, 520);
    workspace.style.setProperty("--sidebar-width", `${nextWidth}px`);
    map.invalidateSize();
  });

  handle.addEventListener("pointerup", (event) => {
    resizeState = null;
    document.body.style.userSelect = "";
    handle.releasePointerCapture(event.pointerId);
    map.invalidateSize();
  });
}

function createPopup(group) {
  const place = [group.state, group.country].filter(Boolean).join(", ");
  const count = group.rows.length;
  const items = group.rows.map((row, index) => {
    const label = count > 1 ? `Response ${index + 1}` : row.Area;
    return `
      <li>
        <strong>${escapeHtml(label)}</strong>
        <span>Area: ${escapeHtml(row.Area)}</span>
        <span>Knowledge: ${escapeHtml(row.Knowledge)} / 5</span>
        <span>Fair investment: ${escapeHtml(row["Fair Investment"])}</span>
        <span>Energy source: ${renderEnergySource(row)}</span>
      </li>
    `;
  }).join("");

  return `
    <div class="popup">
      <h2>${escapeHtml(group.city)}</h2>
      <p class="place">${escapeHtml(place)}</p>
      <p class="response-count">${count} response${count > 1 ? "s" : ""}</p>
      <ul>${items}</ul>
    </div>
  `;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  const [header, ...body] = rows;
  return body.map((fields, index) => {
    const record = header.reduce((result, column, columnIndex) => {
      result[column] = fields[columnIndex] ?? "";
      return result;
    }, {});
    record.__responseIndex = index;
    return record;
  });
}

function groupByCity(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const latitude = Number(row.Latitude);
    const longitude = Number(row.Longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const key = [
      row.City,
      row["State/Province"],
      row.Country,
      row.Latitude,
      row.Longitude
    ].join("|");

    row.__groupKey = key;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        city: row.City,
        state: row["State/Province"],
        country: row.Country,
        latitude,
        longitude,
        rows: []
      });
    }

    groups.get(key).rows.push(row);
  });

  return Array.from(groups.values());
}

function mostCommon(values) {
  const counts = values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .at(0)?.[0];
}

function compareCitiesByName(a, b) {
  return a.city.localeCompare(b.city, undefined, { sensitivity: "base" })
    || a.country.localeCompare(b.country, undefined, { sensitivity: "base" })
    || a.state.localeCompare(b.state, undefined, { sensitivity: "base" });
}

function getPolicyUrl(country) {
  return POLICY_BY_COUNTRY[country] || "policy_US.html";
}

function renderEnergySource(row) {
  const value = String(row["Energy Source"] ?? "");
  if (!isUnitedStates(row.Country)) return escapeHtml(value);
  return linkUtilityNames(value);
}

function isUnitedStates(country) {
  return ["usa", "us", "united states", "united states of america"].includes(String(country ?? "").trim().toLowerCase());
}

function linkUtilityNames(value) {
  const utilityPattern = /(PG&E|SCE|National\s+Grid)/gi;
  let html = "";
  let lastIndex = 0;
  let match;

  while ((match = utilityPattern.exec(value))) {
    html += escapeHtml(value.slice(lastIndex, match.index));
    html += `<a href="supporting.html">${escapeHtml(match[0])}</a>`;
    lastIndex = utilityPattern.lastIndex;
  }

  html += escapeHtml(value.slice(lastIndex));
  return html;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
