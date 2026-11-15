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

// High-intensity color scale (Yellow-Green-Cyan-Cobalt-Navy)
// Combines luminous bright hues for lower values with saturated electric cyan and deep midnight navy
const INTENSITY_RAMP = [
  [237, 248, 177], // 0.0: luminous lime-yellow (#edf8b1)
  [127, 205, 187], // 0.25: vivid seafoam turquoise (#7fcdbb)
  [29, 145, 192],  // 0.50: intense electric cyan-blue (#1d91c0)
  [34, 94, 168],   // 0.75: rich royal cobalt (#225ea8)
  [8, 29, 88]      // 1.0: deep midnight navy (#081d58)
];

function mapColor(value, min, max) {
  if (max <= min) return '#225ea8';
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));

  if (window.d3 && d3.interpolateYlGnBu) {
    return d3.interpolateYlGnBu(0.1 + 0.9 * ratio);
  }

  // Piecewise interpolation across the high-intensity ramp
  const n = INTENSITY_RAMP.length - 1;
  const scaled = ratio * n;
  const idx = Math.min(n - 1, Math.floor(scaled));
  const t = scaled - idx;
  const c1 = INTENSITY_RAMP[idx];
  const c2 = INTENSITY_RAMP[idx + 1];

  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

window.renderChoroplethMap = function (data) {
  const { G20 } = window;
  const svg = G20.clear('#mapChart');
  const [width, height] = G20.size(svg);

  const yearInput = document.querySelector('#q2Year');
  const userSelect = document.querySelector('#q2Select');
  const year = (yearInput && yearInput.value && !isNaN(+yearInput.value)) ? +yearInput.value : 2021;
  const user = (userSelect && userSelect.value) ? userSelect.value : (data[0]?.['road user'] || 'Car driver, passenger or unknown position');

  const rows = data.filter(row => +row['calendar year'] === year && row['road user'] === user);
  const published = rows.filter(row => row.Status === 'Published');
  const values = published.map(row => G20.number(row['Percent share']));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

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

  // Gradient colors for high-intensity legend
  const minColor = mapColor(min, min, max);
  const midColor = mapColor((min + max) / 2, min, max);
  const maxColor = mapColor(max, min, max);

  // Update Legend with High-Intensity Gradient Bar and Real Values
  const legendElem = document.querySelector('#mapLegend');
  if (legendElem) {
    legendElem.innerHTML = `
      <div class="map-legend-container">
        <div class="legend-header">
          <strong>Color Intensity: Share of jurisdiction's total road injuries (%)</strong>
        </div>
        <div class="map-gradient-row">
          <div class="gradient-bar-wrap">
            <div class="map-gradient-bar" style="background: linear-gradient(to right, ${minColor}, ${midColor}, ${maxColor});"></div>
            <div class="map-gradient-ticks">
              <span>Low: <strong>${min.toFixed(1)}%</strong></span>
              <span>Mid: <strong>${((min + max) / 2).toFixed(1)}%</strong></span>
              <span>High: <strong>${max.toFixed(1)}%</strong></span>
            </div>
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
      const population = STATE_POPULATIONS[code] || 0;

      // High-intensity fill
      const fillColor = isPublished ? mapColor(shareVal, min, max) : 'url(#not-published-hatch)';

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
        fill: '#0f172a'
      }, stateLabelG).textContent = code;

      // Real value line directly visible on the map
      if (isPublished) {
        G20.svg('tspan', {
          x: labelX,
          dy: '1.25em',
          'font-weight': 700,
          'font-size': code === 'ACT' ? '11px' : '12px',
          fill: '#0f172a'
        }, stateLabelG).textContent = `${shareVal.toFixed(1)}%`;
      }

      // Rich Hover Tooltip with counts and rate per 100,000 residents
      const showTooltip = event => {
        const bounds = svg.getBoundingClientRect();
        const pt = event.touches?.[0] || event;
        const posX = pt.clientX - bounds.left;
        const posY = pt.clientY - bounds.top;

        let tooltipHtml = `<strong>${G20.escape(stateName)} (${code})</strong><br>`;
        tooltipHtml += `<small style="color:#94a3b8">${user} · ${year}</small><br>`;

        if (isPublished) {
          const userRate = population ? ((userCases / population) * 100000).toFixed(1) : '—';
          const totalRate = population ? ((totalStateCases / population) * 100000).toFixed(1) : '—';

          tooltipHtml += `Road user injuries: <strong>${G20.format(userCases)}</strong><br>`;
          tooltipHtml += `State total road injuries: <strong>${G20.format(totalStateCases)}</strong><br>`;
          tooltipHtml += `<strong>Share of state's total: ${shareVal.toFixed(1)}%</strong><br>`;
          tooltipHtml += `<hr style="margin:5px 0; border:0; border-top:1px solid #334155">`;
          tooltipHtml += `<small style="color:#cbd5e1">Population: ~${(population / 1000000).toFixed(2)}M<br>`;
          tooltipHtml += `Rate: <strong>${userRate}</strong> per 100k (${totalRate} per 100k total)</small>`;
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
