/**
 * A06 Web Application — Frontend Logic
 * Khảo sát & Dự đoán giá tài sản bằng mô hình học sâu (RNN / GRU / LSTM)
 */

// ============================================================================
// 1. Cấu hình URL Backend (Sửa dòng này khi deploy lên Render)
// ============================================================================
const API_BASE_URL = "https://a06-rnn-api.onrender.com";

// Trang này chỉ phục vụ riêng 1 tài sản — không hiển thị bộ chọn 3 tài sản
const FIXED_ASSET_ID = "gold";

// Hỗ trợ người dùng ghi đè nhanh qua modal cài đặt (lưu vào localStorage nếu có)
function getActiveBaseUrl() {
  const saved = localStorage.getItem("A06_API_BASE_URL");
  return (saved && saved.trim()) ? saved.trim().replace(/\/+$/, "") : API_BASE_URL;
}

// ============================================================================
// 2. Global State
// ============================================================================
const state = {
  assets: [],
  selectedAssetId: null,
  activeAssetMetadata: null,
  historyData: null,       // { asset_id, unit, dates, prices }
  predictionData: null,    // { asset_id, unit, last_known_date, last_known_price, predictions }
  daysAhead: 5,
  isLoadingAssets: false,
  isLoadingHistory: false,
  isLoadingPredict: false,
  chartInstance: null
};

// ============================================================================
// 3. DOM Elements
// ============================================================================
const DOM = {
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  serverStatusBadge: document.getElementById("serverStatusBadge"),
  btnConfigApi: document.getElementById("btnConfigApi"),

  alertBanner: document.getElementById("alertBanner"),
  alertTitle: document.getElementById("alertTitle"),
  alertMessage: document.getElementById("alertMessage"),
  alertRetryBtn: document.getElementById("alertRetryBtn"),
  alertCloseBtn: document.getElementById("alertCloseBtn"),
  serverWakeNotice: document.getElementById("serverWakeNotice"),

  assetsContainer: document.getElementById("assetsContainer"),

  activeAssetName: document.getElementById("activeAssetName"),
  activeAssetLatestPrice: document.getElementById("activeAssetLatestPrice"),
  activeAssetUnit: document.getElementById("activeAssetUnit"),
  activeAssetLatestDate: document.getElementById("activeAssetLatestDate"),

  daysAheadSlider: document.getElementById("daysAheadSlider"),
  daysAheadInput: document.getElementById("daysAheadInput"),
  daysValueDisplay: document.getElementById("daysValueDisplay"),
  quickChips: document.querySelectorAll(".chip-btn"),

  btnPredict: document.getElementById("btnPredict"),
  predictSpinner: document.getElementById("predictSpinner"),
  predictBtnText: document.getElementById("predictBtnText"),

  chartCanvas: document.getElementById("priceChart"),
  chartTitle: document.getElementById("chartTitle"),
  chartSubtitle: document.getElementById("chartSubtitle"),
  legendPredictionItem: document.getElementById("legendPredictionItem"),
  chartLoadingOverlay: document.getElementById("chartLoadingOverlay"),
  chartLoaderText: document.getElementById("chartLoaderText"),

  predictionTableSection: document.getElementById("predictionTableSection"),
  predictionTableBody: document.getElementById("predictionTableBody"),
  predictionQuickStats: document.getElementById("predictionQuickStats"),
  predictionWarningBanner: document.getElementById("predictionWarningBanner"),
  predictionWarningText: document.getElementById("predictionWarningText"),

  // Modal
  apiConfigModal: document.getElementById("apiConfigModal"),
  apiUrlInput: document.getElementById("apiUrlInput"),
  btnSaveApiConfig: document.getElementById("btnSaveApiConfig"),
  btnResetApiDefault: document.getElementById("btnResetApiDefault"),
  modalCloseBtn: document.getElementById("modalCloseBtn")
};

// ============================================================================
// 4. API Wrapper với Cold-Start Handling
// ============================================================================
let activeLoadingTimers = 0;
let wakeNoticeTimer = null;

function notifyRequestStart() {
  activeLoadingTimers++;
  if (!wakeNoticeTimer) {
    // Nếu quá 3.5 giây mà request chưa xong (thường gặp khi Render cold-start)
    // hiển thị thông báo giải thích cho người dùng
    wakeNoticeTimer = setTimeout(() => {
      DOM.serverWakeNotice.classList.remove("hidden");
    }, 3500);
  }
}

function notifyRequestEnd() {
  activeLoadingTimers = Math.max(0, activeLoadingTimers - 1);
  if (activeLoadingTimers === 0) {
    if (wakeNoticeTimer) {
      clearTimeout(wakeNoticeTimer);
      wakeNoticeTimer = null;
    }
    DOM.serverWakeNotice.classList.add("hidden");
  }
}

async function apiFetch(endpoint, options = {}) {
  const baseUrl = getActiveBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  notifyRequestStart();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Accept": "application/json",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      let detailMsg = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson && errorJson.detail) {
          detailMsg = typeof errorJson.detail === "string" 
            ? errorJson.detail 
            : JSON.stringify(errorJson.detail);
        }
      } catch (_) {
        // bỏ qua nếu response không phải JSON
      }
      throw new Error(detailMsg);
    }

    setServerStatus("online", "Máy chủ kết nối tốt");
    return await response.json();
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      setServerStatus("error", "Không thể kết nối máy chủ");
      throw new Error(`Không thể kết nối tới ${baseUrl}. Máy chủ chưa chạy hoặc đang khởi động lại (Render cold start).`);
    } else {
      setServerStatus("error", "Lỗi phản hồi máy chủ");
      throw error;
    }
  } finally {
    notifyRequestEnd();
  }
}

// ============================================================================
// 5. Server Status & Error Alert Helpers
// ============================================================================
function setServerStatus(status, text) {
  DOM.statusDot.className = "status-dot";
  if (status === "online") {
    DOM.statusDot.classList.add("dot-online");
  } else if (status === "connecting") {
    DOM.statusDot.classList.add("dot-connecting");
  } else {
    DOM.statusDot.classList.add("dot-error");
  }
  DOM.statusText.textContent = text;
}

function showError(title, message, retryCallback = null) {
  DOM.alertTitle.textContent = title;
  DOM.alertMessage.textContent = message;
  DOM.alertBanner.classList.remove("hidden");

  if (retryCallback && typeof retryCallback === "function") {
    DOM.alertRetryBtn.style.display = "inline-block";
    DOM.alertRetryBtn.onclick = () => {
      hideError();
      retryCallback();
    };
  } else {
    DOM.alertRetryBtn.style.display = "none";
    DOM.alertRetryBtn.onclick = null;
  }
}

function hideError() {
  DOM.alertBanner.classList.add("hidden");
}

DOM.alertCloseBtn.addEventListener("click", hideError);

// ============================================================================
// 6. Tải danh sách Assets (GET /api/assets)
// ============================================================================
async function loadAssets() {
  state.isLoadingAssets = true;
  setServerStatus("connecting", "Đang tải danh sách tài sản...");
  hideError();

  try {
    const allAssets = await apiFetch("/api/assets");
    if (!Array.isArray(allAssets) || allAssets.length === 0) {
      throw new Error("Dữ liệu tài sản trả về không hợp lệ hoặc rỗng");
    }
    const assets = allAssets.filter(a => a.id === FIXED_ASSET_ID);
    if (assets.length === 0) {
      throw new Error(`Backend không cung cấp tài sản "${FIXED_ASSET_ID}"`);
    }
    state.assets = assets;
    renderAssetTabs(assets);

    selectAsset(FIXED_ASSET_ID);
  } catch (err) {
    console.error("Lỗi loadAssets:", err);
    showError("Không thể tải danh sách tài sản", err.message, () => loadAssets());
  } finally {
    state.isLoadingAssets = false;
  }
}

function renderAssetTabs(assets) {
  DOM.assetsContainer.innerHTML = "";

  const symbolIcons = {
    amzn: "AMZN",
    gold: "XAU",
    silver: "XAG"
  };

  assets.forEach((asset) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `asset-card ${asset.id === state.selectedAssetId ? "active" : ""}`;
    card.setAttribute("data-asset-id", asset.id);
    card.setAttribute("role", "tab");
    card.setAttribute("aria-selected", asset.id === state.selectedAssetId ? "true" : "false");

    const symbol = symbolIcons[asset.id] || asset.id.toUpperCase();
    const fwLower = (asset.framework || "").toLowerCase();
    const fwClass = fwLower.includes("keras") ? "keras" : (fwLower.includes("pytorch") ? "pytorch" : "");

    card.innerHTML = `
      <div class="asset-card-top">
        <div class="asset-info">
          <div class="asset-symbol-icon">${symbol}</div>
          <div>
            <div class="asset-name">${escapeHtml(asset.name)}</div>
            <div class="asset-unit-tag">${escapeHtml(asset.unit)}</div>
          </div>
        </div>
        <div class="asset-status-pill"></div>
      </div>
      <div class="asset-meta-row">
        <span class="framework-badge ${fwClass}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          ${escapeHtml(asset.framework || "Mô hình")}
        </span>
        <span class="seq-length-badge">Seq: ${asset.sequence_length || 10} phiên</span>
      </div>
    `;

    card.addEventListener("click", () => {
      if (state.selectedAssetId !== asset.id) {
        selectAsset(asset.id);
      }
    });

    DOM.assetsContainer.appendChild(card);
  });
}

function updateActiveTabUI(assetId) {
  const cards = DOM.assetsContainer.querySelectorAll(".asset-card");
  cards.forEach(card => {
    const isTarget = card.getAttribute("data-asset-id") === assetId;
    card.classList.toggle("active", isTarget);
    card.setAttribute("aria-selected", isTarget ? "true" : "false");
  });
}

// ============================================================================
// 7. Chọn tài sản & Tải lịch sử giá (GET /api/history/{asset_id}?limit=200)
// ============================================================================
async function selectAsset(assetId) {
  state.selectedAssetId = assetId;
  const assetMeta = state.assets.find(a => a.id === assetId);
  state.activeAssetMetadata = assetMeta;

  updateActiveTabUI(assetId);

  // Xóa kết quả dự đoán của tài sản cũ
  state.predictionData = null;
  DOM.predictionTableSection.classList.add("hidden");
  DOM.predictionWarningBanner.classList.add("hidden");
  DOM.predictionTableBody.innerHTML = "";
  DOM.legendPredictionItem.style.display = "none";

  // Cập nhật thông tin tiêu đề
  if (assetMeta) {
    DOM.activeAssetName.textContent = assetMeta.name;
    DOM.activeAssetUnit.textContent = assetMeta.unit;
    DOM.chartTitle.textContent = `Biểu đồ giá: ${assetMeta.name}`;
    DOM.chartSubtitle.textContent = `200 phiên gần nhất • Đơn vị: ${assetMeta.unit}`;
  }

  // Tải dữ liệu lịch sử
  await loadHistory(assetId);
}

async function loadHistory(assetId) {
  state.isLoadingHistory = true;
  DOM.chartLoadingOverlay.classList.remove("hidden");
  DOM.chartLoaderText.textContent = "Đang tải dữ liệu 200 phiên lịch sử...";
  DOM.btnPredict.disabled = true;
  hideError();

  try {
    const data = await apiFetch(`/api/history/${assetId}?limit=200`);
    if (!data || !Array.isArray(data.dates) || !Array.isArray(data.prices)) {
      throw new Error("Cấu trúc dữ liệu lịch sử không đúng chuẩn");
    }

    state.historyData = data;

    // Cập nhật giá gần nhất ở panel
    const len = data.prices.length;
    if (len > 0) {
      const lastPrice = data.prices[len - 1];
      const lastDate = data.dates[len - 1];
      DOM.activeAssetLatestPrice.textContent = formatCurrency(lastPrice);
      DOM.activeAssetLatestDate.textContent = `Phiên gần nhất: ${lastDate}`;
    }

    // Vẽ lại biểu đồ với dữ liệu lịch sử mới
    renderChart(data.dates, data.prices, data.unit);
    DOM.btnPredict.disabled = false;
  } catch (err) {
    console.error("Lỗi loadHistory:", err);
    showError("Không thể tải dữ liệu lịch sử", err.message, () => loadHistory(assetId));
  } finally {
    state.isLoadingHistory = false;
    DOM.chartLoadingOverlay.classList.add("hidden");
  }
}

// ============================================================================
// 8. Chạy Dự đoán (POST /api/predict/{asset_id})
// ============================================================================
async function runPrediction() {
  if (!state.selectedAssetId || !state.historyData) return;

  const daysAhead = parseInt(state.daysAhead, 10);
  if (isNaN(daysAhead) || daysAhead < 1 || daysAhead > 30) {
    showError("Giá trị không hợp lệ", "Số ngày dự đoán phải nằm trong khoảng từ 1 đến 30.");
    return;
  }

  state.isLoadingPredict = true;
  DOM.btnPredict.disabled = true;
  DOM.predictSpinner.classList.remove("hidden");
  DOM.predictBtnText.textContent = "Đang tính toán mô hình...";
  DOM.chartLoadingOverlay.classList.remove("hidden");
  DOM.chartLoaderText.textContent = `Đang chạy dự đoán ${daysAhead} phiên kế tiếp qua Deep Learning...`;
  hideError();

  try {
    const payload = { days_ahead: daysAhead };
    const result = await apiFetch(`/api/predict/${state.selectedAssetId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!result || !Array.isArray(result.predictions)) {
      throw new Error("Phản hồi dự đoán không chứa danh sách predictions");
    }

    state.predictionData = result;

    // Vẽ cập nhật biểu đồ với đường dự đoán nối tiếp
    updateChartWithPredictions(state.historyData, result);

    // Hiển thị bảng chi tiết
    renderPredictionTable(result);
  } catch (err) {
    console.error("Lỗi runPrediction:", err);
    showError("Lỗi khi chạy dự đoán", err.message, () => runPrediction());
  } finally {
    state.isLoadingPredict = false;
    DOM.btnPredict.disabled = false;
    DOM.predictSpinner.classList.add("hidden");
    DOM.predictBtnText.textContent = "Chạy dự đoán mô hình";
    DOM.chartLoadingOverlay.classList.add("hidden");
  }
}

// ============================================================================
// 9. Quản lý Biểu đồ Chart.js
// ============================================================================
function createChartGradients(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 360);
  gradient.addColorStop(0, "rgba(56, 189, 248, 0.28)");
  gradient.addColorStop(1, "rgba(56, 189, 248, 0.0)");
  return gradient;
}

function renderChart(dates, prices, unit) {
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }

  const ctx = DOM.chartCanvas.getContext("2d");
  const areaGradient = createChartGradients(ctx);

  const config = {
    type: "line",
    data: {
      labels: [...dates],
      datasets: [
        {
          label: `Giá lịch sử (${unit})`,
          data: [...prices],
          borderColor: "#38bdf8",
          borderWidth: 2,
          backgroundColor: areaGradient,
          fill: true,
          tension: 0.15,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#38bdf8",
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: false // Đã có legend tùy biến bên ngoài
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#94a3b8",
          bodyColor: "#f8fafc",
          borderColor: "rgba(148, 163, 184, 0.2)",
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            title: function (items) {
              return `Phiên: ${items[0].label}`;
            },
            label: function (context) {
              if (context.raw === null || context.raw === undefined) return null;
              const val = Number(context.raw).toFixed(2);
              return ` ${context.dataset.label}: ${val} ${unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(148, 163, 184, 0.06)",
            tickColor: "transparent"
          },
          ticks: {
            color: "#64748b",
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            maxTicksLimit: 10,
            maxRotation: 0
          }
        },
        y: {
          position: "right",
          grid: {
            color: "rgba(148, 163, 184, 0.08)"
          },
          ticks: {
            color: "#94a3b8",
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: function (val) {
              return Number(val).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
            }
          }
        }
      }
    }
  };

  state.chartInstance = new Chart(ctx, config);
  DOM.legendPredictionItem.style.display = "none";
}

function updateChartWithPredictions(history, predictionResult) {
  if (!state.chartInstance) return;

  const historyDates = history.dates;
  const historyPrices = history.prices;
  const predictions = predictionResult.predictions;
  const unit = predictionResult.unit || history.unit;

  // Danh sách nhãn: 200 ngày lịch sử + N ngày dự đoán
  const predDates = predictions.map(p => p.date);
  const combinedLabels = [...historyDates, ...predDates];

  // Dữ liệu đường lịch sử: giữ nguyên điểm lịch sử, các điểm tương lai đặt là null
  const extendedHistoryPrices = [
    ...historyPrices,
    ...new Array(predictions.length).fill(null)
  ];

  // Dữ liệu đường dự đoán:
  // Để NỐI TIẾP liền mạch ngay tại điểm cuối của giá thật:
  // Điểm cuối của giá thật (index historyPrices.length - 1) sẽ là điểm khởi đầu của đường dự đoán!
  const lastRealPrice = historyPrices[historyPrices.length - 1];
  const predPricesOnly = predictions.map(p => p.predicted_price);

  const predictionSeries = new Array(historyPrices.length - 1).fill(null);
  predictionSeries.push(lastRealPrice); // Điểm nối
  predictionSeries.push(...predPricesOnly);

  // Cập nhật nhãn và 2 datasets
  state.chartInstance.data.labels = combinedLabels;
  state.chartInstance.data.datasets = [
    {
      label: `Giá thực tế (${unit})`,
      data: extendedHistoryPrices,
      borderColor: "#38bdf8",
      borderWidth: 2,
      backgroundColor: createChartGradients(state.chartInstance.ctx),
      fill: true,
      tension: 0.15,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: "#38bdf8",
      pointHoverBorderColor: "#ffffff",
      pointHoverBorderWidth: 2
    },
    {
      label: `Dự đoán AI (${unit})`,
      data: predictionSeries,
      borderColor: "#fbbf24",
      borderWidth: 2.5,
      borderDash: [6, 6], // Nét đứt rõ ràng
      backgroundColor: "transparent",
      fill: false,
      tension: 0.15,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: "#fbbf24",
      pointBorderColor: "#090d16",
      pointBorderWidth: 2
    }
  ];

  state.chartInstance.update();
  DOM.legendPredictionItem.style.display = "inline-flex";
}

// ============================================================================
// 10. Bảng Chi Tiết Dự Đoán
// ============================================================================
function renderPredictionTable(predictionResult) {
  const predictions = predictionResult.predictions || [];
  const basePrice = predictionResult.last_known_price;
  const unit = predictionResult.unit;

  if (predictions.length === 0) {
    DOM.predictionTableSection.classList.add("hidden");
    return;
  }

  DOM.predictionTableSection.classList.remove("hidden");
  DOM.predictionTableBody.innerHTML = "";

  // Hiển thị cảnh báo tin cậy nếu API trả về trường 'note' khác null (đặc biệt với AMZN khi vượt khoảng huấn luyện)
  if (predictionResult.note && typeof predictionResult.note === "string" && predictionResult.note.trim()) {
    DOM.predictionWarningText.textContent = predictionResult.note;
    DOM.predictionWarningBanner.classList.remove("hidden");
  } else {
    DOM.predictionWarningBanner.classList.add("hidden");
  }

  const finalPred = predictions[predictions.length - 1].predicted_price;
  const totalDiff = finalPred - basePrice;
  const totalDiffPct = (totalDiff / basePrice) * 100;
  const isUp = totalDiff >= 0;

  // Render quick stats
  DOM.predictionQuickStats.innerHTML = `
    <div class="stat-pill">
      <span class="stat-label">Giá phiên cuối (${basePrice ? basePrice.toFixed(2) : '--'} &rarr;):</span>
      <span class="stat-val">${finalPred.toFixed(2)} ${unit}</span>
    </div>
    <div class="stat-pill ${isUp ? "positive" : "negative"}">
      <span class="stat-label">Kỳ vọng xu hướng:</span>
      <span class="stat-val">
        ${isUp ? "▲ Tăng" : "▼ Giảm"} ${Math.abs(totalDiffPct).toFixed(2)}% (${isUp ? "+" : ""}${totalDiff.toFixed(2)} ${unit})
      </span>
    </div>
  `;

  let prevPrice = basePrice;

  predictions.forEach((item, index) => {
    const stepNum = index + 1;
    const currentPrice = item.predicted_price;

    // Chênh lệch so với phiên liền trước
    const stepDiff = currentPrice - prevPrice;
    const stepDiffPct = (stepDiff / prevPrice) * 100;

    // Chênh lệch so với giá gốc cuối cùng của dữ liệu thật
    const rootDiff = currentPrice - basePrice;
    const rootDiffPct = (rootDiff / basePrice) * 100;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="badge-step">+${stepNum}</span></td>
      <td><strong>${escapeHtml(item.date)}</strong> <span style="color:#64748b; font-size:0.75rem;">(phiên ${stepNum})</span></td>
      <td style="color:#fbbf24; font-weight:700;">${currentPrice.toFixed(2)} ${unit}</td>
      <td class="${stepDiff >= 0 ? "diff-positive" : "diff-negative"}">
        ${stepDiff >= 0 ? "+" : ""}${stepDiff.toFixed(2)} (${stepDiff >= 0 ? "+" : ""}${stepDiffPct.toFixed(2)}%)
      </td>
      <td class="${rootDiff >= 0 ? "diff-positive" : "diff-negative"}">
        ${rootDiff >= 0 ? "+" : ""}${rootDiff.toFixed(2)} (${rootDiff >= 0 ? "+" : ""}${rootDiffPct.toFixed(2)}%)
      </td>
    `;
    DOM.predictionTableBody.appendChild(row);

    prevPrice = currentPrice;
  });
}

// ============================================================================
// 11. Xử lý Sự kiện Điều khiển (Slider, Input, Chips)
// ============================================================================
function setDaysAhead(days) {
  let val = parseInt(days, 10);
  if (isNaN(val)) val = 5;
  val = Math.min(30, Math.max(1, val));

  state.daysAhead = val;
  DOM.daysAheadSlider.value = val;
  DOM.daysAheadInput.value = val;
  DOM.daysValueDisplay.textContent = `${val} phiên`;

  DOM.quickChips.forEach(chip => {
    const chipVal = parseInt(chip.getAttribute("data-days"), 10);
    chip.classList.toggle("active", chipVal === val);
  });
}

DOM.daysAheadSlider.addEventListener("input", (e) => {
  setDaysAhead(e.target.value);
});

DOM.daysAheadInput.addEventListener("change", (e) => {
  setDaysAhead(e.target.value);
});

DOM.quickChips.forEach(chip => {
  chip.addEventListener("click", () => {
    const days = chip.getAttribute("data-days");
    setDaysAhead(days);
  });
});

DOM.btnPredict.addEventListener("click", () => {
  runPrediction();
});

// ============================================================================
// 12. Modal Cài Đặt API URL
// ============================================================================
DOM.btnConfigApi.addEventListener("click", () => {
  DOM.apiUrlInput.value = getActiveBaseUrl();
  DOM.apiConfigModal.classList.remove("hidden");
});

DOM.modalCloseBtn.addEventListener("click", () => {
  DOM.apiConfigModal.classList.add("hidden");
});

DOM.apiConfigModal.addEventListener("click", (e) => {
  if (e.target === DOM.apiConfigModal) {
    DOM.apiConfigModal.classList.add("hidden");
  }
});

DOM.btnResetApiDefault.addEventListener("click", () => {
  localStorage.removeItem("A06_API_BASE_URL");
  DOM.apiUrlInput.value = API_BASE_URL;
  DOM.apiConfigModal.classList.add("hidden");
  loadAssets();
});

DOM.btnSaveApiConfig.addEventListener("click", () => {
  const newUrl = DOM.apiUrlInput.value.trim().replace(/\/+$/, "");
  if (!newUrl) {
    localStorage.removeItem("A06_API_BASE_URL");
  } else {
    localStorage.setItem("A06_API_BASE_URL", newUrl);
  }
  DOM.apiConfigModal.classList.add("hidden");
  loadAssets();
});

// ============================================================================
// 13. Utilities
// ============================================================================
function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return "--";
  return Number(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// 14. Khởi chạy Ứng dụng
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  setDaysAhead(5);
  loadAssets();
});
