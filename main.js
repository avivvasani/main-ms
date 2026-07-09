const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs'); // Filesystem module to handle silent overwrites

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

// --- NEW BACKGROUND SAVING HANDLER ---
// Intercepts the plain JSON string from index.html and rewrites it silently
ipcMain.handle('write-portfolio-background', async (event, { userId, jsonString }) => {
  try {
    // Defines a dedicated storage folder inside the OS user data directory
    const saveDirectory = path.join(app.getPath('userData'), 'Portfolios');
    
    // Ensure the target folder path exists cleanly
    if (!fs.existsSync(saveDirectory)) {
        fs.mkdirSync(saveDirectory, { recursive: true });
    }

    // Saved with a .json extension for plain readability
    const fileName = `${userId}_portfolio.json`;
    const filePath = path.join(saveDirectory, fileName);
    
    // Overwrite the persistent target file cleanly with no browser prompts
    fs.writeFileSync(filePath, jsonString, 'utf8');
    
    console.log(`[AUTOMATION] Plain JSON portfolio silently saved at: ${filePath}`);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('[AUTOMATION ERROR] Failed plain text background write:', error);
    return { success: false, error: error.message };
  }
});

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
  chartWindow.webContents.on('will-prevent-unload', (unloadEvent) => {
    unloadEvent.preventDefault(); 
  });

  chartWindow.on('close', (closeEvent) => {
    if (chartWindow) {
      chartWindow.destroy(); 
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
      activeChartWindows[symbol].destroy(); 
    }
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
