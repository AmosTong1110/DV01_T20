// Draw age-group shares by year and allow filtering by sex
window.renderAgeShareHeatmap = (function () {
  let cachedData = null;

  return function (data) {
    const { G20 } = window;
    cachedData = data || cachedData;
    if (!cachedData) return;

    // Read the selected sex and set up counts for each year and age group
    const selectedSex = document.querySelector('#q5Sex').value;
    const visibleYears = G20.YEARS;
    const svg = G20.clear('#heatmapChart');
    const [width, height] = G20.size(svg);
    const margin = { left: 66, right: 22, top: 56, bottom: 110 };
    const yearIndexes = new Map(G20.YEARS.map((year, index) => [year, index]));
    const ageIndexes = new Map(G20.AGE_ORDER.map((age, index) => [age, index]));
    const counts = G20.YEARS.map(() => G20.AGE_ORDER.map(() => 0));

    // Add counts for the selected sex, or both sexes when All is selected
    cachedData.forEach(row => {
      if (row.Sex !== 'Male' && row.Sex !== 'Female') return;
      if (selectedSex !== 'All' && row.Sex !== selectedSex) return;
      const yearIndex = yearIndexes.get(Number(row['Calendar year']));
      const ageIndex = ageIndexes.get(row['Age group']);
      if (yearIndex === undefined || ageIndex === undefined) return;
      counts[yearIndex][ageIndex] += G20.number(row['Sum(Hospitalisations)']);
    });

    // Calculate each age group's share of that year's total
    const totals = counts.map(yearCounts => yearCounts.reduce((sum, count) => sum + count, 0));
    const shares = counts.map((yearCounts, yearIndex) =>
      yearCounts.map(count => totals[yearIndex] ? count / totals[yearIndex] * 100 : 0)
    );

    // Size the cells and keep the colour scale the same when the filter changes
    const cellWidth = (width - margin.left - margin.right) / G20.AGE_ORDER.length;
    const plotHeight = height - margin.top - margin.bottom;
    const cellHeight = Math.min(36, plotHeight / visibleYears.length);
    const plotTop = margin.top + (plotHeight - cellHeight * visibleYears.length) / 2;
    const color = d3.scaleSequential(d3.interpolateViridis).domain([0, 33]);

    // Add axis labels and prepare the hover outline
    const xTitle = G20.svg('text', {
      x: margin.left + (width - margin.left - margin.right) / 2,
      y: height - margin.bottom + 37,
      'text-anchor': 'middle',
      class: 'heatmap-axis-title'
    }, svg);
    xTitle.textContent = 'Age group';
    const yMidpoint = plotTop + cellHeight * visibleYears.length / 2;
    const yTitle = G20.svg('text', {
      x: 16,
      y: yMidpoint,
      transform: `rotate(-90 16 ${yMidpoint})`,
      'text-anchor': 'middle',
      class: 'heatmap-axis-title'
    }, svg);
    yTitle.textContent = 'Year';

    const highlight = G20.svg('rect', {
      fill: 'none',
      stroke: '#17333a',
      'stroke-width': 3,
      'pointer-events': 'none',
      'aria-hidden': 'true',
      class: 'heatmap-cell-highlight',
      style: 'display: none'
    }, svg);

    // Show age groups below the heat map
    G20.AGE_ORDER.forEach((age, ageIndex) => {
      const label = G20.svg('text', {
        x: margin.left + (ageIndex + 0.5) * cellWidth,
        y: height - margin.bottom + 14,
        'text-anchor': 'middle',
        class: 'heatmap-axis-label'
      }, svg);
      label.textContent = age;
      label.style.fontSize = `${Math.min(12, Math.max(8, cellWidth * 0.3))}px`;
    });

    // Put 2011 at the bottom and 2021 at the top
    visibleYears.forEach((year, visibleIndex) => {
      const yearIndex = yearIndexes.get(year);
      const y = plotTop + (visibleYears.length - 1 - visibleIndex) * cellHeight;
      const yearLabel = G20.svg('text', {
        x: margin.left - 10,
        y: y + cellHeight / 2 + 4,
        'text-anchor': 'end',
        class: 'heatmap-axis-label'
      }, svg);
      yearLabel.textContent = year;

      G20.AGE_ORDER.forEach((age, ageIndex) => {
        const share = shares[yearIndex][ageIndex];
        const value = Math.max(0, Math.min(33, share));
        const cellX = margin.left + ageIndex * cellWidth;
        const cellY = y;
        const cellColor = color(value);
        const cell = G20.svg('rect', {
          x: cellX,
          y: cellY,
          width: cellWidth,
          height: cellHeight,
          fill: cellColor,
          stroke: '#ffffff',
          'stroke-width': 2,
          class: 'heatmap-cell',
          'aria-label': `${year}, age ${age}: ${G20.percent(share)}, ${G20.format(counts[yearIndex][ageIndex])} hospitalisations`
        }, svg);

        const label = G20.svg('text', {
          x: cellX + cellWidth / 2,
          y: cellY + cellHeight / 2 + 4,
          'text-anchor': 'middle',
          fill: '#ffffff',
          class: 'heatmap-cell-label'
        }, svg);
        label.textContent = G20.percent(share);
        label.style.fontSize = `${Math.min(12, Math.max(8, cellWidth * 0.3))}px`;

        // Show the count and share when a cell is hovered
        const showCellDetails = () => {
          highlight.setAttribute('x', cellX);
          highlight.setAttribute('y', cellY);
          highlight.setAttribute('width', cellWidth);
          highlight.setAttribute('height', cellHeight);
          svg.appendChild(highlight);
          highlight.style.display = '';
          G20.tooltip(
            svg,
            `<strong>${year} · Age ${age}</strong><br>` +
            `Share: <strong>${G20.percent(share)}</strong><br>` +
            `Hospitalisations: <strong>${G20.format(counts[yearIndex][ageIndex])}</strong>`,
            cellX + cellWidth / 2,
            cellY + cellHeight / 2
          );
        };
        const hideCellDetails = () => {
          highlight.style.display = 'none';
          G20.hideTooltip();
        };
        cell.addEventListener('mouseenter', showCellDetails);
        cell.addEventListener('mouseleave', hideCellDetails);
      });
    });

    // Add colour stops so the legend matches the heat map
    const legendWidth = Math.min(220, width - margin.left - margin.right);
    const legendX = (width - legendWidth) / 2;
    const legendY = height - 38;
    const defs = G20.svg('defs', {}, svg);
    const gradient = G20.svg('linearGradient', {
      id: 'q5HeatmapScale',
      x1: '0%',
      x2: '100%',
      y1: '0%',
      y2: '0%'
    }, defs);
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach(position => G20.svg('stop', {
      offset: `${position * 100}%`,
      'stop-color': color(position * 33)
    }, gradient));
    G20.svg('rect', {
      x: legendX,
      y: legendY,
      width: legendWidth,
      height: 10,
      rx: 4,
      fill: 'url(#q5HeatmapScale)'
    }, svg);
    const legendTitle = G20.svg('text', {
      x: width / 2,
      y: legendY - 7,
      'text-anchor': 'middle',
      class: 'heatmap-legend-label'
    }, svg);
    legendTitle.textContent = 'Share of hospitalisations';
    const lowLabel = G20.svg('text', {
      x: legendX,
      y: legendY + 25,
      'text-anchor': 'start',
      class: 'heatmap-legend-label'
    }, svg);
    lowLabel.textContent = '0%';
    const highLabel = G20.svg('text', {
      x: legendX + legendWidth,
      y: legendY + 25,
      'text-anchor': 'end',
      class: 'heatmap-legend-label'
    }, svg);
    highLabel.textContent = '33%';

    // Describe the chart for screen readers
    svg.setAttribute('aria-label',
      `Heat map of ${selectedSex === 'All' ? 'all-sex' : selectedSex.toLowerCase()} hospitalisation shares by age group and year from ${visibleYears[0]} to ${visibleYears[visibleYears.length - 1]}, with a fixed colour scale from 0 to 33 percent`);

    // Find the top age group each year and combine matching years
    const leaderRuns = [];
    visibleYears.forEach(year => {
      const yearIndex = yearIndexes.get(year);
      const yearShares = shares[yearIndex];
      const age = G20.AGE_ORDER[yearShares.indexOf(Math.max(...yearShares))];
      const previousRun = leaderRuns[leaderRuns.length - 1];
      if (previousRun && previousRun.age === age && previousRun.end === year - 1) {
        previousRun.end = year;
      } else {
        leaderRuns.push({ age, start: year, end: year });
      }
    });

    const leaderNote = leaderRuns.length === 1
      ? `The ${leaderRuns[0].age} age group had the highest share every year from ` +
        `${leaderRuns[0].start} through ${leaderRuns[0].end}.`
      : `The highest share belonged to ${leaderRuns.map(run =>
        `${run.age} in ${run.start === run.end ? run.start : `${run.start}-${run.end}`}`
      ).join('; ')}.`;
    const sexNote = selectedSex === 'All'
      ? 'Male and female counts are combined before calculating each yearly share.'
      : `Each percentage is ${selectedSex.toLowerCase()} hospitalisations for the age group ` +
        `divided by total ${selectedSex.toLowerCase()} hospitalisations that year.`;
    document.querySelector('#q5Insight').textContent =
      `${sexNote} ${leaderNote} The colour scale is fixed from 0% to 33%.`;
  };
})();

