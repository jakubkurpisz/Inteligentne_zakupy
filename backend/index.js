const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { spawn } = require('child_process');
const path = require('path');
const app = express();
const port = 3001; // Port dla backendu

const DATABASE_FILE = path.join(__dirname, '..\\', 'product_states.db'); // Ścieżka do bazy danych SQLite
const PYTHON_SCRIPT = path.join(__dirname, '..\\', 'product_data_manager.py'); // Ścieżka do skryptu Pythona

// Funkcja do uruchamiania skryptu Pythona
function runPythonScript() {
    console.log(`Uruchamiam skrypt Pythona: ${PYTHON_SCRIPT}`);
    const pythonProcess = spawn('python', [PYTHON_SCRIPT]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Skrypt Pythona zakończył działanie z kodem: ${code}`);
        if (code !== 0) {
            console.error('Błąd podczas uruchamiania skryptu Pythona. Sprawdź logi.');
        }
    });
}

// Uruchom skrypt Pythona raz przy starcie serwera i co 5 minut
runPythonScript();
setInterval(runPythonScript, 5 * 60 * 1000); // Co 5 minut

// Middleware do parsowania JSON
app.use(express.json());

// Dodaj CORS, aby frontend mógł się łączyć
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Zmień na domenę frontendu w produkcji
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Endpoint do pobierania danych sprzedażowych z SQLite
app.get('/api/sales-data', (req, res) => {
    const db = new sqlite3.Database(DATABASE_FILE, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('Błąd połączenia z bazą danych SQLite:', err.message);
            return res.status(500).json({ error: 'Nie udało się połączyć z bazą danych.', details: err.message });
        }
    });

    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            console.error('Błąd podczas pobierania danych z SQLite:', err.message);
            return res.status(500).json({ error: 'Nie udało się pobrać danych z produktów.', details: err.message });
        }
        res.json(rows);
    });

    db.close((err) => {
        if (err) {
            console.error('Błąd podczas zamykania połączenia z bazą danych SQLite:', err.message);
        }
    });
});

// Endpoint do pobierania zagregowanych danych sprzedażowych
app.get('/api/sales-summary', (req, res) => {
    const db = new sqlite3.Database(DATABASE_FILE, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('Błąd połączenia z bazą danych SQLite:', err.message);
            return res.status(500).json({ error: 'Nie udało się połączyć z bazą danych.', details: err.message });
        }
    });

    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            console.error('Błąd podczas pobierania danych z SQLite dla podsumowania:', err.message);
            return res.status(500).json({ error: 'Nie udało się pobrać danych dla podsumowania.', details: err.message });
        }

        const salesData = rows.map(row => ({
            ...row,
            DataSprzedazy: row.DataSprzedazy ? new Date(row.DataSprzedazy) : null,
            WartoscNetto: parseFloat(row.DetalicznaNetto || 0),
            WartoscBrutto: parseFloat(row.DetalicznaBrutto || 0),
            IloscSprzedana: parseFloat(row.Stan || 0), // Używamy Stan jako IloscSprzedana dla podsumowania
        })).filter(row => row.DataSprzedazy !== null);

        const summary = {
            daily: {},
            weekly: {},
            monthly: {},
            yearly: {},
        };

        salesData.forEach(item => {
            const date = item.DataSprzedazy;
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // Miesiące są od 0-11
            const day = date.getDate();
            const week = getWeekNumber(date); // Funkcja pomocnicza do numeru tygodnia

            // Agregacja dzienna
            const dailyKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            if (!summary.daily[dailyKey]) {
                summary.daily[dailyKey] = { date: dailyKey, totalNetto: 0, totalBrutto: 0, totalQuantity: 0 };
            }
            summary.daily[dailyKey].totalNetto += item.WartoscNetto;
            summary.daily[dailyKey].totalBrutto += item.WartoscBrutto;
            summary.daily[dailyKey].totalQuantity += item.IloscSprzedana;

            // Agregacja tygodniowa
            const weeklyKey = `${year}-W${week.toString().padStart(2, '0')}`;
            if (!summary.weekly[weeklyKey]) {
                summary.weekly[weeklyKey] = { week: weeklyKey, totalNetto: 0, totalBrutto: 0, totalQuantity: 0 };
            }
            summary.weekly[weeklyKey].totalNetto += item.WartoscNetto;
            summary.weekly[weeklyKey].totalBrutto += item.WartoscBrutto;
            summary.weekly[weeklyKey].totalQuantity += item.IloscSprzedana;

            // Agregacja miesięczna
            const monthlyKey = `${year}-${month.toString().padStart(2, '0')}`;
            if (!summary.monthly[monthlyKey]) {
                summary.monthly[monthlyKey] = { month: monthlyKey, totalNetto: 0, totalBrutto: 0, totalQuantity: 0 };
            }
            summary.monthly[monthlyKey].totalNetto += item.WartoscNetto;
            summary.monthly[monthlyKey].totalBrutto += item.WartoscBrutto;
            summary.monthly[monthlyKey].totalQuantity += item.IloscSprzedana;

            // Agregacja roczna
            const yearlyKey = `${year}`;
            if (!summary.yearly[yearlyKey]) {
                summary.yearly[yearlyKey] = { year: yearlyKey, totalNetto: 0, totalBrutto: 0, totalQuantity: 0 };
            }
            summary.yearly[yearlyKey].totalNetto += item.WartoscNetto;
            summary.yearly[yearlyKey].totalBrutto += item.WartoscBrutto;
            summary.yearly[yearlyKey].totalQuantity += item.IloscSprzedana;
        });

        // Konwersja obiektów na tablice i sortowanie
        const sortedDaily = Object.values(summary.daily).sort((a, b) => a.date.localeCompare(b.date));
        const sortedWeekly = Object.values(summary.weekly).sort((a, b) => a.week.localeCompare(b.week));
        const sortedMonthly = Object.values(summary.monthly).sort((a, b) => a.month.localeCompare(b.month));
        const sortedYearly = Object.values(summary.yearly).sort((a, b) => a.year.localeCompare(b.year));

        res.json({
            daily: sortedDaily,
            weekly: sortedWeekly,
            monthly: sortedMonthly,
            yearly: sortedYearly,
        });
    });

    db.close((err) => {
        if (err) {
            console.error('Błąd podczas zamykania połączenia z bazą danych SQLite:', err.message);
        }
    });
});

// Funkcja pomocnicza do obliczania numeru tygodnia (ISO 8601)
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// Uruchom serwer
app.listen(port, () => {
    console.log(`Backend API działa na http://localhost:${port}`);
    console.log(`Dane pobierane z bazy danych SQLite: ${DATABASE_FILE}`);
});

