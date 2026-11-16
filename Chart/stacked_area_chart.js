// Chart 5 combines sexes and shows each age group's share of hospitalisations over time.
// "All ages" stacks all groups; an age button isolates that group's share trend.
// The year slider moves the marker and updates the tooltip and summary.
window.renderStackedAreaChart = (function () {
  // Keep the active age filter and loaded data available between redraws.
  let selectedAge = 'all'; // 'all', '0-7', '8-16', '17-25', '26-39', '40-64', '65-74', '75+'
  let cachedData = null;

  return function (data) {
    const { G20 } = window;
    // Reuse the loaded data when a filter triggers a redraw without passing data.
    cachedData = data || cachedData;
    if (!cachedData) return;

    // Clear the previous drawing and read the chart size and selected year.
    const svg = G20.clear('#areaChart');
    const [width, height] = G20.size(svg);
    const margin = { left: 75, right: 35, top: 38, bottom: 44 };
    const yearControl = document.querySelector('#q5Year');
    const selectedYear = Number(yearControl.value);
    const selectedYearIndex = G20.YEARS.indexOf(selectedYear);
    const selectedAgeIndex = G20.AGE_ORDER.indexOf(selectedAge);
    document.querySelector('#q5YearValue').textContent = selectedYear;

    // Position tooltips to the left of their data point while keeping them onscreen.
    const showChartTooltip = (text, anchorX, anchorY) => {
      G20.tooltip(svg, text, anchorX, anchorY);
      const tooltip = svg.parentElement.querySelector('.tooltip');
      if (!tooltip) return;

      tooltip.style.whiteSpace = 'normal';
      tooltip.style.maxWidth = '250px';
      const tooltipWidth = tooltip.getBoundingClientRect().width;
      const shellWidth = svg.parentElement.getBoundingClientRect().width;
      const minCenter = tooltipWidth / 2 + 8;
      const maxCenter = Math.max(minCenter, shellWidth - tooltipWidth / 2 - 8);
      const leftCenter = Math.max(minCenter, Math.min(anchorX - tooltipWidth / 2 - 12, maxCenter));
      tooltip.style.left = `${leftCenter}px`;
    };

    // Sum hospitalisations by year and age group, combining all sexes.
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

    // Convert years and percentages into SVG coordinates.
    const x = year => margin.left + (width - margin.left - margin.right) * (year - 2011) / 10;

    // Keep the full 0-100% scale for all ages; zoom single-age views to their data.
    const maxShare = selectedAge === 'all'
      ? 100
      : Math.max(...stackedShares.map(yearShares => yearShares[selectedAgeIndex]), 0.1);
    const yScale = d3.scaleLinear()
      .domain([0, maxShare])
      .nice(5)
      .range([height - margin.bottom, margin.top]);
    const yTicks = selectedAge === 'all' ? [0, 20, 40, 60, 80, 100] : yScale.ticks(5);
    const yTitle = 'Share of hospitalisations (%)';

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
      }, svg).textContent = tickVal;
    });

    // Y-axis Title
    G20.svg('text', {
      x: margin.left - 12,
      y: margin.top - 28,
      'text-anchor': 'start',
      'font-weight': 700,
      'font-size': '14px',
      fill: '#17232e'
    }, svg).textContent = yTitle;

    // Create SVG groups to organize the area shapes, trend lines, and hover points.
    const areasGroup = G20.svg('g', { class: 'stacked-areas-group' }, svg);
    const linesGroup = G20.svg('g', { class: 'lines-group' }, svg);
    const pointsGroup = G20.svg('g', { class: 'points-group' }, svg);

    if (selectedAge === 'all') {
      // 100% Stacked Area Chart (7 layers)
      let baseShares = Array(11).fill(0);

      // Build each stacked band on top of the age groups drawn before it.
      G20.AGE_ORDER.forEach((age, ageIdx) => {
        const topShares = stackedShares.map((row, i) => baseShares[i] + row[ageIdx]);
        const lowerShares = baseShares.slice();
        const ageColor = G20.COLORS[ageIdx];

        // Trace the upper and lower edges to make a filled area for this age group.
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
          'data-age': age,
          fill: ageColor,
          opacity: 0.88,
          stroke: '#ffffff',
          'stroke-width': 1,
          class: `area-layer area-${age}`,
          style: 'cursor: pointer;'
        }, areasGroup);

        // Show this group's share and count for the year selected by the slider.
        areaPath.addEventListener('mouseenter', () => {
          areaPath.setAttribute('opacity', '1');
          const share = stackedShares[selectedYearIndex][ageIdx];
          const count = ageCounts[selectedYearIndex][ageIdx];
          const tooltipY = yScale(lowerShares[selectedYearIndex] + share / 2);
          showChartTooltip(
            `<strong>Age ${age}</strong><br>${selectedYear} share: <strong>${share.toFixed(1)}%</strong>` +
            `<br>Hospitalisations: <strong>${G20.format(count)}</strong>`,
            x(selectedYear),
            tooltipY
          );
        });
        areaPath.addEventListener('mouseleave', () => {
          areaPath.setAttribute('opacity', '0.88');
          G20.hideTooltip();
        });

        baseShares = topShares;
      });
    } else {
      // In a filtered view, show only the selected age group's share over time.
      const ageIdx = selectedAgeIndex;
      const ageColor = G20.COLORS[ageIdx];
      const singleShares = stackedShares.map(yearShares => yearShares[ageIdx]);

      // Fill the space between this group's share line and zero.
      const areaPts = [
        ...G20.YEARS.map((year, i) => [x(year), yScale(singleShares[i])]),
        ...G20.YEARS.slice().reverse().map(year => [x(year), yScale(0)])
      ];
      const areaD = areaPts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ') + 'Z';

      G20.svg('path', {
        d: areaD,
        'data-age': selectedAge,
        fill: ageColor,
        opacity: 0.35,
        class: 'single-age-area'
      }, areasGroup);

      // Draw a stronger outline to make the selected group's trend easy to follow.
      const linePts = G20.YEARS.map((year, i) => [x(year), yScale(singleShares[i])]);
      G20.svg('polyline', {
        points: linePts.map(pt => pt.join(',')).join(' '),
        'data-age': selectedAge,
        fill: 'none',
        stroke: ageColor,
        'stroke-width': 3.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        class: 'single-age-line'
      }, linesGroup);

      // Add hoverable year points with counts, shares, and change since 2011.
      linePts.forEach((pt, i) => {
        const year = G20.YEARS[i];
        const count = ageCounts[i][ageIdx];
        const share = stackedShares[i][ageIdx];
        const base2011 = ageCounts[0][ageIdx];
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
          showChartTooltip(
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
    }

    // Label each year along the horizontal axis.
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

    // Highlight the selected year without changing the historical area data.
    const markerX = x(selectedYear);
    G20.svg('line', {
      x1: markerX,
      x2: markerX,
      y1: margin.top,
      y2: height - margin.bottom,
      class: 'area-year-marker'
    }, svg);
    G20.svg('text', {
      x: markerX,
      y: margin.top - 8,
      'text-anchor': 'middle',
      class: 'area-marker-label'
    }, svg).textContent = selectedYear;

    // Rebuild the age buttons and mark the active all-ages or single-age view.
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

    // Morph the existing area shapes into the newly selected age view.
    function animateAgeChart() {
      G20.hideTooltip();
      const previousAreas = new Map(
        [...svg.querySelectorAll('path.area-layer')].map(path => [path.dataset.age, {
          d: path.getAttribute('d'),
          fill: path.getAttribute('fill'),
          opacity: path.getAttribute('opacity')
        }])
      );
      const oldSingleArea = svg.querySelector('path.single-age-area');
      const previousSingleArea = oldSingleArea ? {
        age: oldSingleArea.dataset.age,
        d: oldSingleArea.getAttribute('d'),
        fill: oldSingleArea.getAttribute('fill'),
        opacity: oldSingleArea.getAttribute('opacity')
      } : null;
      const oldSingleLine = svg.querySelector('polyline.single-age-line');
      const previousLine = oldSingleLine ? {
        points: oldSingleLine.getAttribute('points'),
        stroke: oldSingleLine.getAttribute('stroke')
      } : null;

      // Use a collapsed polygon as the starting shape for age groups entering the chart.
      const baselineY = height - margin.bottom;
      const collapsedPoints = [
        ...G20.YEARS.map(year => [x(year), baselineY]),
        ...G20.YEARS.slice().reverse().map(year => [x(year), baselineY])
      ];
      const collapsedArea = `${collapsedPoints
        .map((point, index) => `${index ? 'L' : 'M'}${point[0]},${point[1]}`).join(' ')}Z`;

      window.renderStackedAreaChart(cachedData);

      const duration = 600;
      const ease = d3.easeCubicInOut;
      if (selectedAge !== 'all') {
        const areaGroup = svg.querySelector('.stacked-areas-group');
        previousAreas.forEach((previous, age) => {
          if (age === selectedAge) return;
          const exitingArea = G20.svg('path', {
            d: previous.d,
            fill: previous.fill,
            opacity: previous.opacity,
            stroke: '#ffffff',
            'stroke-width': 1,
            class: 'area-layer-exit',
            style: 'pointer-events: none;'
          }, areaGroup);
          areaGroup.insertBefore(exitingArea, areaGroup.firstChild);
          d3.select(exitingArea).transition()
            .duration(duration)
            .ease(ease)
            .attr('d', collapsedArea)
            .attr('opacity', 0)
            .remove();
        });
      }

      const shapes = [...svg.querySelectorAll('path.area-layer, path.single-age-area')];
      shapes.forEach(path => {
        const targetD = path.getAttribute('d');
        const targetFill = path.getAttribute('fill');
        const targetOpacity = path.getAttribute('opacity');
        const isSingleArea = path.classList.contains('single-age-area');
        const previous = isSingleArea
          ? previousSingleArea || previousAreas.get(path.dataset.age)
          : previousAreas.get(path.dataset.age) ||
            (previousSingleArea && previousSingleArea.age === path.dataset.age ? previousSingleArea : null);

        path.setAttribute('d', previous ? previous.d : collapsedArea);
        path.setAttribute('fill', previous ? previous.fill : targetFill);
        path.setAttribute('opacity', previous ? previous.opacity : 0);
        d3.select(path).interrupt().transition()
          .duration(duration)
          .ease(ease)
          .attr('d', targetD)
          .attr('fill', targetFill)
          .attr('opacity', targetOpacity);
      });

      const line = svg.querySelector('polyline.single-age-line');
      if (line) {
        const targetPoints = line.getAttribute('points');
        const targetStroke = line.getAttribute('stroke');
        const previousArea = previousAreas.get(line.dataset.age);
        // When leaving the stacked view, trace the selected band's upper edge into a line.
        const previousTopLine = previousArea
          ? (previousArea.d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [])
            .slice(0, G20.YEARS.length * 2)
            .reduce((points, value, index, values) => {
              if (index % 2 === 0) points.push(`${value},${values[index + 1]}`);
              return points;
            }, [])
            .join(' ')
          : null;

        if (previousLine) {
          line.setAttribute('points', previousLine.points);
          line.setAttribute('stroke', previousLine.stroke);
        } else if (previousTopLine) {
          line.setAttribute('points', previousTopLine);
          line.setAttribute('stroke', previousArea.fill);
          line.style.opacity = 0.6;
        }
        d3.select(line).interrupt().transition()
          .duration(duration)
          .ease(ease)
          .attr('points', targetPoints)
          .attr('stroke', targetStroke)
          .style('opacity', 1);
      } else if (previousLine) {
        const exitLine = G20.svg('polyline', {
          points: previousLine.points,
          fill: 'none',
          stroke: previousLine.stroke,
          'stroke-width': 3.5,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          class: 'single-age-line-exit'
        }, svg.querySelector('.lines-group'));
        d3.select(exitLine).transition()
          .duration(duration)
          .ease(ease)
          .style('opacity', 0)
          .remove();
      }
    }

    // Update the text summary to match the selected year and age view.
    const insightElem = document.querySelector('#q5Insight');

    if (insightElem) {
      if (selectedAge === 'all') {
        // Report the largest age share and the biggest share change since 2011.
        const selectedShares = stackedShares[selectedYearIndex];
        const leadingIndex = selectedShares.reduce(
          (best, share, index) => share > selectedShares[best] ? index : best,
          0
        );
        const leadingAge = G20.AGE_ORDER[leadingIndex];
        const leadingShare = selectedShares[leadingIndex];

        if (selectedYearIndex === 0) {
          insightElem.innerHTML =
            `In <strong>${selectedYear}</strong>, age group <strong>${leadingAge}</strong> had the largest share ` +
            `at <strong>${G20.percent(leadingShare)}</strong>. Move the slider to compare other years with 2011.`;
        } else {
          const largestChange = selectedShares
            .map((share, index) => ({ index, change: share - stackedShares[0][index] }))
            .reduce((largest, change) =>
              Math.abs(change.change) > Math.abs(largest.change) ? change : largest
            );
          const changeAge = G20.AGE_ORDER[largestChange.index];
          const changeAmount = Math.abs(largestChange.change).toFixed(1);
          const direction = largestChange.change > 0 ? 'increased' : 'decreased';

          insightElem.innerHTML =
            `In <strong>${selectedYear}</strong>, age group <strong>${leadingAge}</strong> had the largest share ` +
            `at <strong>${G20.percent(leadingShare)}</strong>. Since 2011, the share for ` +
            `<strong>${changeAge}</strong> has ${direction} the most, by <strong>${changeAmount} percentage points</strong>.`;
        }
      } else {
        // For one age group, compare its selected-year count with 2011 and 2021.
        const ageIdx = selectedAgeIndex;
        const count2011 = ageCounts[0][ageIdx];
        const count2021 = ageCounts[10][ageIdx];
        const countYear = ageCounts[selectedYearIndex][ageIdx];
        const shareYear = stackedShares[selectedYearIndex][ageIdx];
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
