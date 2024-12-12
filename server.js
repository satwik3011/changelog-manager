const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/run-scraper', async (req, res) => {
  try {
    // Run the scraper
    execSync('node scraper.js', {
      cwd: path.join(__dirname),
      stdio: 'inherit'
    });

    res.json({ success: true, message: 'Scraper completed successfully' });
  } catch (error) {
    console.error('Error running scraper:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});