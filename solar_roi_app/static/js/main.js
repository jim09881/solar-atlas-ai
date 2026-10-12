// Main JavaScript for Solar ROI Calculator

let profitChart = null;
let sea
// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    initMap();
    setupAssistant();
});

// Set up event listeners
function setupEventListeners() {
    console.log('setupEventListeners called');
    
    // Form submission
    const form = document.getElementById('roiForm');
    if (form) {
        console.log('Form found');
        form.addEventListener('submit', function(e) {
            console.log('Form submit event triggered');
            e.preventDefault();
            calculateROI();
        });
    } else {
        console.error('roiForm not found');
    }
    
    // Direct button click handler as backup
    const btnCalculate = document.getElementById('btn-calculate-main');
    if (btnCalculate) {
        console.log('Calculate button found');
        btnCalculate.addEventListener('click', function(e) {
            console.log('Button click event triggered');
            e.preventDefault();
            calculateROI();
        });
    } else {
        console.error('btn-calculate-main not found');
    }

    // Range slider sync
    const systemSizeRange = document.getElementById('system_size_range');
    const systemSizeInput = document.getElementById('system_size');

    systemSizeRange.addEventListener('input', function() {
        systemSizeInput.value = this.value;
    });

    systemSizeInput.addEventListener('input', function() {
        systemSizeRange.value = this.value;
    });

    // Toggle Advanced Options
    const btnToggle = document.querySelector('.btn-toggle-advanced');
    const advancedPanel = document.getElementById('advancedPanel');
    btnToggle.addEventListener('click', function() {
        advancedPanel.classList.toggle('hidden');
        btnToggle.classList.toggle('active');
    });

    // Financing toggle
    const financingEnable = document.getElementById('financing_enable');
    const financingPanel = document.getElementById('financingPanel');
    financingEnable.addEventListener('change', function() {
        financingPanel.style.display = this.checked ? 'block' : 'none';
    });

    // Electricity estimation
    const btnEstimate = document.getElementById('btn-estimate-usage');
    btnEstimate.addEventListener('click', estimateElectricityUsage);

    // Quick location buttons
    const locationButtons = document.querySelectorAll('.btn-location');
    locationButtons.forEach(button => {
        button.addEventListener('click', function() {
            const lat = parseFloat(this.getAttribute('data-lat'));
            const lon = parseFloat(this.getAttribute('data-lon'));
            
            document.getElementById('latitude').value = lat;
            document.getElementById('longitude').value = lon;
            
            // อัปเดต marker บนแผนที่ (ใช้ Leaflet หากมี)
            try {
                if (typeof marker !== 'undefined' && marker && typeof L !== 'undefined') {
                    const latlng = L.latLng(lat, lon);
                    marker.setLatLng(latlng);
                    if (typeof map !== 'undefined' && map && typeof map.setView === 'function') {
                        map.setView(latlng, map.getZoom ? map.getZoom() : 15);
                    }
                        // Battery toggle
                        const batteryEnable = document.getElementById('battery_enable');
                        const batteryPanel = document.getElementById('batteryPanel');
                        if (batteryEnable && batteryPanel) {
                            batteryEnable.addEventListener('change', function() {
                                batteryPanel.style.display = this.checked ? 'block' : 'none';
                            });
                        }
                }
            } catch (err) {
                console.warn('Could not update marker for quick location:', err);
            }
        });
    });

    // Monthly bill to electricity price calculation
    const monthlyBillInput = document.getElementById('monthly_bill');
    const electricityPriceInput = document.getElementById('electricity_price');
    if (monthlyBillInput && electricityPriceInput) {
        monthlyBillInput.addEventListener('input', function() {
            const monthlyBill = parseFloat(this.value);
            if (monthlyBill > 0) {
                // สมมติว่าใช้ไฟเฉลี่ย 300-500 kWh/เดือน (ขึ้นอยู่กับขนาดบ้าน)
                // ใช้ค่าเฉลี่ย 400 kWh/เดือน
                const avgMonthlyKwh = 400;
                const calculatedPrice = monthlyBill / avgMonthlyKwh;
                electricityPriceInput.value = calculatedPrice.toFixed(2);
            }
        });
    }

    // Image prediction button
    const btnPredictImage = document.getElementById('btn-predict-image');
    if (btnPredictImage) {
        btnPredictImage.addEventListener('click', predictImage);
    }

    // GIF creation button
    const btnCreateGif = document.getElementById('btn-create-gif');
    if (btnCreateGif) {
        btnCreateGif.addEventListener('click', createSolarGif);
    }

    // Reset custom settings button
    const btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) {
        btnResetSettings.addEventListener('click', resetCustomSettings);
    }

    // Export buttons
    const btnExportPDF = document.getElementById('btn-export-pdf');
    const btnExportExcel = document.getElementById('btn-export-excel');
    const btnPrint = document.getElementById('btn-print');
    
    if (btnExportPDF) btnExportPDF.addEventListener('click', exportToPDF);
    if (btnExportExcel) btnExportExcel.addEventListener('click', exportToExcel);
    if (btnPrint) btnPrint.addEventListener('click', printReport);

    // Real-time form validation
    setupFormValidation();

    // Keyboard shortcuts
    setupKeyboardShortcuts();
}

// Estimate electricity usage based on household info
function estimateElectricityUsage() {
    const people = parseInt(document.getElementById('household_people').value) || 4;
    const homeType = document.getElementById('home_type').value;
    const acHours = parseInt(document.getElementById('air_conditioner_hours').value) || 8;
    
    // Base consumption (kWh/month)
    let baseUsage = people * 50;  // ~50 kWh per person/month
    
    // Add home type factor
    const homeFactors = {
        'apartment': 0.8,
        'house_small': 1.0,
        'house_large': 1.6,
        'villa': 1.6
    };
    baseUsage *= homeFactors[homeType] || 1.0;
    
    // Add AC consumption (AC uses ~1.5 kW, 30 days)
    const acUsage = acHours * 1.5 * 30 / 1000;  // rough estimate
    const totalKwh = baseUsage + acUsage;
    
    // Recommend kW size (rule of thumb: peak load / 4-5)
    const recommendedKw = Math.ceil(totalKwh / 150);  // 150-200 kWh per kW recommended
    
    // Show result
    document.getElementById('estimatedKwh').textContent = totalKwh.toFixed(0);
    document.getElementById('recommendedKw').textContent = recommendedKw;
    document.getElementById('estimationResult').style.display = 'block';
    
    // Auto-fill system size
    document.getElementById('system_size').value = recommendedKw;
    document.getElementById('system_size_range').value = recommendedKw;
}

// Calculate ROI
async function calculateROI() {
    console.log('calculateROI called');
    
    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;
    const electricity_price = document.getElementById('electricity_price').value;
    const system_size = document.getElementById('system_size').value;
    const cloud_coverage = document.getElementById('cloud_coverage') ? document.getElementById('cloud_coverage').value : 'partly';
    const financing_enable_el = document.getElementById('financing_enable');
    const financing_enable = financing_enable_el ? financing_enable_el.checked : false;
    const loan_years_el = document.getElementById('loan_years');
    const interest_rate_el = document.getElementById('interest_rate');
    const loan_years = loan_years_el ? parseInt(loan_years_el.value) : null;
    const interest_rate = interest_rate_el ? parseFloat(interest_rate_el.value) : null;

    console.log('Input values:', {latitude, longitude, electricity_price, system_size});

    // Get custom settings (ensure they are numbers or null)
    let custom_panel_cost = null;
    let custom_installation_multiplier = null;
    let custom_maintenance_rate = null;
    let custom_inflation_rate = null;
    let custom_degradation_rate = null;
    let custom_analysis_period = null;
    let custom_discount_rate = null;
    
    const customPanelCostEl = document.getElementById('custom_panel_cost');
    const customInstallMultEl = document.getElementById('custom_installation_multiplier');
    const customMaintRateEl = document.getElementById('custom_maintenance_rate');
    const customInflRateEl = document.getElementById('custom_inflation_rate');
    const customDegRateEl = document.getElementById('custom_degradation_rate');
    const customAnalysisPeriodEl = document.getElementById('custom_analysis_period');
    const customDiscountRateEl = document.getElementById('custom_discount_rate');
    
    if (customPanelCostEl && customPanelCostEl.value) {
        const val = parseFloat(customPanelCostEl.value);
        if (!isNaN(val)) custom_panel_cost = val;
    }
    if (customInstallMultEl && customInstallMultEl.value) {
        const val = parseFloat(customInstallMultEl.value);
        if (!isNaN(val)) custom_installation_multiplier = val;
    }
    if (customMaintRateEl && customMaintRateEl.value) {
        const val = parseFloat(customMaintRateEl.value);
        if (!isNaN(val)) custom_maintenance_rate = val;
    }
    if (customInflRateEl && customInflRateEl.value) {
        const val = parseFloat(customInflRateEl.value);
        if (!isNaN(val)) custom_inflation_rate = val;
    }
    if (customDegRateEl && customDegRateEl.value) {
        const val = parseFloat(customDegRateEl.value);
        if (!isNaN(val)) custom_degradation_rate = val;
    }
    if (customAnalysisPeriodEl && customAnalysisPeriodEl.value) {
        const val = parseInt(customAnalysisPeriodEl.value);
        if (!isNaN(val)) custom_analysis_period = val;
    }
    if (customDiscountRateEl && customDiscountRateEl.value) {
        const val = parseFloat(customDiscountRateEl.value);
        if (!isNaN(val)) custom_discount_rate = val;
    }

    // Validate input
    if (!latitude || !longitude || !electricity_price || !system_size) {
        const msg = 'กรุณากรอกข้อมูลให้ครบถ้วน';
        console.error(msg);
        showError(msg);
        hideLoading();
        return;
    }
    
    console.log('Basic validation passed');
    
    // Validate system_size range
    if (system_size < 1 || system_size > 300) {
        const msg = 'ขนาดระบบต้องอยู่ระหว่าง 1-300 kW (แนะนำ 3-10 kW สำหรับบ้าน, 10-300 kW สำหรับอาคาร)';
        console.error(msg);
        showError(msg);
        hideLoading();
        return;
    }
    
    console.log('System size validation passed');

    // Show loading spinner
    showLoading();
    hideError();
    hideResults();

    try {
        // Build request body - only include non-null custom settings
        const requestBody = {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            electricity_price: parseFloat(electricity_price),
            system_size: parseFloat(system_size),
            cloud_coverage: cloud_coverage,
            financing_enable: financing_enable,
            loan_years: financing_enable ? loan_years : undefined,
            interest_rate: financing_enable ? interest_rate : undefined
        };
        
        // Add custom settings only if they are not null
        if (custom_panel_cost !== null) requestBody.custom_panel_cost = custom_panel_cost;
        if (custom_installation_multiplier !== null) requestBody.custom_installation_multiplier = custom_installation_multiplier;
        if (custom_maintenance_rate !== null) requestBody.custom_maintenance_rate = custom_maintenance_rate;
        if (custom_inflation_rate !== null) requestBody.custom_inflation_rate = custom_inflation_rate;
        if (custom_degradation_rate !== null) requestBody.custom_degradation_rate = custom_degradation_rate;
        if (custom_analysis_period !== null) requestBody.custom_analysis_period = custom_analysis_period;
        if (custom_discount_rate !== null) requestBody.custom_discount_rate = custom_discount_rate;
        
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'เกิดข้อผิดพลาดในการคำนวณ');
        }
                // Add battery settings
                const batteryEnable = document.getElementById('battery_enable');
                if (batteryEnable && batteryEnable.checked) {
                    requestBody.battery_enable = true;
                    requestBody.battery_capacity = parseFloat(document.getElementById('battery_capacity').value);
                    requestBody.battery_cost = parseFloat(document.getElementById('battery_cost').value);
                    requestBody.battery_efficiency = parseFloat(document.getElementById('battery_efficiency').value) / 100;
                    requestBody.battery_lifespan = parseInt(document.getElementById('battery_lifespan').value);
                } else {
                    requestBody.battery_enable = false;
                }

        const data = await response.json();
        displayResults(data);
        
        // Show success message
        showSuccess('คำนวณสำเร็จแล้ว! ดูผลลัพธ์ด้านล่าง');
        
        // Check if comparison is enabled
        const enableComparison = document.getElementById('enable_comparison');
        if (enableComparison && enableComparison.checked) {
            await calculateComparison(data);
        }

    } catch (error) {
        console.error('Error:', error);
        hideLoading(); // ซ่อน loading เมื่อเกิด error
        showBetterError(error);
    } finally {
        // ตรวจสอบให้แน่ใจว่า loading ถูกซ่อนเสมอ
        hideLoading();
    }
}

// Display results
function displayResults(data) {
    console.log('Displaying results:', data);
    
    // ซ่อน loading spinner
    hideLoading();
    
    // แสดงผลลัพธ์ก่อน (สำคัญมาก!)
    showResults();
    
    // ตรวจสอบว่ามี element ที่ต้องการหรือไม่
    if (!document.getElementById('capitalCost')) {
        console.error('Result elements not found!');
        return;
    }

    // Format number with thousands separator
    const formatNumber = (num) => {
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(num);
    };

    // Update result values
    document.getElementById('capitalCost').textContent = formatNumber(data.capital_cost);
    
    // Calculate and display cost per watt (บาท/วัตต์)
    const costPerWatt = data.capital_cost / (data.system_size_kw * 1000); // convert kW to W
    document.getElementById('costPerWatt').textContent = formatNumber(costPerWatt);
    
    document.getElementById('annualProduction').textContent = formatNumber(data.annual_production);
    
    // Display battery cost if available
    if (data.battery_cost) {
        document.getElementById('batteryCost').textContent = formatNumber(data.battery_cost);
    } else {
        document.getElementById('batteryCost').textContent = '-';
    }

    document.getElementById('annualRevenue').textContent = formatNumber(data.annual_revenue);
    
    // Update daily GHI display
    const dailyGHIElement = document.getElementById('dailyGHI');
    if (dailyGHIElement && data.ghi) {
        dailyGHIElement.textContent = formatNumber(data.ghi);
    }
    
    // Calculate and display environmental impact
    calculateEnvironmentalImpact(data.annual_production, data.system_size_kw);
    
    // Setup chart tabs
    setupChartTabs();
    
    if (data.payback_period) {
        document.getElementById('paybackPeriod').textContent = data.payback_period + ' ปี';
    } else {
        // ถ้ายังไม่ถึง payback ให้คำนวณต่อจากข้อมูลที่มี
        // ใช้ข้อมูลปีสุดท้ายเพื่อประมาณการ
        if (data.yearly_data && data.yearly_data.length > 0) {
            const lastYear = data.yearly_data[data.yearly_data.length - 1];
            const capitalCost = data.capital_cost;
            const cumulativeActual = lastYear.cumulative_actual;
            
            if (cumulativeActual < capitalCost && lastYear.profit > 0) {
                // คำนวณว่าต้องใช้เวลาอีกกี่ปี
                const remaining = capitalCost - cumulativeActual;
                const avgProfit = lastYear.profit; // ใช้ profit ปีสุดท้ายเป็นค่าเฉลี่ย
                const additionalYears = Math.ceil(remaining / avgProfit);
                const totalYears = 5 + additionalYears;
                
                document.getElementById('paybackPeriod').textContent = totalYears + ' ปี';
            } else {
                document.getElementById('paybackPeriod').textContent = '> 30 ปี';
            }
        } else {
            document.getElementById('paybackPeriod').textContent = '> 30 ปี';
        }
    }
    
    if (data.roi_5_years) {
        document.getElementById('roi25Years').textContent = formatNumber(data.roi_5_years) + '%';
    } else {
        document.getElementById('roi25Years').textContent = '-';
    }
    
    if (data.total_savings_5_years) {
        document.getElementById('totalSavings').textContent = formatNumber(data.total_savings_5_years);
    }

    // Update solar information
    document.getElementById('ghiDaily').textContent = formatNumber(data.ghi || 0);
    document.getElementById('ghiAnnual').textContent = formatNumber(data.annual_ghi || 0);

    // Financing info (if any)
    const financingSection = document.getElementById('financingSummary');
    if (financingSection) {
        if (data.monthly_payment && data.loan_years) {
            financingSection.classList.remove('hidden');
            document.getElementById('monthlyPayment').textContent = formatNumber(data.monthly_payment);
            document.getElementById('loanYears').textContent = data.loan_years;
            document.getElementById('totalInterest').textContent = formatNumber(data.total_interest || 0);
        } else {
            financingSection.classList.add('hidden');
        }
    }

    // Fill yearly table
    const tbody = document.getElementById('yearlyTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        (data.yearly_data || []).forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>ปีที่ ${row.year}</td>
                <td class="num">${formatNumber(row.production)}</td>
                <td class="num">${formatNumber(row.revenue)}</td>
                <td class="num">${formatNumber(row.maintenance)}</td>
                <td class="num">${formatNumber(row.profit)}</td>
                <td class="num">${formatNumber(row.cumulative_actual)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Draw sun path diagram (if SVG exists)
    if (Array.isArray(data.hourly_angles) && data.hourly_angles.length > 0) {
        try {
            drawSunPathDiagram(data.hourly_angles);
        } catch (error) {
            console.error('Error drawing sun path:', error);
        }
    }

    // Create charts
    if (data.yearly_data && data.yearly_data.length > 0) {
        try {
            createChart(data.yearly_data);
            createProductionChart(data.yearly_data);
        } catch (error) {
            console.error('Error creating charts:', error);
        }
    }

    // Scroll to results after a short delay
    setTimeout(() => {
        const resultsCard = document.getElementById('resultsCard');
        if (resultsCard && !resultsCard.classList.contains('hidden')) {
            resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 500);
    
    console.log('Results displayed successfully');
}

// Draw polar diagram showing sun path
function drawSunPathDiagram(hourlyAngles) {
    const svg = document.getElementById('sunPathDiagram');
    if (!svg) return;
    
    svg.innerHTML = '';
    
    const width = 400;
    const height = 400;
    const center = { x: width / 2, y: height / 2 };
    const radius = 140;
    
    // Draw sky dome (light blue background already in SVG style)
    
    // Draw concentric circles (altitude lines)
    const altitudes = [90, 60, 30, 0];
    altitudes.forEach(alt => {
        const r = radius * (1 - alt / 90);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', center.x);
        circle.setAttribute('cy', center.y);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', alt === 0 ? '#999' : '#ccc');
        circle.setAttribute('stroke-width', alt === 0 ? 2 : 1);
        circle.setAttribute('stroke-dasharray', alt === 0 ? '0' : '5,5');
        svg.appendChild(circle);
        
        // Altitude labels
        if (alt > 0) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', center.x + r + 5);
            text.setAttribute('y', center.y - 5);
            text.setAttribute('font-size', '11px');
            text.setAttribute('fill', '#999');
            text.textContent = `${alt}°`;
            svg.appendChild(text);
        }
    });
    
    // Draw cardinal directions
    const directions = [
        { name: 'N', angle: 0 },
        { name: 'E', angle: 90 },
        { name: 'S', angle: 180 },
        { name: 'W', angle: 270 }
    ];
    
    directions.forEach(dir => {
        const rad = (dir.angle * Math.PI) / 180;
        const x = center.x + (radius + 20) * Math.sin(rad);
        const y = center.y - (radius + 20) * Math.cos(rad);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '14px');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#333');
        text.textContent = dir.name;
        svg.appendChild(text);
        
        // Draw direction lines
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', center.x);
        line.setAttribute('y1', center.y);
        line.setAttribute('x2', center.x + radius * Math.sin(rad));
        line.setAttribute('y2', center.y - radius * Math.cos(rad));
        line.setAttribute('stroke', '#ddd');
        line.setAttribute('stroke-width', 1);
        svg.appendChild(line);
    });
    
    // Draw sun path (connect hourly points)
    const pathPoints = hourlyAngles.map(item => {
        const elevation = item.elevation;
        const azimuth = item.azimuth;
        
        // Convert to polar coords
        const r = radius * (1 - elevation / 90);
        const rad = (azimuth * Math.PI) / 180;
        
        return {
            x: center.x + r * Math.sin(rad),
            y: center.y - r * Math.cos(rad),
            time: item.time_str,
            elevation: elevation,
            azimuth: azimuth
        };
    });
    
    // Draw path line
    const pathD = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', '#ff9800');
    path.setAttribute('stroke-width', 2);
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '0.7');
    svg.appendChild(path);
    
    // Draw sun positions (dots and labels)
    pathPoints.forEach((p, i) => {
        // Circle for each hour
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', p.x);
        circle.setAttribute('cy', p.y);
        circle.setAttribute('r', 4);
        circle.setAttribute('fill', '#ff9800');
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', 2);
        circle.setAttribute('opacity', '0.9');
        
        // Add tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${p.time} - Elevation: ${p.elevation.toFixed(1)}° Azimuth: ${p.azimuth.toFixed(1)}°`;
        circle.appendChild(title);
        
        svg.appendChild(circle);
        
        // Label every 2 hours to avoid crowding
        if (i % 2 === 0) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', p.x);
            text.setAttribute('y', p.y - 12);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '10px');
            text.setAttribute('fill', '#ff6600');
            text.setAttribute('font-weight', 'bold');
            text.textContent = p.time;
            svg.appendChild(text);
        }
    });
    
    // Add legend
    const legendY = height - 25;
    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    legend.setAttribute('x', 10);
    legend.setAttribute('y', legendY);
    legend.setAttribute('font-size', '11px');
    legend.setAttribute('fill', '#666');
    legend.textContent = '☀ = ตำแหน่งพระอาทิตย์ (มองลงจากท้องฟ้า)';
    svg.appendChild(legend);
}

// Create profit chart - 25-Year Financial Projection
function createChart(yearlyData) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (profitChart) {
        profitChart.destroy();
    }

    // Extend data to 25 years if needed
    const extendedData = extend25YearProjection(yearlyData);
    const years = extendedData.map(item => item.year);
    const cumulativeProfits = extendedData.map(item => item.cumulative);

    profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: '25-Year Financial Projection',
                    data: cumulativeProfits,
                    borderColor: '#333333',
                    backgroundColor: 'rgba(200, 200, 200, 0.4)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#333333',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: '📈 25-Year Financial Projection',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#333333',
                    padding: {
                        bottom: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(51, 51, 51, 0.95)',
                    padding: 12,
                    titleFont: {
                        size: 13
                    },
                    bodyFont: {
                        size: 12
                    },
                    callbacks: {
                        title: function(context) {
                            return 'ปีที่ ' + context[0].label;
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            return 'กำไรสะสม: ฿' + formatMillions(value);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#999999',
                        maxRotation: 0,
                        callback: function(value, index) {
                            // Show every 5th label
                            return index % 5 === 0 ? this.getLabelForValue(value) : '';
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.08)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#999999',
                        callback: function(value) {
                            return '฿' + formatMillions(value);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// Extend yearly data to 25 years projection
function extend25YearProjection(yearlyData) {
    if (!yearlyData || yearlyData.length === 0) return [];
    
    const extendedData = [];
    const lastYear = yearlyData[yearlyData.length - 1];
    const avgYearlyProfit = lastYear.profit || (lastYear.cumulative_actual / yearlyData.length);
    const degradationRate = 0.007; // 0.7% per year
    
    // Add year 0 (initial investment - negative)
    const capitalCost = parseFloat(document.getElementById('capitalCost')?.textContent?.replace(/,/g, '')) || 0;
    extendedData.push({
        year: 0,
        cumulative: -capitalCost
    });
    
    // Add existing data
    for (let i = 0; i < yearlyData.length; i++) {
        extendedData.push({
            year: yearlyData[i].year,
            cumulative: yearlyData[i].cumulative_actual - capitalCost
        });
    }
    
    // Extend to 25 years
    let lastCumulative = extendedData[extendedData.length - 1].cumulative;
    for (let year = yearlyData.length + 1; year <= 25; year++) {
        const degradation = Math.pow(1 - degradationRate, year - 1);
        const yearProfit = avgYearlyProfit * degradation;
        lastCumulative += yearProfit;
        extendedData.push({
            year: year,
            cumulative: lastCumulative
        });
    }
    
    return extendedData;
}

// Format number to millions (e.g., 1.9M)
function formatMillions(value) {
    if (Math.abs(value) >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(0) + 'K';
    }
    return value.toFixed(0);
}

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat('th-TH', {
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
    }).format(value);
}

// Store interval globally for cleanup
let loadingInterval = null;

function showLoading() {
    const loadingProgress = document.getElementById('loadingProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (loadingProgress) {
        // Clear any existing interval
        if (loadingInterval) {
            clearInterval(loadingInterval);
            loadingInterval = null;
        }
        
        // Reset progress
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        if (progressText) {
            progressText.textContent = 'กำลังคำนวณ... 0%';
        }
        
        loadingProgress.classList.remove('hidden');
        
        // Show enhanced loading with steps
        showLoadingWithSteps();
        
        // Simulate progress
        let progress = 0;
        loadingInterval = setInterval(() => {
            progress += Math.random() * 8 + 3;
            if (progress > 95) progress = 95; // จำกัดที่ 95% เพื่อรอ response
            if (progressBar) {
                progressBar.style.width = progress + '%';
            }
            if (progressText) {
                progressText.textContent = `กำลังคำนวณ... ${Math.round(progress)}%`;
            }
        }, 150); // ลดเวลา interval เป็น 150ms
    }
}

function hideLoading() {
    const loadingProgress = document.getElementById('loadingProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    // Clear interval immediately
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
    
    if (loadingProgress) {
        // Complete progress to 100%
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        if (progressText) {
            progressText.textContent = 'เสร็จสิ้น! 100%';
        }
        
        // Hide after short delay
        setTimeout(() => {
            loadingProgress.classList.add('hidden');
            // Reset progress bar for next use
            if (progressBar) {
                progressBar.style.width = '0%';
            }
            if (progressText) {
                progressText.textContent = 'กำลังคำนวณ... 0%';
            }
        }, 600);
    }
}

function showSuccess(message) {
    const successMsg = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    if (successMsg && successText) {
        successText.textContent = message || 'คำนวณสำเร็จแล้ว!';
        successMsg.classList.remove('hidden');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            successMsg.classList.add('hidden');
        }, 5000);
    }
}

function hideSuccess() {
    const successMsg = document.getElementById('successMessage');
    if (successMsg) {
        successMsg.classList.add('hidden');
    }
}

function showResults() {
    const resultsCard = document.getElementById('resultsCard');
    if (resultsCard) {
        resultsCard.classList.remove('hidden');
        // ตรวจสอบว่ามีข้อมูลหรือไม่
        console.log('Showing results card');
    } else {
        console.error('resultsCard element not found!');
    }
}

function hideResults() {
    const resultsCard = document.getElementById('resultsCard');
    if (resultsCard) {
        resultsCard.classList.add('hidden');
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    document.getElementById('errorText').textContent = message;
    errorElement.classList.remove('hidden');
}

function showBetterError(error) {
    // Extract error message from error object
    let errorMessage = 'เกิดข้อผิดพลาด: ';
    
    if (error instanceof Error) {
        errorMessage += error.message;
    } else if (typeof error === 'string') {
        errorMessage += error;
    } else {
        errorMessage += JSON.stringify(error);
    }
    
    showError(errorMessage);
    console.error('Detailed error:', error);
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

// ==============================
// Assistant: ครูบอล
// ==============================

function setupAssistant() {
    const toggleBtn = document.getElementById('assistantToggle');
    const panel = document.getElementById('assistantPanel');
    const input = document.getElementById('assistantInput');
    const sendBtn = document.getElementById('assistantSend');
    const messagesEl = document.getElementById('assistantMessages');

    if (!toggleBtn || !panel || !input || !sendBtn || !messagesEl) {
        return;
    }

    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            input.focus();
        }
    });

    sendBtn.addEventListener('click', () => {
        sendAssistantMessage();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAssistantMessage();
        }
    });
}

function appendAssistantMessage(role, text) {
    const messagesEl = document.getElementById('assistantMessages');
    const characterEl = document.querySelector('.assistant-character');
    if (!messagesEl) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'assistant-message ' + (role === 'user' ? 'assistant-message--user' : 'assistant-message--bot');

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // ถ้าเป็นคำตอบของครูบอล ให้ทำเอฟเฟกต์ขยับตัวเล็กน้อย
    if (role === 'bot' && characterEl) {
        characterEl.classList.remove('speaking');
        // trigger reflow ให้ animation เล่นซ้ำได้
        void characterEl.offsetWidth;
        characterEl.classList.add('speaking');
        setTimeout(() => {
            characterEl.classList.remove('speaking');
        }, 450);
    }
}

async function sendAssistantMessage() {
    const input = document.getElementById('assistantInput');
    const text = (input && input.value || '').trim();
    if (!text) return;

    appendAssistantMessage('user', text);
    input.value = '';

    // สร้างข้อความกำลังพิมพ์
    const loadingText = 'ครูบอลกำลังคิดคำตอบให้...';
    appendAssistantMessage('bot', loadingText);

    const messagesEl = document.getElementById('assistantMessages');
    const loadingNode = messagesEl.lastChild;

    try {
        // context จากฟอร์มหลัก
        const latitude = parseFloat(document.getElementById('latitude').value || '0');
        const longitude = parseFloat(document.getElementById('longitude').value || '0');
        const systemSize = parseFloat(document.getElementById('system_size').value || '0');
        const elecPrice = parseFloat(document.getElementById('electricity_price').value || '0');

        const context = {
            latitude,
            longitude,
            system_size_kw: systemSize,
            electricity_price: elecPrice
        };

        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: text,
                context
            })
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'เกิดข้อผิดพลาดจากผู้ช่วยครูบอล');
        }

        const data = await resp.json();

        // ลบข้อความกำลังคิด
        if (loadingNode && loadingNode.parentNode === messagesEl) {
            messagesEl.removeChild(loadingNode);
        }

        appendAssistantMessage('bot', data.reply || 'ครูบอลตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้งครับ');
    } catch (err) {
        console.error(err);
        if (loadingNode && loadingNode.parentNode === messagesEl) {
            messagesEl.removeChild(loadingNode);
        }
        appendAssistantMessage('bot', err.message || 'เกิดข้อผิดพลาดจากผู้ช่วยครูบอล');
    }
}

// ==============================
// Image Prediction Function
// ==============================

async function predictImage() {
    const btnPredict = document.getElementById('btn-predict-image');
    const resultDiv = document.getElementById('predictionResult');
    const loadingDiv = document.getElementById('predictionLoading');
    const contentDiv = document.getElementById('predictionContent');
    const originalImg = document.getElementById('originalImage');
    const overlayImg = document.getElementById('overlayImage');

    if (!btnPredict || !resultDiv || !loadingDiv || !contentDiv || !originalImg || !overlayImg) {
        console.error('Prediction elements not found');
        return;
    }

    // ดึงพิกัดจาก form
    const latInput = document.getElementById('latitude');
    const lonInput = document.getElementById('longitude');
    const latitude = latInput ? parseFloat(latInput.value) : null;
    const longitude = lonInput ? parseFloat(lonInput.value) : null;

    // Show loading, hide result
    loadingDiv.classList.remove('hidden');
    resultDiv.style.display = 'none';
    btnPredict.disabled = true;
    btnPredict.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังตรวจจับ...';

    try {
        // Retry logic สำหรับ Render free tier ที่อาจ wake up ช้า
        let response;
        let lastError;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    btnPredict.innerHTML = `<i class="fas fa-spinner fa-spin"></i> รอเซิร์ฟเวอร์ตื่น... (${attempt}/${maxRetries})`;
                    await new Promise(r => setTimeout(r, 3000));
                }
                response = await fetch('/api/predict-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latitude, longitude })
                });
                // ตรวจว่าได้ JSON จริงๆ ไม่ใช่ HTML
                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    throw new Error('Server ยังไม่พร้อม กรุณารอสักครู่...');
                }
                break; // สำเร็จ
            } catch (e) {
                lastError = e;
                if (attempt === maxRetries) throw lastError;
            }
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'เกิดข้อผิดพลาดในการตรวจจับทิศหลังคา');
        }

        const data = await response.json();
        
        // แสดงรูปภาพ
        if (data.original_image) {
            originalImg.src = data.original_image;
        }
        if (data.overlay_image) {
            overlayImg.src = data.overlay_image;
        }
        
        // Display class statistics
        let html = '<div style="margin-top: 10px;">';
        
        if (data.class_stats && data.class_stats.length > 0) {
            html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
            data.class_stats.forEach((stat) => {
                if (stat.pixel_count > 0) {
                    const [r, g, b] = stat.color;
                    html += `<div style="padding: 10px; background: rgba(${r}, ${g}, ${b}, 0.2); border-radius: 6px; border-left: 4px solid rgb(${r}, ${g}, ${b});">
                        <strong style="color: rgb(${r}, ${g}, ${b});">${stat.class}</strong><br>
                        <span style="font-size: 12px; color: #666;">
                            Pixels: ${stat.pixel_count.toLocaleString()} (${stat.percentage}%)
                        </span>
                    </div>`;
                }
            });
            html += '</div>';
        } else {
            html += '<p style="color: #666;">ไม่พบข้อมูล class</p>';
        }

        if (data.message) {
            html += `<p style="margin-top: 15px; color: #666; font-size: 14px;"><em>${data.message}</em></p>`;
        }

        html += '</div>';
        contentDiv.innerHTML = html;
        resultDiv.style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        contentDiv.innerHTML = `<p style="color: #d32f2f;">${error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}</p>`;
        resultDiv.style.display = 'block';
    } finally {
        loadingDiv.classList.add('hidden');
        btnPredict.disabled = false;
        btnPredict.innerHTML = '<i class="fas fa-search"></i> ตรวจจับทิศหลังคา';
    }
}

// ==============================
// Solar GIF Creation Function
// ==============================

async function createSolarGif() {
    const btnCreateGif = document.getElementById('btn-create-gif');
    const gifLoading = document.getElementById('gifLoading');
    const gifResult = document.getElementById('gifResult');
    const gifImage = document.getElementById('gifImage');
    const gifDate = document.getElementById('gifDate');
    const roofTilt = document.getElementById('roofTilt');

    if (!btnCreateGif || !gifLoading || !gifResult || !gifImage || !gifDate || !roofTilt) {
        console.error('GIF creation elements not found');
        return;
    }

    // ดึงพิกัดจากฟอร์ม
    const latitude = parseFloat(document.getElementById('latitude').value || '14.909999243404515');  // โรงเรียนสุรธรรมพิทักษ์
    const longitude = parseFloat(document.getElementById('longitude').value || '102.07143026893837');  // โรงเรียนสุรธรรมพิทักษ์
    const dateStr = gifDate.value || '2024-06-21';
    const tilt = parseFloat(roofTilt.value || '30');

    // Show loading, hide result
    gifLoading.classList.remove('hidden');
    gifResult.style.display = 'none';
    btnCreateGif.disabled = true;
    btnCreateGif.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังสร้าง GIF...';

    try {
        const response = await fetch('/api/create-solar-gif', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                latitude: latitude,
                longitude: longitude,
                date: dateStr,
                roof_tilt: tilt
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'เกิดข้อผิดพลาดในการสร้าง GIF');
        }

        const data = await response.json();
        
        console.log('Response data:', {
            success: data.success,
            has_gif_data: !!data.gif_data,
            gif_size: data.gif_size,
            message: data.message,
            error: data.error
        });
        
        // แสดง GIF
        if (data.gif_data && data.success) {
            // Clear previous src first
            gifImage.src = '';
            
            // Wait a bit before setting new src
            setTimeout(() => {
                // Set new src with timestamp to force reload
                const timestamp = new Date().getTime();
                const gifSrc = data.gif_data;
                gifImage.src = gifSrc;
                gifResult.style.display = 'block';
                
                console.log('GIF src set, data URI length:', gifSrc.length);
                console.log('GIF size:', data.gif_size, 'bytes');
                
                // ตรวจสอบว่า GIF โหลดสำเร็จ
                gifImage.onload = function() {
                    console.log('GIF loaded successfully');
                };
                
                gifImage.onerror = function(e) {
                    console.error('Error loading GIF:', e);
                    console.error('GIF src preview:', gifSrc.substring(0, 200));
                    console.error('GIF data URI valid:', gifSrc.startsWith('data:image/gif;base64,'));
                    
                    // ลองใช้ object URL แทน
                    try {
                        const blob = dataURLtoBlob(gifSrc);
                        const url = URL.createObjectURL(blob);
                        gifImage.src = url;
                        console.log('Trying object URL instead');
                    } catch (blobError) {
                        console.error('Blob conversion failed:', blobError);
                        alert('ไม่สามารถโหลด GIF ได้ กรุณาลองใหม่ (Error: ' + blobError.message + ')');
                    }
                };
            }, 100);
        } else {
            console.error('No GIF data in response or not successful');
            console.error('Full response:', JSON.stringify(data, null, 2));
            const errorMsg = data.error || 'ไม่พบข้อมูล GIF ใน response';
            alert(errorMsg);
        }

    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
        gifLoading.classList.add('hidden');
        btnCreateGif.disabled = false;
        btnCreateGif.innerHTML = '<i class="fas fa-film"></i> สร้าง GIF Animation';
    }
}

// Helper function to convert data URL to Blob
function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

// ==============================
// Form Validation (Real-time)
// ==============================

function setupFormValidation() {
    const inputs = ['latitude', 'longitude', 'electricity_price', 'system_size', 'monthly_bill'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('blur', function() {
                validateField(inputId, this.value);
            });
            input.addEventListener('input', function() {
                clearFieldError(inputId);
            });
        }
    });
}

function validateField(fieldId, value) {
    const errorElement = document.getElementById(fieldId + '-error');
    if (!errorElement) return;
    
    let error = '';
    
    switch(fieldId) {
        case 'latitude':
            const lat = parseFloat(value);
            if (isNaN(lat) || lat < -90 || lat > 90) {
                error = '❌ ละติจูดต้องอยู่ระหว่าง -90 ถึง 90';
            }
            break;
        case 'longitude':
            const lon = parseFloat(value);
            if (isNaN(lon) || lon < -180 || lon > 180) {
                error = '❌ ลองติจูดต้องอยู่ระหว่าง -180 ถึง 180';
            }
            break;
        case 'electricity_price':
            const price = parseFloat(value);
            if (isNaN(price) || price <= 0) {
                error = '❌ ราคาไฟฟ้าต้องมากกว่า 0';
            } else if (price > 20) {
                error = '⚠️ ราคาไฟฟ้าดูสูงผิดปกติ';
            }
            break;
        case 'system_size':
            const size = parseFloat(value);
            if (isNaN(size) || size <= 0) {
                error = '❌ ขนาดระบบต้องมากกว่า 0';
            } else if (size > 300) {
                error = '⚠️ ขนาดระบบเกิน 300 kW อาจไม่เหมาะสม';
            }
            break;
        case 'monthly_bill':
            const bill = parseFloat(value);
            if (value && (isNaN(bill) || bill <= 0)) {
                error = '❌ ค่าไฟต่อเดือนต้องมากกว่า 0';
            }
            break;
    }
    
    if (error) {
        errorElement.textContent = error;
        errorElement.style.color = '#e74c3c';
        errorElement.style.display = 'block';
    } else {
        clearFieldError(fieldId);
    }
}

function clearFieldError(fieldId) {
    const errorElement = document.getElementById(fieldId + '-error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

// ==============================
// Keyboard Shortcuts
// ==============================

function setupKeyboardShortcuts() {
    // Enter key to calculate
    document.addEventListener('keydown', function(e) {
        // Enter key (but not in textarea)
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            const form = document.getElementById('roiForm');
            if (form && !e.target.closest('form')) {
                // If focus is on form inputs, submit
                if (form.contains(e.target)) {
                    e.preventDefault();
                    form.dispatchEvent(new Event('submit'));
                }
            }
        }
        
        // Ctrl/Cmd + Enter to calculate
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const form = document.getElementById('roiForm');
            if (form) {
                form.dispatchEvent(new Event('submit'));
            }
        }
    });
}

// ==============================
// Custom Settings
// ==============================

function resetCustomSettings() {
    document.getElementById('custom_panel_cost').value = 80000;
    document.getElementById('custom_installation_multiplier').value = 1.2;
    document.getElementById('custom_maintenance_rate').value = 0.5;
    document.getElementById('custom_inflation_rate').value = 3.0;
    document.getElementById('custom_degradation_rate').value = 0.7;
    document.getElementById('custom_analysis_period').value = 5;
    document.getElementById('custom_discount_rate').value = 5.0;
    
    showSuccess('รีเซ็ตการตั้งค่าเป็นค่าเริ่มต้นแล้ว');
}

// ==============================
// Comparison Feature
// ==============================

async function calculateComparison(mainData) {
    const comparisonSection = document.getElementById('comparisonSection');
    const comparisonTableBody = document.getElementById('comparisonTableBody');
    
    if (!comparisonSection || !comparisonTableBody) return;
    
    comparisonSection.classList.remove('hidden');
    comparisonTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">กำลังคำนวณ...</td></tr>';
    
    const sizes = [3, 5, 10];
    const latitude = parseFloat(document.getElementById('latitude').value);
    const longitude = parseFloat(document.getElementById('longitude').value);
    const electricity_price = parseFloat(document.getElementById('electricity_price').value);
    const cloud_coverage = document.getElementById('cloud_coverage') ? document.getElementById('cloud_coverage').value : 'partly';
    
    comparisonTableBody.innerHTML = '';
    
    for (const size of sizes) {
        try {
            const response = await fetch('/api/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitude, longitude, electricity_price,
                    system_size: size, cloud_coverage
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${size} kW</strong></td>
                    <td class="num">${formatNumber(data.capital_cost)}</td>
                    <td class="num">${formatNumber(data.annual_production)}</td>
                    <td class="num">${formatNumber(data.annual_revenue)}</td>
                    <td class="num">${data.payback_period ? data.payback_period + ' ปี' : '> 30 ปี'}</td>
                    <td class="num">${data.roi_5_years ? formatNumber(data.roi_5_years) + '%' : '-'}</td>
                `;
                comparisonTableBody.appendChild(row);
            }
        } catch (error) {
            console.error(`Error calculating ${size}kW:`, error);
        }
    }
}

// ==============================
// Export Functions
// ==============================

async function exportToPDF() {
    const resultsCard = document.getElementById('resultsCard');
    if (!resultsCard || resultsCard.classList.contains('hidden')) {
        alert('กรุณาคำนวณ ROI ก่อนเพื่อ Export PDF');
        return;
    }

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
        alert('กำลังโหลด jsPDF library...');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Thai font support - use built-in font
        doc.setFont('helvetica');
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 20;

        // Title
        doc.setFontSize(20);
        doc.setTextColor(0, 102, 204);
        doc.text('Solar ROI Calculator Report', pageWidth / 2, y, { align: 'center' });
        y += 10;

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text('Suratham Phithak School', pageWidth / 2, y, { align: 'center' });
        y += 15;

        // Date
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('Generated: ' + new Date().toLocaleDateString('th-TH'), pageWidth / 2, y, { align: 'center' });
        y += 15;

        // Results Section
        doc.setFontSize(14);
        doc.setTextColor(0, 102, 204);
        doc.text('Calculation Results', margin, y);
        y += 10;

        doc.setFontSize(11);
        doc.setTextColor(50);

        // Get values
        const capitalCost = document.getElementById('capitalCost')?.textContent || '-';
        const annualProduction = document.getElementById('annualProduction')?.textContent || '-';
        const annualRevenue = document.getElementById('annualRevenue')?.textContent || '-';
        const paybackPeriod = document.getElementById('paybackPeriod')?.textContent || '-';
        const roi = document.getElementById('roi25Years')?.textContent || '-';
        const totalSavings = document.getElementById('totalSavings')?.textContent || '-';

        const results = [
            ['Capital Cost:', capitalCost + ' THB'],
            ['Annual Production:', annualProduction + ' kWh'],
            ['Annual Revenue:', annualRevenue + ' THB'],
            ['Payback Period:', paybackPeriod],
            ['ROI (5 Years):', roi],
            ['Total Savings (5 Years):', totalSavings + ' THB']
        ];

        results.forEach(([label, value]) => {
            doc.setTextColor(80);
            doc.text(label, margin, y);
            doc.setTextColor(0, 102, 204);
            doc.text(value, margin + 60, y);
            y += 8;
        });

        y += 10;

        // Environmental Impact
        doc.setFontSize(14);
        doc.setTextColor(0, 102, 204);
        doc.text('Environmental Impact', margin, y);
        y += 10;

        doc.setFontSize(11);
        const co2 = document.getElementById('co2Reduction')?.textContent || '-';
        const trees = document.getElementById('treesEquivalent')?.textContent || '-';

        doc.setTextColor(80);
        doc.text('CO2 Reduction:', margin, y);
        doc.setTextColor(40, 167, 69);
        doc.text(co2 + ' tons/year', margin + 60, y);
        y += 8;

        doc.setTextColor(80);
        doc.text('Trees Equivalent:', margin, y);
        doc.setTextColor(40, 167, 69);
        doc.text(trees + ' trees', margin + 60, y);
        y += 15;

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text('This report is generated by SOLAR ATLAS AI - Suratham Phithak School', pageWidth / 2, 280, { align: 'center' });

        // Save PDF
        doc.save('solar_roi_report_' + new Date().toISOString().split('T')[0] + '.pdf');
        
        showSuccess('Export PDF Success!');

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Error exporting PDF: ' + error.message);
    }
}

function exportToExcel() {
    const resultsCard = document.getElementById('resultsCard');
    if (!resultsCard || resultsCard.classList.contains('hidden')) {
        alert('กรุณาคำนวณ ROI ก่อนเพื่อ Export');
        return;
    }
    
    // Create CSV data
    let csv = 'Solar ROI Calculator Report\n';
    csv += 'โรงเรียนสุรธรรมพิทักษ์\n\n';
    csv += 'ผลการคำนวณ\n';
    csv += `ต้นทุนเงินทุน,${document.getElementById('capitalCost').textContent.replace(/,/g, '')}\n`;
    csv += `การผลิตต่อปี,${document.getElementById('annualProduction').textContent.replace(/,/g, '')}\n`;
    csv += `รายได้ต่อปี,${document.getElementById('annualRevenue').textContent.replace(/,/g, '')}\n`;
    csv += `ระยะเวลา Payback,${document.getElementById('paybackPeriod').textContent}\n`;
    csv += `ROI (5 ปี),${document.getElementById('roi25Years').textContent}\n`;
    csv += `เงินออมรวม (5 ปี),${document.getElementById('totalSavings').textContent.replace(/,/g, '')}\n\n`;
    
    // Yearly data
    csv += 'ตารางผลประกอบการรายปี\n';
    csv += 'ปี,การผลิต (kWh),รายได้ (บาท),บำรุงรักษา (บาท),กำไรสุทธิ (บาท),กำไรสะสม (บาท)\n';
    
    const tableRows = document.querySelectorAll('#yearlyTableBody tr');
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
            csv += `${cells[0].textContent},${cells[1].textContent.replace(/,/g, '')},${cells[2].textContent.replace(/,/g, '')},${cells[3].textContent.replace(/,/g, '')},${cells[4].textContent.replace(/,/g, '')},${cells[5].textContent.replace(/,/g, '')}\n`;
        }
    });
    
    // Download CSV
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `solar_roi_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showSuccess('Export Excel สำเร็จ!');
}

function printReport() {
    const resultsCard = document.getElementById('resultsCard');
    if (!resultsCard || resultsCard.classList.contains('hidden')) {
        alert('กรุณาคำนวณ ROI ก่อนเพื่อพิมพ์รายงาน');
        return;
    }
    
    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Solar ROI Report - โรงเรียนสุรธรรมพิทักษ์</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #0066cc; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #0066cc; color: white; }
                    .result-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
                    .result-item { padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>รายงานการคำนวณ ROI โซล่าเซลล์</h1>
                <p><strong>โรงเรียนสุรธรรมพิทักษ์</strong></p>
                <p>วันที่: ${new Date().toLocaleDateString('th-TH')}</p>
                ${resultsCard.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ==============================
// Environmental Impact Calculations
// ==============================

function calculateEnvironmentalImpact(annualProduction, systemSizeKw) {
    // CO2 reduction calculation (kg CO2 per kWh varies by country)
    // Thailand: approximately 0.5 kg CO2 per kWh from grid electricity
    const co2PerKwh = 0.5; // kg CO2 per kWh
    const co2ReductionKg = annualProduction * co2PerKwh;
    const co2ReductionTons = co2ReductionKg / 1000;
    
    // Trees equivalent (1 tree absorbs about 22 kg CO2 per year)
    const co2PerTree = 22; // kg CO2 per tree per year
    const treesEquivalent = Math.round(co2ReductionKg / co2PerTree);
    
    // Homes powered (average Thai home uses about 2,500 kWh per year)
    const avgHomeConsumption = 2500; // kWh per year
    const homesPowered = (annualProduction / avgHomeConsumption).toFixed(1);
    
    // Update display
    const co2Element = document.getElementById('co2Reduction');
    const treesElement = document.getElementById('treesEquivalent');
    const homesElement = document.getElementById('homesPowered');
    
    if (co2Element) co2Element.textContent = co2ReductionTons.toFixed(1);
    if (treesElement) treesElement.textContent = treesEquivalent.toLocaleString();
    if (homesElement) homesElement.textContent = homesPowered;
}

// ==============================
// Chart Tabs Management
// ==============================

function setupChartTabs() {
    const tabs = document.querySelectorAll('.chart-tab');
    const panels = document.querySelectorAll('.chart-panel');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const chartType = this.getAttribute('data-chart');
            
            // Remove active class from all tabs and panels
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding panel
            this.classList.add('active');
            const targetPanel = document.getElementById(chartType + 'ChartPanel');
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
}

// ==============================
// Production Chart
// ==============================

function createProductionChart(yearlyData) {
    const ctx = document.getElementById('productionChart');
    if (!ctx) return;
    
    const ctxContext = ctx.getContext('2d');
    
    const years = yearlyData.map(item => `ปีที่ ${item.year}`);
    const production = yearlyData.map(item => item.production);
    const revenue = yearlyData.map(item => item.revenue);
    
    new Chart(ctxContext, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'การผลิต (kWh)',
                    data: production,
                    backgroundColor: 'rgba(251, 191, 36, 0.8)',
                    borderColor: 'rgb(251, 191, 36)',
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'รายได้ (บาท)',
                    data: revenue,
                    type: 'line',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: { size: 12 },
                        color: '#555555'
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { font: { size: 11 }, color: '#666666' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(251, 191, 36, 0.1)' },
                    ticks: { 
                        font: { size: 11 }, 
                        color: '#666666',
                        callback: function(value) {
                            return formatCurrency(value) + ' kWh';
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { 
                        font: { size: 11 }, 
                        color: '#666666',
                        callback: function(value) {
                            return formatCurrency(value) + ' ฿';
                        }
                    }
                }
            }
        }
    });
}

// ==============================
// Print Function
// ==============================

function printReport() {
    const resultsCard = document.getElementById('resultsCard');
    if (!resultsCard || resultsCard.classList.contains('hidden')) {
        alert('กรุณาคำนวณ ROI ก่อนเพื่อพิมพ์รายงาน');
        return;
    }
    
    // Create print-friendly version
    const printWindow = window.open('', '_blank');
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>รายงานการคำนวณ ROI โซลาร์เซลล์</title>
            <style>
                body { font-family: 'Sarabun', sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .results-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
                .result-item { padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
                .result-label { font-weight: bold; color: #333; }
                .result-value { font-size: 18px; color: #0066cc; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
                th { background-color: #f5f5f5; }
                .num { text-align: right; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>รายงานการคำนวณ ROI โซลาร์เซลล์</h1>
                <h2>โรงเรียนสุรธรรมพิทักษ์</h2>
                <p>วันที่: ${new Date().toLocaleDateString('th-TH')}</p>
            </div>
            ${resultsCard.innerHTML}
            <script>window.print(); window.close();</script>
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// ==============================
// Enhanced Format Number Function
// ==============================

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(num);
}

// ==============================
// Loading Progress Enhancement
// ==============================

function showLoadingWithSteps() {
    const loadingProgress = document.getElementById('loadingProgress');
    const progressText = document.getElementById('progressText');
    
    if (!loadingProgress || !progressText) return;
    
    const steps = [
        'กำลังตรวจสอบข้อมูล...',
        'กำลังคำนวณแสงอาทิตย์...',
        'กำลังวิเคราะห์ ROI...',
        'กำลังสร้างกราฟ...',
        'เสร็จสิ้น!'
    ];
    
    let currentStep = 0;
    const stepInterval = setInterval(() => {
        if (currentStep < steps.length) {
            progressText.textContent = steps[currentStep];
            currentStep++;
        } else {
            clearInterval(stepInterval);
        }
    }, 800);
    
    // Store interval for cleanup
    loadingProgress.stepInterval = stepInterval;
}

// ==============================
// Enhanced Error Handling
// ==============================

function showDetailedError(error, context = '') {
    const errorElement = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    if (!errorElement || !errorText) return;
    
    let message = 'เกิดข้อผิดพลาด: ';
    
    if (error.message) {
        message += error.message;
    } else if (typeof error === 'string') {
        message += error;
    } else {
        message += 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    }
    
    if (context) {
        message += ` (${context})`;
    }
    
    errorText.textContent = message;
    errorElement.classList.remove('hidden');
    
    // Auto hide after 10 seconds
    setTimeout(() => {
        errorElement.classList.add('hidden');
    }, 10000);
}

// ==============================
// Responsive Chart Handling
// ==============================

function handleChartResize() {
    if (profitChart) {
        profitChart.resize();
    }
    
    // Redraw SVG sun path if needed
    const svg = document.getElementById('sunPathDiagram');
    if (svg && svg.hasChildNodes()) {
        // SVG will automatically resize, but we might need to adjust viewBox
        const rect = svg.getBoundingClientRect();
        svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    }
}

// Add resize listener
window.addEventListener('resize', handleChartResize);

// ==============================
// Initialize Enhanced Features
// ==============================

document.addEventListener('DOMContentLoaded', function() {
    // Setup chart tabs when page loads
    setupChartTabs();
    
    // Add smooth scrolling for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});


// ==============================
// Location Search System
// ==============================

let searchTimeout = null;
let currentSearchResults = [];

function setupLocationSearch() {
    const searchInput = document.getElementById('locationSearch');
    const searchBtn = document.getElementById('searchBtn');
    const myLocationBtn = document.getElementById('myLocationBtn');
    const searchResults = document.getElementById('searchResults');
    const clearBtn = document.getElementById('clearLocation');
    
    if (!searchInput) return;
    
    // Search on input with debounce
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Hide results if query is too short
        if (query.length < 2) {
            hideSearchResults();
            return;
        }
        
        // Debounce search (wait 500ms after user stops typing)
        searchTimeout = setTimeout(() => {
            searchLocation(query);
        }, 500);
    });
    
    // Search on button click
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                searchLocation(query);
            }
        });
    }
    
    // Search on Enter key
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = this.value.trim();
            if (query.length >= 2) {
                searchLocation(query);
            }
        }
    });
    
    // Get current location
    if (myLocationBtn) {
        myLocationBtn.addEventListener('click', getCurrentLocation);
    }
    
    // Clear location
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSelectedLocation);
    }
    
    // Close results when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.location-search-container')) {
            hideSearchResults();
        }
    });
}

// Search location using OpenStreetMap Nominatim API
async function searchLocation(query) {
    const searchResults = document.getElementById('searchResults');
    
    // Show loading state
    searchResults.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> กำลังค้นหา...</div>';
    searchResults.classList.remove('hidden');
    
    try {
        // Use Nominatim API (free, no API key needed)
        // Prioritize Thailand results
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=th&limit=8&addressdetails=1&accept-language=th`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SolarROICalculator/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error('Search failed');
        }
        
        const results = await response.json();
        currentSearchResults = results;
        
        displaySearchResults(results);
        
    } catch (error) {
        console.error('Location search error:', error);
        searchResults.innerHTML = '<div class="search-error"><i class="fas fa-exclamation-circle"></i> ไม่สามารถค้นหาได้ กรุณาลองใหม่</div>';
    }
}

// Display search results
function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results"><i class="fas fa-map-marker-alt"></i> ไม่พบสถานที่ ลองค้นหาด้วยคำอื่น</div>';
        return;
    }
    
    let html = '<ul class="search-results-list">';
    
    results.forEach((result, index) => {
        const displayName = formatLocationName(result);
        const type = getLocationType(result);
        
        html += `
            <li class="search-result-item" data-index="${index}" onclick="selectSearchResult(${index})">
                <div class="result-icon">
                    <i class="fas ${getLocationIcon(result)}"></i>
                </div>
                <div class="result-content">
                    <div class="result-name">${displayName}</div>
                    <div class="result-type">${type}</div>
                </div>
                <div class="result-coords">
                    <small>${parseFloat(result.lat).toFixed(4)}, ${parseFloat(result.lon).toFixed(4)}</small>
                </div>
            </li>
        `;
    });
    
    html += '</ul>';
    searchResults.innerHTML = html;
}

// Format location name for display
function formatLocationName(result) {
    if (result.address) {
        const parts = [];
        
        // Add specific location name
        if (result.address.amenity) parts.push(result.address.amenity);
        else if (result.address.building) parts.push(result.address.building);
        else if (result.address.shop) parts.push(result.address.shop);
        else if (result.address.office) parts.push(result.address.office);
        else if (result.address.tourism) parts.push(result.address.tourism);
        else if (result.address.leisure) parts.push(result.address.leisure);
        
        // Add road/village
        if (result.address.road) parts.push(result.address.road);
        else if (result.address.village) parts.push(result.address.village);
        
        // Add subdistrict/district
        if (result.address.suburb) parts.push(result.address.suburb);
        else if (result.address.subdistrict) parts.push(result.address.subdistrict);
        
        // Add district
        if (result.address.city_district) parts.push(result.address.city_district);
        else if (result.address.district) parts.push(result.address.district);
        
        // Add city/province
        if (result.address.city) parts.push(result.address.city);
        else if (result.address.town) parts.push(result.address.town);
        else if (result.address.state) parts.push(result.address.state);
        
        if (parts.length > 0) {
            return parts.slice(0, 3).join(', ');
        }
    }
    
    // Fallback to display_name
    return result.display_name.split(',').slice(0, 3).join(', ');
}

// Get location type for display
function getLocationType(result) {
    const typeMap = {
        'school': 'โรงเรียน',
        'university': 'มหาวิทยาลัย',
        'hospital': 'โรงพยาบาล',
        'place_of_worship': 'วัด/ศาสนสถาน',
        'restaurant': 'ร้านอาหาร',
        'cafe': 'คาเฟ่',
        'bank': 'ธนาคาร',
        'fuel': 'ปั๊มน้ำมัน',
        'supermarket': 'ซูเปอร์มาร์เก็ต',
        'convenience': 'ร้านสะดวกซื้อ',
        'residential': 'ที่พักอาศัย',
        'commercial': 'พาณิชย์',
        'industrial': 'อุตสาหกรรม',
        'village': 'หมู่บ้าน',
        'suburb': 'ตำบล',
        'city': 'เมือง',
        'town': 'อำเภอ',
        'administrative': 'เขตปกครอง'
    };
    
    if (result.type && typeMap[result.type]) {
        return typeMap[result.type];
    }
    
    if (result.class) {
        if (result.class === 'amenity') return 'สถานที่';
        if (result.class === 'building') return 'อาคาร';
        if (result.class === 'place') return 'สถานที่';
        if (result.class === 'highway') return 'ถนน';
        if (result.class === 'boundary') return 'เขตพื้นที่';
    }
    
    return 'สถานที่';
}

// Get icon for location type
function getLocationIcon(result) {
    const iconMap = {
        'school': 'fa-school',
        'university': 'fa-university',
        'hospital': 'fa-hospital',
        'place_of_worship': 'fa-place-of-worship',
        'restaurant': 'fa-utensils',
        'cafe': 'fa-coffee',
        'bank': 'fa-university',
        'fuel': 'fa-gas-pump',
        'supermarket': 'fa-shopping-cart',
        'convenience': 'fa-store',
        'residential': 'fa-home',
        'village': 'fa-home',
        'city': 'fa-city',
        'town': 'fa-building'
    };
    
    if (result.type && iconMap[result.type]) {
        return iconMap[result.type];
    }
    
    return 'fa-map-marker-alt';
}

// Select a search result
function selectSearchResult(index) {
    const result = currentSearchResults[index];
    if (!result) return;
    
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const displayName = formatLocationName(result);
    
    // Update form fields
    document.getElementById('latitude').value = lat.toFixed(6);
    document.getElementById('longitude').value = lon.toFixed(6);
    
    // Update map
    updateMapLocation(lat, lon, displayName);
    
    // Show selected location
    showSelectedLocation(displayName, lat, lon);
    
    // Hide search results
    hideSearchResults();
    
    // Clear search input
    document.getElementById('locationSearch').value = '';
    
    // Show success message
    showSuccess(`เลือกตำแหน่ง: ${displayName}`);
}

// Get current GPS location
function getCurrentLocation() {
    const myLocationBtn = document.getElementById('myLocationBtn');
    
    if (!navigator.geolocation) {
        showError('เบราว์เซอร์ของคุณไม่รองรับ GPS');
        return;
    }
    
    // Show loading state
    myLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    myLocationBtn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            // Update form fields
            document.getElementById('latitude').value = lat.toFixed(6);
            document.getElementById('longitude').value = lon.toFixed(6);
            
            // Try to get address from coordinates (reverse geocoding)
            try {
                const address = await reverseGeocode(lat, lon);
                showSelectedLocation(address, lat, lon);
                updateMapLocation(lat, lon, address);
                showSuccess(`พบตำแหน่งของคุณ: ${address}`);
            } catch (error) {
                showSelectedLocation('ตำแหน่งปัจจุบันของคุณ', lat, lon);
                updateMapLocation(lat, lon, 'ตำแหน่งปัจจุบัน');
                showSuccess('พบตำแหน่งของคุณแล้ว');
            }
            
            // Reset button
            myLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i>';
            myLocationBtn.disabled = false;
        },
        (error) => {
            console.error('Geolocation error:', error);
            let errorMsg = 'ไม่สามารถหาตำแหน่งได้';
            
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'ไม่สามารถหาตำแหน่งได้';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'หมดเวลาในการหาตำแหน่ง';
                    break;
            }
            
            showError(errorMsg);
            
            // Reset button
            myLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i>';
            myLocationBtn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Reverse geocode (coordinates to address)
async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=th`;
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'SolarROICalculator/1.0'
        }
    });
    
    if (!response.ok) {
        throw new Error('Reverse geocoding failed');
    }
    
    const result = await response.json();
    return formatLocationName(result);
}

// Update map location
function updateMapLocation(lat, lon, label) {
    // Check if map and marker exist (from map.js)
    if (typeof map !== 'undefined' && map && typeof L !== 'undefined') {
        const latlng = L.latLng(lat, lon);
        
        // Update marker position
        if (typeof marker !== 'undefined' && marker) {
            marker.setLatLng(latlng);
            if (label) {
                marker.bindPopup(`<b>${label}</b><br>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`).openPopup();
            }
        }
        
        // Center map on location
        map.setView(latlng, 16);
    }
}

// Show selected location display
function showSelectedLocation(name, lat, lon) {
    const selectedLocation = document.getElementById('selectedLocation');
    const selectedLocationText = document.getElementById('selectedLocationText');
    
    if (selectedLocation && selectedLocationText) {
        selectedLocationText.innerHTML = `<strong>${name}</strong><br><small>พิกัด: ${lat.toFixed(4)}, ${lon.toFixed(4)}</small>`;
        selectedLocation.classList.remove('hidden');
    }
}

// Clear selected location
function clearSelectedLocation() {
    const selectedLocation = document.getElementById('selectedLocation');
    const searchInput = document.getElementById('locationSearch');
    
    if (selectedLocation) {
        selectedLocation.classList.add('hidden');
    }
    
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Reset to default coordinates (Thailand center)
    document.getElementById('latitude').value = '14.909999243404515';
    document.getElementById('longitude').value = '102.07143026893837';
}

// Hide search results
function hideSearchResults() {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.classList.add('hidden');
    }
}

// Initialize location search on page load
document.addEventListener('DOMContentLoaded', function() {
    setupLocationSearch();
});
