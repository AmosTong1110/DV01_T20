// Chart 3: Remoteness comparison by First Nations status (100% stacked bar chart)

window.renderStackedBarChart = function (data) {
  const { G20 } = window;
  const svg = G20.clear('#stackedChart');
  const [width, height] = G20.size(svg);

  const yearInput = document.querySelector('#q3Year');
  const year = (yearInput && yearInput.value && !isNaN(+yearInput.value)) ? +yearInput.value : 2021;
  const yearOut = document.querySelector('#q3YearValue');
  if (yearOut) yearOut.value = year;

  // Distinct color palette differing completely from Chart 5's colors
  // Chart 5 uses: #086f70, #e87b45, #477da5, #d16d78, #8a6fb0, #d3a735, #527d68
  const REMOTENESS_COLORS = {
    'Major Cities': '#1e293b', // Deep Slate Navy
    'Regional': '#2563eb',     // Vibrant Cobalt Blue
    'Remote': '#dc2626'        // Vivid Crimson
  };

  const groups = ['First Nations people', 'Non-Indigenous'];
  const areas = ['Major Cities', 'Regional', 'Remote'];

  // Margins accommodating y-axis (0-100%), legend, top totals, and bottom labels
  const margin = { left: 75, right: 90, top: 58, bottom: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // 1. Continuous 0% to 100% Y-Axis
  const yScale = d3.scaleLinear()
    .domain([0, 100])
    .range([height - margin.bottom, margin.top]);

  // Y-axis grid lines and tick labels
  const yTicks = [0, 20, 40, 60, 80, 100];
  yTicks.forEach(tickVal => {
    const yPos = yScale(tickVal);
    G20.svg('line', {
      x1: margin.left,
      x2: width - margin.right,
      y1: yPos,
      y2: yPos,
      class: 'grid-line',
      stroke: '#e2e8f0',
      'stroke-width': tickVal === 0 ? 1.5 : 1
    }, svg);

    G20.svg('text', {
      x: margin.left - 12,
      y: yPos + 4,
      'text-anchor': 'end',
      class: 'y-axis-label',
      fill: '#64748b',
      'font-size': '13px'
    }, svg).textContent = `${tickVal}%`;
  });

  // Y-axis Title
  G20.svg('text', {
    x: margin.left - 12,
    y: margin.top - 36,
    'text-anchor': 'start',
    'font-weight': 700,
    'font-size': '13px',
    fill: '#17232e'
  }, svg).textContent = 'Share of hospitalisations (%)';

  // 2. Legend at the top right
  const legendG = G20.svg('g', { class: 'chart3-legend' }, svg);
  let legendXOffset = margin.left + 220;
  areas.forEach(area => {
    const areaColor = REMOTENESS_COLORS[area];
    G20.svg('rect', {
      x: legendXOffset,
      y: margin.top - 46,
      width: 12,
      height: 12,
      rx: 3,
      fill: areaColor
    }, legendG);
    const textNode = G20.svg('text', {
      x: legendXOffset + 18,
      y: margin.top - 36,
      'font-size': '13px',
      'font-weight': 600,
      fill: '#334155'
    }, legendG);
    textNode.textContent = area;
    legendXOffset += area.length * 8 + 48;
  });

  // 3. Bar Layout & Dimensions
  const barWidth = Math.min(130, Math.max(70, (plotWidth - 140) / 2));
  const spacing = (plotWidth - 2 * barWidth) / 3;
  const barXs = [
    margin.left + spacing,
    margin.left + spacing * 2 + barWidth
  ];

  const barsGroup = G20.svg('g', { class: 'bars-group' }, svg);
  const labelsGroup = G20.svg('g', { class: 'labels-group' }, svg);

  // Store data for the disparity annotation
  const remoteShares = {};
  const remoteTops = {};

  groups.forEach((group, groupIndex) => {
    const barX = barXs[groupIndex];
    let accumPercent = 0;

    // Retrieve group total case count n
    const groupRows = data.filter(item =>
      +item['Calendar year'] === year && item['First Nations status'] === group);
    const totalN = groupRows.length ? G20.number(groupRows[0]['Sum(Hospitalisations) (Right)']) : 0;

    // Display total case count above each bar
    const totalNLabel = G20.svg('text', {
      x: barX + barWidth / 2,
      y: margin.top - 12,
      'text-anchor': 'middle',
      'font-size': '13px',
      'font-weight': 700,
      fill: '#1e293b'
    }, svg);
    totalNLabel.textContent = `Total cases = ${G20.format(totalN)}`;

    // Stack segments: Major Cities (bottom), Regional (middle), Remote (top)
    areas.forEach(area => {
      const areaColor = REMOTENESS_COLORS[area];
      const row = groupRows.find(item => item['ABS remoteness area'] === area);
      const shareVal = row ? G20.number(row['Percent share']) : 0;
      const casesVal = row ? G20.number(row['Sum(Hospitalisations)']) : 0;

      const segHeight = plotHeight * (shareVal / 100);
      const segY = yScale(accumPercent + shareVal);

      if (area === 'Remote') {
        remoteShares[group] = shareVal;
        remoteTops[group] = { x: barX, y: segY, h: segHeight };
      }

      // Draw segment rectangle
      const rect = G20.svg('rect', {
        x: barX,
        y: segY,
        width: barWidth,
        height: Math.max(0, segHeight),
        fill: areaColor,
        stroke: '#ffffff',
        'stroke-width': 1.5,
        rx: accumPercent + shareVal >= 99.9 ? 4 : 0,
        style: 'cursor: pointer;'
      }, barsGroup);

      // Percentage label inside or beside segment (in crisp white colour)
      if (segHeight >= 20) {
        // Label centered inside segment
        const pctLabel = G20.svg('text', {
          x: barX + barWidth / 2,
          y: segY + segHeight / 2 + 5,
          'text-anchor': 'middle',
          'font-size': '14px',
          'font-weight': 750,
          fill: '#ffffff',
          style: 'fill: #ffffff !important;',
          class: 'segment-pct-label',
          'pointer-events': 'none'
        }, labelsGroup);
        pctLabel.textContent = `${shareVal.toFixed(1)}%`;
      } else if (shareVal > 0) {
        // External callout with badge for thin segments (e.g. Non-Indigenous Remote at ~1.7%)
        const calloutX = barX + barWidth + 8;
        const calloutY = segY + segHeight / 2;
        const badgeW = 46;
        const badgeH = 20;

        G20.svg('line', {
          x1: barX + barWidth + 1,
          y1: calloutY,
          x2: calloutX,
          y2: calloutY,
          stroke: areaColor,
          'stroke-width': 1.5
        }, labelsGroup);

        // Small badge pill with area color and white text
        G20.svg('rect', {
          x: calloutX,
          y: calloutY - badgeH / 2,
          width: badgeW,
          height: badgeH,
          rx: 4,
          fill: areaColor
        }, labelsGroup);

        const extLabel = G20.svg('text', {
          x: calloutX + badgeW / 2,
          y: calloutY + 4,
          'text-anchor': 'middle',
          'font-size': '12px',
          'font-weight': 750,
          fill: '#ffffff',
          style: 'fill: #ffffff !important;',
          class: 'segment-pct-label',
          'pointer-events': 'none'
        }, labelsGroup);
        extLabel.textContent = `${shareVal.toFixed(1)}%`;
      }

      // Hover Tooltip for segment
      const showTooltip = () => {
        G20.tooltip(
          svg,
          `<strong>${group === 'First Nations people' ? 'First Nations' : group}</strong><br>` +
          `Area: <strong>${area}</strong> (${year})<br>` +
          `Cases: <strong>${G20.format(casesVal)}</strong> out of ${G20.format(totalN)}<br>` +
          `<strong>Share: ${shareVal.toFixed(1)}%</strong>`,
          barX + barWidth / 2,
          segY + segHeight / 2
        );
      };

      rect.addEventListener('mouseenter', showTooltip);
      rect.addEventListener('mouseleave', G20.hideTooltip);

      accumPercent += shareVal;
    });

    // Category label underneath bar
    const groupDisplay = group === 'First Nations people' ? 'First Nations' : group;
    const catLabel = G20.svg('text', {
      x: barX + barWidth / 2,
      y: height - margin.bottom + 26,
      'text-anchor': 'middle',
      'font-weight': 700,
      'font-size': '15px',
      fill: '#0f172a'
    }, svg);
    catLabel.textContent = groupDisplay;

    // Sub-label with total case count
    const nSubLabel = G20.svg('text', {
      x: barX + barWidth / 2,
      y: height - margin.bottom + 46,
      'text-anchor': 'middle',
      'font-size': '13px',
      fill: '#64748b'
    }, svg);
    nSubLabel.textContent = `(${G20.format(totalN)} total cases)`;
  });

  // Dynamic Insight Text
  const fnRemote = remoteShares['First Nations people'] || 0;
  const nonRemote = remoteShares['Non-Indigenous'] || 0;
  const ratio = nonRemote > 0 ? (fnRemote / nonRemote).toFixed(1) : '—';

  const insightElem = document.querySelector('#q3Insight');
  if (insightElem) {
    insightElem.innerHTML =
      `In <strong>${year}</strong>, Remote areas accounted for <strong>${G20.percent(fnRemote)}</strong> ` +
      `of First Nations road injury hospitalisations compared with just <strong>${G20.percent(nonRemote)}</strong> ` +
      `for non-Indigenous people (a <strong>${ratio}× higher share</strong>). Conversely, Major Cities represented ` +
      `<strong>${(100 - (remoteShares['Non-Indigenous'] || 0) - G20.number(data.find(r => +r['Calendar year'] === year && r['First Nations status'] === 'Non-Indigenous' && r['ABS remoteness area'] === 'Regional')?.['Percent share'])).toFixed(1)}%</strong> ` +
      `of non-Indigenous hospitalisations versus <strong>${G20.number(data.find(r => +r['Calendar year'] === year && r['First Nations status'] === 'First Nations people' && r['ABS remoteness area'] === 'Major Cities')?.['Percent share']).toFixed(1)}%</strong> for First Nations people.`;
  }
}