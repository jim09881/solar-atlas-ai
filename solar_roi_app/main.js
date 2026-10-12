// Main JavaScript for Solar ROI Calculator

let profitChart = null;

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
    document.getElementById('annualRevenue').textContent = formatNumber(data.annual_revenue);
    
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

    // Create chart
    if (data.yearly_data && data.yearly_data.length > 0) {
        try {
            createChart(data.yearly_data);
        } catch (error) {
            console.error('Error creating chart:', error);
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

// Create profit chart
function createChart(yearlyData) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (profitChart) {
        profitChart.destroy();
    }

    const years = yearlyData.map(item => `ปีที่ ${item.year}`);
    const cumulativeProfits = yearlyData.map(item => item.cumulative);

    profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'กำไรสะสม (บาท)',
                    data: cumulativeProfits,
                    borderColor: '#0066cc',
                    backgroundColor: 'rgba(0, 102, 204, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#0066cc',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#004499'
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
                        font: {
                            size: 12
                        },
                        color: '#555555'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 102, 204, 0.9)',
                    padding: 12,
                    titleFont: {
                        size: 13
                    },
                    bodyFont: {
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            return 'กำไร: ' + formatCurrency(value) + ' บาท';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: true
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#666666',
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 102, 204, 0.1)',
                        drawBorder: true
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#666666',
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
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
        
        // Simulate progress
        let progress = 0;
        loadingInterval = setInterval(() => {
            progress += Math.random() * 10 + 5; // เพิ่มความเร็วขึ้น
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

    // Show loading, hide result
    loadingDiv.classList.remove('hidden');
    resultDiv.style.display = 'none';
    btnPredict.disabled = true;
    btnPredict.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังตรวจจับ...';

    try {
        const response = await fetch('/api/predict-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

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

function exportToPDF() {
    // This would require a PDF library like jsPDF
    alert('ฟีเจอร์ Export PDF กำลังพัฒนา...\n\nจะใช้ jsPDF เพื่อสร้าง PDF รายงาน');
    // TODO: Implement PDF export
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
