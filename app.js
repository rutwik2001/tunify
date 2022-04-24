//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })
const fs = require('fs')
const util = require('util')
const unlinkFile = util.promisify(fs.unlink)
const bcrypt = require("bcrypt");
const passport = require("passport")
const LocalStrategy = require("passport-local").Strategy
const flash = require("express-flash")
const session = require("express-session")
var crypto = require("crypto");
var moment = require('moment'); // require
moment().format();

const { uploadFile, getFileStream } = require('./s3')

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use("/public", express.static('public'))
app.use(flash())
app.use(session({
  secret: "123",
  resave: false,
 saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
let _currentUser_ = {}
app.use(async (req, res, next) => {
  if(await Creator.findOne({_id: req.user}) !== null){
    await Creator.findOne({_id: req.user}, function(err, currentUser){
      _currentUser_ = currentUser;
      console.log(_currentUser_.numId)
    }).clone()
  } 

console.log("outside:" + _currentUser_);
  next();
})
 


mongoose.connect("mongodb+srv://admin:gGR5zJWOMww0gBqh@cluster0.ibvrm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", {useNewUrlParser: true});

const db = mongoose.connection
db.on("error", console.error.bind(console, "Not Connected"))
db.once("open", () => {
  console.log("Mongoose connection established...")
})

const creatorSchema = {
  numId: { type: Number, unique: true },
  name: String,
  dob: String,
  artistName: {
      type: String,
      unique: true
  },
  email: {
      type: String,
      unique: true
  },
  phone: {
      type: String,
      unique: true
  },
  password: {type: String}
};
const Creator = mongoose.model("Creator", creatorSchema);



const songSchema = {
    numId: { type: Number, default: 0 },
    name: String,
    location: {
      type: String,
      unique: true
  },
    likes: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
    albumId: { type: Number, required: true}
}

const Song = mongoose.model("Song", songSchema);

const albumSchema = {
    numId: { type: Number, default: 0 },
  creatorId: {
      type: Number,
  },
    name: String,
    likes: { type: Number, default: 0 }
}

const Album = mongoose.model("Album", albumSchema);



// const postSchema = {
//   title: String,
//   content: String
// };



// app.get("/", function(req, res){

//   Post.find({}, function(err, posts){
//     res.render("home", {
//       startingContent: homeStartingContent,
//       posts: posts
//       });
//   });
// });


passport.use(new LocalStrategy({ usernameField: 'email' },
  async function(email = req.body.email, password = req.body.password, done) {
    
    if(await Creator.findOne({email: email}) !== null){
      Creator.findOne({ email: email }, async (err, user) => {
        if (user == null) {
          
          return done(null, false, { message: 'No creator with that email' })
        }

        
          try {
            
            if (await bcrypt.compare(password, user.password)) {
              console.log("yes p")
              console.log(user.id)
              console.log(user)
              
              return done(null, user)
              
            } else {
              console.log("no p")
              return done(null, false, { message: 'Password incorrect' })
            }
          } catch (e) {
            return done(e)
          }
          


        })
    } 


            
            passport.serializeUser((user, done) => done(null,user.id))
            passport.deserializeUser((user, done) => {
              return done(null, user)
          });


  }
));

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}

app.get("/login", checkNotAuthenticated, (req,res) => {
  res.render("login.ejs")
})


app.post("/login", checkNotAuthenticated, passport.authenticate("local",{
  successRedirect: `/creator` ,
  failureRedirect: "/login",
  failureFlash: true
}))

app.delete("/logout", (req, res) => {
  req.logOut()
  res.redirect('/login')
})
app.get("/", function(req, res){
  
  Song.find({}, function(err, songs){
    Album.find({}, function(err, albums){
      res.render("home", {
      songs: songs,
      albums: albums,
      });
    })
    
  });
  
});


app.get("/newCreator", checkNotAuthenticated,function(req, res){
  res.render("newCreator");
});

app.post("/newCreator",checkNotAuthenticated, async function(req, res){
  
  try{
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    const countOfCreators = await Creator.find({});
    const creator = new Creator({
    numId: countOfCreators.length + 1,
    name: req.body.name,
    dob: req.body.dob,
    artistName: req.body.artistName,
    email: req.body.email,
    phone: req.body.phone,
    password: hashedPassword
  });

  await creator.save();
  res.redirect(`/login`);
  } catch(err){
    console.log(err.message);
  }
});



app.get("/creator", checkAuthenticated,async function(req, res){
  
  try {
    console.log(_currentUser_)
    const creatorId = _currentUser_.numId;
    await Creator.findOne({numId: creatorId}, async function(err, creator){
      await Album.find({creatorId: creatorId}, function(err, albums){
        res.render("creatorProfile", {
      creator: creator,
      albums: albums,
      
      });
      }).clone()
    
  }).clone();
  } catch(err){
    console.log(err.message)
  }
  
});

app.get("/albums", async function(req, res){
  try{
    await Album.find({}, function(err, albums){
        res.render("albums", {
      albums: albums,
      });
      })
  } catch(err){
    console.log(err)
  }
})

app.get("/creator/:creatorId", async function(req, res){
  
  try {
    const creatorId = req.params.creatorId;
    await Creator.findOne({numId: creatorId}, async function(err, creator){
      await Album.find({creatorId: creatorId}, function(err, albums){
        res.render("showProfile", {
      creator: creator,
      albums: albums,
      });
      })
    
  });
  } catch(err){
    console.log(err.message)
  }
  
});



app.get("/creator/:creatorId/newAlbum",checkAuthenticated, async function(req, res){
  
  const creatorId = req.params.creatorId; 
  res.render("newAlbum", {
    creatorId: creatorId,
  });
});

app.post("/creator/:creatorId/newAlbum",checkAuthenticated, async function(req, res){
  const creatorId = req.params.creatorId;

  try{
    const countOfAlbums = await Album.find({});
    const album = new Album({
    numId: countOfAlbums.length + 1,
    name: req.body.name,
    creatorId: creatorId
  });

  await album.save();
  res.redirect(`/album/${countOfAlbums.length + 1}`)
  } catch(err){
    console.log(err.message)
  }
  
});

app.get("/album/:albumId", async function(req, res){
  
  try {
    const albumId = req.params.albumId;
    await Album.findOne({numId: albumId}, async function(err, album){
      await Creator.findOne({numId: album.creatorId}, async function(err, creator){
        await Song.find({albumId: albumId}, async function(err, songs){
          res.render("album", {
      album: album,
      creator: creator,
      songs: songs,
      });
        })
        
      })
    
  });
  } catch(err){
    console.log(err.message)
  }
  
});


app.get("/album/:albumId/newSong",checkAuthenticated, function(req, res){
  
  const albumId = req.params.albumId
  res.render("newSong",{
    albumId: albumId,
  });
});

app.post("/album/:albumId/newSong",upload.single('target_file'),checkAuthenticated, async function(req, res){
  try{
  const albumId = req.params.albumId;

  let file = req.file;
  console.log(file);

  const result = await uploadFile(file)
  await unlinkFile(file.path)
  console.log(result)
  

  const location = result.Key //AWS S3
  const countOfSongs = await Song.find({});
  const song = new Song({
    numId: countOfSongs.length + 1,
    name: req.body.name,
    location: location,
    albumId: albumId
  });

  await song.save();
  // Album.songs.push(countOfSongs.length)
  // Album.updateOne({numId: albumId}, {$push: {
  //   songs: countOfSongs.length
  // }})
  Album.updateOne(
  { numId: albumId }, 
  { $addToSet: { songs: countOfSongs.length } }
);
  res.redirect(`/songs/${countOfSongs.length + 1}`)
  } catch(err){
    console.log(err.message)
  }

  
});

app.get("/songs/:songId", async function(req, res){
  
  const songId = req.params.songId
  try {
    
    await Song.findOne({numId: songId}, function(err, song){
    res.render("song", {
      song: song,
      });
  });
  } catch(err){
    console.log(err.message)
  }
});

app.get('/song/:key', (req, res) => {
  console.log(req.params)
  const key = req.params.key
  const readStream = getFileStream(key)

  readStream.pipe(res)
})


app.get("/search", (req, res) => {
  
  res.render("search", {
    songs: [],
  });
  
})

app.post("/search", async (req, res) => {
  const query = req.body.query;
  try {
    
    await Song.find({"name" : {$regex : query }}, function(err, songs){
      console.log(songs)
    res.render("search", {
    songs: songs
  });
  });
  } catch(err){
    console.log(err.message)
  }
})




// app.get("/playlist/:playlistId/addSong", function(req, res){
//   const playlistId = req.params.playlistId
//   res.render("addSong",{
//     playlistId: playlistId
//   });
// });

// app.post("/playlist/:playlistId/addSong", async function(req, res){
//   const userId = req.params.userId;

//   try{
//     const countOfPlaylists = await Playlist.find({});
//     const playlist = new Playlist({
//     numId: countOfPlaylists.length + 1,
//     name: req.body.name,
//     userId: userId
//   });

//   await playlist.save();
//   res.redirect(`/playlist/${countOfPlaylists.length + 1}`)
//   } catch(err){
//     console.log(err.message)
//   }
  

// });



// app.get("/posts/:postId", function(req, res){

// const requestedPostId = req.params.postId;

//   Post.findOne({_id: requestedPostId}, function(err, post){
//     res.render("post", {
//       title: post.title,
//       content: post.content
//     });
//   });

// });

// app.get("/about", function(req, res){
//   res.render("about", {aboutContent: aboutContent});
// });

// app.get("/contact", function(req, res){
//   res.render("contact", {contactContent: contactContent});
// });


const port = process.env.PORT || 3000
app.listen(port, function() {
  console.log("Server started on port 3000");
});