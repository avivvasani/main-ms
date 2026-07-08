const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;
const activeChartWindows = {};

app.commandLine.appendSwitch('ignore-certificate-errors');

function createWindow() {
  win = new BrowserWindow({ 
    width: 1920, 
    height: 1080,
    icon: path.join(__dirname, 'assets/icon.png'), 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html'); 
}

ipcMain.on('open-chart-window', (event, symbol) => {
  const upperSymbol = symbol.toUpperCase();

  if (activeChartWindows[upperSymbol]) {
    activeChartWindows[upperSymbol].focus();
    return;
  }

  let chartWindow = new BrowserWindow({
    width: 1200, 
    height: 800,
    title: `Live Chart - ${upperSymbol}`,
    icon: path.join(__dirname, 'assets/icon.png'), 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: `persist:chart-${upperSymbol}` 
    }
  });

  activeChartWindows[upperSymbol] = chartWindow;
  
  const chartUrl = `https://www.tradingview.com/chart/?symbol=NSE:${upperSymbol}&theme=light`;
  chartWindow.loadURL(chartUrl);

  // --- FORCE CLOSE GUARANTEE START ---
  // 1. Intercept beforeunload events to prevent the webpage script from blocking the close action
  chartWindow.webContents.on('will-prevent-unload', (unloadEvent) => {
    unloadEvent.preventDefault(); 
  });

  // 2. Clear out any custom close prevention scripts running inside the page context
  chartWindow.on('close', (closeEvent) => {
    if (chartWindow) {
      chartWindow.destroy(); // Hard kills the window frame instantly, ignoring page blocks
    }
  });
  // --- FORCE CLOSE GUARANTEE END ---

  chartWindow.on('closed', () => {
    delete activeChartWindows[upperSymbol];
  });
});

ipcMain.on('close-all-charts', () => {
  Object.keys(activeChartWindows).forEach((symbol) => {
    if (activeChartWindows[symbol] && !activeChartWindows[symbol].isDestroyed()) {
      // Force destroy active windows to bypass page blocks
      activeChartWindows[symbol].destroy(); 
    }
  });
});

app.whenReady().then(createWindow);

// Keep the global quit routine, but ensure it only triggers if the main app window is target-closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});