require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient } = require('mongodb');
const dns = require('dns');
const urlparser = require('url');

// Basic Configuration
const port = process.env.PORT || 3000;

// Setup MongoDB Client
const client = new MongoClient(process.env.MONGO_URI);
const db = client.db("urlshortener");
const urls = db.collection("urls");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// POST /api/shorturl
app.post('/api/shorturl', function(req, res) {
  const url = req.body.url;
  
  // Parse hostname for DNS lookup
  const hostname = urlparser.parse(url).hostname;
  
  if (!hostname) {
    return res.json({ error: 'invalid url' });
  }

  dns.lookup(hostname, async (err, address) => {
    if (!address) {
      res.json({ error: 'invalid url' });
    } else {
      try {
        const urlCount = await urls.countDocuments({});
        const urlDoc = {
          url,
          short_url: urlCount
        };

        const result = await urls.insertOne(urlDoc);
        console.log("URL Saved:", result);
        res.json({ original_url: url, short_url: urlCount });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'database error' });
      }
    }
  });
});

// GET /api/shorturl/:short_url
app.get("/api/shorturl/:short_url", async (req, res) => {
  const shorturl = req.params.short_url;
  console.log("Requested short_url:", shorturl);

  try {
    const urlDoc = await urls.findOne({ short_url: +shorturl });
    if (urlDoc) {
      res.redirect(urlDoc.url);
    } else {
      res.json({ error: 'No short URL found for the given input' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});