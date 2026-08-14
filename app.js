/* ===========================================================
   FLEXIHIRE FLEET EXPLORER
   APP STATE + INITIALISATION
   =========================================================== */


/* ===========================================================
   APPLICATION STATE
   =========================================================== */

const App = {
    fleet: [],
    filteredFleet: [],

    favourites: new Set(),
    comparison: new Set(),

filters: {
    search: "",
    categories: new Set(),
    manufacturers: new Set(),
    minHeight: 0,
    minReach: 0,
    maxWidth: 0,
    sort: "name"
},

    settings: {
        maxCompare: 3,
        heightUnits: "metres"
    }
};


/* ===========================================================
   DOM REFERENCES
   =========================================================== */

const DOM = {
   searchInput: document.getElementById("searchInput"),
   heightInput: document.getElementById("heightInput"),
   reachInput: document.getElementById("reachInput"),
   widthInput: document.getElementById("widthInput"),

   sortSelect: document.getElementById("sortSelect"),
   
    categoryFilters: document.getElementById("categoryFilters"),

    selectAllButton: document.getElementById("selectAll"),
    clearAllButton: document.getElementById("clearAll"),

    favouritesDashboardButton:
        document.getElementById("favouritesDashboardButton"),

    machineCount: document.getElementById("machineCount"),
    categoryCount: document.getElementById("categoryCount"),

    fleetGrid: document.getElementById("fleetGrid")
};

/* ===========================================================
   APPLICATION STARTUP
   =========================================================== */

document.addEventListener("DOMContentLoaded", initialiseApp);

async function initialiseApp() {
    try {

        await loadFleet();

        restoreFavourites();
        restoreComparison();

        initialiseFilterState();

        cleanStoredMachineIds();

        registerEvents();
        registerDashboardEvents();

        renderDashboard();
         renderSidebar();
         applyFilters();
         updateDashboardSelectionState();

        // New additions
        renderComparisonBar();
        registerServiceWorker();

    } catch (error) {

        console.error(
            "Unable to initialise Flexihire Fleet Explorer:",
            error
        );

        showApplicationError(
            "Fleet information could not be loaded. Please refresh the page and try again."
        );

    }
}


/* ===========================================================
   FLEET DATA
   =========================================================== */

async function loadFleet() {
    const response = await fetch("fleet.json", {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(
            `Unable to load fleet.json (${response.status})`
        );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new TypeError(
            "fleet.json must contain an array of machines."
        );
    }

    App.fleet = data
        .filter(isValidMachine)
        .sort(sortByName);

    App.filteredFleet = [...App.fleet];
}


/* ===========================================================
   INITIAL FILTER STATE
   =========================================================== */

function initialiseFilterState() {
    App.filters.categories = new Set(
        App.fleet
            .map(machine => machine.category)
            .filter(Boolean)
    );

    App.filters.manufacturers = new Set(
        App.fleet
            .map(machine => machine.manufacturer)
            .filter(Boolean)
    );
}


/* ===========================================================
   EVENT REGISTRATION
   =========================================================== */

function registerEvents() {

    DOM.searchInput?.addEventListener(
        "input",
        debounce(handleSearch, 150)
    );

    DOM.heightInput?.addEventListener(
    "input",
    handleHeightFilter
);

DOM.reachInput?.addEventListener(
    "input",
    handleReachFilter
);

DOM.widthInput?.addEventListener(
    "input",
    handleWidthFilter
);

    document
        .getElementById("heightMetres")
        ?.addEventListener(
            "click",
            () => setHeightUnits("metres")
        );

    document
        .getElementById("heightFeet")
        ?.addEventListener(
            "click",
            () => setHeightUnits("feet")
        );

    DOM.sortSelect?.addEventListener(
        "change",
        event => setSortOrder(
            event.target.value
        )
    );

    DOM.favouritesDashboardButton?.addEventListener(
        "click",
        showFavouriteMachines
    );

    DOM.selectAllButton?.addEventListener(
        "click",
        selectAllFilters
    );

    DOM.clearAllButton?.addEventListener(
        "click",
        resetFilters
    );

    window.addEventListener(
        "resize",
        debounce(handleResize, 150)
    );

    // ===========================================================
    // MACHINE IMAGE: QUICK CLICK TO EXPAND, LONG PRESS TO COMPARE
    // ===========================================================
    let pressTimer = null;
    let isLongPress = false;

    // 1. Long Press Detection (Press down)
    const handlePressStart = (event) => {
        const imageWrapper = event.target.closest(".machine-image");
        if (!imageWrapper) return;

        isLongPress = false;

        if (pressTimer) clearTimeout(pressTimer);

        pressTimer = setTimeout(() => {
            isLongPress = true;

            const card = imageWrapper.closest(".machine-card");
            if (card) {
                const compareBtn = card.querySelector(".compare-action") || 
                                   card.querySelector('[data-action="compare"]');

                if (compareBtn) {
                    compareBtn.click();
                }
            }

            if (navigator.vibrate) navigator.vibrate(40);
        }, 450); // Hold time in milliseconds
    };

    // 2. Clear Timer (Release/Cancel)
    const handlePressEnd = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    // Mouse / Touch listeners for long press
    DOM.fleetGrid?.addEventListener("mousedown", handlePressStart);
    DOM.fleetGrid?.addEventListener("touchstart", handlePressStart, { passive: true });

    DOM.fleetGrid?.addEventListener("mouseup", handlePressEnd);
    DOM.fleetGrid?.addEventListener("mouseleave", handlePressEnd);
    DOM.fleetGrid?.addEventListener("touchend", handlePressEnd);
    DOM.fleetGrid?.addEventListener("touchcancel", handlePressEnd);

    // 3. Native Click Handler (Quick click to toggle details)
    DOM.fleetGrid?.addEventListener("click", (event) => {
        const imageWrapper = event.target.closest(".machine-image");
        if (!imageWrapper) return;

        // If it was a long press, prevent opening/closing details
        if (isLongPress) {
            event.preventDefault();
            event.stopPropagation();
            isLongPress = false;
            return;
        }

        const card = imageWrapper.closest(".machine-card");
        const details = card?.querySelector("details");

        if (details) {
            details.open = !details.open;

            if (details.open) {
                card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }
    });
}

/* ===========================================================
   EVENT HANDLERS
   =========================================================== */

function handleSearch(event) {
    App.filters.search = event.target.value
        .trim()
        .toLowerCase();

    applyFilters();
}


function handleHeightFilter(event) {
    const value = Number.parseFloat(event.target.value);

    App.filters.minHeight =
        Number.isFinite(value) && value > 0
            ? value
            : 0;

    applyFilters();
}
function handleReachFilter(event) {
    const value = Number.parseFloat(event.target.value);

    App.filters.minReach =
        Number.isFinite(value) && value > 0
            ? value
            : 0;

    applyFilters();
}

function handleWidthFilter(event) {
    const value = Number.parseFloat(event.target.value);

    App.filters.maxWidth =
        Number.isFinite(value) && value > 0
            ? value
            : 0;

    applyFilters();
}

function setHeightUnits(units) {
    App.settings.heightUnits = units;

    document
        .getElementById("heightMetres")
        ?.classList.toggle(
            "is-active",
            units === "metres"
        );

    document
        .getElementById("heightFeet")
        ?.classList.toggle(
            "is-active",
            units === "feet"
        );

    renderFleet();
}


function handleResize() {
    redrawReachGraphs();
}


/* ===========================================================
   BASIC VALIDATION
   =========================================================== */

function isValidMachine(machine) {
    return Boolean(
        machine &&
        typeof machine === "object" &&
        machine.id &&
        machine.name
    );
}


/* ===========================================================
   BASIC UTILITIES
   =========================================================== */

function sortByName(a, b) {
    return a.name.localeCompare(
        b.name,
        undefined,
        {
            numeric: true,
            sensitivity: "base"
        }
    );
}


function debounce(callback, delay = 150) {
    let timeout;

    return (...args) => {
        clearTimeout(timeout);

        timeout = setTimeout(
            () => callback(...args),
            delay
        );
    };
}


/* ===========================================================
   APPLICATION ERROR
   =========================================================== */

function showApplicationError(message) {
    if (!DOM.fleetGrid) {
        return;
    }

    DOM.fleetGrid.innerHTML = `
        <div class="app-error">
            <strong>Unable to load fleet</strong>
            <p>${message}</p>
        </div>
    `;
}
/* ===========================================================
   FILTERING + SORTING
   =========================================================== */


/* ===========================================================
   APPLY FILTERS
   =========================================================== */

function applyFilters() {
    let machines = [...App.fleet];

   machines = machines.filter(matchesSearch);
machines = machines.filter(matchesHeight);
machines = machines.filter(matchesReach);
machines = machines.filter(matchesWidth);
machines = machines.filter(matchesCategory);
machines = machines.filter(matchesManufacturer);

    machines = sortFleet(machines);

    App.filteredFleet = machines;

    renderDashboard();
    renderFleet();
}


/* ===========================================================
   SEARCH FILTER
   =========================================================== */

function matchesSearch(machine) {
    const query = App.filters.search;

    if (!query) {
        return true;
    }

    const searchableValues = [
        machine.name,
        machine.model,
        machine.manufacturer,
        machine.category,
        machine.description
    ];

    return searchableValues
        .filter(Boolean)
        .some(value =>
            String(value)
                .toLowerCase()
                .includes(query)
        );
}


/* ===========================================================
   HEIGHT FILTER
   =========================================================== */

function matchesHeight(machine) {
    const minimumHeight = App.filters.minHeight;

    if (!minimumHeight) {
        return true;
    }

    const machineHeight = Number(machine.maxHeight);

    return Number.isFinite(machineHeight) &&
        machineHeight >= minimumHeight;
}

function matchesReach(machine) {
    const minimumReach = App.filters.minReach;

    if (!minimumReach) {
        return true;
    }

    const machineReach = Number(machine.maxReach);

    return Number.isFinite(machineReach) &&
        machineReach >= minimumReach;
}

function matchesWidth(machine) {
    const maximumWidth = App.filters.maxWidth;

    if (!maximumWidth) {
        return true;
    }

    const machineWidth = getDimensionNumber(
        machine.dimensions?.width
    );

    return machineWidth > 0 &&
        machineWidth <= maximumWidth;
}


/* ===========================================================
   CATEGORY FILTER
   =========================================================== */

function matchesCategory(machine) {
    if (!App.filters.categories.size) {
        return false;
    }

    return App.filters.categories.has(
        machine.category
    );
}


/* ===========================================================
   MANUFACTURER FILTER
   =========================================================== */

function matchesManufacturer(machine) {
    if (!App.filters.manufacturers.size) {
        return false;
    }

    return App.filters.manufacturers.has(
        machine.manufacturer
    );
}



/* ===========================================================
   SORTING
   =========================================================== */

function sortFleet(machines) {
    const sorted = [...machines];

    switch (App.filters.sort) {

        case "height-high":
            return sorted.sort(
                (a, b) =>
                    getNumericValue(b.maxHeight) -
                    getNumericValue(a.maxHeight)
            );

        case "height-low":
            return sorted.sort(
                (a, b) =>
                    getNumericValue(a.maxHeight) -
                    getNumericValue(b.maxHeight)
            );

          case "width-low":
          return sorted.sort(
              (a, b) =>
                  getDimensionNumber(a.dimensions?.width) -
                  getDimensionNumber(b.dimensions?.width)
             );

case "width-high":
    return sorted.sort(
        (a, b) =>
            getDimensionNumber(b.dimensions?.width) -
            getDimensionNumber(a.dimensions?.width)
    );

        case "weight-high":
            return sorted.sort(
                (a, b) =>
                    getWeightNumber(b.weight) -
                    getWeightNumber(a.weight)
            );

        case "weight-low":
            return sorted.sort(
                (a, b) =>
                    getWeightNumber(a.weight) -
                    getWeightNumber(b.weight)
            );

        case "reach-high":
            return sorted.sort(
                (a, b) =>
                    getNumericValue(b.maxReach) -
                    getNumericValue(a.maxReach)
            );

        case "reach-low":
            return sorted.sort(
                (a, b) =>
                    getNumericValue(a.maxReach) -
                    getNumericValue(b.maxReach)
            );

        case "name-desc":
            return sorted.sort(
                (a, b) => sortByName(b, a)
            );

        case "name":
        default:
            return sorted.sort(sortByName);
    }
}


/* ===========================================================
   CATEGORY FILTER CONTROLS
   =========================================================== */

function toggleCategory(category) {
    if (App.filters.categories.has(category)) {
        App.filters.categories.delete(category);
    } else {
        App.filters.categories.add(category);
    }

    applyFilters();
}


/* ===========================================================
   MANUFACTURER FILTER CONTROLS
   =========================================================== */

function toggleManufacturer(manufacturer) {
    if (
        App.filters.manufacturers.has(manufacturer)
    ) {
        App.filters.manufacturers.delete(
            manufacturer
        );
    } else {
        App.filters.manufacturers.add(
            manufacturer
        );
    }

    applyFilters();
}

/* ===========================================================
   SORT CONTROL
   =========================================================== */

function setSortOrder(sortOrder) {
    App.filters.sort = sortOrder;

    applyFilters();
}


/* ===========================================================
   SELECT ALL FILTERS
   =========================================================== */

function selectAllFilters() {
    App.filters.categories = new Set(
        App.fleet
            .map(machine => machine.category)
            .filter(Boolean)
    );

    App.filters.manufacturers = new Set(
        App.fleet
            .map(machine => machine.manufacturer)
            .filter(Boolean)
    );

App.filters.minHeight = 0;
App.filters.minReach = 0;
App.filters.maxWidth = 0;
App.filters.search = "";
App.filters.sort = "name";

if (DOM.searchInput) DOM.searchInput.value = "";
if (DOM.heightInput) DOM.heightInput.value = "";
if (DOM.reachInput) DOM.reachInput.value = "";
if (DOM.widthInput) DOM.widthInput.value = "";
if (DOM.sortSelect) DOM.sortSelect.value = "name";

    renderSidebar();
    applyFilters();
   updateDashboardSelectionState();
}


/* ===========================================================
   RESET FILTERS
   =========================================================== */

function resetFilters() {
    App.filters.search = "";
    App.filters.minHeight = 0;
    App.filters.minReach = 0;
    App.filters.maxWidth = 0;
    App.filters.sort = "name";

    // Restore all categories
    App.filters.categories = new Set(
        App.fleet
            .map(machine => machine.category)
            .filter(Boolean)
    );

    // Restore all manufacturers
    App.filters.manufacturers = new Set(
        App.fleet
            .map(machine => machine.manufacturer)
            .filter(Boolean)
    );

    // Reset UI controls
    if (DOM.searchInput) {
        DOM.searchInput.value = "";
    }

    if (DOM.heightInput) {
        DOM.heightInput.value = "";
    }

    if (DOM.reachInput) {
    DOM.reachInput.value = "";
}

   if (DOM.widthInput) {
    DOM.widthInput.value = "";
   }

    if (DOM.sortSelect) {
        DOM.sortSelect.value = "name";
    }

    renderSidebar();
    applyFilters();
   updateDashboardSelectionState();
}

/* ===========================================================
   FILTER HELPERS
   =========================================================== */

function getNumericValue(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function getWeightNumber(weight) {
    if (!weight) {
        return 0;
    }

    const cleaned = String(weight)
        .replace(/,/g, "")
        .replace(/[^\d.]/g, "");

    const value = Number.parseFloat(cleaned);

    return Number.isFinite(value)
        ? value
        : 0;
}


function getDimensionNumber(value) {
    if (!value) {
        return 0;
    }

    const number = Number.parseFloat(
        String(value)
            .replace(",", ".")
            .replace(/[^\d.]/g, "")
    );

    return Number.isFinite(number)
        ? number
        : 0;
}

/* ===========================================================
   SIDEBAR RENDERING
   =========================================================== */

function renderSidebar() {
     renderManufacturerFilters();

}


/* ===========================================================
   CATEGORY FILTERS
   =========================================================== */

function renderCategoryFilters() {

    const container = document.getElementById("categoryFilters");

    if (!container) return;

    const categories = [...new Set(

        App.fleet.map(machine => machine.category)

    )].sort();

    container.innerHTML = "";

    categories.forEach(category => {

        const label = document.createElement("label");

        label.className = "filter-checkbox";

        label.innerHTML = `

            <input
                type="checkbox"
                ${App.filters.categories.has(category) ? "checked" : ""}
            >

            <span>${category}</span>

            <small>${
                App.fleet.filter(
                    machine => machine.category === category
                ).length
            }</small>

        `;

        label.querySelector("input")
            .addEventListener("change", () => {

                toggleCategory(category);

            });

        container.appendChild(label);

    });

}


/* ===========================================================
   MANUFACTURER FILTERS
   =========================================================== */

function renderManufacturerFilters() {

    let section = document.getElementById("manufacturerFilters");

    if (!section) {

        section = document.createElement("div");

        section.id = "manufacturerFilters";

        section.className = "filter-section";

        document.querySelector(".sidebar")
            .appendChild(section);

    }

    const manufacturers = [...new Set(

        App.fleet.map(machine => machine.manufacturer)

    )]

    .filter(Boolean)

    .sort();

    section.innerHTML = `

        <h2>Manufacturers</h2>

    `;

    manufacturers.forEach(manufacturer => {

        const label = document.createElement("label");

        label.className = "filter-checkbox";

        label.innerHTML = `

            <input
                type="checkbox"
                ${App.filters.manufacturers.has(manufacturer) ? "checked" : ""}
            >

            <span>${manufacturer}</span>

            <small>${
                App.fleet.filter(
                    machine =>
                        machine.manufacturer === manufacturer
                ).length
            }</small>

        `;

        label.querySelector("input")
            .addEventListener("change", () => {

                toggleManufacturer(manufacturer);

            });

        section.appendChild(label);

    });

}


/* ===========================================================
   SIDEBAR COUNTS
   =========================================================== */

function getMachineCountByCategory(category) {

    return App.fleet.filter(

        machine => machine.category === category

    ).length;

}


function getMachineCountByManufacturer(manufacturer) {

    return App.fleet.filter(

        machine => machine.manufacturer === manufacturer

    ).length;

}
/* ===========================================================
   DASHBOARD + LIVE STATISTICS
   =========================================================== */


/* ===========================================================
   DASHBOARD RENDERING
   =========================================================== */

function renderDashboard() {
    updateMachineCount();
    updateCategoryCount();
    updateFleetSummary();
}


/* ===========================================================
   MACHINE COUNT
   =========================================================== */

function updateMachineCount() {
    if (!DOM.machineCount) return;

    DOM.machineCount.textContent =
        App.filteredFleet.length;
}


/* ===========================================================
   CATEGORY COUNT
   =========================================================== */

function updateCategoryCount() {
    if (!DOM.categoryCount) return;

    const categories = new Set(
        App.filteredFleet
            .map(machine => machine.category)
            .filter(Boolean)
    );

    DOM.categoryCount.textContent =
        categories.size;
}


/* ===========================================================
   FLEET SUMMARY
   =========================================================== */

function updateFleetSummary() {
    const summary = {
        total: App.filteredFleet.length,
        boomLifts: 0,
        scissorLifts: 0,
        trailerBooms: 0,
        verticalLifts: 0,
        favourites: 0,
        comparison: App.comparison.size
    };

    App.filteredFleet.forEach(machine => {
        switch (machine.category) {
            case "Boom Lift":
                summary.boomLifts++;
                break;

            case "Scissor Lift":
                summary.scissorLifts++;
                break;

            case "Trailer Boom":
                summary.trailerBooms++;
                break;

            case "Vertical Lift":
                summary.verticalLifts++;
                break;
        }

        if (App.favourites.has(machine.id)) {
            summary.favourites++;
        }
    });

    updateDashboardStat("totalFleetCount", summary.total);
    updateDashboardStat("boomLiftCount", summary.boomLifts);
    updateDashboardStat("scissorLiftCount", summary.scissorLifts);
    updateDashboardStat("trailerBoomCount", summary.trailerBooms);
    updateDashboardStat("verticalLiftCount", summary.verticalLifts);
    updateDashboardStat("favouriteCount", summary.favourites);
    updateDashboardStat("comparisonCount", summary.comparison);
}


/* ===========================================================
   DASHBOARD STAT HELPER
   =========================================================== */

function updateDashboardStat(elementId, value) {
    const element = document.getElementById(elementId);

    if (!element) return;

    element.textContent = value;
}


/* ===========================================================
   DASHBOARD CARD INTERACTION
   =========================================================== */

function registerDashboardEvents() {
    const statCards = document.querySelectorAll(
        "[data-dashboard-filter]"
    );

    statCards.forEach(card => {
        card.addEventListener("click", () => {
            const category =
                card.dataset.dashboardFilter;

            applyDashboardCategoryFilter(category);
        });
    });
}


/* ===========================================================
   DASHBOARD CATEGORY FILTER
   =========================================================== */

function applyDashboardCategoryFilter(category) {
    if (!category) return;

    const allCategories = [
        ...new Set(
            App.fleet
                .map(machine => machine.category)
                .filter(Boolean)
        )
    ];

    if (category === "all") {
        const allSelected =
            App.filters.categories.size ===
            allCategories.length;

        if (allSelected) {
            App.filters.categories.clear();
        } else {
            App.filters.categories =
                new Set(allCategories);
        }
    } else {
        if (App.filters.categories.has(category)) {
            App.filters.categories.delete(category);
        } else {
            App.filters.categories.add(category);
        }
    }

    updateDashboardSelectionState();
    applyFilters();
}
function updateDashboardSelectionState() {
    const allCategories = [
        ...new Set(
            App.fleet
                .map(machine => machine.category)
                .filter(Boolean)
        )
    ];

    const allSelected =
        App.filters.categories.size ===
        allCategories.length;

    document
        .querySelectorAll("[data-dashboard-filter]")
        .forEach(card => {

            const category =
                card.dataset.dashboardFilter;

            let isSelected = false;

            if (category === "all") {
                isSelected = allSelected;
            } else {
                isSelected =
                    App.filters.categories.has(category);
            }

            card.classList.toggle(
                "is-selected",
                isSelected
            );

            card.setAttribute(
                "aria-pressed",
                String(isSelected)
            );
        });
}

/* ===========================================================
   FAVOURITES DASHBOARD FILTER
   =========================================================== */

function showFavouriteMachines() {
    App.filteredFleet = App.fleet.filter(
        machine =>
            App.favourites.has(machine.id)
    );

    App.filteredFleet =
        sortFleet(App.filteredFleet);

    renderDashboard();
    renderFleet();
}


/* ===========================================================
   DASHBOARD RESET
   =========================================================== */

function resetDashboardView() {
    resetFilters();
}


/* ===========================================================
   MACHINE CARD RENDERING
   =========================================================== */


/* ===========================================================
   RENDER FLEET
   =========================================================== */

function renderFleet() {
    if (!DOM.fleetGrid) return;

    if (!App.filteredFleet.length) {
        renderEmptyFleetState();
        return;
    }

    DOM.fleetGrid.innerHTML = App.filteredFleet
        .map(createMachineCard)
        .join("");

    registerMachineCardEvents();

    App.filteredFleet
        .filter(machine => machine.isBoomlift)
        .forEach(drawReachGraph);
}


/* ===========================================================
   CREATE MACHINE CARD
   =========================================================== */

function createMachineCard(machine) {
    const isFavourite =
        App.favourites.has(machine.id);

    const isCompared =
        App.comparison.has(machine.id);

    const image = getMachineImage(machine);

    const manufacturer =
        machine.manufacturer ||
        "Unknown";

    const model =
        machine.model ||
        machine.name;

    const description =
        machine.description ||
        machine.category ||
        "";

    return `
        <article
            class="machine-card"
            data-machine-id="${escapeHTML(machine.id)}"
        >

            <div class="machine-image">

                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(machine.name)}"
                    loading="lazy"
                    onerror="this.closest('.machine-image').classList.add('image-missing'); this.remove();"
                >

                <span class="machine-category">
                    ${escapeHTML(machine.category)}
                </span>

                <button
                    class="favourite-button ${isFavourite ? "is-active" : ""}"
                    type="button"
                    data-action="favourite"
                    data-machine-id="${escapeHTML(machine.id)}"
                    aria-label="${isFavourite ? "Remove from favourites" : "Add to favourites"}"
                    title="${isFavourite ? "Remove from favourites" : "Add to favourites"}"
                >
                    ${isFavourite ? "★" : "☆"}
                </button>

            </div>


            <div class="machine-content">

                <div class="machine-heading">

                    <span class="machine-manufacturer">
                        ${escapeHTML(manufacturer)}
                    </span>

                    <h2 class="machine-title">
                        ${escapeHTML(model)}
                    </h2>

                    <p class="machine-description">
                        ${escapeHTML(description)}
                    </p>

                </div>


                <div class="quick-spec-grid">

                    ${createSpecTile(
                        "Height",
                        formatHeight(machine.maxHeight)
                    )}

                    ${createSpecTile(
                        "Reach",
                        machine.isBoomlift
                            ? formatMeasurement(machine.maxReach)
                            : "—"
                    )}

                    ${createSpecTile(
                        "Weight",
                        machine.weight || "—"
                    )}

                    ${createSpecTile(
                        "Capacity",
                        machine.platformCapacity || "—"
                    )}

                </div>


                <details class="machine-details">

                    <summary>
                        More Specifications
                    </summary>

                    <div class="machine-specifications">

                        ${createSpecificationRow(
                            "Category",
                            machine.category
                        )}

                        ${createSpecificationRow(
                            "Manufacturer",
                            manufacturer
                        )}

                        ${createSpecificationRow(
                            "Model",
                            machine.model || "—"
                        )}

                        ${createSpecificationRow(
                            "Length",
                            machine.dimensions?.length || "—"
                        )}

                        ${createSpecificationRow(
                            "Width",
                            machine.dimensions?.width || "—"
                        )}

                        ${createSpecificationRow(
                            "Transport Height",
                            machine.dimensions?.height || "—"
                        )}

                        ${createSpecificationRow(
                            "Weight",
                            machine.weight || "—"
                        )}

                        ${createSpecificationRow(
                            "Platform Capacity",
                            machine.platformCapacity || "—"
                        )}

                        ${createSpecificationRow(
                            "Power Source",
                            machine.powerSource || "—"
                        )}

                        ${createSpecificationRow(
                            "Indoor Use",
                            formatBoolean(machine.indoor)
                        )}

                        ${createSpecificationRow(
                            "Outdoor Use",
                            formatBoolean(machine.outdoor)
                        )}

                        ${
                            machine.isBoomlift
                                ? createSpecificationRow(
                                    "Up & Over Clearance",
                                    formatMeasurement(
                                        machine.upAndOver
                                    )
                                )
                                : ""
                        }

                    </div>

                    ${
                        machine.isBoomlift
                            ? createReachGraphSection(machine)
                            : ""
                    }

                </details>


              


                <div class="machine-actions">

                    <button
                        type="button"
                        class="card-action favourite-action ${isFavourite ? "is-active" : ""}"
                        data-action="favourite"
                        data-machine-id="${escapeHTML(machine.id)}"
                    >
                        ${isFavourite ? "★ Favourited" : "☆ Favourite"}
                    </button>

                    <button
                        type="button"
                        class="card-action compare-action ${isCompared ? "is-active" : ""}"
                        data-action="compare"
                        data-machine-id="${escapeHTML(machine.id)}"
                    >
                        ${isCompared ? "✓ Comparing" : "Compare"}
                    </button>

                    ${createDatasheetButton(machine)}

                </div>

            </div>

        </article>
    `;
}


/* ===========================================================
   QUICK SPEC TILE
   =========================================================== */

function createSpecTile(label, value) {
    return `
        <div class="quick-spec">

            <span class="quick-spec-label">
                ${escapeHTML(label)}
            </span>

            <strong class="quick-spec-value">
                ${escapeHTML(value)}
            </strong>

        </div>
    `;
}


/* ===========================================================
   SPECIFICATION ROW
   =========================================================== */

function createSpecificationRow(label, value) {
    return `
        <div class="spec-row">

            <span class="spec-name">
                ${escapeHTML(label)}
            </span>

            <strong class="spec-value">
                ${escapeHTML(value || "—")}
            </strong>

        </div>
    `;
}


/* ===========================================================
   REACH GRAPH SECTION
   =========================================================== */

function createReachGraphSection(machine) {
    return `
        <section class="reach-card">

            <div class="reach-card-header">

                <div>

                    <span class="reach-eyebrow">
                        Performance
                    </span>

                    <h3>
                        Reach Envelope
                    </h3>

                </div>

                <div class="reach-summary">

                    <span>
                        ${formatHeight(machine.maxHeight)}
                        <small>Height</small>
                    </span>

                    <span>
                        ${formatMeasurement(machine.maxReach)}
                        <small>Reach</small>
                    </span>

                </div>

            </div>

            <canvas
                id="reach-${escapeHTML(machine.id)}"
                class="reach-canvas"
                aria-label="Reach envelope for ${escapeHTML(machine.name)}"
            ></canvas>

        </section>
    `;
}


/* ===========================================================
   DATASHEET BUTTON
   =========================================================== */

function createDatasheetButton(machine) {
    if (!machine.datasheet) {
        return `
            <button
                type="button"
                class="card-action datasheet-action"
                disabled
            >
                Spec Sheet
            </button>
        `;
    }

    return `
        <a
            class="card-action datasheet-action"
            href="${escapeHTML(machine.datasheet)}"
            target="_blank"
            rel="noopener noreferrer"
        >
            Spec Sheet
        </a>
    `;
}


/* ===========================================================
   MACHINE CARD EVENTS
   =========================================================== */

function registerMachineCardEvents() {
    if (!DOM.fleetGrid) return;

    DOM.fleetGrid
        .querySelectorAll(
            "[data-action='favourite']"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                handleFavouriteAction
            );
        });

    DOM.fleetGrid
        .querySelectorAll(
            "[data-action='compare']"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                handleCompareAction
            );
        });
}


/* ===========================================================
   FAVOURITE ACTION
   =========================================================== */

function handleFavouriteAction(event) {
    const machineId = event.currentTarget.dataset.machineId;
    if (!machineId) return;

    toggleFavourite(machineId);
    renderDashboard();
    renderFleet();
}


/* ===========================================================
   COMPARE ACTION
   =========================================================== */

function handleCompareAction(event) {
    const machineId = event.currentTarget.dataset.machineId;
    if (!machineId) return;

    if (!toggleComparison(machineId)) {
        showCompareLimitMessage();
        return;
    }

    renderDashboard();
    renderFleet();
    renderComparisonBar();
}


/* ===========================================================
   COMPARE LIMIT
   =========================================================== */

function showCompareLimitMessage() {
    showToast(
        `You can compare up to ${App.settings.maxCompare} machines at once.`
    );
}


/* ===========================================================
   EMPTY STATE
   =========================================================== */

function renderEmptyFleetState() {
    DOM.fleetGrid.innerHTML = `
        <div class="fleet-empty-state">

            <div class="fleet-empty-icon">
                ⌕
            </div>

            <h2>
                No machines found
            </h2>

            <p>
                Try adjusting your search or filters.
            </p>

            <button
                type="button"
                id="emptyResetFilters"
            >
                Reset Filters
            </button>

        </div>
    `;

    document
        .getElementById(
            "emptyResetFilters"
        )
        ?.addEventListener(
            "click",
            resetFilters
        );
}


/* ===========================================================
   CARD FORMAT HELPERS
   =========================================================== */

function formatHeight(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    if (App.settings.heightUnits === "feet") {
        return `${(number * 3.28084).toFixed(1)} ft`;
    }

    return `${number} m`;
}


function formatMeasurement(value) {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return `${number} m`;
}

function formatBoolean(value) {
    if (value === true) {
        return "Yes";
    }

    if (value === false) {
        return "No";
    }

    return "—";
}


/* ===========================================================
   HTML SAFETY
   =========================================================== */

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
/* ===========================================================
   MACHINE COMPARISON
   =========================================================== */


/* ===========================================================
   RENDER COMPARISON BAR
   =========================================================== */

function renderComparisonBar() {
    let bar = document.getElementById("comparisonBar");

    if (!App.comparison.size) {
        bar?.remove();
        closeComparisonModal();
        return;
    }

    if (!bar) {
        bar = document.createElement("div");
        bar.id = "comparisonBar";
        bar.className = "comparison-bar";

        document.body.appendChild(bar);
    }

    const machines = getComparedMachines();

    bar.innerHTML = `
        <div class="comparison-bar-inner">

            <div class="comparison-summary">

                <strong>
                    Compare Machines
                </strong>

                <span>
                    ${machines.length} of ${App.settings.maxCompare} selected
                </span>

            </div>

            <div class="comparison-machines">

                ${machines
                    .map(createComparisonChip)
                    .join("")}

            </div>

            <div class="comparison-actions">

                <button
                    type="button"
                    class="comparison-clear"
                    id="clearComparison"
                >
                    Clear
                </button>

                <button
                    type="button"
                    class="comparison-open"
                    id="openComparison"
                    ${machines.length < 2 ? "disabled" : ""}
                >
                    Compare
                </button>

            </div>

        </div>
    `;

    registerComparisonBarEvents();
}


/* ===========================================================
   COMPARED MACHINES
   =========================================================== */

function getComparedMachines() {
    return [...App.comparison]
        .map(id =>
            App.fleet.find(
                machine => machine.id === id
            )
        )
        .filter(Boolean);
}


/* ===========================================================
   COMPARISON CHIP
   =========================================================== */

function createComparisonChip(machine) {
    return `
        <div
            class="comparison-chip"
            data-machine-id="${escapeHTML(machine.id)}"
        >

            <span>
                ${escapeHTML(
                    machine.model ||
                    machine.name
                )}
            </span>

            <button
                type="button"
                data-remove-comparison="${escapeHTML(machine.id)}"
                aria-label="Remove ${escapeHTML(machine.name)} from comparison"
            >
                ×
            </button>

        </div>
    `;
}


/* ===========================================================
   COMPARISON BAR EVENTS
   =========================================================== */

function registerComparisonBarEvents() {
    document
        .getElementById("clearComparison")
        ?.addEventListener(
            "click",
            clearComparison
        );

    document
        .getElementById("openComparison")
        ?.addEventListener(
            "click",
            openComparisonModal
        );

    document
        .querySelectorAll(
            "[data-remove-comparison]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                removeComparisonMachine
            );
        });
}


/* ===========================================================
   REMOVE MACHINE FROM COMPARISON
   =========================================================== */

function removeComparisonMachine(event) {
    const machineId = event.currentTarget.dataset.removeComparison;
    if (!machineId) return;

    App.comparison.delete(machineId);
    saveComparison();

    renderDashboard();
    renderFleet();
    renderComparisonBar();
}


/* ===========================================================
   CLEAR COMPARISON
   =========================================================== */

function clearComparison() {
    App.comparison.clear();
    saveComparison();

    renderDashboard();
    renderFleet();
    renderComparisonBar();
}


/* ===========================================================
   OPEN COMPARISON MODAL
   =========================================================== */

function openComparisonModal() {
    const machines = getComparedMachines();

    if (machines.length < 2) {
        return;
    }

    closeComparisonModal();

    const modal =
        document.createElement("div");

    modal.id = "comparisonModal";
    modal.className = "comparison-modal";

    modal.innerHTML = `
        <div
            class="comparison-modal-backdrop"
            data-close-comparison
        ></div>

        <section
            class="comparison-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comparisonModalTitle"
        >

            <header class="comparison-modal-header">

                <div>

                    <span class="comparison-eyebrow">
                        Fleet Comparison
                    </span>

                    <h2 id="comparisonModalTitle">
                        Machine Comparison
                    </h2>

                </div>

                <button
                    type="button"
                    class="comparison-modal-close"
                    data-close-comparison
                    aria-label="Close comparison"
                >
                    ×
                </button>

            </header>

            <div class="comparison-table-wrapper">

                ${createComparisonTable(machines)}

            </div>

        </section>
    `;

    document.body.appendChild(modal);

    document.body.classList.add(
        "comparison-modal-open"
    );

    registerComparisonModalEvents();
}


/* ===========================================================
   CLOSE COMPARISON MODAL
   =========================================================== */

function closeComparisonModal() {
    document
        .getElementById("comparisonModal")
        ?.remove();

    document.body.classList.remove(
        "comparison-modal-open"
    );
}


/* ===========================================================
   COMPARISON MODAL EVENTS
   =========================================================== */

function registerComparisonModalEvents() {
    document
        .querySelectorAll(
            "[data-close-comparison]"
        )
        .forEach(element => {
            element.addEventListener(
                "click",
                closeComparisonModal
            );
        });

    document.addEventListener(
        "keydown",
        handleComparisonEscape,
        { once: true }
    );
}


/* ===========================================================
   ESCAPE KEY
   =========================================================== */

function handleComparisonEscape(event) {
    if (event.key === "Escape") {
        closeComparisonModal();
        return;
    }

    if (
        document.getElementById(
            "comparisonModal"
        )
    ) {
        document.addEventListener(
            "keydown",
            handleComparisonEscape,
            { once: true }
        );
    }
}


/* ===========================================================
   CREATE COMPARISON TABLE
   =========================================================== */

function createComparisonTable(machines) {
    const rows = [
        {
            label: "Manufacturer",
            getValue: machine =>
                machine.manufacturer || "—"
        },
        {
            label: "Model",
            getValue: machine =>
                machine.model || "—"
        },
        {
            label: "Category",
            getValue: machine =>
                machine.category || "—"
        },
        {
            label: "Height",
            getValue: machine =>
                formatHeight(
                    machine.maxHeight
                )
        },
        {
            label: "Horizontal Reach",
            getValue: machine =>
                machine.isBoomlift
                    ? formatMeasurement(
                        machine.maxReach
                    )
                    : "—"
        },
        {
            label: "Up & Over",
            getValue: machine =>
                machine.isBoomlift
                    ? formatMeasurement(
                        machine.upAndOver
                    )
                    : "—"
        },
        {
            label: "Platform Capacity",
            getValue: machine =>
                machine.platformCapacity ||
                "—"
        },
        {
            label: "Weight",
            getValue: machine =>
                machine.weight || "—"
        },
        {
            label: "Length",
            getValue: machine =>
                machine.dimensions?.length ||
                "—"
        },
        {
            label: "Width",
            getValue: machine =>
                machine.dimensions?.width ||
                "—"
        },
        {
            label: "Transport Height",
            getValue: machine =>
                machine.dimensions?.height ||
                "—"
        },
        {
            label: "Power Source",
            getValue: machine =>
                machine.powerSource || "—"
        },
        {
            label: "Indoor Use",
            getValue: machine =>
                formatBoolean(
                    machine.indoor
                )
        },
        {
            label: "Outdoor Use",
            getValue: machine =>
                formatBoolean(
                    machine.outdoor
                )
        }
    ];

    return `
        <table class="comparison-table">

            <thead>

                <tr>

                    <th>
                        Specification
                    </th>

                    ${machines
                        .map(
                            machine => `
                                <th>

                                    <div class="comparison-machine-heading">

                                        <span>
                                            ${escapeHTML(
                                                machine.manufacturer ||
                                                ""
                                            )}
                                        </span>

                                        <strong>
                                            ${escapeHTML(
                                                machine.model ||
                                                machine.name
                                            )}
                                        </strong>

                                    </div>

                                </th>
                            `
                        )
                        .join("")}

                </tr>

            </thead>

            <tbody>

                ${rows
                    .map(row =>
                        createComparisonRow(
                            row.label,
                            machines,
                            row.getValue
                        )
                    )
                    .join("")}

            </tbody>

        </table>
    `;
}


/* ===========================================================
   CREATE COMPARISON ROW
   =========================================================== */

function createComparisonRow(
    label,
    machines,
    getValue
) {
    return `
        <tr>

            <th scope="row">
                ${escapeHTML(label)}
            </th>

            ${machines
                .map(
                    machine => `
                        <td>
                            ${escapeHTML(
                                getValue(machine)
                            )}
                        </td>
                    `
                )
                .join("")}

        </tr>
    `;
}
/* ===========================================================
   REACH ENVELOPE GRAPHS
   =========================================================== */


/* ===========================================================
   DRAW ALL VISIBLE REACH GRAPHS
   =========================================================== */

function redrawReachGraphs() {
    App.filteredFleet
        .filter(machine => machine.isBoomlift)
        .forEach(drawReachGraph);
}


/* ===========================================================
   DRAW REACH GRAPH
   =========================================================== */

function drawReachGraph(machine) {
    const canvas = document.getElementById(
        `reach-${machine.id}`
    );

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    const width =
        canvas.clientWidth ||
        canvas.parentElement?.clientWidth ||
        320;

    const height = 260;

    setupCanvas(canvas, context, width, height);

    const graph = createGraphDimensions(
        width,
        height,
        machine
    );

    drawGraphBackground(
        context,
        graph
    );

    drawGrid(
        context,
        graph
    );

    drawAxes(
        context,
        graph
    );

    drawEnvelope(
        context,
        graph,
        machine
    );

    drawGraphLegend(
        context,
        graph,
        machine
    );
}


/* ===========================================================
   HIGH DPI CANVAS SETUP
   =========================================================== */

function setupCanvas(
    canvas,
    context,
    width,
    height
) {
    const pixelRatio =
        window.devicePixelRatio || 1;

    canvas.width =
        Math.round(width * pixelRatio);

    canvas.height =
        Math.round(height * pixelRatio);

    canvas.style.width =
        `${width}px`;

    canvas.style.height =
        `${height}px`;

    context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
    );

    context.clearRect(
        0,
        0,
        width,
        height
    );
}


/* ===========================================================
   GRAPH DIMENSIONS
   =========================================================== */

function createGraphDimensions(
    width,
    height,
    machine
) {
    const padding = {
        top: 24,
        right: 22,
        bottom: 38,
        left: 46
    };

    const maxHeight =
        getGraphMaximum(
            machine.maxHeight,
            5,
            10
        );

    const maxReach =
        getGraphMaximum(
            machine.maxReach,
            2,
            6
        );

    const graphWidth =
        width -
        padding.left -
        padding.right;

    const graphHeight =
        height -
        padding.top -
        padding.bottom;

    return {
        width,
        height,

        padding,

        graphWidth,
        graphHeight,

        maxHeight,
        maxReach,

        scaleX:
            graphWidth /
            maxReach,

        scaleY:
            graphHeight /
            maxHeight,

        originX:
            padding.left,

        originY:
            height -
            padding.bottom
    };
}


/* ===========================================================
   GRAPH MAXIMUM HELPER
   =========================================================== */

function getGraphMaximum(
    value,
    step,
    minimum
) {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return minimum;
    }

    return Math.max(
        Math.ceil(number / step) * step,
        minimum
    );
}


/* ===========================================================
   GRAPH BACKGROUND
   =========================================================== */

function drawGraphBackground(
    context,
    graph
) {
    context.save();

    context.fillStyle =
        "#ffffff";

    context.fillRect(
        0,
        0,
        graph.width,
        graph.height
    );

    context.restore();
}


/* ===========================================================
   GRID
   =========================================================== */

function drawGrid(
    context,
    graph
) {
    context.save();

    context.strokeStyle =
        "#ececec";

    context.lineWidth = 1;

    context.fillStyle =
        "#777777";

    context.font =
        '10px "Segoe UI", Arial, sans-serif';

    drawVerticalGridLines(
        context,
        graph
    );

    drawHorizontalGridLines(
        context,
        graph
    );

    context.restore();
}


/* ===========================================================
   VERTICAL GRID LINES
   =========================================================== */

function drawVerticalGridLines(
    context,
    graph
) {
    const step =
        graph.maxReach > 20
            ? 5
            : 2;

    context.textAlign =
        "center";

    context.textBaseline =
        "top";

    for (
        let reach = 0;
        reach <= graph.maxReach;
        reach += step
    ) {
        const x =
            graph.originX +
            reach *
            graph.scaleX;

        context.beginPath();

        context.moveTo(
            x,
            graph.padding.top
        );

        context.lineTo(
            x,
            graph.originY
        );

        context.stroke();

        context.fillText(
            `${reach}m`,
            x,
            graph.originY + 8
        );
    }
}


/* ===========================================================
   HORIZONTAL GRID LINES
   =========================================================== */

function drawHorizontalGridLines(
    context,
    graph
) {
    const step =
        graph.maxHeight > 30
            ? 10
            : 5;

    context.textAlign =
        "right";

    context.textBaseline =
        "middle";

    for (
        let height = 0;
        height <= graph.maxHeight;
        height += step
    ) {
        const y =
            graph.originY -
            height *
            graph.scaleY;

        context.beginPath();

        context.moveTo(
            graph.originX,
            y
        );

        context.lineTo(
            graph.width -
            graph.padding.right,
            y
        );

        context.stroke();

        context.fillText(
            `${height}m`,
            graph.originX - 8,
            y
        );
    }
}


/* ===========================================================
   AXES
   =========================================================== */

function drawAxes(
    context,
    graph
) {
    context.save();

    context.strokeStyle =
        "#333333";

    context.lineWidth =
        1.5;

    context.beginPath();

    context.moveTo(
        graph.originX,
        graph.padding.top
    );

    context.lineTo(
        graph.originX,
        graph.originY
    );

    context.lineTo(
        graph.width -
        graph.padding.right,
        graph.originY
    );

    context.stroke();


    context.fillStyle =
        "#555555";

    context.font =
        '11px "Segoe UI", Arial, sans-serif';

    context.textAlign =
        "center";

    context.fillText(
        "Horizontal Reach",
        graph.originX +
        graph.graphWidth / 2,
        graph.height - 7
    );

    context.save();

    context.translate(
        13,
        graph.padding.top +
        graph.graphHeight / 2
    );

    context.rotate(
        -Math.PI / 2
    );

    context.fillText(
        "Height",
        0,
        0
    );

    context.restore();

    context.restore();
}


/* ===========================================================
   DRAW ENVELOPE
   =========================================================== */

function drawEnvelope(
    context,
    graph,
    machine
) {
    const height =
        getNumericValue(
            machine.maxHeight
        );

    const reach =
        getNumericValue(
            machine.maxReach
        );

    const upAndOver =
        getNumericValue(
            machine.upAndOver
        );

    if (!height || !reach) {
        drawGraphUnavailable(
            context,
            graph
        );

        return;
    }

    const points =
        createEnvelopePoints(
            graph,
            height,
            reach,
            upAndOver
        );

    context.save();

    context.fillStyle =
        "rgba(244, 176, 0, 0.16)";

    context.strokeStyle =
        "#f4b000";

    context.lineWidth = 2.5;

    context.lineJoin =
        "round";

    context.lineCap =
        "round";

    context.beginPath();

    context.moveTo(
        points.base.x,
        points.base.y
    );

    context.lineTo(
        points.upAndOver.x,
        points.upAndOver.y
    );

    context.bezierCurveTo(
        points.controlTopLeft.x,
        points.controlTopLeft.y,

        points.controlTopRight.x,
        points.controlTopRight.y,

        points.peak.x,
        points.peak.y
    );

    context.bezierCurveTo(
        points.controlReachTop.x,
        points.controlReachTop.y,

        points.controlReachRight.x,
        points.controlReachRight.y,

        points.maximumReach.x,
        points.maximumReach.y
    );

    context.bezierCurveTo(
        points.controlLowerRight.x,
        points.controlLowerRight.y,

        points.controlLowerLeft.x,
        points.controlLowerLeft.y,

        points.lowerReturn.x,
        points.lowerReturn.y
    );

    context.lineTo(
        points.base.x,
        points.base.y
    );

    context.closePath();

    context.fill();
    context.stroke();

    drawEnvelopeMarkers(
        context,
        graph,
        machine,
        points
    );

    context.restore();
}


/* ===========================================================
   ENVELOPE POINT CALCULATION
   =========================================================== */

function createEnvelopePoints(
    graph,
    height,
    reach,
    upAndOver
) {
    const x =
        value =>
            graph.originX +
            value *
            graph.scaleX;

    const y =
        value =>
            graph.originY -
            value *
            graph.scaleY;

    const effectiveUpAndOver =
        Math.max(
            0,
            Math.min(
                upAndOver,
                height
            )
        );

    return {
        base: {
            x: x(0),
            y: y(0)
        },

        upAndOver: {
            x: x(0),
            y: y(effectiveUpAndOver)
        },

        peak: {
            x: x(reach * 0.36),
            y: y(height)
        },

        maximumReach: {
            x: x(reach),
            y: y(height * 0.62)
        },

        lowerReturn: {
            x: x(reach * 0.68),
            y: y(height * 0.12)
        },

        controlTopLeft: {
            x: x(reach * 0.03),
            y: y(height * 0.92)
        },

        controlTopRight: {
            x: x(reach * 0.18),
            y: y(height)
        },

        controlReachTop: {
            x: x(reach * 0.72),
            y: y(height)
        },

        controlReachRight: {
            x: x(reach),
            y: y(height * 0.82)
        },

        controlLowerRight: {
            x: x(reach),
            y: y(height * 0.28)
        },

        controlLowerLeft: {
            x: x(reach * 0.82),
            y: y(height * 0.15)
        }
    };
}


/* ===========================================================
   ENVELOPE MARKERS
   =========================================================== */

function drawEnvelopeMarkers(
    context,
    graph,
    machine,
    points
) {
    drawGraphMarker(
        context,
        points.peak,
        `Max Height ${formatHeight(
            machine.maxHeight
        )}`,
        "top"
    );

    drawGraphMarker(
        context,
        points.maximumReach,
        `Max Reach ${formatMeasurement(
            machine.maxReach
        )}`,
        "right"
    );

    if (
        getNumericValue(
            machine.upAndOver
        ) > 0
    ) {
        drawGraphMarker(
            context,
            points.upAndOver,
            `Up & Over ${formatMeasurement(
                machine.upAndOver
            )}`,
            "right"
        );
    }
}


/* ===========================================================
   GRAPH MARKER
   =========================================================== */

function drawGraphMarker(
    context,
    point,
    label,
    position = "right"
) {
    context.save();

    context.fillStyle =
        "#f4b000";

    context.beginPath();

    context.arc(
        point.x,
        point.y,
        4,
        0,
        Math.PI * 2
    );

    context.fill();


    context.font =
        '600 10px "Segoe UI", Arial, sans-serif';

    context.fillStyle =
        "#333333";

    if (position === "top") {
        context.textAlign =
            "center";

        context.textBaseline =
            "bottom";

        context.fillText(
            label,
            point.x,
            point.y - 8
        );
    } else {
        context.textAlign =
            "left";

        context.textBaseline =
            "middle";

        context.fillText(
            label,
            point.x + 8,
            point.y
        );
    }

    context.restore();
}


/* ===========================================================
   GRAPH LEGEND
   =========================================================== */

function drawGraphLegend(
    context,
    graph,
    machine
) {
    context.save();

    context.font =
        '10px "Segoe UI", Arial, sans-serif';

    context.textAlign =
        "right";

    context.textBaseline =
        "top";

    context.fillStyle =
        "#888888";

    context.fillText(
        "Indicative reach envelope",
        graph.width -
        graph.padding.right,
        6
    );

    context.restore();
}


/* ===========================================================
   GRAPH UNAVAILABLE
   =========================================================== */

function drawGraphUnavailable(
    context,
    graph
) {
    context.save();

    context.fillStyle =
        "#888888";

    context.font =
        '13px "Segoe UI", Arial, sans-serif';

    context.textAlign =
        "center";

    context.textBaseline =
        "middle";

    context.fillText(
        "Reach data unavailable",
        graph.width / 2,
        graph.height / 2
    );

    context.restore();
}
/* ===========================================================
   FAVOURITES + PERSISTENCE + UTILITIES
   =========================================================== */


/* ===========================================================
   STORAGE KEYS
   =========================================================== */

const STORAGE_KEYS = {
    favourites: "flexihire-favourites",
    comparison: "flexihire-comparison"
};


/* ===========================================================
   RESTORE FAVOURITES
   =========================================================== */

function restoreFavourites() {
    App.favourites = new Set(
        readStoredArray(
            STORAGE_KEYS.favourites
        )
    );
}


/* ===========================================================
   SAVE FAVOURITES
   =========================================================== */

function saveFavourites() {
    writeStoredArray(
        STORAGE_KEYS.favourites,
        [...App.favourites]
    );
}


/* ===========================================================
   RESTORE COMPARISON
   =========================================================== */

function restoreComparison() {
    const storedIds =
        readStoredArray(
            STORAGE_KEYS.comparison
        );

    App.comparison = new Set(
        storedIds.slice(
            0,
            App.settings.maxCompare
        )
    );
}


/* ===========================================================
   SAVE COMPARISON
   =========================================================== */

function saveComparison() {
    writeStoredArray(
        STORAGE_KEYS.comparison,
        [...App.comparison]
    );
}


/* ===========================================================
   READ STORED ARRAY
   =========================================================== */

function readStoredArray(key) {
    try {
        const value =
            JSON.parse(
                localStorage.getItem(key) ||
                "[]"
            );

        return Array.isArray(value)
            ? value
            : [];
    } catch {
        return [];
    }
}


/* ===========================================================
   WRITE STORED ARRAY
   =========================================================== */

function writeStoredArray(
    key,
    value
) {
    try {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    } catch (error) {
        console.warn(
            `Unable to save ${key}:`,
            error
        );
    }
}


/* ===========================================================
   VALIDATE STORED MACHINE IDS
   =========================================================== */

function cleanStoredMachineIds() {
    const validIds = new Set(
        App.fleet.map(
            machine => machine.id
        )
    );

    App.favourites = new Set(
        [...App.favourites].filter(
            id => validIds.has(id)
        )
    );

    App.comparison = new Set(
        [...App.comparison]
            .filter(
                id => validIds.has(id)
            )
            .slice(
                0,
                App.settings.maxCompare
            )
    );

    saveFavourites();
    saveComparison();
}


/* ===========================================================
   TOGGLE FAVOURITE
   =========================================================== */

function toggleFavourite(machineId) {
    if (!machineId) return;

    if (
        App.favourites.has(machineId)
    ) {
        App.favourites.delete(
            machineId
        );
    } else {
        App.favourites.add(
            machineId
        );
    }

    saveFavourites();
}


/* ===========================================================
   TOGGLE COMPARISON
   =========================================================== */

function toggleComparison(machineId) {
    if (!machineId) {
        return false;
    }

    if (
        App.comparison.has(machineId)
    ) {
        App.comparison.delete(
            machineId
        );

        saveComparison();

        return true;
    }

    if (
        App.comparison.size >=
        App.settings.maxCompare
    ) {
        return false;
    }

    App.comparison.add(
        machineId
    );

    saveComparison();

    return true;
}


/* ===========================================================
   MACHINE LOOKUP
   =========================================================== */

function getMachineById(machineId) {
    return App.fleet.find(
        machine =>
            machine.id === machineId
    ) || null;
}


/* ===========================================================
   UNIQUE VALUES
   =========================================================== */

function getUniqueValues(
    key
) {
    return [
        ...new Set(
            App.fleet
                .map(
                    machine =>
                        machine[key]
                )
                .filter(Boolean)
        )
    ].sort(
        (a, b) =>
            String(a)
                .localeCompare(
                    String(b),
                    undefined,
                    {
                        numeric: true,
                        sensitivity: "base"
                    }
                )
    );
}


/* ===========================================================
   DIMENSION HELPER
   =========================================================== */

function getDimension(
    machine,
    dimension
) {
    return (
        machine?.dimensions?.[
            dimension
        ] ||
        "—"
    );
}


/* ===========================================================
   FORMAT NUMBER
   =========================================================== */

function formatNumber(
    value,
    maximumDecimals = 2
) {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return new Intl.NumberFormat(
        "en-AU",
        {
            maximumFractionDigits:
                maximumDecimals
        }
    ).format(number);
}


/* ===========================================================
   FORMAT METRES
   =========================================================== */

function formatMetres(value) {
    const formatted =
        formatNumber(value, 2);

    return formatted === "—"
        ? "—"
        : `${formatted} m`;
}


/* ===========================================================
   FORMAT WEIGHT
   =========================================================== */

function formatWeight(value) {
    if (!value) {
        return "—";
    }

    if (
        typeof value === "string"
    ) {
        return value;
    }

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return `${formatNumber(
        number,
        0
    )} kg`;
}


/* ===========================================================
   CATEGORY SLUG
   =========================================================== */

function slugify(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        );
}


/* ===========================================================
   MACHINE DISPLAY NAME
   =========================================================== */

function getMachineDisplayName(
    machine
) {
    if (!machine) {
        return "";
    }

    if (
        machine.manufacturer &&
        machine.model
    ) {
        return `${machine.manufacturer} ${machine.model}`;
    }

    return machine.name || "";
}


/* ===========================================================
   DATASHEET AVAILABILITY
   =========================================================== */

function hasDatasheet(machine) {
    return Boolean(
        machine?.datasheet &&
        String(
            machine.datasheet
        ).trim()
    );
}


/* ===========================================================
   ENVIRONMENT LABEL
   =========================================================== */

function getEnvironmentLabel(
    machine
) {
    const indoor =
        machine?.indoor === true;

    const outdoor =
        machine?.outdoor === true;

    if (indoor && outdoor) {
        return "Indoor / Outdoor";
    }

    if (indoor) {
        return "Indoor";
    }

    if (outdoor) {
        return "Outdoor";
    }

    return "—";
}


/* ===========================================================
   SCROLL HELPER
   =========================================================== */

function scrollToFleet() {
    DOM.fleetGrid?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


/* ===========================================================
   UI MESSAGE
   =========================================================== */

function showToast(
    message,
    duration = 2500
) {
    document
        .querySelector(
            ".app-toast"
        )
        ?.remove();

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        "app-toast";

    toast.textContent =
        message;

    document.body.appendChild(
        toast
    );

    requestAnimationFrame(() => {
        toast.classList.add(
            "is-visible"
        );
    });

    window.setTimeout(() => {
        toast.classList.remove(
            "is-visible"
        );

        window.setTimeout(
            () => toast.remove(),
            250
        );
    }, duration);
}


/* ===========================================================
   SAFER IMAGE PATH
   =========================================================== */

function getMachineImage(
    machine
) {
    if (
        machine?.image &&
        String(machine.image).trim()
    ) {
        return machine.image;
    }

    return `images/${machine.id}.jpg`;
}


/* ===========================================================
   REQUEST RENDER
   =========================================================== */

function refreshApp() {
    applyFilters();
    renderComparisonBar();
}


/* ===========================================================
   SERVICE WORKER
   =========================================================== */

async function registerServiceWorker() {
    if (
        !("serviceWorker" in navigator)
    ) {
        return;
    }

    try {
        await navigator
            .serviceWorker
            .register(
                "service-worker.js"
            );
    } catch (error) {
        console.warn(
            "Service worker registration failed:",
            error
        );
    }
}
