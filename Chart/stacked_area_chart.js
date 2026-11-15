// Chart 5: Age distribution over time with interactive age filter buttons
// Smooth D3 transitions between 7 different age-group charts and the 100% stacked view

window.renderStackedAreaChart = (function () {
  let selectedAge = 'all'; // 'all', '0-7', '8-16', '17-25', '26-39', '40-64', '65-74', '75+'
  let cachedData = null;

  return function (data) {
    const { G20 } = window;
    cachedData = data || cachedData;
    if (!cachedData) return;

    const svg = G20.clear('#areaChart');
    const [width, height] = G20.size(svg);
    const margin = { left: 75, right: 130, top: 38, bottom: 44 };

    // 1. Calculate age group metrics for each year
    // counts[yearIndex][ageIndex] = sum of hospitalisations
    const annualTotals = G20.YEARS.map(year => {
      const yearRows = cachedData.filter(row => +row['Calendar year'] === year);
      return yearRows.reduce((sum, row) => sum + G20.number(row['Sum(Hospitalisations)']), 0);
    });

    const ageCounts = G20.YEARS.map(year => G20.AGE_ORDER.map(age => {
      const rows = cachedData.filter(row => +row['Calendar year'] === year && row['Age group'] === age);
      return rows.reduce((sum, row) => sum + G20.number(row['Sum(Hospitalisations)']), 0);
    }));

    // Stacked percentage shares (0 - 100%)
    const stackedShares = ageCounts.map((yearCounts, yIdx) => {
      const tot = annualTotals[yIdx] || 1;
      return yearCounts.map(count => (count / tot) * 100);
    });

    const x = year => margin.left + (width - margin.left - margin.right) * (year - 2011) / 10;

    // 2. Compute Y-Scale based on whether "All" or a single age group is selected
    let yScale;
    let yTicks;
    let yTitle;

    if (selectedAge === 'all') {
      yScale = d3.scaleLinear()
        .domain([0, 100])
        .range([height - margin.bottom, margin.top]);
      yTicks = [0, 20, 40, 60, 80, 100];
      yTitle = 'Share of hospitalisations (%)';
    } else {
      const ageIdx = G20.AGE_ORDER.indexOf(selectedAge);
      const singleCounts = ageCounts.map(yc => yc[ageIdx]);
      const maxCount = Math.max(...singleCounts, 100);
      const yCeil = Math.ceil(maxCount / (maxCount > 5000 ? 2000 : maxCount > 2000 ? 500 : 200)) *
        (maxCount > 5000 ? 2000 : maxCount > 2000 ? 500 : 200);

      yScale = d3.scaleLinear()
        .domain([0, yCeil])
        .range([height - margin.bottom, margin.top]);
      yTicks = yScale.ticks(6);
      yTitle = `Hospitalisations: Age ${selectedAge} (count)`;
    }

    // Y-axis grid lines and clean tick labels
    yTicks.forEach(tickVal => {
      const lineY = yScale(tickVal);
      G20.svg('line', {
        x1: margin.left,
        x2: width - margin.right,
        y1: lineY,
        y2: lineY,
        class: 'grid-line',
        stroke: '#e2e8f0',
        'stroke-width': tickVal === 0 ? 1.5 : 1
      }, svg);

      G20.svg('text', {
        x: margin.left - 12,
        y: lineY + 5,
        'text-anchor': 'end',
        class: 'y-axis-label',
        fill: '#64748b',
        'font-size': '13px'
      }, svg).textContent = selectedAge === 'all' ? `${tickVal}%` : G20.format(tickVal);
    });

    // Y-axis Title
    G20.svg('text', {
      x: margin.left - 12,
      y: margin.top - 16,
      'text-anchor': 'start',
      'font-weight': 700,
      'font-size': '14px',
      fill: '#17232e'
    }, svg).textContent = yTitle;

    // 3. Render Area Layers and Line Trajectories
    const areasGroup = G20.svg('g', { class: 'stacked-areas-group' }, svg);
    const linesGroup = G20.svg('g', { class: 'lines-group' }, svg);
    const pointsGroup = G20.svg('g', { class: 'points-group' }, svg);
    const labelsGroup = G20.svg('g', { class: 'labels-group' }, svg);

    if (selectedAge === 'all') {
      // 100% Stacked Area Chart (7 layers)
      let baseShares = Array(11).fill(0);

      G20.AGE_ORDER.forEach((age, ageIdx) => {
        const topShares = stackedShares.map((row, i) => baseShares[i] + row[ageIdx]);
        const ageColor = G20.COLORS[ageIdx];

        // Polygon points
        const forwardPts = G20.YEARS.map((year, i) => [
          x(year),
          yScale(topShares[i])
        ]);
        const backwardPts = G20.YEARS.slice().reverse().map((year, j) => {
          const i = 10 - j;
          return [x(year), yScale(baseShares[i])];
        });

        const allPoints = [...forwardPts, ...backwardPts];
        const pathD = allPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ') + 'Z';

        const areaPath = G20.svg('path', {
          d: pathD,
          fill: ageColor,
          opacity: 0.88,
          stroke: '#ffffff',
          'stroke-width': 1,
          class: `area-layer area-${age}`,
          style: 'cursor: pointer; transition: opacity 0.2s ease;'
        }, areasGroup);

        // Hover effect to highlight layer
        areaPath.addEventListener('mouseenter', () => {
          areaPath.setAttribute('opacity', '1');
          const lastShare = stackedShares[10][ageIdx];
          G20.tooltip(svg, `<strong>Age ${age}</strong><br>2021 Share: <strong>${lastShare.toFixed(1)}%</strong><br><small>Click age button above to inspect dedicated trend</small>`, width / 2, height / 2);
        });
        areaPath.addEventListener('mouseleave', () => {
          areaPath.setAttribute('opacity', '0.88');
          G20.hideTooltip();
        });

        // Direct label on the right at year 2021
        const midY = (yScale(topShares[10]) + yScale(baseShares[10])) / 2;
        if (Math.abs(yScale(baseShares[10]) - yScale(topShares[10])) > 14) {
          const lbl = G20.svg('text', {
            x: width - margin.right + 8,
            y: midY + 4,
            'font-size': '12px',
            'font-weight': 700,
            fill: ageColor
          }, labelsGroup);
          lbl.textContent = `${age} (${stackedShares[10][ageIdx].toFixed(1)}%)`;
        }

        baseShares = topShares;
      });
    } else {
      // Single Dedicated Age Group Chart (Transition View)
      const ageIdx = G20.AGE_ORDER.indexOf(selectedAge);
      const ageColor = G20.COLORS[ageIdx];
      const singleCounts = ageCounts.map(yc => yc[ageIdx]);
      const base2011 = singleCounts[0];

      // Draw baseline area for the selected age group
      const areaPts = [
        ...G20.YEARS.map((year, i) => [x(year), yScale(singleCounts[i])]),
        ...G20.YEARS.slice().reverse().map(year => [x(year), yScale(0)])
      ];
      const areaD = areaPts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ') + 'Z';

      G20.svg('path', {
        d: areaD,
        fill: ageColor,
        opacity: 0.35,
        class: 'single-age-area'
      }, areasGroup);

      // Top contour polyline
      const linePts = G20.YEARS.map((year, i) => [x(year), yScale(singleCounts[i])]);
      G20.svg('polyline', {
        points: linePts.map(pt => pt.join(',')).join(' '),
        fill: 'none',
        stroke: ageColor,
        'stroke-width': 3.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        class: 'single-age-line'
      }, linesGroup);

      // 11 Interactive points along the curve
      linePts.forEach((pt, i) => {
        const year = G20.YEARS[i];
        const count = singleCounts[i];
        const share = stackedShares[i][ageIdx];
        const pctChange = base2011 ? ((count - base2011) / base2011 * 100) : 0;
        const changeSign = pctChange > 0 ? '+' : '';

        const circle = G20.svg('circle', {
          cx: pt[0],
          cy: pt[1],
          r: 5,
          fill: ageColor,
          stroke: '#ffffff',
          'stroke-width': 2,
          class: 'dot dot-age',
          style: 'cursor: pointer;'
        }, pointsGroup);

        circle.addEventListener('mouseenter', () => {
          G20.tooltip(
            svg,
            `<strong>Age Group: ${selectedAge}</strong><br>` +
            `Year: <strong>${year}</strong><br>` +
            `Hospitalisations: <strong>${G20.format(count)}</strong><br>` +
            `Share of year: <strong>${share.toFixed(1)}%</strong><br>` +
            `<small style="color:#cbd5e1">${i === 0 ? 'Baseline year' : `${changeSign}${pctChange.toFixed(1)}% vs 2011`}</small>`,
            pt[0],
            pt[1]
          );
        });
        circle.addEventListener('mouseleave', G20.hideTooltip);
      });

      // Direct end-label at 2021
      const lastPt = linePts[linePts.length - 1];
      const lastCount = singleCounts[10];
      const lastShare = stackedShares[10][ageIdx];
      const endLabel = G20.svg('text', {
        x: lastPt[0] + 8,
        y: lastPt[1] + 4,
        'font-size': '12.5px',
        'font-weight': 750,
        fill: ageColor,
        class: 'direct-end-label'
      }, labelsGroup);
      endLabel.textContent = `${selectedAge}: ${G20.format(lastCount)} (${lastShare.toFixed(1)}%)`;
    }

    // X-axis Year Labels
    G20.YEARS.forEach(year => {
      G20.svg('text', {
        x: x(year),
        y: height - 12,
        'text-anchor': 'middle',
        'font-weight': 600,
        'font-size': '13px',
        fill: '#475569'
      }, svg).textContent = year;
    });

    // 4. Age Filter Buttons
    const filterContainer = document.querySelector('#q5AgeFilter');
    if (filterContainer) {
      filterContainer.innerHTML = '';

      // "All ages (100% Stacked)" button
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = `age-btn ${selectedAge === 'all' ? 'active' : ''}`;
      allBtn.setAttribute('aria-pressed', selectedAge === 'all' ? 'true' : 'false');
      allBtn.innerHTML = '<span class="age-btn-dot" style="background:#475569"></span><span>All ages (100% Stacked)</span>';
      allBtn.addEventListener('click', () => {
        selectedAge = 'all';
        animateAgeChart();
      });
      filterContainer.appendChild(allBtn);

      // 7 Individual Age Group buttons
      G20.AGE_ORDER.forEach((age, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `age-btn ${selectedAge === age ? 'active' : ''}`;
        btn.setAttribute('aria-pressed', selectedAge === age ? 'true' : 'false');
        const color = G20.COLORS[idx];
        btn.innerHTML = `<span class="age-btn-dot" style="background:${color}"></span><span>${age}</span>`;
        btn.addEventListener('click', () => {
          selectedAge = age;
          animateAgeChart();
        });
        filterContainer.appendChild(btn);
      });
    }

    // Helper to perform smooth animated redraw
    function animateAgeChart() {
      const areaSvg = d3.select('#areaChart');
      areaSvg.transition()
        .duration(200)
        .style('opacity', 0.25)
        .on('end', () => {
          window.renderStackedAreaChart(cachedData);
          areaSvg.transition()
            .duration(350)
            .style('opacity', 1);
        });
    }

    // 5. Dynamic Insight Narrative
    const insightElem = document.querySelector('#q5Insight');
    const selectedYear = 2021;

    if (insightElem) {
      if (selectedAge === 'all') {
        const currentRows = cachedData.filter(row => +row['Calendar year'] === selectedYear);
        const initialRows = cachedData.filter(row => +row['Calendar year'] === 2011);
        const current = G20.AGE_ORDER.map(age => currentRows
          .filter(row => row['Age group'] === age)
          .reduce((sum, row) => sum + G20.number(row['Sum(Hospitalisations)']), 0));
        const initial = G20.AGE_ORDER.map(age => initialRows
          .filter(row => row['Age group'] === age)
          .reduce((sum, row) => sum + G20.number(row['Sum(Hospitalisations)']), 0));
        const share65Plus = values => values.slice(5).reduce((a, b) => a + b, 0) / values.reduce((a, b) => a + b, 0);

        insightElem.innerHTML =
          `In <strong>${selectedYear}</strong>, older Australians aged 65 and over represented ` +
          `<strong>${G20.percent(share65Plus(current) * 100)}</strong> of all hospitalised road injuries, ` +
          `up from <strong>${G20.percent(share65Plus(initial) * 100)}</strong> in 2011. ` +
          `<em>Click any age button above to transition the chart to that specific age group's decade trend.</em>`;
      } else {
        const ageIdx = G20.AGE_ORDER.indexOf(selectedAge);
        const count2011 = ageCounts[0][ageIdx];
        const count2021 = ageCounts[10][ageIdx];
        const countYear = ageCounts[selectedYear - 2011][ageIdx];
        const shareYear = stackedShares[selectedYear - 2011][ageIdx];
        const pctChg = count2011 ? ((count2021 - count2011) / count2011 * 100).toFixed(1) : 0;
        const dir = pctChg >= 0 ? 'increased' : 'decreased';

        insightElem.innerHTML =
          `<strong>Age group ${selectedAge}:</strong> In ${selectedYear}, this age group accounted for ` +
          `<strong>${G20.format(countYear)}</strong> hospitalisations (<strong>${shareYear.toFixed(1)}%</strong> of national road trauma). ` +
          `Between 2011 and 2021, hospitalisations for age ${selectedAge} ${dir} by ` +
          `<strong>${Math.abs(pctChg)}%</strong> (from ${G20.format(count2011)} in 2011 to ${G20.format(count2021)} in 2021).`;
      }
    }
  };
})();
