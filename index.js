require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const mongoose = require('mongoose');
const { URL } = require('url');

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// URL Schema
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true }
});

const Url = mongoose.model('Url', urlSchema);

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// API Endpoints

// POST /api/shorturl
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;

  // 1. Basic format check
  try {
    const urlObj = new URL(originalUrl);
    
    // Only allow http and https
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return res.json({ error: 'invalid url' });
    }

    // 2. DNS Lookup check
    dns.lookup(urlObj.hostname, async (err) => {
      if (err) {
        return res.json({ error: 'invalid url' });
      }

      try {
        // 3. Check if already exists
        let findOne = await Url.findOne({ original_url: originalUrl });
        if (findOne) {
          return res.json({
            original_url: findOne.original_url,
            short_url: findOne.short_url
          });
        }

        // 4. Create new entry
        // Get the current max short_url
        const lastUrl = await Url.findOne().sort({ short_url: -1 });
        const nextShortUrl = lastUrl ? lastUrl.short_url + 1 : 1;

        const newUrl = new Url({
          original_url: originalUrl,
          short_url: nextShortUrl
        });

        await newUrl.save();
        res.json({
          original_url: originalUrl,
          short_url: nextShortUrl
        });

      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'server error' });
      }
    });

  } catch (err) {
    // URL constructor throws if URL is invalid
    return res.json({ error: 'invalid url' });
  }
});

// GET /api/shorturl/:short_url
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = req.params.short_url;
  console.log("Requested short_url:", shortUrl); // Debug log for FCC tests

  try {
    // Find the original URL
    const urlData = await Url.findOne({ short_url: Number(shortUrl) });

    if (urlData) {
      // Redirect to original URL
      return res.redirect(urlData.original_url);
    } else {
      return res.json({ error: 'No short URL found for the given input' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
