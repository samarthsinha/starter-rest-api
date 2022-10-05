'use strict';
process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err);
});
const express = require('express')
const app = express()
const db = require('cyclic-dynamodb')
const https = require('https');

app.use(function (req, res, next) {
  var domains = process.env.CORS_DOMAIN
  var allowedDomains = domains.split(',');
  var origin = req.headers.origin;
  if(allowedDomains.indexOf(origin) > -1){
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Accept');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
})
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

async function post(url, data) {
  const dataString = JSON.stringify(data)
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': dataString.length,
    },
    timeout: 1000, // in ms
  }

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        return reject(new Error(`HTTP status code ${res.statusCode}`))
      }
      const body = []
      res.on('data', (chunk) => body.push(chunk))
      res.on('end', () => {
        const resString = Buffer.concat(body).toString()
        resolve(resString)
      })
    })
    req.on('error', (err) => {
      reject(err)
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request time out'))
    })
    req.write(dataString)
    req.end()
  })
}

// #############################################################################
// This configures static hosting for files in /public that have the extensions
// listed in the array.
// var options = {
//   dotfiles: 'ignore',
//   etag: false,
//   extensions: ['htm', 'html','css','js','ico','jpg','jpeg','png','svg'],
//   index: ['index.html'],
//   maxAge: '1m',
//   redirect: false
// }
// app.use(express.static('public', options))
// #############################################################################

// Create or Update an item
app.post('/:col/:key', async (req, res) => {
  console.log(req.body)

  const col = req.params.col
  const key = req.params.key
  console.log(`from collection: ${col} delete key: ${key} with params ${JSON.stringify(req.params)}`)
  const item = await db.collection(col).set(key, req.body)
  console.log(JSON.stringify(item, null, 2))
  res.json(item).end()
})

// Delete an item
app.delete('/:col/:key', async (req, res) => {
  const col = req.params.col
  const key = req.params.key
  console.log(`from collection: ${col} delete key: ${key} with params ${JSON.stringify(req.params)}`)
  const item = await db.collection(col).delete(key)
  console.log(JSON.stringify(item, null, 2))
  res.json(item).end()
})

// Get a single item
app.get('/:col/:key', async (req, res) => {
  const col = req.params.col
  const key = req.params.key
  console.log(`from collection: ${col} get key: ${key} with params ${JSON.stringify(req.params)}`)
  const item = await db.collection(col).get(key)
  console.log(JSON.stringify(item, null, 2))
  res.json(item).end()
})

// Get a full listing
app.get('/:col', async (req, res) => {
  const col = req.params.col
  console.log(`list collection: ${col} with params: ${JSON.stringify(req.params)}`)
  const items = await db.collection(col).list()
  console.log(JSON.stringify(items, null, 2))
  res.json(items).end()
})

app.post('/appointments', async(req,res)=>{
    var telegramBody = {
        "chat_id":`${process.env.TG_CHANNEL_CHAT_ID}`,
        "text":`Hi ${req.body.patient_name} (${req.body.mobile} - ${req.body.email}) has requested an appointment on
        ${req.body.preferred_date} ${req.body.preferred_time_slot} for ${req.body.appointment_for}.`,
        "parse_mode":"Markdown"
    }
    var tg_send_msg_url=`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`;
    try{
        var resp = await post(tg_send_msg_url,telegramBody);
        res.json({"status":`${JSON.parse(resp).ok ? "200":"400"}`}).end()
    }catch(err){
         res.status(500).json({"status":"500", "message":"Appointment couldn't be forwarded."}).end();
    }
})

// Catch all handler for all other request.
app.use('*', (req, res) => {
  res.json({ msg: 'no route handler found' }).end()
})

// Start the server
const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`index.js listening on ${port}`)
})
