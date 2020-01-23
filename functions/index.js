const functions = require('firebase-functions');
var admin = require("firebase-admin");
const fetch = require("node-fetch");
const UUID = require("uuid-v4");
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser');

const api = express()
api.use(bodyParser.urlencoded({
  extended: false
}));
api.use(bodyParser.json());
// Automatically allow cross-origin requests
api.use(cors({
  origin: ['chrome-extension://dmfldfkgdnpkjcmckjgjpmkklgkchjde', 'chrome-extension://daknnihhlokbjjmliaadjiaiejbdblch', 'https://www.facebook.com', 'https://www.messenger.com']
}))

var serviceAccount = require("./key.json");

const {
  filesUpload
} = require('./middleware');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "btlweb-dev.appspot.com"
});

const firestore = admin.firestore()

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

api.post('/set_data', async (req, res) => {
  req.body = JSON.parse(req.body);
  [source, from, to, imgUrl, username, history, iddoc] = [req.body.source, req.body.from, req.body.to, req.body.imgUrl, req.body.username, req.body.history, req.body.iddoc]
  history = history || [];
  (!history.includes(imgUrl) && imgUrl !== '') ? history.push(imgUrl): '';
  const docRef = iddoc && iddoc !== '' ? firestore.collection(source).doc(iddoc) : firestore.collection(source).doc()
  docRef.set({
    refer: from + ',' + to,
    current_bg_img: imgUrl,
    history_bg: history,
    username
  }).then(() => {
    res.status(200).json('saved')
  }).catch(err => {
    console.log(err);
    res.status(500).json(err);
  })
})

// const get = (col) => {
//   return new Promise(r => {
//     firestore.collection(col)
//     // .where('username', '==', 'Nhọn Huynh')
//     .get().then(async docs => {
//       let data = []
//       if (docs.size > 0) {
//         docs.forEach(doc => {
//           let obj = doc.data();
//           obj.id = doc.id;
//           data.push(obj);
//         })
//       }
//       r(data);
//     })
//   })
// }

// const updateLink = (col, doc, data) => {
//   return new Promise(r=>{
//     firestore.collection(col).doc(doc).update(data).then(()=>r('ok'))
//   })
// }

// api.post('/test_upload', async (req, res) => {
//   const datas = await get('messengerBG');
//   let index = 1;
//   console.log(datas.length);
//   await asyncForEach(datas, async data => {
//     let check = 'background-image-for-fb-inbox.appspot.com';
//     let imgUrl = data.imgUrl;
//     if (imgUrl.includes(check)) {
//       let newImgUrl = await uploadFromLink(imgUrl);
//       if(newImgUrl) {
//         imgUrl = newImgUrl
//       }
//     }
//     let history = data.history;
//     await asyncForEach(data.history, async item=>{
//       if(item.includes(check)) {
//         let newURL = await uploadFromLink(item);
//         if(newURL) {
//           const ind = history.indexOf(item);
//           history[ind] = newURL;
//         }
//       }
//     })
//     let done = await updateLink('messengerBG', data.id, {current_bg_img: imgUrl, history_bg: history})
//     console.log(done, index);
//     index++;
//   })
//   console.log('done');
// })

const uploadFromLink = ( link) => {
  return new Promise((r, j) => {
    let uuid = UUID();
    const fileName = Math.floor(Math.random() * 100).toString() + '_' + (new Date()).getTime();
    const file = admin.storage().bucket().file(fileName);
    fetch(link).then((resp) => {
      const writeStream = file.createWriteStream({
        metadata: {
          contentType: 'image/png',
          metadata: {
            firebaseStorageDownloadTokens: uuid
          }
        }
      })
      resp.body.pipe(writeStream);
      const url = "https://firebasestorage.googleapis.com/v0/b/" + "btlweb-dev.appspot.com" + "/o/" + encodeURIComponent(fileName) + "?alt=media&token=" + uuid;
      r(url);
    }).catch(err => {
      console.log(err);
      j()
    });
  })
}

api.post('/upload', filesUpload, function (req, res) {
  // will contain all text fields 
  // will contain an array of file objects
  /*
    {
      fieldname: 'image',       String - name of the field used in the form
      originalname,             String - original filename of the uploaded image
      encoding,                 String - encoding of the image (e.g. "7bit")
      mimetype,                 String - MIME type of the file (e.g. "image/jpeg")
      buffer,                   Buffer - buffer containing binary data
      size,                     Number - size of buffer in bytes
    }
  */
  const fileName = (new Date()).getTime().toString() + '_' + req.files[0].originalname;
  const fileBuffer = req.files[0];
  const file = admin.storage().bucket().file(fileName);
  file.save(fileBuffer.buffer, {
    contentType: fileBuffer.mimetype,
    gzip: true,
    public: true
  }).then(() => {
    res.status(200).json(`https://storage.googleapis.com/btlweb-dev.appspot.com/${fileName}`)
  }).catch((err) => console.log(err));

  // res.send(req.files[0].buffer)
})



api.get('/get_data/:col', async (req, res) => {

  const [ids, col] = [req.query.ids.split(','), req.params.col];

  const queryRef = (swept) => {
    return firestore.collection(col).where('refer', '==', (swept ? ids : ids.reverse()).toString())
  }

  queryRef(true).get().then(docs1 => {
    if (docs1.size === 0) {
      queryRef().get().then(docs2 => {
        getData(docs2)
      })
    } else {
      getData(docs1)
    }
  })

  const getData = (docs) => {
    let data = {};

    if (docs.size > 0) {
      docs.length = 1;
      docs.forEach(doc => {
        data = doc.data();
        data.history = data.history_bg || data.history;
        data.imgUrl = data.current_bg_img || data.imgUrl
        data.id = doc.id;
      })
    }

    res.status(200).json(data)
  }

})


exports.api = functions.https.onRequest(api)