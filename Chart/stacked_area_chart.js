// Show stacked age-group shares over time, or isolate one group from zero.
window.renderStackedAreaChart = (function () {
  let selectedAge = 'all';
  let cachedData = null;
  let controlsReady = false;

  return function (data) {
    const { G20 } = window;
    cachedData = data || cachedData;
    if (!cachedData) return;

    const svg = G20.clear('#areaChart');
    const [width, height] = G20.size(svg);
    const margin = { left: 68, right: 24, top: 38, bottom: 46 };
    const selectedAgeIndex = G20.AGE_ORDER.indexOf(selectedAge);
    const x = d3.scaleLinear()
      .domain([G20.YEARS[0], G20.YEARS[G20.YEARS.length - 1]])
      .range([margin.left, width - margin.right]);

    // Sum records by year and age group, combining all sexes.
    const counts = G20.YEARS.map(year => G20.AGE_ORDER.map(age =>
      cachedData
        .filter(row => Number(row['Calendar year']) === year && row['Age group'] === age)
        .reduce((sum, row) => sum + G20.number(row['Sum(Hospitalisations)']), 0)
    ));
    const totals = counts.map(yearCounts => yearCounts.reduce((sum, count) => sum + count, 0));
    const shares = counts.map((yearCounts, yearIndex) =>
      yearCounts.map(count => totals[yearIndex] ? count / totals[yearIndex] * 100 : 0)
    );
    const stackData = G20.YEARS.map((year, yearIndex) => {
      const row = { year };
      G20.AGE_ORDER.forEach((age, ageIndex) => {
        row[age] = shares[yearIndex][ageIndex];
      });
      return row;
    });

    // All ages fill a 0-100% stack; one age group gets its own 0-based scale.
    const keys = selectedAge === 'all' ? G20.AGE_ORDER : [selectedAge];
    const maxShare = selectedAge === 'all'
      ? 100
      : Math.max(...shares.map(yearShares => yearShares[selectedAgeIndex]), 0.1);
    const y = d3.scaleLinear()
      .domain([0, maxShare])
      .nice(5)
      .range([height - margin.bottom, margin.top]);
    const yTicks = selectedAge === 'all' ? [0, 20, 40, 60, 80, 100] : y.ticks(5);
    const layers = d3.stack().keys(keys)(stackData);
    const area = d3.area()
      .x(point => x(point.data.year))
      .y0(point => y(point[0]))
      .y1(point => y(point[1]));
    const colors = d3.scaleOrdinal().domain(G20.AGE_ORDER).range(G20.COLORS);

    // Draw the colored area bands with transparency so the grid remains visible.
    layers.forEach(layer => {
      G20.svg('path', {
        d: area(layer),
        fill: colors(layer.key),
        opacity: 0.55,
        stroke: '#ffffff',
        'stroke-width': 0.8,
        class: 'q5-age-area',
        'data-age': layer.key
      }, svg);
    });

    // Draw dotted horizontal guides over the fills and behind the data points.
    yTicks.forEach(value => {
      const tickY = y(value);
      G20.svg('line', {
        x1: margin.left,
        x2: width - margin.right,
        y1: tickY,
        y2: tickY,
        class: 'area-grid-line'
      }, svg);
      const tick = G20.svg('text', {
        x: margin.left - 10,
        y: tickY + 4,
        'text-anchor': 'end',
        class: 'area-axis-text'
      }, svg);
      tick.textContent = Number(value.toFixed(1));
    });

    G20.YEARS.forEach((year, index) => {
      if (index % 2 !== 0 && index !== G20.YEARS.length - 1) return;
      const label = G20.svg('text', {
        x: x(year),
        y: height - 12,
        'text-anchor': 'middle',
        class: 'area-axis-text'
      }, svg);
      label.textContent = year;
    });

    const yTitle = G20.svg('text', {
      x: margin.left,
      y: 20,
      class: 'area-axis-title'
    }, svg);
    yTitle.textContent = 'Share of hospitalisations (%)';

    // Put each year point on the top edge of its age group's area.
    layers.forEach(layer => {
      const age = layer.key;
      const ageIndex = G20.AGE_ORDER.indexOf(age);
      layer.forEach((extent, yearIndex) => {
        const share = shares[yearIndex][ageIndex];
        const boundary = extent[1];
        const point = G20.svg('circle', {
          cx: x(G20.YEARS[yearIndex]),
          cy: y(boundary),
          r: 4.2,
          fill: colors(age),
          stroke: '#ffffff',
          'stroke-width': 1.5,
          class: 'q5-age-point',
          tabindex: '0',
          role: 'img',
          'aria-label': `${age}, ${G20.YEARS[yearIndex]}: ${G20.percent(share)} share, ${G20.format(counts[yearIndex][ageIndex])} hospitalisations`
        }, svg);

        // Show the age group, year, share, and count on hover or keyboard focus.
        const showTooltip = () => {
          G20.tooltip(
            svg,
            `<strong>Age ${age}</strong><br>Year: <strong>${G20.YEARS[yearIndex]}</strong>` +
            `<br>Share: <strong>${G20.percent(share)}</strong>` +
            `<br>Hospitalisations: <strong>${G20.format(counts[yearIndex][ageIndex])}</strong>`,
            x(G20.YEARS[yearIndex]),
            y(boundary)
          );
          const tooltip = svg.parentElement.querySelector('.tooltip');
          if (!tooltip) return;
          tooltip.style.whiteSpace = 'normal';
          tooltip.style.maxWidth = '250px';
          const tooltipWidth = tooltip.getBoundingClientRect().width;
          const shellWidth = svg.parentElement.getBoundingClientRect().width;
          const minCenter = tooltipWidth / 2 + 8;
          const maxCenter = Math.max(minCenter, shellWidth - tooltipWidth / 2 - 8);
          tooltip.style.left = `${Math.max(minCenter, Math.min(
            x(G20.YEARS[yearIndex]) - tooltipWidth / 2 - 12,
            maxCenter
          ))}px`;
        };
        point.addEventListener('mouseenter', showTooltip);
        point.addEventListener('focus', showTooltip);
        point.addEventListener('mouseleave', G20.hideTooltip);
        point.addEventListener('blur', G20.hideTooltip);
      });
    });

    svg.setAttribute('aria-label', selectedAge === 'all'
      ? '100 percent stacked area chart of age-group hospitalisation shares from 2011 to 2021'
      : `Area chart showing the share of hospitalisations for age group ${selectedAge} from 2011 to 2021`);

    // Create age buttons once; each selection redraws the matching area view.
    if (!controlsReady) {
      const filterContainer = document.querySelector('#q5AgeFilter');
      const filterOptions = [
        { age: 'all', label: 'All ages' },
        ...G20.AGE_ORDER.map(age => ({ age, label: age }))
      ];

      filterOptions.forEach(({ age, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'age-btn';
        button.dataset.age = age;
        button.setAttribute('aria-pressed', 'false');
        if (age !== 'all') {
          const dot = document.createElement('span');
          dot.className = 'age-btn-dot';
          dot.style.backgroundColor = colors(age);
          button.appendChild(dot);
        }
        button.appendChild(document.createTextNode(label));
        filterContainer.appendChild(button);
      });

      filterContainer.addEventListener('click', event => {
        const button = event.target.closest('button[data-age]');
        if (!button) return;
        selectedAge = button.dataset.age;
        G20.hideTooltip();
        window.renderStackedAreaChart(cachedData);
      });
      controlsReady = true;
    }

    document.querySelectorAll('#q5AgeFilter button[data-age]').forEach(button => {
      const active = button.dataset.age === selectedAge;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    // Summarize the largest endpoint change or the selected group's endpoint shares.
    const insight = document.querySelector('#q5Insight');
    const firstShares = shares[0];
    const lastShares = shares[shares.length - 1];
    if (selectedAgeIndex < 0) {
      const largestChange = lastShares
        .map((share, index) => ({ index, change: share - firstShares[index] }))
        .reduce((largest, change) =>
          Math.abs(change.change) > Math.abs(largest.change) ? change : largest
        );
      const direction = largestChange.change > 0
        ? 'increased'
        : largestChange.change < 0 ? 'decreased' : 'did not change';
      insight.innerHTML = `From 2011 to 2021, <strong>${G20.AGE_ORDER[largestChange.index]}</strong> ` +
        `had the largest change: its share ${direction} from ` +
        `<strong>${G20.percent(firstShares[largestChange.index])}</strong> to ` +
        `<strong>${G20.percent(lastShares[largestChange.index])}</strong> ` +
        `(<strong>${Math.abs(largestChange.change).toFixed(1)} percentage points</strong>).`;
    } else {
      const change = lastShares[selectedAgeIndex] - firstShares[selectedAgeIndex];
      const direction = change > 0 ? 'increased' : change < 0 ? 'decreased' : 'did not change';
      insight.innerHTML = `The share for <strong>${selectedAge}</strong> ${direction} by ` +
        `<strong>${Math.abs(change).toFixed(1)} percentage points</strong>, from ` +
        `${G20.percent(firstShares[selectedAgeIndex])} in 2011 to ` +
        `${G20.percent(lastShares[selectedAgeIndex])} in 2021.`;
    }
  };
})();
