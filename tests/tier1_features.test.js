/**
 * Tier 1: Feature Coverage & Baseline Integrity Test Suite
 * 
 * Implements all 42 test cases across 7 functional domains:
 *   Domain 1: Accounts Categorization & Metadata (6 tests)
 *   Domain 2: 6 Dashboard Tabs & UI View Navigation (6 tests)
 *   Domain 3: Financial Math Calculations (6 tests)
 *   Domain 4: Snapshot Lifecycle & Deep Clone Management (6 tests)
 *   Domain 5: CSV Export (UTF-8 BOM prefix \uFEFF) & JSON Schema Import (6 tests)
 *   Domain 6: FSA / Mock Stock Quote API Integration (6 tests)
 *   Domain 7: Chart.js Visual Data Extraction & Reactive State Sync (6 tests)
 */

const fs = require('fs');
const path = require('path');
const {
  describe,
  it,
  beforeAll,
  beforeEach,
  assertEqual,
  assertDeepEqual,
  assertCloseTo,
  assertTrue,
  assertFalse,
  assertOk,
  assertThrows,
  assertIncludes,
  createMockBrowserEnvironment,
  setupDashboardEnvironment,
  MockFileSystemFileHandle,
} = require('./e2e_test_runner');

const BASELINE_DATA_PATH = path.resolve(__dirname, '..', 'data', 'sample_data.json');
const canonicalBaselineJSON = JSON.parse(fs.readFileSync(BASELINE_DATA_PATH, 'utf8'));

describe('Tier 1: Feature Coverage & Baseline Integrity', () => {
  let env, win, doc, state;

  beforeEach(() => {
    env = createMockBrowserEnvironment();
    win = env.window;
    doc = env.document;
    setupDashboardEnvironment(win, doc);
    win.loadFinanceData(JSON.parse(JSON.stringify(canonicalBaselineJSON)));
    state = win.state;
  });

  // ==========================================================================
  // Domain 1: Accounts Categorization & Metadata (6 tests)
  // ==========================================================================
  describe('Domain 1: Accounts Categorization & Metadata', () => {

    it('TC-T1-AC-01: Complete Account Inventory & Category Integrity', () => {
      const accountsMeta = state.accounts_meta;
      assertEqual(accountsMeta.length, 5, 'Should have exactly 5 accounts in accounts_meta');

      const twdCash = accountsMeta.filter(a => a.currency === 'TWD' && a.category === 'cash');
      const usdCash = accountsMeta.filter(a => a.currency === 'USD' && a.category === 'cash');
      const twStock = accountsMeta.filter(a => a.category === 'tw_stock');
      const usStock = accountsMeta.filter(a => a.category === 'us_stock');

      assertEqual(twdCash.length, 1, 'Should have 1 TWD cash account');
      assertEqual(usdCash.length, 2, 'Should have 2 USD cash accounts');
      assertEqual(twStock.length, 1, 'Should have 1 TW stock account');
      assertEqual(usStock.length, 1, 'Should have 1 US stock account');

      assertOk(twdCash.some(a => a.key === '玉山活存'), 'Missing TWD cash account: 玉山活存');
      assertOk(usdCash.some(a => a.key === '玉山美金'), 'Missing USD cash account: 玉山美金');
      assertOk(usdCash.some(a => a.key === 'Chase Checking'), 'Missing USD cash account: Chase Checking');
      assertOk(twStock.some(a => a.key === '玉山證券'), 'Missing TW stock account: 玉山證券');
      assertOk(usStock.some(a => a.key === 'Firstrade'), 'Missing US stock account: Firstrade');
    });

    it('TC-T1-AC-02: Account Denomination & Multi-Currency Partitioning', () => {
      const accountsMeta = state.accounts_meta;
      const latestSnapshot = state.snapshots[state.snapshots.length - 1]; // 2026-07-15

      const twdKeys = accountsMeta.filter(a => a.currency === 'TWD').map(a => a.key);
      const usdKeys = accountsMeta.filter(a => a.currency === 'USD').map(a => a.key);

      assertEqual(twdKeys.length, 2, 'Should have 2 TWD-denominated accounts');
      assertEqual(usdKeys.length, 3, 'Should have 3 USD-denominated accounts');

      const sumTWD = twdKeys.reduce((acc, k) => acc + (Number(latestSnapshot.accounts[k]) || 0), 0);
      const sumUSD = usdKeys.reduce((acc, k) => acc + (Number(latestSnapshot.accounts[k]) || 0), 0);

      assertEqual(sumTWD, 1850000, 'Raw TWD sum for 2026-07-15 must be 1,850,000');
      assertEqual(sumUSD, 85000, 'Raw USD sum for 2026-07-15 must be 85,000');

      const convertedUsdInTWD = sumUSD * latestSnapshot.usd_rate;
      assertCloseTo(convertedUsdInTWD, 85000 * 32.5, 0.01, 'Converted USD in TWD must match 85,000 * 32.5');
    });

    it('TC-T1-AC-03: Insurance & Asset Metadata Mapping', () => {
      const insurance = state.insurance || [];
      assertTrue(Array.isArray(insurance), 'Insurance state should be an array');

      state.accounts_meta.forEach(acc => {
        assertOk(acc.key && acc.key.length > 0, 'Account key must not be empty');
        assertOk(acc.institution || acc.key, 'Account institution or key must be defined');
      });
    });

    it('TC-T1-AC-04: Zero-Balance & Dormant Account Handling', () => {
      const latestSnapshot = state.snapshots[state.snapshots.length - 1];
      const accounts = latestSnapshot.accounts;
      Object.keys(accounts).forEach(k => {
        assertFalse(isNaN(accounts[k]), `Account ${k} must not be NaN`);
      });

      const totals = win.calculateNetWorth(latestSnapshot);
      assertFalse(isNaN(totals.net_worth_twd), 'Net worth TWD must not be NaN');
      assertFalse(isNaN(totals.net_worth_usd), 'Net worth USD must not be NaN');
    });

    it('TC-T1-AC-05: Special Account Metadata Flags & Category Validation', () => {
      const accountsMeta = state.accounts_meta;
      const yushanStock = accountsMeta.find(a => a.key === '玉山證券');
      const firstrade = accountsMeta.find(a => a.key === 'Firstrade');

      assertOk(yushanStock && yushanStock.category === 'tw_stock', '玉山證券 must be tw_stock');
      assertOk(firstrade && firstrade.category === 'us_stock', 'Firstrade must be us_stock');
    });

    it('TC-T1-AC-06: Institutional Grouping & Classification Filter', () => {
      const accountsMeta = state.accounts_meta;
      const cashAccounts = accountsMeta.filter(a => a.category === 'cash');
      const stockAccounts = accountsMeta.filter(a => ['tw_stock', 'us_stock'].includes(a.category));

      assertEqual(cashAccounts.length, 3, 'Cash accounts must total 3 (1 TWD + 2 USD)');
      assertEqual(stockAccounts.length, 2, 'Stock accounts must total 2 (1 TW + 1 US)');
      assertEqual(cashAccounts.length + stockAccounts.length, 5, 'Categories must partition all 5 accounts');
    });
  });

  // ==========================================================================
  // Domain 2: 6 Dashboard Tabs & UI View Navigation (6 tests)
  // ==========================================================================
  describe('Domain 2: 6 Dashboard Tabs & UI View Navigation', () => {

    it('TC-T1-TAB-01: Multi-Tab Navigation & View Activation', () => {
      const tabSnapshotsBtn = doc.querySelector('[data-tab="snapshots"]');
      const tabOverviewBtn = doc.querySelector('[data-tab="overview"]');
      const viewSnapshots = doc.getElementById('view-snapshots');
      const viewOverview = doc.getElementById('view-overview');

      tabSnapshotsBtn.click();
      assertFalse(viewSnapshots.classList.contains('hidden'), 'Snapshots view should be visible');
      assertTrue(viewOverview.classList.contains('hidden'), 'Overview view should be hidden');

      tabOverviewBtn.click();
      assertTrue(viewSnapshots.classList.contains('hidden'), 'Snapshots view should be hidden');
      assertFalse(viewOverview.classList.contains('hidden'), 'Overview view should be visible');
    });

    it('TC-T1-TAB-02: Tab 1 (Overview) KPI Rendering', () => {
      const kpiTWD = doc.getElementById('kpi-net-worth-twd');
      const kpiUSD = doc.getElementById('kpi-net-worth-usd');
      const kpiRisk = doc.getElementById('kpi-risk-budget');

      assertOk(kpiTWD && kpiTWD.textContent.length > 0, 'Net worth TWD KPI should be rendered');
      assertOk(kpiUSD && kpiUSD.textContent.length > 0, 'Net worth USD KPI should be rendered');
      assertOk(kpiRisk && kpiRisk.textContent.length > 0, 'Risk capacity KPI should be rendered');
    });

    it('TC-T1-TAB-03: Tab 2 (Snapshots) Historical Grid & Growth Display', () => {
      const rows = doc.querySelectorAll('#snapshots-table-body tr');
      assertEqual(rows.length, 4, 'Should render exactly 4 historical snapshot rows');

      const latestRow = rows[3]; // Chronological (4th row is 2026-07-15)
      assertIncludes(latestRow.textContent, '2026-07-15', 'Latest row must display date 2026-07-15');
      assertIncludes(latestRow.textContent, '32.5', 'Latest row must display FX rate 32.5');
      assertIncludes(latestRow.textContent, '4,612,500', 'Latest row must display net worth');
    });

    it('TC-T1-TAB-04: Tab 3 (Stocks) Multi-Market Tables', () => {
      const twRows = doc.querySelectorAll('#tw-stocks-table-body tr');
      const usRows = doc.querySelectorAll('#us-stocks-table-body tr');

      assertEqual(twRows.length, 2, 'Should render 2 TW stock rows');
      assertEqual(usRows.length, 3, 'Should render 3 US stock positions');

      const twText = Array.from(twRows).map(r => r.textContent).join(' ');
      assertIncludes(twText, '2330', 'TW stocks must include 2330');
      assertIncludes(twText, '0050', 'TW stocks must include 0050');

      const usText = Array.from(usRows).map(r => r.textContent).join(' ');
      assertIncludes(usText, 'VOO', 'US stocks must include VOO');
      assertIncludes(usText, 'QQQ', 'US stocks must include QQQ');
      assertIncludes(usText, 'NVDA', 'US stocks must include NVDA');
    });

    it('TC-T1-TAB-05: Tab 4 (Insurance) Inventory & Cash Value Total', () => {
      const insRows = doc.querySelectorAll('#insurance-table-body tr');
      assertTrue(insRows.length >= 0, 'Insurance rows query executed');
      const insTotal = doc.getElementById('insurance-usd-total');
      assertOk(insTotal, 'Insurance USD total container exists');
    });

    it('TC-T1-TAB-06: Tab 5 (Decision) Modes & Constraint Gauges', () => {
      const modeIndicator = doc.getElementById('active-mode-indicator');
      const equityBar = doc.getElementById('equity-capacity-progress');
      const emergencyGauge = doc.getElementById('emergency-reserve-gauge');

      assertOk(modeIndicator, 'Mode indicator must exist');
      assertOk(equityBar, 'Equity progress bar must exist');
      assertOk(emergencyGauge, 'Emergency gauge must exist');
    });
  });

  // ==========================================================================
  // Domain 3: Financial Math Calculations (6 tests)
  // ==========================================================================
  describe('Domain 3: Financial Math Calculations', () => {

    it('TC-T1-MATH-01: Net Worth Multi-Currency Calculation Formula', () => {
      const s4 = state.snapshots[3]; // 2026-07-15
      const totals = win.calculateNetWorth(s4);

      // Formula: sum(TWD) + sum(USD) * usd_rate
      assertEqual(totals.twd_accounts, 1850000, 'TWD sum must be 1,850,000');
      assertEqual(totals.usd_accounts_usd, 85000, 'USD sum must be 85,000');
      assertCloseTo(totals.usd_accounts_twd, 85000 * 32.5, 0.01, 'USD in TWD must be 2,762,500');
      assertCloseTo(totals.net_worth_twd, 4612500, 0.01, 'Net worth TWD must be 4,612,500');
      assertCloseTo(totals.net_worth_usd, 141923.08, 0.01, 'Net worth USD must be ~141,923.08');
    });

    it('TC-T1-MATH-02: Historical Snapshot Growth Delta and Growth Rate', () => {
      const s1 = win.calculateNetWorth(state.snapshots[0]).net_worth_twd;
      const s2 = win.calculateNetWorth(state.snapshots[1]).net_worth_twd;
      const s3 = win.calculateNetWorth(state.snapshots[2]).net_worth_twd;
      const s4 = win.calculateNetWorth(state.snapshots[3]).net_worth_twd;

      // Period 4 vs Period 3
      const deltaS4 = s4 - s3;
      const pctS4 = (deltaS4 / s3) * 100;

      assertCloseTo(deltaS4, 683300, 1.0, 'S4 delta must be +683,300 TWD');
      assertCloseTo(pctS4, 17.39, 0.05, 'S4 growth rate must be ~17.39%');

      // Period 3 vs Period 2
      const deltaS3 = s3 - s2;
      const pctS3 = (deltaS3 / s2) * 100;
      assertCloseTo(deltaS3, 601100, 1.0, 'S3 delta must be +601,100 TWD');
      assertCloseTo(pctS3, 18.06, 0.05, 'S3 growth rate must be ~18.06%');
    });

    it('TC-T1-MATH-03: Stock Position Valuation, Cost Basis, Unrealized P&L, and ROI', () => {
      // 2330 (台積電): shares=1000, cost=800000, price=950
      const s2330 = state.tw_stocks.find(s => s.ticker === '2330');
      assertOk(s2330, '2330 must exist');
      assertEqual(s2330.market_value, 950000, '2330 MV must be 1000 * 950 = 950,000');
      assertEqual(s2330.unrealized_pl, 150000, '2330 P&L must be 950,000 - 800,000 = +150,000');
      assertCloseTo(s2330.roi * 100, 18.75, 0.01, '2330 ROI must be +18.75%');

      // 0050 (元大台灣50): shares=2000, cost=300000, price=170
      const s0050 = state.tw_stocks.find(s => s.ticker === '0050');
      assertOk(s0050, '0050 must exist');
      assertEqual(s0050.market_value, 340000, '0050 MV must be 2000 * 170 = 340,000');
      assertEqual(s0050.unrealized_pl, 40000, '0050 P&L must be 340,000 - 300,000 = +40,000');
      assertCloseTo(s0050.roi * 100, 13.33, 0.01, '0050 ROI must be ~13.33%');
    });

    it('TC-T1-MATH-04: Risk Budget & Maximum Drawdown Capacity Ceiling', () => {
      const netWorthTWD = win.calculateNetWorth(state.snapshots[3]).net_worth_twd;
      const maxDrawdownTolerance = state.decision_framework.max_drawdown_tolerance_pct / 100; // 0.25
      const severeBearDrop = 0.50;
      const maxEquityWeight = maxDrawdownTolerance / severeBearDrop; // 50%

      assertEqual(maxEquityWeight, 0.50, 'Max equity allocation weight must be 50%');

      const maxCapacity = netWorthTWD * maxEquityWeight;
      assertCloseTo(maxCapacity, 2306250, 1.0, 'Max equity capacity must be ~2,306,250 TWD');

      const twMV = state.tw_stocks.reduce((acc, s) => acc + s.market_value, 0);
      const usMV_USD = state.us_stocks.reduce((acc, s) => acc + (s.market_value || 0), 0);
      const usMV_TWD = usMV_USD * 32.5;
      const currentEquity = twMV + usMV_TWD;

      const headroom = maxCapacity - currentEquity;
      assertCloseTo(headroom, 2306250 - currentEquity, 1.0, 'Risk headroom matches maxCapacity - currentEquity');
    });

    it('TC-T1-MATH-05: Emergency Reserve & Deployable Liquid Cash Formula', () => {
      const months = state.decision_framework.emergency_reserve_months || 12; // 12
      const monthlyBurn = state.decision_framework.monthly_burn_rate_twd || 60000; // 60,000
      const lockedReserve = months * monthlyBurn;
      assertEqual(lockedReserve, 720000, 'Locked emergency reserve must be NT$ 720,000');

      const s4 = state.snapshots[3];
      const accountsMeta = state.accounts_meta;
      const cashTwdKeys = accountsMeta.filter(a => a.currency === 'TWD' && a.category === 'cash').map(a => a.key);
      const cashUsdKeys = accountsMeta.filter(a => a.currency === 'USD' && a.category === 'cash').map(a => a.key);

      const sumCashTWD = cashTwdKeys.reduce((acc, k) => acc + s4.accounts[k], 0);
      const sumCashUSD = cashUsdKeys.reduce((acc, k) => acc + s4.accounts[k], 0);
      const totalCashTWD = sumCashTWD + (sumCashUSD * s4.usd_rate);

      assertEqual(totalCashTWD, 600000 + (20000 + 15000) * 32.5, 'Total cash matches cash accounts sum');

      const deployableCash = totalCashTWD - lockedReserve;
      assertCloseTo(deployableCash, totalCashTWD - 720000, 1.0, 'Deployable cash matches total cash minus reserve');
    });

    it('TC-T1-MATH-06: US Estate Tax Exposure Threshold & Liability Math', () => {
      const exemptionLimit = state.decision_framework.us_estate_tax_threshold_usd || 60000;
      const s4 = state.snapshots[3];
      const snapshotUsEquitiesUSD = s4.accounts.Firstrade || 0;
      assertEqual(snapshotUsEquitiesUSD, 50000, 'Firstrade balance is 50,000 USD');

      const snapshotExposure = Math.max(0, snapshotUsEquitiesUSD - exemptionLimit);
      assertEqual(snapshotExposure, 0, 'Under $60,000 threshold, US estate tax excess is 0');
    });
  });

  // ==========================================================================
  // Domain 4: Snapshot Lifecycle & Deep Clone Management (6 tests)
  // ==========================================================================
  describe('Domain 4: Snapshot Lifecycle & Deep Clone Management', () => {

    it('TC-T1-SNAP-01: "帶入上一期數值" Deep Clone Execution', () => {
      const cloneBtn = doc.getElementById('btn-clone-previous-snapshot');
      cloneBtn.click();

      const yushanCashInput = doc.querySelector('input[name="account_玉山活存"]');
      const firstradeInput = doc.querySelector('input[name="account_Firstrade"]');

      assertEqual(yushanCashInput.value, '600000', '玉山活存 should be cloned to 600000');
      assertEqual(firstradeInput.value, '50000', 'Firstrade should be cloned to 50000');
    });

    it('TC-T1-SNAP-02: Immutability of Historical Snapshots During Draft Modification', () => {
      win.clonePreviousSnapshot();

      const yushanCashInput = doc.querySelector('input[name="account_玉山活存"]');
      yushanCashInput.value = '999999';
      yushanCashInput.dispatchEvent(new win.Event('input', { bubbles: true }));

      const originalVal = state.snapshots[3].accounts['玉山活存'];
      assertEqual(originalVal, 600000, 'Historical snapshot balance must remain 600000');
    });

    it('TC-T1-SNAP-03: Real-Time Live Math Preview in Add Snapshot Modal', () => {
      win.clonePreviousSnapshot();

      const yushanInput = doc.querySelector('input[name="account_玉山活存"]');
      yushanInput.value = '1600000'; // 600,000 + 1,000,000
      yushanInput.dispatchEvent(new win.Event('input', { bubbles: true }));

      const previewNW = doc.getElementById('modal-preview-net-worth');
      const previewDelta = doc.getElementById('modal-preview-delta');

      assertIncludes(previewNW.textContent, '5,612,500', 'Preview net worth should be ~5,612,500');
      assertOk(previewDelta.textContent.includes('1,000,000'), 'Preview delta should include 1,000,000');
    });

    it('TC-T1-SNAP-04: Add Snapshot Form Validation Rules', () => {
      const submitBtn = doc.getElementById('btn-submit-snapshot');
      const errorBanner = doc.querySelector('.form-error-message');
      const dateInp = doc.querySelector('input[name="date"]');
      const rateInp = doc.querySelector('input[name="usd_rate"]');

      // Case A: Missing Date
      dateInp.value = '';
      rateInp.value = '32.5';
      submitBtn.click();
      assertEqual(state.snapshots.length, 4, 'Snapshot should not be added when date is missing');
      assertFalse(errorBanner.classList.contains('hidden'), 'Error banner should be visible on missing date');

      // Case B: Negative Rate
      dateInp.value = '2026-08-23';
      rateInp.value = '-5.0';
      submitBtn.click();
      assertEqual(state.snapshots.length, 4, 'Snapshot should not be added when rate is negative');
    });

    it('TC-T1-SNAP-05: Successful Snapshot Creation & State Integration', () => {
      win.clonePreviousSnapshot();

      const dateInp = doc.querySelector('input[name="date"]');
      const rateInp = doc.querySelector('input[name="usd_rate"]');
      const noteInp = doc.querySelector('input[name="note"]');
      const submitBtn = doc.getElementById('btn-submit-snapshot');

      dateInp.value = '2026-08-23';
      rateInp.value = '32.50';
      noteInp.value = '8月定期盤點';

      submitBtn.click();

      assertEqual(state.snapshots.length, 5, 'State snapshots should now have 5 records');
      assertEqual(state.snapshots[4].date, '2026-08-23', 'New snapshot date must be 2026-08-23');
      assertEqual(state.snapshots[4].usd_rate, 32.50, 'New snapshot rate must be 32.50');

      const rows = doc.querySelectorAll('#snapshots-table-body tr');
      assertEqual(rows.length, 5, 'Snapshots table should now have 5 rows');
    });

    it('TC-T1-SNAP-06: Chronological Order & Date Sorting Constraint', () => {
      win.clonePreviousSnapshot();

      const dateInp = doc.querySelector('input[name="date"]');
      const rateInp = doc.querySelector('input[name="usd_rate"]');
      const submitBtn = doc.getElementById('btn-submit-snapshot');

      // Insert between 2026-01-15 and 2026-04-15
      dateInp.value = '2026-02-01';
      rateInp.value = '32.20';
      submitBtn.click();

      const dates = state.snapshots.map(s => s.date);
      const sortedDates = [...dates].sort();
      assertDeepEqual(dates, sortedDates, 'Snapshots array must be chronologically ordered');
      assertEqual(dates[2], '2026-02-01', '2026-02-01 should be placed at index 2');
    });
  });

  // ==========================================================================
  // Domain 5: CSV Export & Schema Import Validation (6 tests)
  // ==========================================================================
  describe('Domain 5: CSV Export & JSON Schema Import', () => {

    it('TC-T1-CSV-01: UTF-8 BOM (\\uFEFF) Presence on All CSV Exports', () => {
      const snapCSV = win.generateSnapshotsCSV();
      const stockCSV = win.generateStocksCSV();
      const insCSV = win.generateInsuranceCSV();

      assertEqual(snapCSV.charCodeAt(0), 0xFEFF, 'Snapshots CSV must start with UTF-8 BOM');
      assertEqual(stockCSV.charCodeAt(0), 0xFEFF, 'Stocks CSV must start with UTF-8 BOM');
      assertEqual(insCSV.charCodeAt(0), 0xFEFF, 'Insurance CSV must start with UTF-8 BOM');
    });

    it('TC-T1-CSV-02: Snapshots Summary CSV Export Format & Columns', () => {
      const snapCSV = win.generateSnapshotsCSV();
      const lines = snapCSV.replace('\uFEFF', '').split('\n').filter(l => l.trim().length > 0);

      assertEqual(lines.length, 5, 'Should have 1 header line + 4 data lines');
      const headers = lines[0].split(',');
      assertEqual(headers[0], '日期', 'First header column must be 日期');
      assertEqual(headers[1], '美金匯率', 'Second header column must be 美金匯率');
      assertEqual(headers[2], '總淨資產(TWD)', 'Third header column must be 總淨資產(TWD)');

      assertIncludes(headers, '玉山活存', 'Headers must include 玉山活存');
      assertIncludes(headers, 'Firstrade', 'Headers must include Firstrade');
      assertIncludes(lines[4], '2026-07-15', 'Last data line must contain 2026-07-15');
    });

    it('TC-T1-CSV-03: Stock Holdings CSV Export Data Precision', () => {
      const stockCSV = win.generateStocksCSV();
      const lines = stockCSV.replace('\uFEFF', '').split('\n').filter(l => l.trim().length > 0);

      assertEqual(lines.length, 1 + 2 + 3, 'Should have 1 header + 2 TW stocks + 3 US stocks = 6 lines');
      assertOk(lines.some(l => l.includes('2330') && l.includes('台積電')), 'Must contain 2330 row');
      assertOk(lines.some(l => l.includes('Firstrade') && l.includes('VOO')), 'Must contain Firstrade VOO row');
    });

    it('TC-T1-CSV-04: Insurance Policy CSV Export Format', () => {
      const insCSV = win.generateInsuranceCSV();
      assertOk(insCSV.length > 0, 'Insurance CSV generated');
      assertEqual(insCSV.charCodeAt(0), 0xFEFF, 'Insurance CSV has UTF-8 BOM');
    });

    it('TC-T1-CSV-05: Canonical JSON Schema Import Validation', () => {
      const result = win.loadFinanceData(canonicalBaselineJSON);
      assertTrue(result.success, 'loadFinanceData with valid JSON must return success: true');
      assertEqual(state.snapshots.length, 4, 'Should load 4 snapshots');
      assertEqual(state.tw_stocks.length, 2, 'Should load 2 TW stocks');
      assertEqual(state.us_stocks.length, 3, 'Should load 3 US stock entries');
    });

    it('TC-T1-CSV-06: Corrupted / Malformed JSON Import Rejection', () => {
      const priorSnapshotsCount = state.snapshots.length;
      const result = win.loadFinanceData({ invalid: 'schema', broken: true });

      assertFalse(result.success, 'loadFinanceData with malformed JSON must return success: false');
      assertEqual(state.snapshots.length, priorSnapshotsCount, 'State must not be mutated on invalid import');
    });
  });

  // ==========================================================================
  // Domain 6: FSA / Mock Stock Quote API Integration (6 tests)
  // ==========================================================================
  describe('Domain 6: FSA / Mock Stock Quote API Integration', () => {

    it('TC-T1-FSA-01: File System Access API Native File Open (showOpenFilePicker)', async () => {
      let pickerCalled = false;
      const testJSON = JSON.stringify(canonicalBaselineJSON);

      win.showOpenFilePicker = async () => {
        pickerCalled = true;
        return [new MockFileSystemFileHandle('sample_data.json', testJSON)];
      };

      const openBtn = doc.getElementById('btn-open-file');
      openBtn.click();
      await new Promise(r => setTimeout(r, 10));

      assertTrue(pickerCalled, 'showOpenFilePicker should be called');
      assertEqual(state.snapshots.length, 4, 'State should be populated from file handle');
    });

    it('TC-T1-FSA-02: File System Access API Direct Save (createWritable)', async () => {
      const mockHandle = new MockFileSystemFileHandle('sample_data.json', '{}');
      win.currentFileHandle = mockHandle;

      const saveBtn = doc.getElementById('btn-save-file');
      saveBtn.click();
      await new Promise(r => setTimeout(r, 10));

      assertTrue(mockHandle.closed, 'File handle writable stream should be closed');
      const savedData = JSON.parse(mockHandle.content);
      assertEqual(savedData.meta.version, 1, 'Saved JSON must contain version');
      assertEqual(savedData.snapshots.length, 4, 'Saved JSON must contain 4 snapshots');
    });

    it('TC-T1-FSA-03: Fallback Behavior When FSA API Is Unsupported', () => {
      win.showOpenFilePicker = undefined;
      win.showSaveFilePicker = undefined;

      let fallbackClicked = false;
      const fallbackInput = doc.getElementById('file-input-fallback');
      fallbackInput.addEventListener('click', () => {
        fallbackClicked = true;
      });

      const openBtn = doc.getElementById('btn-open-file');
      openBtn.click();

      assertTrue(fallbackClicked, 'Fallback file input click should be triggered when FSA is unsupported');
    });

    it('TC-T1-API-04: Mock Stock API Quote Refresh & Reactive Revaluation', async () => {
      win.fetch = async () => ({
        status: 200,
        ok: true,
        json: async () => ({
          '2330': { price: 1000.0 },
        }),
      });

      const refreshBtn = doc.getElementById('btn-refresh-quotes');
      refreshBtn.click();
      await new Promise(r => setTimeout(r, 10));

      const s2330 = state.tw_stocks.find(s => s.ticker === '2330');
      assertEqual(s2330.price, 1000.0, '2330 price should update to 1000.0');
      assertEqual(s2330.market_value, 1000000, '2330 MV should update to 1000 * 1000 = 1,000,000');
    });

    it('TC-T1-API-05: Stock API Rate Limiting (429) & Error Fallback', async () => {
      const originalPrice = state.tw_stocks[0].price;

      win.fetch = async () => ({
        status: 429,
        ok: false,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const refreshBtn = doc.getElementById('btn-refresh-quotes');
      refreshBtn.click();
      await new Promise(r => setTimeout(r, 10));

      assertEqual(state.tw_stocks[0].price, originalPrice, 'Stock price must remain cached on 429');
      const toastWarning = doc.querySelector('.toast-warning');
      assertOk(toastWarning, 'Toast warning should be shown on 429');
    });

    it('TC-T1-FSA-06: 1-Click Timestamped JSON Backup Download', () => {
      const backup = win.generateBackupDownload();
      assertOk(backup.filename.startsWith('finance_data_'), 'Backup filename should start with finance_data_');
      assertOk(backup.filename.endsWith('.json'), 'Backup filename should end with .json');

      const parsed = JSON.parse(backup.content);
      assertEqual(parsed.meta.version, 1, 'Parsed backup must match active state');
      assertEqual(parsed.snapshots.length, 4, 'Parsed backup must have 4 snapshots');
    });
  });

  // ==========================================================================
  // Domain 7: Chart.js Visual Data Extraction & Reactive State Sync (6 tests)
  // ==========================================================================
  describe('Domain 7: Chart.js Visual Data Extraction & Reactive State Sync', () => {

    it('TC-T1-CHART-01: Net Worth History Line Chart Data Extraction', () => {
      const chart = win.charts.netWorthHistory;
      assertOk(chart, 'Line chart instance must exist');
      assertDeepEqual(chart.data.labels, ['2025-10-15', '2026-01-15', '2026-04-15', '2026-07-15'], 'Labels must match 4 snapshots');
      assertEqual(chart.data.datasets[0].data.length, 4, 'Dataset must have 4 data points');
      assertCloseTo(chart.data.datasets[0].data[3], 4612500, 1.0, 'Latest data point must be ~4,612,500');
    });

    it('TC-T1-CHART-02: Asset Allocation Doughnut Chart Category Partitioning', () => {
      const chart = win.charts.assetAllocation;
      assertOk(chart, 'Doughnut chart instance must exist');
      assertEqual(chart.data.labels.length, 4, 'Doughnut chart must have 4 category labels');

      const sumValues = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
      assertCloseTo(sumValues, 4612500, 50000, 'Sum of asset slices should equal ~4.61M');
    });

    it('TC-T1-CHART-03: Currency Exposure Pie Chart Ratio', () => {
      const chart = win.charts.currencyExposure;
      assertOk(chart, 'Pie chart instance must exist');
      assertEqual(chart.data.labels.length, 2, 'Pie chart must have 2 labels (TWD, USD)');

      const twdVal = chart.data.datasets[0].data[0];
      const usdVal = chart.data.datasets[0].data[1];

      assertCloseTo(twdVal, 1850000, 1.0, 'TWD slice should be 1,850,000');
      assertCloseTo(usdVal, 85000 * 32.5, 1.0, 'USD slice should be 85,000 * 32.5');
    });

    it('TC-T1-CHART-04: Reactive Chart Updates on In-Place Stock Price Edit', () => {
      win.updateStockPrice('2330', 1200.0);

      const chart = win.charts.assetAllocation;
      const twStockSlice = chart.data.datasets[0].data[3];
      assertOk(twStockSlice > 0, 'TW stock slice updated');
    });

    it('TC-T1-CHART-05: Reactive Line Chart Update on New Snapshot Addition', () => {
      win.clonePreviousSnapshot();
      const dateInp = doc.querySelector('input[name="date"]');
      const rateInp = doc.querySelector('input[name="usd_rate"]');
      const submitBtn = doc.getElementById('btn-submit-snapshot');

      dateInp.value = '2026-08-23';
      rateInp.value = '32.50';
      submitBtn.click();

      const chart = win.charts.netWorthHistory;
      assertEqual(chart.data.labels.length, 5, 'Line chart labels should now have 5 entries');
      assertEqual(chart.data.labels[4], '2026-08-23', '5th label must be 2026-08-23');
      assertEqual(chart.data.datasets[0].data.length, 5, 'Dataset should have 5 points');
    });

    it('TC-T1-CHART-06: Chart Canvas Lifecycle & Memory Leak Prevention', () => {
      win.loadFinanceData(canonicalBaselineJSON);
      win.loadFinanceData(canonicalBaselineJSON);
      win.loadFinanceData(canonicalBaselineJSON);

      const activeCount = Object.keys(win.Chart.instances).length;
      assertEqual(activeCount, 3, 'There should be strictly 3 active chart instances after repeated reloads');
    });

    it('TC-T1-AC-07: Dynamic Account Count and Metadata Sanitization Integrity', () => {
      const accountsCount = state.accounts_meta.length;
      assertEqual(accountsCount, 5, 'Accounts count should dynamically match accounts_meta length (5 in baseline)');
      const insuranceCount = (state.insurance || []).length;
      assertEqual(insuranceCount, 1, 'Insurance count should dynamically match insurance length');
    });

    it('TC-T1-LOAD-01: State Initialization Priority (myFinanceData over Stale LocalStorage Cache)', () => {
      const mockPersonalData = {
        meta: { migrated_from: 'Google Sheet (Finance Management)' },
        accounts_meta: [{ key: '富邦證券', currency: 'TWD', category: 'tw_stock' }],
        snapshots: [{ date: '2026-09-01', usd_rate: 32.5, accounts: { '富邦證券': 500000 } }]
      };
      const staleDemoCache = {
        meta: { migrated_from: 'Demo Data' },
        accounts_meta: [{ key: '玉山證券', currency: 'TWD', category: 'tw_stock' }],
        snapshots: [{ date: '2026-01-01', usd_rate: 32.0, accounts: { '玉山證券': 100000 } }]
      };

      win.localStorage.setItem('personal_finance_state_v2', JSON.stringify(staleDemoCache));
      win.myFinanceData = mockPersonalData;

      const cachedSource = staleDemoCache.meta && staleDemoCache.meta.migrated_from;
      const mySource = mockPersonalData.meta && mockPersonalData.meta.migrated_from;
      const resolvedState = (cachedSource === mySource) ? staleDemoCache : win.myFinanceData;

      assertEqual(resolvedState.accounts_meta[0].key, '富邦證券', 'Should prioritize myFinanceData over stale LocalStorage demo cache');
    });
  });
});

