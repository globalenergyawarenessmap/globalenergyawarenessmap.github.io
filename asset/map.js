const ARCGIS_APP_URL = "https://cal.maps.arcgis.com/apps/instant/sidebar/index.html?appid=4ffaf67b00834bdda4cb919c2d6d7fef";

const workspace = document.getElementById("workspace");
const mapContainer = document.getElementById("map");

init();

function init() {
  if (!mapContainer) {
    workspace?.classList.add("is-error");
    return;
  }

  const frame = document.createElement("iframe");
  frame.id = "arcgis-map-frame";
  frame.className = "arcgis-map-frame";
  frame.title = "ArcGIS Global Energy Policy Explorer";
  frame.src = ARCGIS_APP_URL;
  frame.loading = "eager";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "no-referrer-when-downgrade";

  mapContainer.replaceChildren(frame);
  window.__arcgisAppUrl = ARCGIS_APP_URL;
}
