// Chart 2: Injury share by state and territory (Choropleth Map)
// High-intensity, high-contrast color scale with direct on-map share labels

const AUSTRALIAN_STATES_URL = 'https://raw.githubusercontent.com/rowanhogan/australian-states/master/states.geojson';

const STATE_CODES = {
  'New South Wales': 'NSW',
  'Northern Territory': 'NT',
  'Queensland': 'Qld',
  'South Australia': 'SA',
  'Tasmania': 'Tas',
  'Victoria': 'Vic',
  'Western Australia': 'WA',
  'Australian Capital Territory': 'ACT'
};

// ABS 2021 Estimated Resident Population (ERP) for population context and per-100k calculations
const STATE_POPULATIONS = {
  'NSW': 8095000,
  'Vic': 6550000,
  'Qld': 5220000,
  'WA': 2760000,
  'SA': 1800000,
  'Tas': 570000,
  'ACT': 454000,
  'NT': 250000
};

let australianStates;

function loadAustralianStates() {
  if (!australianStates) {
    australianStates = fetch(AUSTRALIAN_STATES_URL).then(response => {
      if (!response.ok) throw new Error(`Unable to load Australian state boundaries (${response.status})`);
      return response.json();
    });
  }
  return australianStates;
}

// High-contrast, 5-grade stepped color palette for choropleth mapping
// Ranging from soft lime-yellow (Grade 1) to deep midnight navy (Grade 5)
const COLOR_GRADES = [
  '#edf8b1', // Grade 1 (0 – 20% of max): soft lime-yellow
  '#7fcdbb', // Grade 2 (20 – 40% of max): fresh seafoam turquoise
  '#1d91c0', // Grade 3 (40 – 60% of max): electric cyan-blue
  '#225ea8', // Grade 4 (60 – 80% of max): rich royal cobalt
  '#081d58'  // Grade 5 (80 – 100% of max): deep midnight navy
];

function getNiceCeil(val) {
  if (val <= 1.5) return 1.5;
  if (val <= 3) return 3;
  if (val <= 6) return 6;
  if (val <= 12) return 12;
  if (val <= 15) return 15;
  if (val <= 25) return 25;
  if (val <= 35) return 35;
  if (val <= 50) return 50;
  if (val <= 60) return 60;
  return Math.ceil(val / 10) * 10;
}

window.renderChoroplethMap = function (data) {
  const { G20 } = window;
  const svg = G20.clear('#mapChart');
  const [width, height] = G20.size(svg);

  const yearInput = document.querySelector('#q2Year');
  const userSelect = document.querySelector('#q2Select');
  const year = (yearInput && yearInput.value && !isNaN(+yearInput.value)) ? +yearInput.value : 2021;
  const user = (userSelect && userSelect.value) ? userSelect.value : (data[0]?.['road user'] || 'Car driver, passenger or unknown position');

  // Fixed max percentage across ALL years for the selected road user
  // Guarantees stable, fixed color grading across years so differences stand out and comparisons are valid
  const userPublishedAllYears = data.filter(row => row['road user'] === user && row.Status === 'Published');
  const maxShareAllYears = userPublishedAllYears.length
    ? Math.max(...userPublishedAllYears.map(row => G20.number(row['Percent share'])))
    : 1;
  const maxCeil = getNiceCeil(maxShareAllYears);
  const step = maxCeil / 5;

  const getGradeIndex = val => {
    if (val <= 0) return 0;
    const idx = Math.floor(val / step);
    return Math.min(4, Math.max(0, idx));
  };

  const rows = data.filter(row => +row['calendar year'] === year && row['road user'] === user);
  const published = rows.filter(row => row.Status === 'Published');

  const yearOut = document.querySelector('#q2YearValue');
  if (yearOut) yearOut.value = year;

  // SVG Defs for Hatch Pattern (for "Not published" states)
  const defs = G20.svg('defs', {}, svg);
  const pattern = G20.svg('pattern', {
    id: 'not-published-hatch',
    width: '8',
    height: '8',
    patternTransform: 'rotate(45 0 0)',
    patternUnits: 'userSpaceOnUse'
  }, defs);
  G20.svg('rect', { width: '8', height: '8', fill: '#f8fafc' }, pattern);
  G20.svg('line', {
    x1: '0',
    y1: '0',
    x2: '0',
    y2: '8',
    stroke: '#94a3b8',
    'stroke-width': '2.5'
  }, pattern);

  // Update Legend with Fixed Stepped Color Grading
  const formatStep = n => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1));
  const legendElem = document.querySelector('#mapLegend');
  if (legendElem) {
    legendElem.innerHTML = `
      <div class="map-legend-container">
        <div class="legend-header">
          <strong>Color Grading: Share of jurisdiction's total road injuries (%) — Fixed Scale: 0 to ${formatStep(maxCeil)}%</strong>
        </div>
        <div class="map-stepped-legend-row">
          <div class="map-legend-grades">
            ${COLOR_GRADES.map((col, i) => {
              const fromVal = formatStep(i * step);
              const toVal = formatStep((i + 1) * step);
              const isDarkSwatch = i >= 3;
              return `
                <div class="legend-grade-item">
                  <span class="grade-swatch" style="background:${col}; border:1px solid ${isDarkSwatch ? 'rgba(0,0,0,0.1)' : '#94a3b8'};"></span>
                  <span class="grade-label">${fromVal}–${toVal}%</span>
                </div>
              `;
            }).join('')}
          </div>
          <div class="map-legend-np-item">
            <span class="np-hatch-swatch"></span>
            <span>Not published</span>
          </div>
        </div>
      </div>
    `;
  }

  loadAustralianStates().then(geojson => {
    const projection = d3.geoMercator().fitExtent([[24, 18], [width - 24, height - 24]], geojson);
    const path = d3.geoPath(projection);

    const statesGroup = G20.svg('g', { class: 'states-group' }, svg);
    const labelsGroup = G20.svg('g', { class: 'state-labels-group' }, svg);

    geojson.features.forEach(feature => {
      const stateName = feature.properties.STATE_NAME;
      const code = STATE_CODES[stateName];
      if (!code) return;

      const row = rows.find(item => item['state or territory'] === code);
      const isNotPublished = !row || row.Status === 'Not published';
      const isPublished = !isNotPublished;
      const shareVal = row ? G20.number(row['Percent share']) : 0;
      const userCases = row ? G20.number(row['road_user_cases']) : 0;
      const totalStateCases = row ? G20.number(row['state_total_cases']) : 0;
      const gradeIdx = isPublished ? getGradeIndex(shareVal) : -1;

      // Fill using stepped color grading
      const fillColor = isPublished ? COLOR_GRADES[gradeIdx] : 'url(#not-published-hatch)';

      const statePath = G20.svg('path', {
        d: path(feature),
        fill: fillColor,
        stroke: '#ffffff',
        'stroke-width': 1.8,
        'vector-effect': 'non-scaling-stroke',
        class: 'state-polygon',
        tabindex: 0,
        role: 'img',
        'aria-label': `${stateName}: ${isPublished ? `${shareVal.toFixed(1)}% share` : 'Not published'}`
      }, statesGroup);

      // Centroid for state name & share label
      const [cx, cy] = path.centroid(feature);

      let labelX = cx;
      let labelY = cy;
      if (code === 'ACT') {
        labelX = cx + 38;
        labelY = cy - 4;
        G20.svg('line', {
          x1: cx,
          y1: cy,
          x2: labelX - 16,
          y2: labelY,
          stroke: '#1e293b',
          'stroke-width': 1.2,
          'stroke-dasharray': '2 2'
        }, labelsGroup);
      } else if (code === 'NSW') {
        labelX = cx - 18;
        labelY = cy - 8;
      }

      // High-contrast text label: light text on dark blue/navy grades (3 & 4), dark text on light grades (0, 1, 2)
      const isDarkGrade = isPublished && gradeIdx >= 3;
      const labelFill = isDarkGrade ? '#ffffff' : '#0f172a';

      // Render State Name and Share Value directly on the map
      const stateLabelG = G20.svg('text', {
        x: labelX,
        y: labelY,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        class: 'state-name-label'
      }, labelsGroup);

      // Code line
      G20.svg('tspan', {
        x: labelX,
        dy: isPublished ? '-0.5em' : '0',
        'font-weight': 800,
        'font-size': code === 'ACT' ? '12px' : '14px',
        fill: labelFill
      }, stateLabelG).textContent = code;

      // Real value line directly visible on the map
      if (isPublished) {
        G20.svg('tspan', {
          x: labelX,
          dy: '1.25em',
          'font-weight': 700,
          'font-size': code === 'ACT' ? '11px' : '12px',
          fill: labelFill
        }, stateLabelG).textContent = `${shareVal.toFixed(1)}%`;
      }

      // Rich Hover Tooltip with counts and share percentage
      const showTooltip = event => {
        const bounds = svg.getBoundingClientRect();
        const pt = event.touches?.[0] || event;
        const posX = pt.clientX - bounds.left;
        const posY = pt.clientY - bounds.top;

        let tooltipHtml = `<strong>${G20.escape(stateName)} (${code})</strong><br>`;
        tooltipHtml += `<small style="color:#94a3b8">${user} · ${year}</small><br>`;

        if (isPublished) {
          const fromRange = formatStep(gradeIdx * step);
          const toRange = formatStep((gradeIdx + 1) * step);
          tooltipHtml += `Road user injuries: <strong>${G20.format(userCases)}</strong><br>`;
          tooltipHtml += `State total road injuries: <strong>${G20.format(totalStateCases)}</strong><br>`;
          tooltipHtml += `<strong>Share of state's total: ${shareVal.toFixed(1)}%</strong><br>`;
          tooltipHtml += `<span style="display:inline-block; margin-top:4px; font-size:11.5px; color:#cbd5e1;">Color Grade: ${fromRange}–${toRange}% (Fixed Max: ${formatStep(maxCeil)}%)</span>`;
        } else {
          tooltipHtml += `<span style="color:#f87171">Status: Not published</span><br>`;
          tooltipHtml += `<small style="color:#cbd5e1">Data suppressed by AIHW/BITRE to protect privacy for small cell counts.</small>`;
        }

        G20.tooltip(svg, tooltipHtml, posX, posY);
      };

      statePath.addEventListener('mouseenter', showTooltip);
      statePath.addEventListener('mousemove', showTooltip);
      statePath.addEventListener('focus', showTooltip);
      statePath.addEventListener('mouseleave', G20.hideTooltip);
      statePath.addEventListener('blur', G20.hideTooltip);
    });
  }).catch(error => {
    console.error(error);
    const insight = document.querySelector('#q2Insight');
    if (insight) {
      insight.textContent = 'The map boundaries could not be loaded. Please check your connection and reload the page.';
    }
  });

  // Dynamic Insight Text
  const top = published.slice().sort((a, b) =>
    G20.number(b['Percent share']) - G20.number(a['Percent share']))[0];

  const insightElem = document.querySelector('#q2Insight');
  if (insightElem) {
    if (top) {
      const topPct = G20.number(top['Percent share']).toFixed(1);
      const topCases = G20.number(top['road_user_cases']);
      const stateTotal = G20.number(top['state_total_cases']);
      insightElem.innerHTML =
        `In ${year}, <strong>${G20.escape(top['state name'])}</strong> recorded the highest intensity share of ` +
        `<strong>${G20.escape(user.toLowerCase())}</strong> injuries at <strong>${topPct}%</strong> ` +
        `(${G20.format(topCases)} of ${G20.format(stateTotal)} total road hospitalisations). ` +
        `<em>Intensity reflects the relative road-user share within each jurisdiction.</em>`;
    } else {
      insightElem.innerHTML = `No published cases are available for ${G20.escape(user.toLowerCase())} injuries in ${year}.`;
    }
  }
};
