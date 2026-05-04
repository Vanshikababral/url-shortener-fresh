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
  console.log("Shortening URL:", url);
  
  // 1. Strict Protocol Check (Required by FCC)
  const urlRegex = /^(http|https):\/\//i;
  if (!urlRegex.test(url)) {
    return res.json({ error: 'invalid url' });
  }

  // 2. Parse hostname for DNS lookup
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    return res.json({ error: 'invalid url' });
  }
  
  dns.lookup(hostname, async (err, address) => {
    if (err || !address) {
      return res.json({ error: 'invalid url' });
    } else {
      try {
        // 3. Check if URL already exists
        const existingUrl = await urls.findOne({ url: url });
        if (existingUrl) {
          return res.json({ original_url: url, short_url: existingUrl.short_url });
        }

        // 4. Create new entry (starting at 1)
        const urlCount = await urls.countDocuments({});
        const nextId = urlCount + 1;
        
        const urlDoc = {
          url,
          short_url: nextId
        };

        await urls.insertOne(urlDoc);
        res.json({ original_url: url, short_url: nextId });
      } catch (dbErr) {
        console.error(dbErr);
        res.status(500).json({ error: 'database error' });
      }
    }
  });
});

// GET /api/shorturl/:short_url
app.get("/api/shorturl/:short_url", async (req, res) => {
  const shorturl = req.params.short_url;
  console.log("Requested redirection for ID:", shorturl);

  try {
    const urlDoc = await urls.findOne({ short_url: +shorturl });
    if (urlDoc) {
      return res.redirect(urlDoc.url);
    } else {
      return res.json({ error: 'No short URL found for the given input' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Connect to MongoDB and then start server
async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    
    app.listen(port, function() {
      console.log(`Listening on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
  }
}

startServer();